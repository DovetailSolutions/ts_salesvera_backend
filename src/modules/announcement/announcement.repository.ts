import { Op } from "sequelize";
import { sequelize, Announcement, AnnouncementRecipient, User } from "../../config/dbConnection";

// ============================================================
// Announcement repository — raw Sequelize access only, no business logic
// or authorization here (see announcement.service.ts). Mirrors the
// repository/service/controller/routes split used by leave/attendance/task.
// ============================================================

const RECIPIENT_SUMMARY_ATTRS = ["id", "firstName", "lastName", "email", "role"];

export const createAnnouncementWithRecipients = async (
  announcementData: {
    title: string;
    message: string;
    createdBy: number;
    creatorRole: string;
    companyId: number;
    priority: string;
    status: string;
    scheduledAt: Date | null;
    expiresAt: Date | null;
  },
  recipientRows: Array<{ recipientId: number; recipientRole: string; companyId: number }>
) => {
  // Immediately-published announcements are delivered in the same request
  // (see announcement.service.ts's deliverAnnouncement call right after this
  // commits), so their recipient rows are stamped deliveredAt now too —
  // only a genuinely scheduled announcement leaves deliveredAt null until
  // the cron's publishDueScheduled() actually delivers it later.
  const deliveredNow = announcementData.status === "published" ? new Date() : null;

  return sequelize.transaction(async (tx) => {
    const announcement = await Announcement.create(announcementData as any, { transaction: tx });

    await AnnouncementRecipient.bulkCreate(
      recipientRows.map((r) => ({
        announcementId: announcement.id,
        recipientId: r.recipientId,
        recipientRole: r.recipientRole,
        companyId: r.companyId,
        deliveredAt: deliveredNow,
      })) as any,
      { transaction: tx }
    );

    return announcement;
  });
};

export const findAnnouncementById = (id: number) => Announcement.findByPk(id);

export const findRecipientRow = (announcementId: number, recipientId: number) =>
  AnnouncementRecipient.findOne({ where: { announcementId, recipientId } });

export const listSent = async (params: {
  createdBy: number;
  page: number;
  limit: number;
  offset: number;
  status?: string;
  priority?: string;
  search?: string;
}) => {
  const where: any = { createdBy: params.createdBy };
  if (params.status) where.status = params.status;
  if (params.priority) where.priority = params.priority;
  if (params.search) {
    where[Op.or as any] = [
      { title: { [Op.iLike]: `%${params.search}%` } },
      { message: { [Op.iLike]: `%${params.search}%` } },
    ];
  }

  return Announcement.findAndCountAll({
    where,
    order: [["createdAt", "DESC"]],
    limit: params.limit,
    offset: params.offset,
  });
};

export const listReceived = async (params: {
  recipientId: number;
  page: number;
  limit: number;
  offset: number;
  isRead?: boolean;
  priority?: string;
  search?: string;
}) => {
  const recipientWhere: any = { recipientId: params.recipientId };
  if (params.isRead !== undefined) recipientWhere.isRead = params.isRead;

  const announcementWhere: any = {};
  if (params.priority) announcementWhere.priority = params.priority;
  if (params.search) {
    announcementWhere[Op.or as any] = [
      { title: { [Op.iLike]: `%${params.search}%` } },
      { message: { [Op.iLike]: `%${params.search}%` } },
    ];
  }

  return AnnouncementRecipient.findAndCountAll({
    where: recipientWhere,
    include: [
      {
        model: Announcement,
        as: "announcement",
        where: Object.keys(announcementWhere).length ? announcementWhere : undefined,
        required: true,
        include: [{ model: User, as: "creator", attributes: RECIPIENT_SUMMARY_ATTRS }],
      },
    ],
    order: [["createdAt", "DESC"]],
    limit: params.limit,
    offset: params.offset,
  });
};

export const getRecipientBreakdown = async (announcementId: number, page: number, limit: number, offset: number) =>
  AnnouncementRecipient.findAndCountAll({
    where: { announcementId },
    include: [{ model: User, as: "recipient", attributes: RECIPIENT_SUMMARY_ATTRS }],
    order: [["isRead", "ASC"], ["createdAt", "ASC"]],
    limit,
    offset,
  });

export const markRead = async (announcementId: number, recipientId: number) => {
  const [count] = await AnnouncementRecipient.update(
    { isRead: true, readAt: new Date() },
    { where: { announcementId, recipientId, isRead: false } }
  );
  return count;
};

export const markAllRead = async (recipientId: number) => {
  const [count] = await AnnouncementRecipient.update(
    { isRead: true, readAt: new Date() },
    { where: { recipientId, isRead: false } }
  );
  return count;
};

export const getUnreadCount = (recipientId: number) =>
  AnnouncementRecipient.count({ where: { recipientId, isRead: false } });

export const findDueScheduled = (now: Date) =>
  Announcement.findAll({
    where: { status: "scheduled", scheduledAt: { [Op.lte]: now } },
  });

export const getRecipientRowsForAnnouncement = (announcementId: number) =>
  AnnouncementRecipient.findAll({ where: { announcementId } });

export const markAnnouncementPublished = async (id: number) => {
  await Announcement.update({ status: "published" }, { where: { id } });
  await AnnouncementRecipient.update({ deliveredAt: new Date() }, { where: { announcementId: id } });
};

export const cancelAnnouncementById = (id: number) =>
  Announcement.update({ status: "cancelled" }, { where: { id, status: { [Op.in]: ["draft", "scheduled"] } } });
