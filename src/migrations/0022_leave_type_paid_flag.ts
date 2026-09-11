import { Sequelize } from "sequelize";

/**
 * company_leaves.isPaid — the authoritative, admin-configured source of
 * truth for whether a leave type deducts the paid leave balance and how its
 * approved days are reflected in Attendance. Before this column existed,
 * "unpaid" could only be guessed from the leave type's NAME
 * (inferLegacyLeaveTypeEnum in leave.service.ts matching "unpaid"/"lop"/
 * "loss of pay"), which the leave/attendance business rules now rely on more
 * heavily (approved unpaid leave must post Attendance as ABSENT and skip the
 * paid balance entirely — see leave.service.ts's approveLeave/
 * rejectLeaveAndRestoreBalance and user.ts's requestLeave).
 *
 * Defaults every row to true (paid) — the previously-universal behavior —
 * then does a one-time, name-based backfill to false for any existing type
 * whose name already reads as unpaid, so accounts that set this up before
 * today keep working without an admin having to revisit every leave type.
 * Going forward, admins set this explicitly (Step5 leave-type form).
 */
export async function up(sequelize: Sequelize): Promise<void> {
  await sequelize.query(`
    ALTER TABLE "company_leaves" ADD COLUMN IF NOT EXISTS "isPaid" BOOLEAN NOT NULL DEFAULT true;
  `);

  await sequelize.query(`
    UPDATE "company_leaves"
    SET "isPaid" = false
    WHERE LOWER("leaveName") LIKE '%unpaid%'
       OR LOWER("leaveName") LIKE '%loss of pay%'
       OR LOWER("leaveName") LIKE '%lop%'
       OR LOWER("leaveCode") LIKE '%unpaid%'
       OR LOWER("leaveCode") LIKE '%lop%';
  `);
}
