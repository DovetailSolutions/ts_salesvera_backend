import { QueryTypes } from "sequelize";
import { sequelize, CompanyLeave, Company, User } from "../../config/dbConnection";
import { ServiceError } from "../shared/serviceError";
import { getISTDateString } from "../shared/dateUtils";
import { getCompanyScopedChildUserIds } from "../shared/userHierarchy";
import { resolveLeaveTypeBalance } from "../leave/leave.service";
import { loadOffDayChecker } from "../leave/leaveCharge";
import type { ResolvedPolicy } from "../attendancePolicy/attendancePolicy.service";

// ============================================================
// Comp-off: working a full day (P) on a weekly off or holiday earns 1 day of
// the company's "Comp Off" leave type, a half day (HD) 0.5 — when the
// attendance policy's compOff rule is on. Company settings decide the rest:
//   compOffMinHours         — days that can be earned per year (the field is
//                             labelled "Comp Off Days Allowed Per Year";
//                             it's also the Comp Off type's leavesPerYear)
//   compOffExpiryDays       — an earned day expires this many days after the
//                             day worked, if still unused (0 = never)
//   compOffApprovalRequired — earned days wait for a manager's approval
// Each worked day is one comp_off_credits row. The employee's Comp Off
// balance (allocated) is always recomputed from those rows — approved and
// expired days minus the part that expired unused — so it never drifts.
// ============================================================

const COMP_OFF_NAME = "comp off";
const DAY_MS = 24 * 60 * 60 * 1000;

