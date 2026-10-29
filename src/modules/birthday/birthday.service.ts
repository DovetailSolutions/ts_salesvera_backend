import { Op } from "sequelize";
import admin from "firebase-admin";
import { User, Company, Device, EmployeeExtraDetails } from "../../config/dbConnection";
import { ServiceError } from "../shared/serviceError";
import { hasCompanyAccess, resolveCompanyEmployeeIds } from "../shared/companyAccess";
import { collectUserCompanyIds } from "../shared/userHierarchy";
import { sendNotificationWithResult } from "../../config/notificationService";
import { sendPushNotification } from "../../config/Notification";
import { NotificationType } from "../../app/model/Notification";
import { emitAnnouncementCreated } from "../../Notigication/announcement";
import * as BirthdayRepo from "./birthday.repository";
import {
  DEFAULT_TEMPLATE,
  DEFAULT_ANNIVERSARY_TEMPLATE,
  SUPPORTED_PLACEHOLDERS,
  parseDob,
  isBirthdayOn,
  anniversaryYearsOn,
  yearsLabel,
  resolveTimezone,
  localDateParts,
  addDaysYmd,
  validateTemplate,
  joinNames,
  renderTemplate,
} from "./birthday.utils";

// ── Celebration kinds ────────────────────────────────────────────────────
// The same engine (settings, idempotent daily run, delivery audit) publishes
// birthdays and work anniversaries; only these details differ.
type Kind = BirthdayRepo.CelebrationKind;

const KINDS: Record<Kind, { title: string; defaultTemplate: string; notificationKind: string; noneReason: string }> = {
  birthday: {
    title: "🎂 Birthday Celebration",
    defaultTemplate: DEFAULT_TEMPLATE,
    notificationKind: "birthday",
    noneReason: "no_birthdays",
  },
  anniversary: {
    title: "🎊 Work Anniversary",
    defaultTemplate: DEFAULT_ANNIVERSARY_TEMPLATE,
    notificationKind: "work_anniversary",
    noneReason: "no_anniversaries",
  },
};

// Admin API "kind" parameter — omitted means birthday (the original API).
export const parseKind = (raw: unknown): Kind => {
  if (raw === undefined || raw === null || raw === "") return "birthday";
  if (raw === "birthday" || raw === "anniversary") return raw;
  throw new ServiceError("kind must be 'birthday' or 'anniversary'");
};

// employee_extra_details.dateOfJoining per user (YYYY-MM-DD).
const loadJoiningDates = async (userIds: number[]): Promise<Map<number, string>> => {
  if (userIds.length === 0) return new Map();
  const rows: any[] = await (EmployeeExtraDetails as any).findAll({
    where: { userId: { [Op.in]: userIds }, dateOfJoining: { [Op.ne]: null } },
    attributes: ["userId", "dateOfJoining"],
  });
  return new Map(rows.map((r) => [Number(r.userId), String(r.dateOfJoining).slice(0, 10)]));
};

// Who is celebrated on `ymd`, with their years for an anniversary.
const celebrantsOn = async (kind: Kind, members: any[], ymd: string): Promise<Array<{ id: number; years?: number }>> => {
  if (kind === "birthday") {
    return members
      .filter((m) => {
        const dob = parseDob(m.dob, ymd);
        return dob ? isBirthdayOn(dob, ymd) : false;
      })
      .map((m) => ({ id: Number(m.id) }));
  }
  const joined = await loadJoiningDates(members.map((m) => Number(m.id)));
  const out: Array<{ id: number; years: number }> = [];
  for (const m of members) {
    const date = parseDob(joined.get(Number(m.id)), ymd);
    const years = date ? anniversaryYearsOn(date, ymd) : null;
    if (years) out.push({ id: Number(m.id), years });
  }
  return out;
};

