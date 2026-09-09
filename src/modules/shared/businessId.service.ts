import { Sequelize, QueryTypes } from "sequelize";

// ============================================================
// Business ID generation — a human-readable, prefixed, tightly sequential
// identifier (e.g. "CMP001", "SAL014") kept SEPARATE from the database
// primary key (`id`), which continues to be the only thing used for
// foreign keys/joins/internal relationships. See migration
// 0018_business_id_system.ts for the `business_id_sequences` table and the
// existing-row backfill.
//
// Deliberately NOT "MAX(businessCode-suffix) + 1" (unsafe under concurrent
// creates) and NOT a Postgres GENERATED-ALWAYS-from-id column like
// users.employeeCode (that pattern is trivially safe but can't produce
// tight per-type numbering starting at 1 — a company's own `id` might be
// 47, giving CMP00047 with gaps, not CMP001). Instead this is a dedicated
// sequence table, incremented under a row lock inside its own short-lived
// transaction — SEPARATE from whatever transaction the caller's entity
// creation is running in. That's intentional: the sequence must advance
// permanently the moment a number is handed out, even if the entity
// creation that requested it later fails and rolls back — exactly like a
// Postgres SERIAL column's own gap-tolerant, never-reused behavior. Trying
// to make the sequence increment part of the SAME transaction as the
// entity insert would require holding the sequence row's lock for the
// entire duration of that transaction, serializing ALL creates of that
// entity type against each other for no real benefit.
// ============================================================

const PAD_WIDTH = 3;

export class BusinessIdError extends Error {}

// Generates and permanently allocates the next Business ID for the given
// entity type (e.g. "company", "admin", "manager", "sale_person",
// "attendance" — must already have a seeded row in business_id_sequences,
// see the migration). Safe under concurrent callers: the SELECT ... FOR
// UPDATE below blocks any other transaction trying to increment the same
// entityType's row until this one commits.
export const generateBusinessId = async (sequelize: Sequelize, entityType: string): Promise<string> => {
  return sequelize.transaction(async (t) => {
    const rows = await sequelize.query<{ prefix: string; nextNumber: number }>(
      `SELECT "prefix", "nextNumber" FROM "business_id_sequences" WHERE "entityType" = :entityType FOR UPDATE`,
      { replacements: { entityType }, transaction: t, type: QueryTypes.SELECT }
    );
    const seq = rows[0];
    if (!seq) {
      // Fails loudly rather than silently skipping the Business ID — an
      // unseeded entity type is a deployment/migration bug, not a runtime
      // condition to paper over.
      throw new BusinessIdError(`No business-id sequence configured for entity type "${entityType}"`);
    }

    const assignedNumber = seq.nextNumber;
    await sequelize.query(
      `UPDATE "business_id_sequences" SET "nextNumber" = :next, "updatedAt" = NOW() WHERE "entityType" = :entityType`,
      { replacements: { next: assignedNumber + 1, entityType }, transaction: t }
    );

    return `${seq.prefix}${String(assignedNumber).padStart(PAD_WIDTH, "0")}`;
  });
};
