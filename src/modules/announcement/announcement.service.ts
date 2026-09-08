import { Op } from "sequelize";
import { User } from "../../config/dbConnection";
import { ServiceError } from "../shared/serviceError";
import { getCompanyScopedChildUserIds } from "../shared/userHierarchy";
import { resolveCompanyEmployeeIds } from "../shared/companyAccess";
import { sendNotification } from "../../config/notificationService";
import { NotificationType } from "../../app/model/Notification";
import { emitAnnouncementCreated } from "../../Notigication/announcement";
import * as AnnouncementRepo from "./announcement.repository";

const MAX_RECIPIENTS_PER_ANNOUNCEMENT = 500;
const VALID_PRIORITIES = new Set(["low", "normal", "high", "urgent"]);

// ============================================================
// resolveAuthorizedRecipients — the security-critical core of this module.
//
// Returns the caller's true, server-computed audience: Map<recipientId,
// recipientRole>. NEVER derived from anything the client sends — role and
// companyId always come from req.userData (tokenCheck-resolved), and every
// candidate's role is re-verified against a fresh DB read before being
// trusted, regardless of which hierarchy bucket it came from.
//
// Deliberately does NOT intersect the admin/manager branches with
// resolveCompanyEmployeeIds()'s salePersonIds bucket (that function derives
// sale-person company membership purely from User.branchId, which is NULL
// for a large share of real accounts in this system — verified directly
// against live data: most of a real manager's sale-person team have no
// branchId at all, only a UserCreators link). Intersecting with that bucket
// would silently drop legitimate recipients. getCompanyScopedChildUserIds
// already resolves company membership correctly and deliberately "fails
// open" on indeterminate membership for exactly this reason (see its own
// header comment in userHierarchy.ts) — so it alone is the right source of
// candidate ids for the admin/manager branches, with the final live-role
// lookup below doing the role narrowing instead.
export const resolveAuthorizedRecipients = async (
  callerId: number,
  role: string,
  companyId: number | null
): Promise<Map<number, string>> => {
  if (role === "sale_person") {
    throw new ServiceError("Sale persons cannot create announcements", 403);
  }
  if (companyId == null) {
    throw new ServiceError("No company context resolvable for this account", 400);
  }

  let candidateIds: number[] = [];
  let expectedRoles: Set<string>;

  if (role === "user") {
    const { adminIds, managerIds } = await resolveCompanyEmployeeIds(companyId);
    candidateIds = [...adminIds, ...managerIds];
    expectedRoles = new Set(["admin", "manager"]);
  } else if (role === "admin") {
    candidateIds = await getCompanyScopedChildUserIds(callerId, companyId);
    expectedRoles = new Set(["manager", "sale_person"]);
  } else if (role === "manager") {
    candidateIds = await getCompanyScopedChildUserIds(callerId, companyId);
    expectedRoles = new Set(["sale_person"]);
  } else {
    // super_admin and any other role are not senders in this feature.
    throw new ServiceError("This role cannot create announcements", 403);
  }

  if (candidateIds.length === 0) return new Map();

  // Final trust boundary: re-fetch every candidate's LIVE role from the DB.
  // Never trust which bucket a candidate id came from.
  const rows = await User.findAll({
    where: { id: { [Op.in]: candidateIds }, status: "active" },
    attributes: ["id", "role"],
  });

  const map = new Map<number, string>();
  rows.forEach((r: any) => {
    if (expectedRoles.has(r.role)) map.set(Number(r.id), r.role);
  });
  return map;
};