const addDays = (ymd: string, n: number): string =>
  new Date(Date.parse(`${ymd}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);

const round2 = (n: number) => Math.round(n * 100) / 100;

const query = <T = any>(sql: string, replacements: Record<string, unknown> = {}): Promise<T[]> =>
  sequelize.query(sql, { replacements, type: QueryTypes.SELECT }) as Promise<T[]>;

// The company's Comp Off leave type — the row the company settings create
// (utils/leaveTypeSync.js on the frontend names it exactly "Comp Off").
export const findCompOffLeaveType = async (companyId: number): Promise<any | null> => {
  const types: any[] = await CompanyLeave.findAll({ where: { companyId }, order: [["id", "ASC"]] });
  return types.find((t) => String(t.leaveName || "").trim().toLowerCase() === COMP_OFF_NAME) ?? null;
};

// Comp Off balance = earned days that were approved, minus what expired
// unused. Pending / rejected / cancelled credits don't count.
export const syncCompOffBalance = async (employeeId: number, leaveType: any, year: number, actorId: number) => {
  const [row] = await query<{ earned: number }>(
    `SELECT COALESCE(SUM("days" - "expiredDays"), 0)::float AS earned
       FROM comp_off_credits
      WHERE "employeeId" = :employeeId AND "companyLeaveId" = :leaveTypeId AND "year" = :year
        AND "status" IN ('approved', 'expired')`,
    { employeeId, leaveTypeId: leaveType.id, year }
  );
  const balance: any = await resolveLeaveTypeBalance(employeeId, leaveType, year, actorId);
  balance.allocated = round2(Number(row?.earned) || 0);
  await balance.save();
  return balance;
};

const findCredit = async (employeeId: number, workDate: string) =>
  (await query(`SELECT * FROM comp_off_credits WHERE "employeeId" = :employeeId AND "workDate" = :workDate`, { employeeId, workDate }))[0] ?? null;

// Called after a day is classified (punch-out, auto punch-out, approved
// regularization). Creates, updates or cancels that day's credit. Never
// touches a credit a manager rejected or one that already expired.
export const recordCompOffForDay = async (params: {
  employeeId: number;
  companyId: number | null | undefined;
  date: string;
  policy: ResolvedPolicy;
  dayType: string | null;
}): Promise<any> => {
  const { employeeId, date, policy } = params;
  if (!policy.config.compOff?.enabled || !params.companyId) return null;
  const companyId = Number(params.companyId);

  const leaveType = await findCompOffLeaveType(companyId);
  if (!leaveType) return null; // no Comp Off type configured → nothing to credit

  const employee: any = await User.findByPk(employeeId, { attributes: ["id", "branchId"] });
  const isOffDay = await loadOffDayChecker(companyId, employee?.branchId, date, date);
  const worked = params.dayType === "full_day" ? 1 : params.dayType === "half_day" ? 0.5 : 0;
  let earned = isOffDay(date) ? worked : 0;

  const existing = await findCredit(employeeId, date);
  if (existing && (existing.status === "rejected" || existing.status === "expired")) return existing;
  if (!existing && earned === 0) return null;

  const company: any = await Company.findByPk(companyId, {
    attributes: ["id", "compOffMinHours", "compOffExpiryDays", "compOffApprovalRequired"],
  });
  const year = Number(date.slice(0, 4));

  // Yearly limit: what's already pending/approved on other days counts.
  let note = earned === 1 ? "Full day worked on a weekly off / holiday" : earned === 0.5 ? "Half day worked on a weekly off / holiday" : "No longer a full or half day on a weekly off / holiday";
  const yearlyLimit = Number(company?.compOffMinHours) || 0;
  if (earned > 0 && yearlyLimit > 0) {
    const [row] = await query<{ total: number }>(
      `SELECT COALESCE(SUM("days"), 0)::float AS total FROM comp_off_credits
        WHERE "employeeId" = :employeeId AND "companyLeaveId" = :leaveTypeId AND "year" = :year
          AND "status" IN ('pending', 'approved', 'expired') AND "workDate" <> :date`,
      { employeeId, leaveTypeId: leaveType.id, year, date }
    );
    const left = Math.max(0, yearlyLimit - (Number(row?.total) || 0));
    if (earned > left) {
      earned = left;
      note = `Limited by the yearly comp-off limit (${yearlyLimit} day${yearlyLimit === 1 ? "" : "s"})`;
    }
  }

  const expiryDays = Number(company?.compOffExpiryDays) || 0;
  const expiresOn = expiryDays > 0 ? addDays(date, expiryDays) : null;
  const initialStatus = company?.compOffApprovalRequired === false ? "approved" : "pending";

  if (!existing) {
    if (earned === 0) return null;
    const [inserted] = await query(
      `INSERT INTO comp_off_credits ("companyId","employeeId","companyLeaveId","workDate","year","days","status","expiresOn","note","createdAt","updatedAt")
       VALUES (:companyId,:employeeId,:leaveTypeId,:date,:year,:days,:status,:expiresOn,:note,NOW(),NOW())
       ON CONFLICT ("employeeId","workDate") DO NOTHING RETURNING *`,
      { companyId, employeeId, leaveTypeId: leaveType.id, date, year, days: earned, status: initialStatus, expiresOn, note }
    );
    if (inserted) {
      if (initialStatus === "approved") await syncCompOffBalance(employeeId, leaveType, year, employeeId);
      return inserted;
    }
    // Another request created it in the meantime — fall through and update it.
    return recordCompOffForDay(params);
  }

  let days = earned;
  let status = existing.status;
  if (status === "approved" && days < Number(existing.days)) {
    // Never take back more than is still unused — the balance can't go negative.
    const balance: any = await resolveLeaveTypeBalance(employeeId, leaveType, year, employeeId);
    const remaining = (Number(balance.allocated) || 0) + (Number(balance.carriedForward) || 0) - (Number(balance.used) || 0);
    days = Math.max(days, round2(Number(existing.days) - Math.max(0, remaining)));
  }
  if (days === 0) status = "cancelled";
  else if (status === "cancelled") status = initialStatus;

  if (days === Number(existing.days) && status === existing.status) return existing;
  const [updated] = await query(
    `UPDATE comp_off_credits SET "days" = :days, "status" = :status, "note" = :note, "updatedAt" = NOW()
      WHERE id = :id AND "status" = :oldStatus RETURNING *`,
    { id: existing.id, days, status, note, oldStatus: existing.status }
  );
  if (existing.status === "approved" || status === "approved") {
    await syncCompOffBalance(employeeId, leaveType, year, employeeId);
  }
  return updated ?? existing;
};

// ── Manager / admin API ──────────────────────────────────────────────────

export interface CompOffActor {
  userId: number;
  role: string;
  companyId: number | null;
}

const teamOf = async (actor: CompOffActor): Promise<{ companyId: number; ids: number[] }> => {
  if (!actor.companyId) throw new ServiceError("No active company is associated with your account", 403);
  const companyId = Number(actor.companyId);
  const ids = await getCompanyScopedChildUserIds(Number(actor.userId), companyId);
  return { companyId, ids: [...new Set([...ids.map(Number), Number(actor.userId)])] };
};

const STATUSES = ["pending", "approved", "rejected", "expired", "cancelled"];

export const listCompOff = async (actor: CompOffActor, q: any) => {
  const { companyId, ids } = await teamOf(actor);
  const status = STATUSES.includes(q?.status) ? q.status : null;
  const limit = Math.min(Math.max(Number(q?.limit) || 100, 1), 500);
  const rows = await query(
    `SELECT c.id, c."employeeId", c."workDate"::text AS "workDate", c.days, c.status, c."expiresOn"::text AS "expiresOn",
            c."expiredDays", c.note, c."reviewedAt", c."createdAt",
            TRIM(CONCAT(u."firstName", ' ', u."lastName")) AS "employeeName",
            TRIM(CONCAT(r."firstName", ' ', r."lastName")) AS "reviewedByName"
       FROM comp_off_credits c
       JOIN users u ON u.id = c."employeeId"
       LEFT JOIN users r ON r.id = c."reviewedBy"
      WHERE c."companyId" = :companyId AND c."employeeId" IN (:ids) ${status ? `AND c.status = :status` : ""}
      ORDER BY (c.status = 'pending') DESC, c."workDate" DESC, c.id DESC
      LIMIT :limit`,
    { companyId, ids, status, limit }
  );
  return { rows };
};

export const reviewCompOff = async (actor: CompOffActor, id: unknown, body: any) => {
  const decision = body?.status;
  if (decision !== "approved" && decision !== "rejected") throw new ServiceError("Status must be approved or rejected");
  const creditId = Number(id);
  if (!Number.isInteger(creditId) || creditId <= 0) throw new ServiceError("Invalid comp-off request");

  const { companyId, ids } = await teamOf(actor);
  const credit = (await query(`SELECT * FROM comp_off_credits WHERE id = :id AND "companyId" = :companyId`, { id: creditId, companyId }))[0];
  if (!credit || !ids.includes(Number(credit.employeeId))) throw new ServiceError("Comp-off request not found", 404);
  if (Number(credit.employeeId) === Number(actor.userId) && !["admin", "super_admin"].includes(actor.role)) {
    throw new ServiceError("You cannot approve your own comp-off", 403);
  }
  if (credit.status !== "pending") throw new ServiceError(`This comp-off is already ${credit.status}`);

  const note = typeof body?.note === "string" && body.note.trim() ? body.note.trim().slice(0, 255) : credit.note;
  const [updated] = await query(
    `UPDATE comp_off_credits SET "status" = :status, "reviewedBy" = :by, "reviewedAt" = NOW(), "note" = :note, "updatedAt" = NOW()
      WHERE id = :id AND "status" = 'pending' RETURNING *`,
    { id: creditId, status: decision, by: Number(actor.userId), note }
  );
  if (!updated) throw new ServiceError("This comp-off was just reviewed by someone else. Refresh and try again.", 409);

  if (decision === "approved") {
    const leaveType: any = await CompanyLeave.findByPk(credit.companyLeaveId);
    if (leaveType) await syncCompOffBalance(Number(credit.employeeId), leaveType, Number(credit.year), Number(actor.userId));
  }
  return updated;
};

// ── Daily expiry (config/cronJobs.ts) ────────────────────────────────────
// Expires approved credits whose expiry date has passed, oldest first. Comp
// Off days are used oldest-first, so the unused part of the oldest credit is
// whatever remains beyond the newer credits still in the balance.
export const expireCompOffCredits = async (today: string = getISTDateString()) => {
  const due = await query(
    `SELECT * FROM comp_off_credits WHERE "status" = 'approved' AND "expiresOn" < :today ORDER BY "employeeId", "workDate", id`,
    { today }
  );
  let expired = 0;
  for (const credit of due) {
    try {
      const leaveType: any = await CompanyLeave.findByPk(credit.companyLeaveId);
      if (!leaveType) continue;
      const employeeId = Number(credit.employeeId);
      const year = Number(credit.year);
      const balance: any = await resolveLeaveTypeBalance(employeeId, leaveType, year, employeeId);
      const remaining = (Number(balance.allocated) || 0) + (Number(balance.carriedForward) || 0) - (Number(balance.used) || 0);
      const [newer] = await query<{ total: number }>(
        `SELECT COALESCE(SUM("days" - "expiredDays"), 0)::float AS total FROM comp_off_credits
          WHERE "employeeId" = :employeeId AND "companyLeaveId" = :leaveTypeId AND "year" = :year
            AND "status" = 'approved' AND ("workDate" > :workDate OR ("workDate" = :workDate AND id > :id))`,
        { employeeId, leaveTypeId: leaveType.id, year, workDate: String(credit.workDate).slice(0, 10), id: credit.id }
      );
      const unused = round2(Math.max(0, Math.min(Number(credit.days), remaining - (Number(newer?.total) || 0))));
      const [updated] = await query(
        `UPDATE comp_off_credits SET "status" = 'expired', "expiredDays" = :unused, "updatedAt" = NOW()
          WHERE id = :id AND "status" = 'approved' RETURNING id`,
        { id: credit.id, unused }
      );
      if (!updated) continue; // another instance got there first
      await syncCompOffBalance(employeeId, leaveType, year, employeeId);
      expired++;
    } catch (err) {
      console.error(`Comp-off expiry failed for credit #${credit.id}:`, err);
    }
  }
  return { checked: due.length, expired };
};