// Celebrants and recipients: managers and employees only. Admins and the
// tenant owner ("user") are deliberately not included — the feature's
// agreed audience is the company's managers + employees.
const ELIGIBLE_ROLES = ["manager", "employee"];
const LEASE_SECONDS = 300;
const MAX_ATTEMPTS = 3;
const PUSH_BATCH = 500;
const INVALID_TOKEN_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
  "messaging/invalid-argument",
]);
const displayName = (u: any) => [u.firstName, u.lastName].filter(Boolean).join(" ").trim() || "Team member";

// Error text for the audit row — message only (never the error object, which
// for Firebase/pg errors can carry request details), and bounded.
const errorText = (err: unknown) => String((err as any)?.message ?? err).slice(0, 500);

// ── Company membership ───────────────────────────────────────────────────
// Every active manager/employee who positively belongs to this company.
// Candidates come from the tenant (users.tenantId — populated for every
// manager/employee) plus the company's own manager junction and branches;
// each candidate's company is then resolved with collectUserCompanyIds (the
// same signal set the rest of the app uses). Unlike the team-listing helpers,
// this FAILS CLOSED for a company-wide broadcast: someone whose company can't
// be determined is only included when the tenant owns exactly one company
// (so there's no other company they could belong to).
export const resolveCompanyMembers = async (company: any): Promise<any[]> => {
  const companyId = Number(company.id);
  const { managerIds, salePersonIds } = await resolveCompanyEmployeeIds(companyId);

  const where: any = {
    role: { [Op.in]: ELIGIBLE_ROLES },
    status: "active",
    [Op.or]: [
      { id: { [Op.in]: [...managerIds, ...salePersonIds] } },
      ...(company.userId ? [{ tenantId: Number(company.userId) }] : []),
    ],
  };
  const candidates: any[] = await (User as any).findAll({
    where,
    attributes: ["id", "firstName", "lastName", "role", "dob"],
  });
  if (candidates.length === 0) return [];

  const [membership, ownedCount] = await Promise.all([
    collectUserCompanyIds(candidates.map((c) => Number(c.id))),
    company.userId ? (Company as any).count({ where: { userId: company.userId } }) : Promise.resolve(0),
  ]);
  await inheritCreatorCompanies(candidates.map((c) => Number(c.id)), membership);

  return candidates.filter((c) => {
    const companies = membership.get(Number(c.id));
    if (companies && companies.size > 0) return companies.has(companyId);
    return ownedCount === 1;
  });
};

// collectUserCompanyIds' own creator fallback skips any creator that is part
// of the same lookup batch (its `visited` guard), so an employee with no
// branch whose manager IS a candidate here — and is resolved by branch —
// stays indeterminate. Re-applies the same rule (inherit the creator's
// company only when the creator resolves to exactly ONE company) using the
// batch's own results, walking up a few levels for chains of unresolved
// accounts. Mutates `membership`. Kept local to this module on purpose: the
// shared helper feeds many fail-open team listings whose results would shift.
const MAX_CREATOR_LEVELS = 5;

const inheritCreatorCompanies = async (userIds: number[], membership: Map<number, Set<number>>) => {
  const isResolved = (id: number) => (membership.get(id)?.size ?? 0) > 0;
  let pending = userIds.filter((id) => !isResolved(id));

  for (let level = 0; pending.length > 0 && level < MAX_CREATOR_LEVELS; level++) {
    const rows: any[] = await (User as any).findAll({
      where: { id: { [Op.in]: pending } },
      attributes: ["id"],
      include: [{ model: User, as: "creators", attributes: ["id"], through: { attributes: [] } }],
    });
    const creatorOf = new Map<number, number>();
    rows.forEach((row: any) => {
      const creatorId = row.get({ plain: true })?.creators?.[0]?.id;
      if (creatorId != null) creatorOf.set(Number(row.id), Number(creatorId));
    });

    // Creators outside this batch: resolve them the normal way.
    const pendingSet = new Set(pending);
    const outside = Array.from(new Set(creatorOf.values())).filter((id) => !membership.has(id) && !pendingSet.has(id));
    if (outside.length) (await collectUserCompanyIds(outside)).forEach((v, k) => membership.set(k, v));

    let progressed = false;
    creatorOf.forEach((creatorId, userId) => {
      const companies = membership.get(creatorId);
      if (companies && companies.size === 1) {
        membership.set(userId, new Set(companies));
        progressed = true;
      }
    });
    if (!progressed) break;
    pending = pending.filter((id) => !isResolved(id));
  }
};