export const getRecipientCandidates = async (callerId: number, role: string, companyId: number | null) => {
  const authorizedMap = await resolveAuthorizedRecipients(callerId, role, companyId);
  if (authorizedMap.size === 0) return [];

  const ids = Array.from(authorizedMap.keys());
  const users = await User.findAll({
    where: { id: { [Op.in]: ids } },
    attributes: ["id", "firstName", "lastName", "email", "role"],
    order: [["role", "ASC"], ["firstName", "ASC"]],
  });

  return users.map((u: any) => ({
    id: u.id,
    name: [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email,
    email: u.email,
    role: u.role,
  }));
};

const validateCreatePayload = (body: any) => {
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  const priority = body?.priority ? String(body.priority).toLowerCase() : "normal";
  const recipientIds: number[] = Array.isArray(body?.recipientIds)
    ? Array.from(new Set(body.recipientIds.map((id: any) => Number(id)).filter((id: number) => Number.isFinite(id))))
    : [];

  if (!title) throw new ServiceError("Title is required", 400);
  if (title.length > 255) throw new ServiceError("Title must be 255 characters or fewer", 400);
  if (!message) throw new ServiceError("Message is required", 400);
  if (!VALID_PRIORITIES.has(priority)) throw new ServiceError("Invalid priority", 400);
  if (recipientIds.length === 0) throw new ServiceError("At least one recipient is required", 400);
  if (recipientIds.length > MAX_RECIPIENTS_PER_ANNOUNCEMENT) {
    throw new ServiceError(`A single announcement can target at most ${MAX_RECIPIENTS_PER_ANNOUNCEMENT} recipients`, 400);
  }

  let scheduledAt: Date | null = null;
  if (body?.scheduledAt) {
    scheduledAt = new Date(body.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime())) throw new ServiceError("Invalid scheduledAt date", 400);
    if (scheduledAt.getTime() <= Date.now()) throw new ServiceError("scheduledAt must be in the future", 400);
  }

  let expiresAt: Date | null = null;
  if (body?.expiresAt) {
    expiresAt = new Date(body.expiresAt);
    if (Number.isNaN(expiresAt.getTime())) throw new ServiceError("Invalid expiresAt date", 400);
    const floor = scheduledAt ?? new Date();
    if (expiresAt.getTime() <= floor.getTime()) {
      throw new ServiceError("expiresAt must be after the publish/scheduled time", 400);
    }
  }

  return { title, message, priority, recipientIds, scheduledAt, expiresAt };
};

export const createAnnouncement = async (callerId: number, role: string, companyId: number | null, body: any) => {
  const { title, message, priority, recipientIds, scheduledAt, expiresAt } = validateCreatePayload(body);

  // Reads only up to here — no writes are attempted until every submitted
  // recipient is confirmed authorized.
  const authorizedMap = await resolveAuthorizedRecipients(callerId, role, companyId!);
  const invalid = recipientIds.filter((id) => !authorizedMap.has(id));
  if (invalid.length > 0) {
    throw new ServiceError(
      "One or more selected recipients are outside your authorized audience",
      403,
      { invalidIds: invalid }
    );
  }

  // recipientRole/companyId always come from the server-verified map/context,
  // never from the request body.
  const recipientRows = recipientIds.map((id) => ({
    recipientId: id,
    recipientRole: authorizedMap.get(id)!,
    companyId: companyId!,
  }));

  const status = scheduledAt ? "scheduled" : "published";

  const announcement = await AnnouncementRepo.createAnnouncementWithRecipients(
    {
      title,
      message,
      createdBy: callerId,
      creatorRole: role,
      companyId: companyId!,
      priority,
      status,
      scheduledAt,
      expiresAt,
    },
    recipientRows
  );

  // Delivery only after a successful commit, and only for already-published
  // announcements — scheduled ones are delivered by the cron's
  // publishDueScheduled(), which does not re-run authorization (frozen at
  // creation time on purpose, see the plan's Section on scheduled delivery).
  if (status === "published") {
    await deliverAnnouncement(announcement.id, title, message, recipientRows.map((r) => r.recipientId), callerId);
  }

  return { ...announcement.toJSON(), recipientCount: recipientRows.length };
};

// Socket/push failures here are caught and logged, never rolled back and
// never surfaced as an API failure — mirrors sendNotification's own
// internal try/catch, and matches this module's "DB is the source of
// truth, sockets are best-effort delivery" design.
const deliverAnnouncement = async (
  announcementId: number,
  title: string,
  message: string,
  recipientIds: number[],
  senderId: number
) => {
  try {
    await Promise.all(
      recipientIds.map((receiverId) =>
        sendNotification({
          receiverId,
          senderId,
          type: NotificationType.ANNOUNCEMENT,
          title,
          body: message,
          data: { announcementId: String(announcementId) },
        })
      )
    );
    emitAnnouncementCreated(recipientIds, {
      id: announcementId,
      title,
      message,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("announcement delivery error:", err);
  }
};

export const getSentAnnouncements = async (
  callerId: number,
  query: { page?: any; limit?: any; status?: string; priority?: string; search?: string }
) => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(50, Number(query.limit) || 10);
  const offset = (page - 1) * limit;

  const { count, rows } = await AnnouncementRepo.listSent({
    createdBy: callerId,
    page,
    limit,
    offset,
    status: query.status,
    priority: query.priority,
    search: query.search,
  });

  return {
    data: rows,
    page,
    limit,
    totalRecords: count,
    totalPages: Math.ceil(count / limit),
  };
};

export const getReceivedAnnouncements = async (
  recipientId: number,
  query: { page?: any; limit?: any; isRead?: string; priority?: string; search?: string }
) => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(50, Number(query.limit) || 10);
  const offset = (page - 1) * limit;
  const isRead = query.isRead === "true" ? true : query.isRead === "false" ? false : undefined;

  const { count, rows } = await AnnouncementRepo.listReceived({
    recipientId,
    page,
    limit,
    offset,
    isRead,
    priority: query.priority,
    search: query.search,
  });

  return {
    data: rows,
    page,
    limit,
    totalRecords: count,
    totalPages: Math.ceil(count / limit),
  };
};

