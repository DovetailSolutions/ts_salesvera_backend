import crypto from "crypto";
import { RefreshSession, sequelize } from "../../config/dbConnection";
import { ServiceError } from "../shared/serviceError";

// ============================================================
// Refresh-session storage for the web login cookie flow. The raw refresh
// token never touches the database — only its SHA-256 hash. SHA-256 (not
// bcrypt) is deliberate: this hashes a high-entropy, already-random signed
// JWT, not a low-entropy human password, so there's no need for bcrypt's
// slow, salted work factor — a fast, deterministic hash is both sufficient
// and necessary here (rotation/lookup needs to find the row by hash in one
// indexed query, which a salted hash can't do).
// ============================================================

export const hashToken = (rawToken: string): string => crypto.createHash("sha256").update(rawToken).digest("hex");

export interface SessionMeta {
  deviceId?: string | null;
  userAgent?: string | null;
  ipAddress?: string | null;
}

export const createSession = async (userId: number, rawToken: string, expiresAt: Date, meta: SessionMeta = {}) => {
  return (RefreshSession as any).create({
    userId,
    tokenHash: hashToken(rawToken),
    expiresAt,
    deviceId: meta.deviceId ?? null,
    userAgent: meta.userAgent ?? null,
    ipAddress: meta.ipAddress ?? null,
    lastUsedAt: new Date(),
  });
};

// Atomically validates the presented refresh token's session and rotates
// it: the row being used is revoked and a brand-new one is inserted, all
// inside one transaction with the old row locked for the duration — two
// concurrent requests presenting the SAME refresh token (e.g. a duplicate
// browser tab firing the same queued retry) will have one succeed and the
// other see the row already revoked, failing safely instead of both
// minting a valid new session from one token.
// NOTE ON STRUCTURE: every outcome below (including the reuse-detected
// "revoke everything" sweep) is done by RETURNING a discriminated result
// from the transaction, never by throwing from inside it. A thrown error
// makes Sequelize's managed transaction roll back EVERYTHING that happened
// inside it — including the defensive revoke-all sweep, which would
// silently undo the one security action that branch exists to take. The
// transaction always commits; the caller decides whether to throw based on
// the returned `kind`, after that commit has already landed.
type RotateOutcome =
  | { kind: "invalid" }
  | { kind: "reused" }
  | { kind: "expired" }
  | { kind: "ok"; userId: number; session: any };

export const rotateSession = async (
  rawOldToken: string,
  newRawToken: string,
  newExpiresAt: Date,
  meta: SessionMeta = {}
) => {
  const outcome: RotateOutcome = await sequelize.transaction(async (t) => {
    const oldHash = hashToken(rawOldToken);
    const session = await (RefreshSession as any).findOne({
      where: { tokenHash: oldHash },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!session) {
      return { kind: "invalid" };
    }
    if (session.revokedAt) {
      // Reuse of an already-rotated (or already-logged-out) refresh token —
      // the strongest signal available that a token has leaked/been
      // replayed. Revoke every other session for this user as a
      // precaution rather than trusting this one further.
      await (RefreshSession as any).update(
        { revokedAt: new Date() },
        { where: { userId: session.userId, revokedAt: null }, transaction: t }
      );
      return { kind: "reused" };
    }
    if (session.expiresAt.getTime() < Date.now()) {
      return { kind: "expired" };
    }

    session.revokedAt = new Date();
    session.lastUsedAt = new Date();
    await session.save({ transaction: t });

    const created = await (RefreshSession as any).create(
      {
        userId: session.userId,
        tokenHash: hashToken(newRawToken),
        expiresAt: newExpiresAt,
        deviceId: meta.deviceId ?? session.deviceId,
        userAgent: meta.userAgent ?? session.userAgent,
        ipAddress: meta.ipAddress ?? session.ipAddress,
        lastUsedAt: new Date(),
      },
      { transaction: t }
    );

    return { kind: "ok", userId: session.userId as number, session: created };
  });

  if (outcome.kind === "invalid") throw new ServiceError("Invalid refresh session", 401, { code: "REFRESH_INVALID" });
  if (outcome.kind === "reused") throw new ServiceError("Refresh session already used", 401, { code: "REFRESH_REUSED" });
  if (outcome.kind === "expired") throw new ServiceError("Refresh session expired", 401, { code: "REFRESH_EXPIRED" });

  return { userId: outcome.userId, session: outcome.session };
};

export const revokeSession = async (rawToken: string): Promise<void> => {
  await (RefreshSession as any).update({ revokedAt: new Date() }, { where: { tokenHash: hashToken(rawToken), revokedAt: null } });
};

export const revokeAllSessionsForUser = async (userId: number): Promise<void> => {
  await (RefreshSession as any).update({ revokedAt: new Date() }, { where: { userId, revokedAt: null } });
};

// Deletes only sessions that are ALREADY expired — never an active one,
// revoked or not (a revoked-but-not-yet-expired row is still useful replay
// -detection history, see rotateSession's reuse check above).
export const cleanupExpiredSessions = async (): Promise<number> => {
  const { Op } = await import("sequelize");
  const deleted = await (RefreshSession as any).destroy({ where: { expiresAt: { [Op.lt]: new Date() } } });
  return deleted;
};