const loadCompany = (companyId: number) =>
  (Company as any).findByPk(companyId, { attributes: ["id", "companyName", "userId", "adminId", "timezone"] });

const isFirebaseConfigured = () => admin.apps.length > 0;

// ── Scheduled job ────────────────────────────────────────────────────────
// Called hourly by cronJobs.ts (and once shortly after startup). For each
// company with the feature enabled, once the company's local time reaches its
// send hour, publishes ONE combined announcement for that local date. Safe to
// call any number of times — see birthday_runs in migration 0039.
//
// `now` and `companyIds` exist for controlled testing (a test clock and a
// test-company scope); the cron passes neither.
let birthdayJobRunning = false;

export const runBirthdayJob = async (opts: { now?: Date; companyIds?: number[]; source?: string } = {}) => {
  if (birthdayJobRunning) return { skippedRun: true, results: [] as any[] };
  birthdayJobRunning = true;
  const now = opts.now ?? new Date();
  const results: any[] = [];
  try {
    const settingsList = await BirthdayRepo.listEnabledSettings(opts.companyIds);
    for (const settings of settingsList) {
      try {
        results.push({ companyId: settings.companyId, ...(await processCompany(settings, now)) });
      } catch (err) {
        console.error(`[CRON] ❌ Birthday job failed for company ${settings.companyId}: ${errorText(err)}`);
        results.push({ companyId: settings.companyId, outcome: "error", error: errorText(err) });
      }
    }
    const published = results.filter((r) => r.outcome === "processed");
    if (published.length) {
      console.log(`[CRON] 🎂 Birthday job (${opts.source ?? "cron"}) — processed ${published.length} company run(s).`);
    }
    return { skippedRun: false, results };
  } finally {
    birthdayJobRunning = false;
  }
};

const processCompany = async (settings: BirthdayRepo.BirthdaySettingsRow, now: Date) => {
  const kind: Kind = settings.kind ?? "birthday";
  const company = await loadCompany(settings.companyId);
  if (!company) return { kind, outcome: "skipped", reason: "company_not_found" };

  const timezone = resolveTimezone(company.timezone);
  const { ymd, hour } = localDateParts(now, timezone);
  if (hour < settings.sendHour) return { kind, outcome: "skipped", reason: "before_send_hour", date: ymd };

  let run = await BirthdayRepo.findRun(company.id, ymd, kind);

  if (!run) {
    const members = await resolveCompanyMembers(company);
    const celebrants = await celebrantsOn(kind, members, ymd);
    if (celebrants.length === 0) return { kind, outcome: "skipped", reason: KINDS[kind].noneReason, date: ymd };

    run = await BirthdayRepo.claimRun({
      companyId: company.id,
      kind,
      birthdayDate: ymd,
      timezone,
      celebrantIds: celebrants.map((c) => Number(c.id)),
      recipientIds: members.map((m) => Number(m.id)),
      leaseSeconds: LEASE_SECONDS,
    });
    // Lost the race to another tick/instance — it owns this date.
    if (!run) return { kind, outcome: "skipped", reason: "already_claimed", date: ymd };
  } else {
    if (!runNeedsWork(run)) return { kind, outcome: "skipped", reason: "already_processed", date: ymd, runId: run.id };
    run = await BirthdayRepo.acquireLease(run.id, LEASE_SECONDS, MAX_ATTEMPTS);
    if (!run) return { kind, outcome: "skipped", reason: "locked_or_attempts_exhausted", date: ymd };
  }

  await executeRun(run, company, settings);
  const final = await BirthdayRepo.findRun(company.id, ymd, kind);
  return { kind, outcome: "processed", date: ymd, runId: run.id, status: final?.status };
};

