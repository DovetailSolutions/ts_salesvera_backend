import { Sequelize } from "sequelize";

/**
 * Fixes a gap left by migration 0028 (sale_person -> employee) that has made
 * employee creation fail outright ever since.
 *
 * 0028 renamed the "sale_person" value in the enum_users_role type and
 * updated the TypeScript that referenced it, and its own comment concluded
 * that "everything else that said sale_person was TypeScript source". It was
 * not: business_id_sequences still held a DATA row keyed
 * entityType = 'sale_person'.
 *
 * app/model/user.ts asks for a Business ID using the user's ROLE as the
 * entity type, so after 0028 every employee insert looked up
 * entityType = 'employee', found nothing, and businessId.service.ts threw —
 * by design, loudly:
 *
 *   No business-id sequence configured for entity type "employee"
 *
 * Confirmed against the live database before writing this migration: the
 * table had rows for admin/manager/company/... and 'sale_person', but none
 * for 'employee'. So POST /admin/register with role=employee, and the
 * bulk sale-person CSV upload, both failed 100% of the time.
 *
 * The row is RENAMED rather than newly inserted, which matters twice over:
 *   - nextNumber is carried across, so numbering continues from where the
 *     old role left off instead of restarting at 1 and colliding with the
 *     SAL001..SAL055 codes already issued to existing employees.
 *   - the 'SAL' prefix is kept, so historical and new employee codes stay in
 *     one consistent series. Changing it to 'EMP' would be a cosmetic
 *     improvement that splits the series and breaks any saved report,
 *     filter or exported sheet keyed on the old prefix — deliberately not
 *     done here (and, per the task's constraints, legacy data is handled
 *     rather than silently rewritten).
 *
 * Idempotent, and safe whichever state a given database is in: only
 * 'sale_person' present (rename it), both present (keep the higher
 * nextNumber, drop the stale row), or only 'employee' (nothing to do).
 */
export async function up(sequelize: Sequelize): Promise<void> {
  // Both rows exist — a database where something already inserted an
  // 'employee' row alongside the legacy one. Keep whichever counter is
  // further ahead so no number can ever be handed out twice.
  await sequelize.query(`
    UPDATE "business_id_sequences" e
    SET "nextNumber" = GREATEST(e."nextNumber", s."nextNumber"),
        "updatedAt" = NOW()
    FROM "business_id_sequences" s
    WHERE e."entityType" = 'employee'
      AND s."entityType" = 'sale_person';
  `);

  await sequelize.query(`
    DELETE FROM "business_id_sequences"
    WHERE "entityType" = 'sale_person'
      AND EXISTS (SELECT 1 FROM "business_id_sequences" WHERE "entityType" = 'employee');
  `);

  // The normal case: rename the legacy row, carrying its prefix and counter.
  await sequelize.query(`
    UPDATE "business_id_sequences"
    SET "entityType" = 'employee', "updatedAt" = NOW()
    WHERE "entityType" = 'sale_person';
  `);

  // Last resort: a fresh database that has neither row (0018's seed predates
  // the rename and 0028 never added one). Seeded with the same prefix the
  // rest of the system expects for this role.
  await sequelize.query(`
    INSERT INTO "business_id_sequences" ("entityType", "prefix", "nextNumber")
    VALUES ('employee', 'SAL', 1)
    ON CONFLICT ("entityType") DO NOTHING;
  `);
}
