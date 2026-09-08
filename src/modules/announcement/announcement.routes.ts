import { Router } from "express";
import { tokenCheck } from "../../config/jwtVerify";
import { checkPermission } from "../../config/checkPermission";
import * as AnnouncementController from "./announcement.controller";

// ============================================================
// Announcement routes — mounted on /admin in server.ts, same tokenCheck +
// checkPermission gating convention as every other module. tokenCheck
// re-verifies role from the DB (see jwtVerify.ts/tokenCheck.ts), so a
// sale_person token cannot reach create/cancel regardless of client UI
// state — defense in depth is automatic here, not hand-built.
//
// Static-path routes (sent/received/unread-count/recipients/preview/
// read-all) are declared BEFORE the "/:id" routes so they are never
// swallowed by the :id param matcher.
// ============================================================
const router = Router();

router.post("/announcements", tokenCheck, checkPermission("announcement", "create"), AnnouncementController.create);

router.get(
  "/announcements/recipients/preview",
  tokenCheck,
  checkPermission("announcement", "create"),
  AnnouncementController.getRecipientCandidates
);

router.get("/announcements/sent", tokenCheck, checkPermission("announcement", "view"), AnnouncementController.getSent);
router.get(
  "/announcements/received",
  tokenCheck,
  checkPermission("announcement", "view"),
  AnnouncementController.getReceived
);
router.get(
  "/announcements/unread-count",
  tokenCheck,
  checkPermission("announcement", "view"),
  AnnouncementController.unreadCount
);
router.patch(
  "/announcements/read-all",
  tokenCheck,
  checkPermission("announcement", "view"),
  AnnouncementController.markAllRead
);

router.get("/announcements/:id", tokenCheck, checkPermission("announcement", "view"), AnnouncementController.getDetail);
router.get(
  "/announcements/:id/recipients",
  tokenCheck,
  checkPermission("announcement", "view"),
  AnnouncementController.getRecipientBreakdown
);
router.patch(
  "/announcements/:id/read",
  tokenCheck,
  checkPermission("announcement", "view"),
  AnnouncementController.markRead
);
router.patch(
  "/announcements/:id/cancel",
  tokenCheck,
  checkPermission("announcement", "cancel"),
  AnnouncementController.cancel
);

export default router;
