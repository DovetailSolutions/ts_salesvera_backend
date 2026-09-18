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

// How long after a rotation the superseded token may still be presented
// without being treated as a replay. Covers the app's own concurrent
// refreshes (multi-tab startup, bootstrap vs 401 interceptor) — long enough
// for requests already in flight, far too short to be useful to an attacker
// replaying a leaked token later.
export const ROTATION_GRACE_MS = 20_000;

export interface SessionMeta {
  deviceId?: string | null;
  userAgent?: string | null;
  ipAddress?: string | null;
}

export const createSession = async (userId: number, rawToken: string, expiresAt: Date, meta: SessionMeta = {}) => {
  const session = await (RefreshSession as any).create({
    userId,
    tokenHash: hashToken(rawToken),
    expiresAt,
    deviceId: meta.deviceId ?? null,
    userAgent: meta.userAgent ?? null,
    ipAddress: meta.ipAddress ?? null,
    lastUsedAt: new Date(),
  });
  // A fresh login starts its own lineage (this row). Every rotation and
  // grace-window sibling inherits it, so logout can revoke exactly this
  // browser's chain — see revokeSession.
  await session.update({ lineageId: session.id });
  return session;
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
      // ── Benign duplicate vs genuine replay ──────────────────────────
      // The app legitimately presents the same refresh token twice at once:
      // several restored tabs bootstrapping together, or the startup
      // bootstrap racing the 401 interceptor. That used to trip the replay
      // sweep below, which revokes EVERY session for the user — including
      // the new one the winning request had just created — so reopening the
      // browser dropped the user back on the login page.
      //
      // A row revoked BY ROTATION (replacedById set) within the grace window
      // is treated as that duplicate and rotated again. Anything else — a
      // token revoked by logout or by a sweep (replacedById null), or a
      // rotated one presented after the window — is still a replay.
      // The successor must still be alive, too: after a logout (or a replay
      // sweep) the whole lineage is revoked, and an older token from that
      // lineage must not be able to mint a new session inside the window.
      const successor =
        session.replacedById != null
          ? await (RefreshSession as any).findByPk(session.replacedById, { transaction: t })
          : null;
      const rotatedRecently =
        successor != null &&
        successor.revokedAt == null &&
        Date.now() - new Date(session.revokedAt).getTime() <= ROTATION_GRACE_MS;

      if (!rotatedRecently) {
        await (RefreshSession as any).update(
          { revokedAt: new Date() },
          { where: { userId: session.userId, revokedAt: null }, transaction: t }
        );
        return { kind: "reused" };
      }

      const graceSession = await (RefreshSession as any).create(
        {
          userId: session.userId,
          tokenHash: hashToken(newRawToken),
          expiresAt: newExpiresAt,
          deviceId: meta.deviceId ?? session.deviceId,
          userAgent: meta.userAgent ?? session.userAgent,
          ipAddress: meta.ipAddress ?? session.ipAddress,
          lastUsedAt: new Date(),
          lineageId: session.lineageId ?? session.id,
        },
        { transaction: t }
      );
      return { kind: "ok", userId: session.userId as number, session: graceSession };
    }
    if (session.expiresAt.getTime() < Date.now()) {
      return { kind: "expired" };
    }

    const created = await (RefreshSession as any).create(
      {
        userId: session.userId,
        tokenHash: hashToken(newRawToken),
        expiresAt: newExpiresAt,
        deviceId: meta.deviceId ?? session.deviceId,
        userAgent: meta.userAgent ?? session.userAgent,
        ipAddress: meta.ipAddress ?? session.ipAddress,
        lastUsedAt: new Date(),
        lineageId: session.lineageId ?? session.id,
      },
      { transaction: t }
    );

    // Written together so a later presentation of this token can tell
    // "already rotated" (grace-eligible) from "logged out" (never valid).
    session.revokedAt = new Date();
    session.lastUsedAt = new Date();
    session.replacedById = created.id;
    await session.save({ transaction: t });

    return { kind: "ok", userId: session.userId as number, session: created };
  });

  if (outcome.kind === "invalid") throw new ServiceError("Invalid refresh session", 401, { code: "REFRESH_INVALID" });
  if (outcome.kind === "reused") throw new ServiceError("Refresh session already used", 401, { code: "REFRESH_REUSED" });
  if (outcome.kind === "expired") throw new ServiceError("Refresh session expired", 401, { code: "REFRESH_EXPIRED" });

  return { userId: outcome.userId, session: outcome.session };
};

// Logout. Revokes the whole lineage this token belongs to — the presented
// row plus any rotation successor or grace-window sibling from the same
// browser — so an explicit logout really ends the session. Other devices
// have their own lineage and are unaffected. Falls back to the single row
// for legacy rows with no lineage.
export const revokeSession = async (rawToken: string): Promise<void> => {
  const session = await (RefreshSession as any).findOne({ where: { tokenHash: hashToken(rawToken) } });
  if (!session) return;
  const where = session.lineageId != null
    ? { lineageId: session.lineageId, revokedAt: null }
    : { id: session.id, revokedAt: null };
  await (RefreshSession as any).update({ revokedAt: new Date() }, { where });
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
