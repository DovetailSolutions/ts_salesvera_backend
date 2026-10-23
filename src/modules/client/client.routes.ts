import { Router } from "express";
import { tokenCheck } from "../../config/jwtVerify";
import { authorizeRoles } from "../../app/middlewear/rbac";
import * as ClientController from "./client.controller";

// ============================================================
// Client Assignment routes — mounted at "/admin" in server.ts like every
// other module router, so "/clients/..." here is "/admin/clients/...".
//
// Admin-only, like Asset Management: no existing permission lets a manager
// or employee move clients between people, so none is granted here. The
// service re-verifies the admin's company on every call.
//
// Static paths are declared before "/clients/:id/..." so they're never
// captured as an id.
// ============================================================
const router = Router();
const adminOnly = [tokenCheck, authorizeRoles("admin")];

router.get("/clients/assignments", ...adminOnly, ClientController.listClients);
router.get("/clients/assignable-users", ...adminOnly, ClientController.listAssignableUsers);
router.post("/clients/assign", ...adminOnly, ClientController.assignClients);
router.post("/clients/revoke", ...adminOnly, ClientController.revokeClients);
router.get("/clients/transfer/preview", ...adminOnly, ClientController.getTransferPreview);
router.post("/clients/transfer", ...adminOnly, ClientController.transferClients);
router.get("/clients/:id/assignment-history", ...adminOnly, ClientController.getClientHistory);

export default router;
