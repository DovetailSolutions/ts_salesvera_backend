import { Router } from "express";
import * as ContactController from "./contact.controller";

// ============================================================
// Public contact-query routes — mounted on /api in server.ts.
// No tokenCheck: this is the landing page's "Contact Us" form, reachable
// by anyone (logged out visitors included).
// ============================================================
const router = Router();

router.post("/contact-query", ContactController.submitQuery);

export default router;