export const getUnreadCount = async (recipientId: number) => ({
  unreadCount: await AnnouncementRepo.getUnreadCount(recipientId),
});

export const getAnnouncementDetail = async (id: number, callerId: number) => {
  const announcement = await AnnouncementRepo.findAnnouncementById(id);
  if (!announcement) throw new ServiceError("Announcement not found", 404);

  const isCreator = announcement.createdBy === callerId;
  const recipientRow = await AnnouncementRepo.findRecipientRow(id, callerId);

  if (!isCreator && !recipientRow) {
    throw new ServiceError("You do not have access to this announcement", 403);
  }

  return {
    ...announcement.toJSON(),
    isCreator,
    ...(recipientRow ? { isRead: recipientRow.isRead, readAt: recipientRow.readAt } : {}),
  };
};

export const getRecipientBreakdown = async (
  id: number,
  callerId: number,
  query: { page?: any; limit?: any }
) => {
  const announcement = await AnnouncementRepo.findAnnouncementById(id);
  if (!announcement) throw new ServiceError("Announcement not found", 404);
  if (announcement.createdBy !== callerId) {
    throw new ServiceError("Only the creator can view the recipient breakdown", 403);
  }

  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Number(query.limit) || 20);
  const offset = (page - 1) * limit;

  const { count, rows } = await AnnouncementRepo.getRecipientBreakdown(id, page, limit, offset);

  return {
    data: rows,
    page,
    limit,
    totalRecords: count,
    totalPages: Math.ceil(count / limit),
  };
};

export const markRead = async (id: number, recipientId: number) => {
  const row = await AnnouncementRepo.findRecipientRow(id, recipientId);
  if (!row) throw new ServiceError("You are not a recipient of this announcement", 403);
  await AnnouncementRepo.markRead(id, recipientId);
  return { id, isRead: true };
};

export const markAllRead = async (recipientId: number) => {
  const updated = await AnnouncementRepo.markAllRead(recipientId);
  return { updated };
};

export const cancelAnnouncement = async (id: number, callerId: number) => {
  const announcement = await AnnouncementRepo.findAnnouncementById(id);
  if (!announcement) throw new ServiceError("Announcement not found", 404);
  if (announcement.createdBy !== callerId) {
    throw new ServiceError("Only the creator can cancel this announcement", 403);
  }
  if (!["draft", "scheduled"].includes(announcement.status)) {
    throw new ServiceError("Only draft or scheduled announcements can be cancelled", 400);
  }
  await AnnouncementRepo.cancelAnnouncementById(id);
  return { id, status: "cancelled" };
};

// Cron entry point — publishes every announcement whose scheduledAt has
// passed. Does NOT re-run resolveAuthorizedRecipients: the recipient set
// was validated and frozen at creation time. Re-validating here would risk
// a legitimate scheduled announcement silently losing recipients if the org
// chart changed in the interim, which is worse than honoring what was
// authorized at creation.
export const publishDueScheduled = async (): Promise<void> => {
  const due = await AnnouncementRepo.findDueScheduled(new Date());
  for (const announcement of due) {
    try {
      const recipientRows = await AnnouncementRepo.getRecipientRowsForAnnouncement(announcement.id);
      await AnnouncementRepo.markAnnouncementPublished(announcement.id);
      await deliverAnnouncement(
        announcement.id,
        announcement.title,
        announcement.message,
        recipientRows.map((r: any) => r.recipientId),
        announcement.createdBy
      );
    } catch (err) {
      console.error(`publishDueScheduled failed for announcement ${announcement.id}:`, err);
    }
  }
};
