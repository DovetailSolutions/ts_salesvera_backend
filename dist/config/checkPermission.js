"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkInvoiceUpdatePermission = exports.checkInvoiceViewPermission = exports.checkInvoiceCreatePermission = exports.checkPermission = exports.userHasPermission = void 0;
const userPermission_1 = require("../app/model/userPermission");
const permission_1 = require("../app/model/permission");
const Invoice_1 = require("../app/model/Invoice");
const permissionCache_1 = require("./permissionCache");
/**
 * Loads a user's permissions from the database.
 * Returns an array of "module:action" strings.
 * Eager-loads Permission model to avoid N+1.
 */
const loadUserPermissionsFromDB = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const userPerms = yield userPermission_1.UserPermission.findAll({
        where: { userId },
        include: [
            {
                model: permission_1.Permission,
                as: "permission",
                attributes: ["module", "action"],
            },
        ],
        attributes: [],
    });
    return userPerms.map((up) => `${up.permission.module}:${up.permission.action}`);
});
/**
 * Direct permission check (no middleware) — usable from inside controllers
 * that need to branch behaviour (e.g. filtering a list) rather than reject
 * the whole request. super_admin always returns true.
 */
const userHasPermission = (userId, role, module, action) => __awaiter(void 0, void 0, void 0, function* () {
    if (role === "super_admin")
        return true;
    const permissionSet = yield (0, permissionCache_1.getUserPermissionsFromCache)(userId, () => loadUserPermissionsFromDB(userId));
    return permissionSet.has(`${module}:${action}`);
});
exports.userHasPermission = userHasPermission;
/**
 * Middleware factory — call with module and action to protect a route.
 */
