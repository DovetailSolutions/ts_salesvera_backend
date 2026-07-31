import { Request, Response } from "express";
import { createSuccess, badRequest } from "../../app/middlewear/errorMessage";
import { ContactQuery, User } from "../../config/dbConnection";
import { sendNotification } from "../../config/notificationService";
import { NotificationType } from "../../app/model/Notification";
import { sendContactQueryEmail } from "../../config/email";

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
