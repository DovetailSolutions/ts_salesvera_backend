import { Request, Response } from "express";
import { Op } from "sequelize";
import { createSuccess, badRequest } from "../../app/middlewear/errorMessage";
import { ContactQuery, User } from "../../config/dbConnection";
import { sendNotification } from "../../config/notificationService";
import { NotificationType } from "../../app/model/Notification";
import { sendContactQueryEmail } from "../../config/email";

const VALID_STATUSES = ["new", "read", "resolved"];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ============================================================
// POST /api/contact-query — public "Contact Us" form on the landing page.
// No auth: anyone can submit. Persists the query and alerts every
// super_admin (in-app notification + email) so it's not missed.
// ============================================================
export const submitQuery = async (req: Request, res: Response): Promise<void> => {
  try {
    const name = String(req.body?.name || "").trim();
    const email = String(req.body?.email || "").trim();
    const companyName = req.body?.companyName ? String(req.body.companyName).trim() : null;
    const subject = String(req.body?.subject || "").trim();
    const message = String(req.body?.message || "").trim();

    if (!name || !email || !subject || !message) {
      badRequest(res, "name, email, subject and message are required");
      return;
    }
    if (!EMAIL_RE.test(email)) {
      badRequest(res, "Enter a valid email address");
      return;
    }

    const query = await ContactQuery.create({
      name,
      email,
      companyName,
      subject,
      message,
    });

    const superAdmins = await (User as any).findAll({
      where: { role: "super_admin", status: "active" },
      attributes: ["id", "email"],
    });

    await Promise.all(
      superAdmins.map((admin: any) =>
        sendNotification({
          receiverId: admin.id,
          type: NotificationType.SYSTEM,
          title: "New Contact Query",
          body: `${name} sent a query: ${subject}`,
          data: { contactQueryId: query.id, name, email, companyName, subject },
        })
      )
    );

    for (const admin of superAdmins as any[]) {
      if (!admin.email) continue;
      sendContactQueryEmail(admin.email, { name, email, companyName, subject, message }).catch((err) =>
        console.error(`Failed to email contact query to ${admin.email}:`, err)
      );
    }

    createSuccess(res, "Your query has been submitted successfully", { id: query.id });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage);
  }
};

// ============================================================
// GET /admin/contact-queries — super_admin's enquiry inbox.
// Query: page, limit, status (optional: new|read|resolved), search (name/email/subject).
// ============================================================
export const listQueries = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Number(req.query.limit) || 20);
    const offset = (page - 1) * limit;
    const { status, search } = req.query;

    const where: any = {};
    if (status && VALID_STATUSES.includes(String(status))) {
      where.status = status;
    }
    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
        { subject: { [Op.iLike]: `%${search}%` } },
        { companyName: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const { count, rows } = await ContactQuery.findAndCountAll({
      where,
      order: [["createdAt", "DESC"]],
      limit,
      offset,
    });

    const unreadCount = await ContactQuery.count({ where: { status: "new" } });

    createSuccess(res, "Enquiries fetched successfully", {
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
      unreadCount,
      rows,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage);
  }
};

// ============================================================
// PATCH /admin/contact-queries/:id — mark an enquiry read/resolved.
// Body: { status: "read" | "resolved" }
// ============================================================
export const updateQueryStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};

    if (!VALID_STATUSES.includes(status)) {
      badRequest(res, `status must be one of: ${VALID_STATUSES.join(", ")}`);
      return;
    }

    const query = await ContactQuery.findByPk(id);
    if (!query) {
      badRequest(res, "Enquiry not found");
      return;
    }

    query.status = status;
    await query.save();

    createSuccess(res, "Enquiry updated successfully", query);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Something went wrong";
    badRequest(res, errorMessage);
  }
};
