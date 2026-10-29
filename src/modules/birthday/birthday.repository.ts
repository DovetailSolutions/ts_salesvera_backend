import { QueryTypes, Transaction } from "sequelize";
import { sequelize, Announcement, AnnouncementRecipient } from "../../config/dbConnection";

// ============================================================
// Birthday repository — raw access only, no business logic (see
// birthday.service.ts). birthday_settings/birthday_runs use plain SQL
// because the idempotency/lease semantics (INSERT ... ON CONFLICT DO
// NOTHING, conditional lease UPDATE ... RETURNING) are the whole point of
// these tables and are clearer stated directly.
//
// Both tables hold two kinds of celebration (migration 0045): 'birthday'
// and 'anniversary' (work anniversary). Every function takes the kind and
// defaults to 'birthday'.
// ============================================================

export type CelebrationKind = "birthday" | "anniversary";

export interface BirthdaySettingsRow {
  companyId: number;
  kind: CelebrationKind;
  enabled: boolean;
  messageTemplate: string | null;
  pushEnabled: boolean;
  sendHour: number;
  updatedBy: number | null;
  updatedAt: Date | null;
}

export interface BirthdayRunRow {
  id: number;
  companyId: number;
  kind: CelebrationKind;
  birthdayDate: string;
  timezone: string;
  celebrantIds: number[];
  recipientIds: number[];
  announcementId: number | null;
  status: string;
  inAppStatus: string;
  inAppDelivered: number;
  inAppFailed: number;
  socketStatus: string;
  pushStatus: string;
  pushSuccess: number;
  pushFailure: number;
  pushInvalidTokens: number;
  attempts: number;
  lastError: string | null;
  leaseUntil: Date | null;
  processedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// DATE columns come back as "YYYY-MM-DD" strings from pg; keep them that way.
const normalizeRun = (row: any): BirthdayRunRow | null =>
  row ? { ...row, birthdayDate: String(row.birthdayDate).slice(0, 10) } : null;

export const getSettings = async (companyId: number, kind: CelebrationKind = "birthday"): Promise<BirthdaySettingsRow | null> => {
  const rows = await sequelize.query<BirthdaySettingsRow>(
    `SELECT * FROM "birthday_settings" WHERE "companyId" = :companyId AND "kind" = :kind`,
    { replacements: { companyId, kind }, type: QueryTypes.SELECT }
  );
  return rows[0] ?? null;
};

export const upsertSettings = async (s: {
  companyId: number;
  kind: CelebrationKind;
  enabled: boolean;
  messageTemplate: string | null;
  pushEnabled: boolean;
  sendHour: number;
  updatedBy: number;
}): Promise<BirthdaySettingsRow> => {
  const rows = await sequelize.query<BirthdaySettingsRow>(
    `INSERT INTO "birthday_settings" ("companyId","kind","enabled","messageTemplate","pushEnabled","sendHour","updatedBy","createdAt","updatedAt")
     VALUES (:companyId,:kind,:enabled,:messageTemplate,:pushEnabled,:sendHour,:updatedBy,NOW(),NOW())
     ON CONFLICT ("companyId","kind") DO UPDATE SET
       "enabled" = EXCLUDED."enabled",
       "messageTemplate" = EXCLUDED."messageTemplate",
       "pushEnabled" = EXCLUDED."pushEnabled",
       "sendHour" = EXCLUDED."sendHour",
       "updatedBy" = EXCLUDED."updatedBy",
       "updatedAt" = NOW()
     RETURNING *`,
    { replacements: s, type: QueryTypes.SELECT }
  );
  return rows[0];
};

export const listEnabledSettings = async (companyIds?: number[]): Promise<BirthdaySettingsRow[]> => {
  const filter = companyIds ? `AND "companyId" IN (:companyIds)` : "";
  if (companyIds && companyIds.length === 0) return [];
  return sequelize.query<BirthdaySettingsRow>(
    `SELECT * FROM "birthday_settings" WHERE "enabled" = TRUE ${filter} ORDER BY "companyId", "kind"`,
    { replacements: { companyIds: companyIds ?? [] }, type: QueryTypes.SELECT }
  );
};

export const findRun = async (companyId: number, birthdayDate: string, kind: CelebrationKind = "birthday"): Promise<BirthdayRunRow | null> => {
  const rows = await sequelize.query(
    `SELECT * FROM "birthday_runs" WHERE "companyId" = :companyId AND "kind" = :kind AND "birthdayDate" = :birthdayDate`,
    { replacements: { companyId, kind, birthdayDate }, type: QueryTypes.SELECT }
  );
  return normalizeRun(rows[0]);
};

// Claims the (company, kind, date) slot and takes the processing lease in one
// statement. Returns null when another tick/instance already claimed it.
export const claimRun = async (r: {
  companyId: number;
  kind: CelebrationKind;
  birthdayDate: string;
  timezone: string;
  celebrantIds: number[];
  recipientIds: number[];
  leaseSeconds: number;
}): Promise<BirthdayRunRow | null> => {
  const rows = await sequelize.query(
    `INSERT INTO "birthday_runs"
       ("companyId","kind","birthdayDate","timezone","celebrantIds","recipientIds","attempts","leaseUntil","createdAt","updatedAt")
     VALUES (:companyId,:kind,:birthdayDate,:timezone,CAST(:celebrantIds AS JSONB),CAST(:recipientIds AS JSONB),1,
             NOW() + (:leaseSeconds * INTERVAL '1 second'),NOW(),NOW())
     ON CONFLICT ("companyId","kind","birthdayDate") DO NOTHING
     RETURNING *`,
    {
      replacements: {
        ...r,
        celebrantIds: JSON.stringify(r.celebrantIds),
        recipientIds: JSON.stringify(r.recipientIds),
      },
      type: QueryTypes.SELECT,
    }
  );
  return normalizeRun(rows[0]);
};

// Takes the lease on an existing run for a retry — succeeds for exactly one
// caller while the lease is free/expired, and only below the attempt cap.
export const acquireLease = async (id: number, leaseSeconds: number, maxAttempts: number): Promise<BirthdayRunRow | null> => {
  const rows = await sequelize.query(
    `UPDATE "birthday_runs"
        SET "leaseUntil" = NOW() + (:leaseSeconds * INTERVAL '1 second'),
            "attempts" = "attempts" + 1,
            "updatedAt" = NOW()
      WHERE "id" = :id
        AND "attempts" < :maxAttempts
        AND ("leaseUntil" IS NULL OR "leaseUntil" < NOW())
      RETURNING *`,
    { replacements: { id, leaseSeconds, maxAttempts }, type: QueryTypes.SELECT }
  );
  return normalizeRun(rows[0]);
};

const RUN_UPDATABLE = new Set([
  "status", "inAppStatus", "inAppDelivered", "inAppFailed", "socketStatus", "pushStatus",
  "pushSuccess", "pushFailure", "pushInvalidTokens", "lastError", "leaseUntil", "processedAt",
]);

export const updateRun = async (id: number, fields: Partial<BirthdayRunRow>, tx?: Transaction) => {
  const keys = Object.keys(fields).filter((k) => RUN_UPDATABLE.has(k));
  if (keys.length === 0) return;
  const sets = keys.map((k) => `"${k}" = :${k}`).join(", ");
  await sequelize.query(`UPDATE "birthday_runs" SET ${sets}, "updatedAt" = NOW() WHERE "id" = :id`, {
    replacements: { ...fields, id },
    transaction: tx,
  });
};

// Publishes the announcement + its recipient rows and links it to the run in
// ONE transaction. The link is conditional on announcementId still being
// NULL, so a concurrent/duplicate attempt rolls back instead of publishing a
// second announcement.
export const publishAnnouncementForRun = async (
  runId: number,
  announcementData: { title: string; message: string; createdBy: number; creatorRole: string; companyId: number },
  recipientRows: Array<{ recipientId: number; recipientRole: string }>
): Promise<number> =>
  sequelize.transaction(async (tx) => {
    const announcement = await Announcement.create(
      { ...announcementData, priority: "normal", status: "published" } as any,
      { transaction: tx }
    );
    const now = new Date();
    await AnnouncementRecipient.bulkCreate(
      recipientRows.map((r) => ({
        announcementId: announcement.id,
        recipientId: r.recipientId,
        recipientRole: r.recipientRole,
        companyId: announcementData.companyId,
        deliveredAt: now,
      })) as any,
      { transaction: tx }
    );
    const [, affected] = (await sequelize.query(
      `UPDATE "birthday_runs" SET "announcementId" = :announcementId, "updatedAt" = NOW()
        WHERE "id" = :runId AND "announcementId" IS NULL`,
      { replacements: { announcementId: announcement.id, runId }, transaction: tx }
    )) as [unknown, any];
    if ((affected?.rowCount ?? affected) !== 1) {
      throw new Error("Celebration run already has an announcement — rolled back duplicate");
    }
    return announcement.id;
  });

// Receivers that already hold an in-app notification for this announcement —
// lets a retry deliver only to the ones still missing (no duplicates).
export const findNotifiedReceiverIds = async (announcementId: number, receiverIds: number[]): Promise<Set<number>> => {
  if (receiverIds.length === 0) return new Set();
  const rows = await sequelize.query<{ receiverId: number }>(
    `SELECT DISTINCT "receiverId" FROM "notifications"
      WHERE "type" = 'announcement' AND "receiverId" IN (:receiverIds)
        AND "data"->>'announcementId' = :announcementId`,
    { replacements: { receiverIds, announcementId: String(announcementId) }, type: QueryTypes.SELECT }
  );
  return new Set(rows.map((r) => Number(r.receiverId)));
};

export const listRuns = async (companyId: number, limit: number, kind: CelebrationKind = "birthday"): Promise<BirthdayRunRow[]> => {
  const rows = await sequelize.query(
    `SELECT * FROM "birthday_runs" WHERE "companyId" = :companyId AND "kind" = :kind ORDER BY "birthdayDate" DESC, "id" DESC LIMIT :limit`,
    { replacements: { companyId, kind, limit }, type: QueryTypes.SELECT }
  );
  return rows.map((r) => normalizeRun(r)!) ;
};
