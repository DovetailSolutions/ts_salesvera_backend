import { Router } from "express";
import { tokenCheck } from "../../config/jwtVerify";
import { authorizeRoles, ADMIN_AND_MANAGER } from "../../app/middlewear/rbac";
import * as AllocationController from "./allocation.controller";

// ============================================================
// Allocation routes — mounted on /admin in server.ts.
//
// ADMIN_AND_MANAGER is the outer gate (tenant "user", admin, super_admin,
// manager). Which of those may allocate to WHICH target role is enforced
// inside allocation.service.ts against the same hierarchy used for
// permission assignment, so the two can't drift apart:
//   user -> admin, manager | admin -> manager, sale_person | manager -> sale_person
// ============================================================
const router = Router();

router.post(
  "/bulk-assign-branches",
  tokenCheck,
  authorizeRoles(...ADMIN_AND_MANAGER),
  AllocationController.bulkAssignBranches
);

router.post(
  "/bulk-assign-shift",
  tokenCheck,
  authorizeRoles(...ADMIN_AND_MANAGER),
  AllocationController.bulkAssignShift
);

export default router;