const runNeedsWork = (run: BirthdayRepo.BirthdayRunRow) =>
  run.attempts < MAX_ATTEMPTS &&
  (run.announcementId == null ||
    run.inAppStatus !== "done" ||
    run.socketStatus === "pending" ||
    run.pushStatus === "pending" ||
    run.pushStatus === "failed");

// Each channel is resumable on its own: the announcement is only ever
// published once (linked to the run inside the same transaction), in-app
// notifications skip receivers that already have one, the socket event is
// emitted once, and push is only retried when nothing was delivered.
const executeRun = async (run: BirthdayRepo.BirthdayRunRow, company: any, settings: BirthdayRepo.BirthdaySettingsRow) => {
  const errors: string[] = [];
  const recipientIds = (run.recipientIds ?? []).map(Number);
  const kind: Kind = run.kind ?? "birthday";
  const { title, defaultTemplate, notificationKind } = KINDS[kind];

  const celebrantUsers: any[] = await (User as any).findAll({
    where: { id: { [Op.in]: run.celebrantIds } },
    attributes: ["id", "firstName", "lastName"],
  });
  const byId = new Map(celebrantUsers.map((u) => [Number(u.id), u]));
  // Work anniversary: each name carries its years on this run's date.
  const joined = kind === "anniversary" ? await loadJoiningDates(run.celebrantIds.map(Number)) : new Map<number, string>();
  const labelOf = (u: any) => {
    if (kind !== "anniversary") return displayName(u);
    const date = parseDob(joined.get(Number(u.id)), run.birthdayDate);
    const years = date ? anniversaryYearsOn(date, run.birthdayDate) : null;
    return years ? `${displayName(u)} (${yearsLabel(years)})` : displayName(u);
  };
  const names = run.celebrantIds
    .map((id) => byId.get(Number(id)))
    .filter(Boolean)
    .map(labelOf)
    .sort((a, b) => a.localeCompare(b));

  let template = settings.messageTemplate || defaultTemplate;
  if (!validateTemplate(template).valid) {
    // Saved templates are validated on write, so this is only a guard
    // against a hand-edited row breaking the job.
    errors.push("Saved template invalid — default template used");
    template = defaultTemplate;
  }
  const message = renderTemplate(template, { name: joinNames(names), company: company.companyName ?? "SalesVera" });

  // A. Company announcement (feed + per-recipient read tracking/unread count)
  let announcementId = run.announcementId;
  if (announcementId == null) {
    try {
      const roles: any[] = await (User as any).findAll({ where: { id: { [Op.in]: recipientIds } }, attributes: ["id", "role"] });
      const creatorId = company.adminId ?? company.userId;
      announcementId = await BirthdayRepo.publishAnnouncementForRun(
        run.id,
        {
          title,
          message,
          createdBy: Number(creatorId),
          creatorRole: company.adminId ? "admin" : "user",
          companyId: Number(company.id),
        },
        roles.map((r) => ({ recipientId: Number(r.id), recipientRole: r.role }))
      );
    } catch (err) {
      errors.push(`announcement: ${errorText(err)}`);
      await BirthdayRepo.updateRun(run.id, {
        status: "failed",
        lastError: errors.join(" | "),
        leaseUntil: null,
        processedAt: new Date(),
      });
      return;
    }
  }

  const update: Partial<BirthdayRepo.BirthdayRunRow> = {};

  // B. In-app notifications (bell/drawer). sendNotificationWithResult also emits the
  // existing "notification" socket event to each receiver's room.
  if (run.inAppStatus !== "done") {
    let delivered = 0;
    let failed = 0;
    try {
      const already = await BirthdayRepo.findNotifiedReceiverIds(announcementId, recipientIds);
      delivered = already.size;
      for (const receiverId of recipientIds.filter((id) => !already.has(id))) {
        const n = await sendNotificationWithResult({
          receiverId,
          senderId: null,
          type: NotificationType.ANNOUNCEMENT,
          title,
          body: message,
          data: { announcementId: String(announcementId), kind: notificationKind },
          skipPush: true,
        });
        n ? delivered++ : failed++;
      }
    } catch (err) {
      errors.push(`inApp: ${errorText(err)}`);
      failed = recipientIds.length - delivered;
    }
    Object.assign(update, {
      inAppDelivered: delivered,
      inAppFailed: failed,
      inAppStatus: failed === 0 ? "done" : delivered > 0 ? "partial" : "failed",
    });
  }

  // C. Live Announcements-page update via the existing "announcementCreated"
  // event (best-effort; offline users get it from the DB on return).
  if (run.socketStatus === "pending") {
    try {
      emitAnnouncementCreated(recipientIds, { id: announcementId, title, message, createdAt: new Date().toISOString() });
      update.socketStatus = "emitted";
    } catch (err) {
      errors.push(`socket: ${errorText(err)}`);
      update.socketStatus = "failed";
    }
  }

  // D. Firebase push
  if (run.pushStatus === "pending" || run.pushStatus === "failed") {
    Object.assign(update, await deliverPush(recipientIds, title, message, announcementId, settings.pushEnabled, errors, notificationKind));
  }

  const inApp = update.inAppStatus ?? run.inAppStatus;
  const push = update.pushStatus ?? run.pushStatus;
  const ok = inApp === "done" && push !== "failed" && push !== "partial";
  await BirthdayRepo.updateRun(run.id, {
    ...update,
    status: ok ? "published" : "partial",
    lastError: errors.length ? errors.join(" | ") : null,
    leaseUntil: null,
    processedAt: new Date(),
  });
};