const checkPermission = (module, action) => {
    return (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const userData = req.userData;
            if (!userData || !userData.userId) {
                return res.status(401).json({
                    success: false,
                    message: "Unauthorized — no user data in token",
                });
            }
            const { role, userId } = userData;
            // companyId comes exclusively from req.userData, which tokenCheck
            // already resolved server-side (JWT payload → DB lookup) — never from
            // client-supplied body/params/query, which would let a caller satisfy
            // this gate with an arbitrary companyId.
            const companyId = userData.companyId;
            // ── Super Admin: bypass all permission checks ──────────────────
            if (role === "super_admin") {
                return next();
            }
            // ── Admin / Manager / User: check permissions table via cache ──────
            // sale_person is exempt from the companyId requirement — its permission
            // set is still enforced below, just without a company context gate.
            if (!companyId && role !== "sale_person") {
                return res.status(403).json({
                    success: false,
                    message: "Forbidden — no company context in token",
                });
            }
            const permissionSet = yield (0, permissionCache_1.getUserPermissionsFromCache)(userId, () => loadUserPermissionsFromDB(userId));
            const required = `${module}:${action}`;
            if (!permissionSet.has(required)) {
                return res.status(403).json({
                    success: false,
                    message: `You don’t have  '${module}" "${action}'permission`,
                });
            }
            return next();
        }
        catch (error) {
            console.error("checkPermission error:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error during permission check",
            });
        }
    });
};
exports.checkPermission = checkPermission;
// ============================================================
// checkInvoiceCreatePermission middleware
//
// Add-invoice needs two different permissions depending on the invoice
// status sent by the client:
//   status === "draft" (or missing) → proformainvoice:create  (separate module,
//                                       managed independently of "invoice")
//   otherwise                        → invoice:create          (existing behaviour, unchanged)
// ============================================================
const checkInvoiceCreatePermission = () => {
    return (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f, _g;
        try {
            const userData = req.userData;
            if (!userData || !userData.userId) {
                return res.status(401).json({
                    success: false,
                    message: "Unauthorized — no user data in token",
                });
            }
            const { role, userId } = userData;
            const companyId = (_e = (_c = (_a = userData.companyId) !== null && _a !== void 0 ? _a : (_b = req.body) === null || _b === void 0 ? void 0 : _b.companyId) !== null && _c !== void 0 ? _c : (_d = req.params) === null || _d === void 0 ? void 0 : _d.companyId) !== null && _e !== void 0 ? _e : (_f = req.query) === null || _f === void 0 ? void 0 : _f.companyId;
            // ── Super Admin: bypass all permission checks ──────────────────
            if (role === "super_admin") {
                return next();
            }
            if (!companyId && role !== "sale_person") {
                return res.status(403).json({
                    success: false,
                    message: "Forbidden — no company context in token",
                });
            }
            // No status sent → Invoices.create() defaults it to "draft" too, so treat
            // a missing status the same as an explicit "draft" here.
            const isDraft = !((_g = req.body) === null || _g === void 0 ? void 0 : _g.status) || req.body.status === "draft";
            const module = isDraft ? "proformainvoice" : "invoice";
            const action = "create";
            const required = `${module}:${action}`;
            const permissionSet = yield (0, permissionCache_1.getUserPermissionsFromCache)(userId, () => loadUserPermissionsFromDB(userId));
            console.log(`checkInvoiceCreatePermission: userId=${userId}, role=${role}, required=${required}`);
            if (!permissionSet.has(required)) {
                return res.status(403).json({
                    success: false,
                    message: `You don’t have '${module}:${action}' permission`,
                });
            }
            return next();
        }
        catch (error) {
            console.error("checkInvoiceCreatePermission error:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error during permission check",
            });
        }
    });
};
exports.checkInvoiceCreatePermission = checkInvoiceCreatePermission;
// ============================================================
// checkInvoiceViewPermission middleware
//
// getinvoice serves both real invoices and draft (proforma) invoices in one
// list, with the controller filtering draft rows by proformainvoice:view.
// That controller-level gating is dead code if the route itself requires
// invoice:view up front — a sale_person who only has proformainvoice:*
// (no invoice:view) would be blocked before ever reaching the controller,
// even though they're only asking for their draft invoices.
// Pass if the caller has EITHER invoice:view OR proformainvoice:view; the
// controller still scopes which rows (draft vs non-draft) are returned.
// ============================================================
const checkInvoiceViewPermission = () => {
    return (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f;
        try {
            const userData = req.userData;
            if (!userData || !userData.userId) {
                return res.status(401).json({
                    success: false,
                    message: "Unauthorized — no user data in token",
                });
            }
            const { role, userId } = userData;
            const companyId = (_e = (_c = (_a = userData.companyId) !== null && _a !== void 0 ? _a : (_b = req.body) === null || _b === void 0 ? void 0 : _b.companyId) !== null && _c !== void 0 ? _c : (_d = req.params) === null || _d === void 0 ? void 0 : _d.companyId) !== null && _e !== void 0 ? _e : (_f = req.query) === null || _f === void 0 ? void 0 : _f.companyId;
            // ── Super Admin: bypass all permission checks ──────────────────
            if (role === "super_admin") {
                return next();
            }
            if (!companyId && role !== "sale_person") {
                return res.status(403).json({
                    success: false,
                    message: "Forbidden — no company context in token",
                });
            }
            const permissionSet = yield (0, permissionCache_1.getUserPermissionsFromCache)(userId, () => loadUserPermissionsFromDB(userId));
            console.log(`checkInvoiceViewPermission: userId=${userId}, role=${role}, has invoice:view=${permissionSet.has("invoice:view")}, has proformainvoice:view=${permissionSet.has("proformainvoice:view")}`);
            if (!permissionSet.has("invoice:view") && !permissionSet.has("proformainvoice:view")) {
                return res.status(403).json({
                    success: false,
                    message: `You don’t have 'invoice:view' or 'proformainvoice:view' permission`,
                });
            }
            return next();
        }
        catch (error) {
            console.error("checkInvoiceViewPermission error:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error during permission check",
            });
        }
    });
};
exports.checkInvoiceViewPermission = checkInvoiceViewPermission;
// ============================================================
// checkInvoiceUpdatePermission middleware
//
// Updating an invoice needs a different permission depending on the
// invoice's CURRENT status (not the status being set):
//   currently "draft" → proformainvoice:update
//   otherwise         → invoice:update (existing behaviour, unchanged)
// Route must have an :id param identifying the invoice.
// ============================================================
const checkInvoiceUpdatePermission = () => {
    return (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f;
        try {
            const userData = req.userData;
            if (!userData || !userData.userId) {
                return res.status(401).json({
                    success: false,
                    message: "Unauthorized — no user data in token",
                });
            }
            const { role, userId } = userData;
            const companyId = (_e = (_c = (_a = userData.companyId) !== null && _a !== void 0 ? _a : (_b = req.body) === null || _b === void 0 ? void 0 : _b.companyId) !== null && _c !== void 0 ? _c : (_d = req.params) === null || _d === void 0 ? void 0 : _d.companyId) !== null && _e !== void 0 ? _e : (_f = req.query) === null || _f === void 0 ? void 0 : _f.companyId;
            // ── Super Admin: bypass all permission checks ──────────────────
            if (role === "super_admin") {
                return next();
            }
            if (!companyId && role !== "sale_person") {
                return res.status(403).json({
                    success: false,
                    message: "Forbidden — no company context in token",
                });
            }
            const { id } = req.params || {};
            if (!id) {
                return res.status(400).json({ success: false, message: "Invoice ID is required" });
            }
            const invoice = yield Invoice_1.Invoices.findOne({ where: { id: Number(id) } });
            if (!invoice) {
                return res.status(404).json({ success: false, message: "Invoice not found" });
            }
            const isDraft = invoice.status === "draft";
            const module = isDraft ? "proformainvoice" : "invoice";
            const action = "update";
            const required = `${module}:${action}`;
            const permissionSet = yield (0, permissionCache_1.getUserPermissionsFromCache)(userId, () => loadUserPermissionsFromDB(userId));
            console.log(`checkInvoiceUpdatePermission: userId=${userId}, role=${role}, required=${required}`);
            if (!permissionSet.has(required)) {
                return res.status(403).json({
                    success: false,
                    message: `You don’t have '${module}:${action}' permission`,
                });
            }
            return next();
        }
        catch (error) {
            console.error("checkInvoiceUpdatePermission error:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error during permission check",
            });
        }
    });
};
exports.checkInvoiceUpdatePermission = checkInvoiceUpdatePermission;
