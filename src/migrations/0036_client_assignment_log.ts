import { Sequelize } from "sequelize";

/**
 * Client assignment history — see src/modules/client/.
 *
 * A client (MeetingUser) already has exactly one owner, meeting_users.user_id,
 * and every existing read path (getMeeting, getClient, getClientDetails,
 * meeting scheduling) already scopes clients by it. Assigning, revoking and
 * transferring a client therefore just move that owner; this table is the
 * append-only record of every such move, so who created a client, who held
 * it before, who moved it and when are never lost.
 *
 * Purely additive and safe for existing data:
 *   - client_assignment_log is a NEW table; meeting_users is not altered and
 *     no existing row is touched.
 *   - clientId deliberately has no FK (same as asset_audit_log.assetId), so
 *     the history outlives a deleted client.
 *   - requestKey is the client-generated idempotency key of a departure
 *     transfer: a re-submitted transfer finds its own rows and is not run
 *     twice.
 */
export async function up(sequelize: Sequelize): Promise<void> {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS "client_assignment_log" (
      "id" SERIAL PRIMARY KEY,
      "companyId" INTEGER NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
      "clientId" INTEGER NOT NULL,
      "action" VARCHAR(20) NOT NULL CHECK ("action" IN ('assign', 'reassign', 'revoke', 'transfer')),
      "previousUserId" INTEGER REFERENCES "users"("id") ON DELETE SET NULL,
      "newUserId" INTEGER REFERENCES "users"("id") ON DELETE SET NULL,
      "actorId" INTEGER REFERENCES "users"("id") ON DELETE SET NULL,
      "actorRole" VARCHAR(20),
      "requestKey" VARCHAR(64),
      "reason" TEXT,
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS "client_assignment_log_client_idx"
      ON "client_assignment_log" ("clientId", "createdAt" DESC, "id" DESC);
    CREATE INDEX IF NOT EXISTS "client_assignment_log_previous_user_idx"
      ON "client_assignment_log" ("previousUserId", "clientId");
    CREATE INDEX IF NOT EXISTS "client_assignment_log_request_key_idx"
      ON "client_assignment_log" ("companyId", "requestKey") WHERE "requestKey" IS NOT NULL;
  `);
}