const deliverPush = async (
  recipientIds: number[],
  title: string,
  body: string,
  announcementId: number,
  pushEnabled: boolean,
  errors: string[],
  notificationKind: string
): Promise<Partial<BirthdayRepo.BirthdayRunRow>> => {
  if (!pushEnabled) return { pushStatus: "disabled" };
  if (!isFirebaseConfigured()) return { pushStatus: "not_configured" };

  const devices: any[] = await (Device as any).findAll({
    where: { userId: { [Op.in]: recipientIds }, isActive: true },
    attributes: ["deviceToken"],
  });
  const tokens = Array.from(new Set(devices.map((d) => d.deviceToken).filter(Boolean))) as string[];
  if (tokens.length === 0) return { pushStatus: "no_devices", pushSuccess: 0, pushFailure: 0 };

  let success = 0;
  let failure = 0;
  let invalid = 0;
  for (let i = 0; i < tokens.length; i += PUSH_BATCH) {
    const batch = tokens.slice(i, i + PUSH_BATCH);
    const result: any = await sendPushNotification({
      token: batch,
      title,
      body,
      data: { type: NotificationType.ANNOUNCEMENT, announcementId: String(announcementId), kind: notificationKind },
    });
    if (!result.success) {
      failure += batch.length;
      errors.push(`push: ${errorText(result.error)}`);
      continue;
    }
    success += result.response.successCount;
    failure += result.response.failureCount;
    result.response.responses.forEach((r: any) => {
      if (!r.success && INVALID_TOKEN_CODES.has(r.error?.code)) invalid++;
    });
  }
  if (invalid) errors.push(`push: ${invalid} invalid/expired device token(s)`);

  // "failed" (retryable) only when nothing was delivered and at least one
  // failure was not a dead token — a retry then can't double-notify anyone.
  // Dead tokens alone are not retried: they'd fail again.
  const pushStatus =
    failure === 0 ? "sent" : success > 0 ? "partial" : invalid === failure ? "invalid_tokens" : "failed";
  return { pushStatus, pushSuccess: success, pushFailure: failure, pushInvalidTokens: invalid };
};

