import { Router } from "express";
import { tokenCheck } from "../../config/jwtVerify";
import * as Controller from "./employeeProfile.controller";

// ============================================================
// Employee Profile (extra details + bank accounts) routes — mounted on
// /admin in server.ts. Ownership (self vs. "manage someone else's record,
// which needs a permission + team-scope check") is resolved inside
// employeeProfile.service.ts, same pattern as attendance-regularization's
// GET /:id ("self-owner check happens inside the service; reviewer
// authorization too").
// ============================================================
const router = Router();

router.get("/employees/:userId/profile", tokenCheck, Controller.getProfile);
router.put("/employees/:userId/profile", tokenCheck, Controller.updateProfile);

router.get("/employees/:userId/bank-accounts", tokenCheck, Controller.listBankAccounts);
router.post("/employees/:userId/bank-accounts", tokenCheck, Controller.addBankAccount);
router.patch("/employees/:userId/bank-accounts/:bankAccountId", tokenCheck, Controller.updateBankAccount);
router.delete("/employees/:userId/bank-accounts/:bankAccountId", tokenCheck, Controller.deleteBankAccount);
router.patch(
  "/employees/:userId/bank-accounts/:bankAccountId/set-primary",
  tokenCheck,
  Controller.setPrimaryBankAccount
);
router.get(
  "/employees/:userId/bank-accounts/:bankAccountId/reveal",
  tokenCheck,
  Controller.revealBankAccount
);

export default router;