// ── Admin panel API ──────────────────────────────────────────────────────
// Company scope: the caller's active company by default; an explicit
// companyId is honoured only if the caller has a real relationship to it
// (hasCompanyAccess) — so an admin can never read or change another
// company's settings.
export const resolveTargetCompany = async (userData: any, requestedCompanyId?: any) => {
  const callerId = Number(userData.userId);
  const role = String(userData.role);
  if (!["admin", "user"].includes(role)) throw new ServiceError("Only company admins can manage celebrations", 403);

  const companyId = requestedCompanyId != null && requestedCompanyId !== "" ? Number(requestedCompanyId) : userData.companyId;
  if (companyId == null || !Number.isInteger(Number(companyId))) {
    throw new ServiceError("No company context resolvable for this account", 400);
  }
  if (!(await hasCompanyAccess(Number(companyId), callerId, role))) {
    throw new ServiceError("You do not have access to this company", 403);
  }
  const company = await loadCompany(Number(companyId));
  if (!company) throw new ServiceError("Company not found", 404);
  return company;
};

const presentSettings = (company: any, row: BirthdayRepo.BirthdaySettingsRow | null, kind: Kind) => ({
  companyId: company.id,
  kind,
  enabled: row?.enabled ?? false,
  messageTemplate: row?.messageTemplate || KINDS[kind].defaultTemplate,
  pushEnabled: row?.pushEnabled ?? true,
  sendHour: row?.sendHour ?? 9,
  updatedAt: row?.updatedAt ?? null,
  timezone: resolveTimezone(company.timezone),
  defaultTemplate: KINDS[kind].defaultTemplate,
  title: KINDS[kind].title,
  supportedPlaceholders: SUPPORTED_PLACEHOLDERS.map((p) => `{{${p}}}`),
  pushConfigured: isFirebaseConfigured(),
});

export const getSettings = async (userData: any, query: any = {}) => {
  const kind = parseKind(query?.kind);
  const company = await resolveTargetCompany(userData, query?.companyId);
  return presentSettings(company, await BirthdayRepo.getSettings(company.id, kind), kind);
};

export const updateSettings = async (userData: any, body: any) => {
  const kind = parseKind(body?.kind);
  const company = await resolveTargetCompany(userData, body?.companyId);
  const current = await BirthdayRepo.getSettings(company.id, kind);

  const enabled = body?.enabled !== undefined ? body.enabled : current?.enabled ?? false;
  const pushEnabled = body?.pushEnabled !== undefined ? body.pushEnabled : current?.pushEnabled ?? true;
  const sendHour = body?.sendHour !== undefined ? Number(body.sendHour) : current?.sendHour ?? 9;
  if (typeof enabled !== "boolean") throw new ServiceError("enabled must be true or false");
  if (typeof pushEnabled !== "boolean") throw new ServiceError("pushEnabled must be true or false");
  if (!Number.isInteger(sendHour) || sendHour < 0 || sendHour > 23) throw new ServiceError("sendHour must be a whole hour between 0 and 23");

  let messageTemplate = body?.messageTemplate !== undefined ? body.messageTemplate : current?.messageTemplate ?? null;
  if (messageTemplate != null) {
    if (typeof messageTemplate !== "string") throw new ServiceError("messageTemplate must be text");
    messageTemplate = messageTemplate.trim();
    const { valid, errors } = validateTemplate(messageTemplate);
    if (!valid) throw new ServiceError(errors.join(". "), 400, { errors });
    // Storing the default verbatim as NULL keeps it following future default changes.
    if (messageTemplate === KINDS[kind].defaultTemplate) messageTemplate = null;
  }

  const row = await BirthdayRepo.upsertSettings({
    companyId: company.id,
    kind,
    enabled,
    messageTemplate,
    pushEnabled,
    sendHour,
    updatedBy: Number(userData.userId),
  });
  return presentSettings(company, row, kind);
};

export const previewTemplate = async (userData: any, body: any) => {
  const kind = parseKind(body?.kind);
  const company = await resolveTargetCompany(userData, body?.companyId);
  const template = body?.messageTemplate ?? KINDS[kind].defaultTemplate;
  const { valid, errors } = validateTemplate(template);
  const sampleNames = Array.isArray(body?.sampleNames) && body.sampleNames.length
    ? body.sampleNames.slice(0, 10).map((n: any) => String(n).slice(0, 100))
    : [kind === "anniversary" ? `Rahul (${yearsLabel(3)})` : "Rahul"];
  return {
    valid,
    errors,
    title: KINDS[kind].title,
    message: valid ? renderTemplate(template, { name: joinNames(sampleNames), company: company.companyName ?? "SalesVera" }) : null,
  };
};

// Today's and upcoming celebrations (company local date). Only day + month is
// returned — never the birth year or age. For a work anniversary, `years` is
// the anniversary being reached; `missingDob` then lists people with no valid
// date of joining (the field name is kept for the existing birthday API).
export const getBirthdays = async (userData: any, query: any) => {
  const kind = parseKind(query?.kind);
  const company = await resolveTargetCompany(userData, query?.companyId);
  const days = Math.min(90, Math.max(1, Number(query?.days) || 30));
  const timezone = resolveTimezone(company.timezone);
  const { ymd: today } = localDateParts(new Date(), timezone);

  const members = await resolveCompanyMembers(company);
  const joined = kind === "anniversary" ? await loadJoiningDates(members.map((m) => Number(m.id))) : null;
  const upcoming: any[] = [];
  const missingDob: any[] = [];
  for (const m of members) {
    const date = joined ? parseDob(joined.get(Number(m.id)), today) : parseDob(m.dob, today);
    if (!date) {
      missingDob.push({ userId: m.id, name: displayName(m), role: m.role });
      continue;
    }
    for (let i = 0; i <= days; i++) {
      const day = addDaysYmd(today, i);
      const years = joined ? anniversaryYearsOn(date, day) : null;
      if (joined ? years : isBirthdayOn(date, day)) {
        upcoming.push({
          userId: m.id,
          name: displayName(m),
          role: m.role,
          birthday: `${String(date.day).padStart(2, "0")}-${String(date.month).padStart(2, "0")}`,
          ...(years ? { years } : {}),
          nextDate: day,
          daysAway: i,
          isToday: i === 0,
        });
        break;
      }
    }
  }
  upcoming.sort((a, b) => a.daysAway - b.daysAway || a.name.localeCompare(b.name));
  return {
    kind,
    today,
    timezone,
    days,
    todays: upcoming.filter((u) => u.isToday),
    upcoming: upcoming.filter((u) => !u.isToday),
    missingDob,
  };
};

export const getRecentRuns = async (userData: any, query: any) => {
  const kind = parseKind(query?.kind);
  const company = await resolveTargetCompany(userData, query?.companyId);
  const limit = Math.min(30, Math.max(1, Number(query?.limit) || 10));
  const runs = await BirthdayRepo.listRuns(company.id, limit, kind);
  const ids = Array.from(new Set(runs.flatMap((r) => r.celebrantIds.map(Number))));
  const users: any[] = ids.length
    ? await (User as any).findAll({ where: { id: { [Op.in]: ids } }, attributes: ["id", "firstName", "lastName"] })
    : [];
  const nameById = new Map(users.map((u) => [Number(u.id), displayName(u)]));
  return runs.map((r) => ({
    id: r.id,
    kind: r.kind,
    birthdayDate: r.birthdayDate,
    timezone: r.timezone,
    celebrants: r.celebrantIds.map((id) => ({ userId: Number(id), name: nameById.get(Number(id)) ?? "Former member" })),
    recipientCount: r.recipientIds.length,
    announcementId: r.announcementId,
    status: r.status,
    inApp: { status: r.inAppStatus, delivered: r.inAppDelivered, failed: r.inAppFailed },
    socket: { status: r.socketStatus },
    push: { status: r.pushStatus, success: r.pushSuccess, failure: r.pushFailure, invalidTokens: r.pushInvalidTokens },
    attempts: r.attempts,
    lastError: r.lastError,
    processedAt: r.processedAt,
  }));
};
