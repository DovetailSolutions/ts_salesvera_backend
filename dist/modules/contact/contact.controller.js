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
exports.updateQueryStatus = exports.listQueries = exports.submitQuery = void 0;
const sequelize_1 = require("sequelize");
const errorMessage_1 = require("../../app/middlewear/errorMessage");
const dbConnection_1 = require("../../config/dbConnection");
const notificationService_1 = require("../../config/notificationService");
const Notification_1 = require("../../app/model/Notification");
const email_1 = require("../../config/email");
const VALID_STATUSES = ["new", "read", "resolved"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// ============================================================
// POST /api/contact-query — public "Contact Us" form on the landing page.
// No auth: anyone can submit. Persists the query and alerts every
// super_admin (in-app notification + email) so it's not missed.
// ============================================================
const submitQuery = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e;
    try {
        const name = String(((_a = req.body) === null || _a === void 0 ? void 0 : _a.name) || "").trim();
        const email = String(((_b = req.body) === null || _b === void 0 ? void 0 : _b.email) || "").trim();
        const companyName = ((_c = req.body) === null || _c === void 0 ? void 0 : _c.companyName) ? String(req.body.companyName).trim() : null;
        const subject = String(((_d = req.body) === null || _d === void 0 ? void 0 : _d.subject) || "").trim();
        const message = String(((_e = req.body) === null || _e === void 0 ? void 0 : _e.message) || "").trim();
        if (!name || !email || !subject || !message) {
            (0, errorMessage_1.badRequest)(res, "name, email, subject and message are required");
            return;
        }
        if (!EMAIL_RE.test(email)) {
            (0, errorMessage_1.badRequest)(res, "Enter a valid email address");
            return;
        }
        const query = yield dbConnection_1.ContactQuery.create({
            name,
            email,
            companyName,
            subject,
            message,
        });
        const superAdmins = yield dbConnection_1.User.findAll({
            where: { role: "super_admin", status: "active" },
            attributes: ["id", "email"],
        });
        yield Promise.all(superAdmins.map((admin) => (0, notificationService_1.sendNotification)({
            receiverId: admin.id,
            type: Notification_1.NotificationType.SYSTEM,
            title: "New Contact Query",
            body: `${name} sent a query: ${subject}`,
            data: { contactQueryId: query.id, name, email, companyName, subject },
        })));
        for (const admin of superAdmins) {
            if (!admin.email)
                continue;
            (0, email_1.sendContactQueryEmail)(admin.email, { name, email, companyName, subject, message }).catch((err) => console.error(`Failed to email contact query to ${admin.email}:`, err));
        }
        (0, errorMessage_1.createSuccess)(res, "Your query has been submitted successfully", { id: query.id });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage);
    }
});
exports.submitQuery = submitQuery;
// ============================================================
// GET /admin/contact-queries — super_admin's enquiry inbox.
// Query: page, limit, status (optional: new|read|resolved), search (name/email/subject).
// ============================================================
const listQueries = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(100, Number(req.query.limit) || 20);
        const offset = (page - 1) * limit;
        const { status, search } = req.query;
        const where = {};
        if (status && VALID_STATUSES.includes(String(status))) {
            where.status = status;
        }
        if (search) {
            where[sequelize_1.Op.or] = [
                { name: { [sequelize_1.Op.iLike]: `%${search}%` } },
                { email: { [sequelize_1.Op.iLike]: `%${search}%` } },
                { subject: { [sequelize_1.Op.iLike]: `%${search}%` } },
                { companyName: { [sequelize_1.Op.iLike]: `%${search}%` } },
            ];
        }
        const { count, rows } = yield dbConnection_1.ContactQuery.findAndCountAll({
            where,
            order: [["createdAt", "DESC"]],
            limit,
            offset,
        });
        const unreadCount = yield dbConnection_1.ContactQuery.count({ where: { status: "new" } });
        (0, errorMessage_1.createSuccess)(res, "Enquiries fetched successfully", {
            total: count,
            page,
            limit,
            totalPages: Math.ceil(count / limit),
            unreadCount,
            rows,
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage);
    }
});
exports.listQueries = listQueries;
// ============================================================
// PATCH /admin/contact-queries/:id — mark an enquiry read/resolved.
// Body: { status: "read" | "resolved" }
// ============================================================
const updateQueryStatus = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { status } = req.body || {};
        if (!VALID_STATUSES.includes(status)) {
            (0, errorMessage_1.badRequest)(res, `status must be one of: ${VALID_STATUSES.join(", ")}`);
            return;
        }
        const query = yield dbConnection_1.ContactQuery.findByPk(id);
        if (!query) {
            (0, errorMessage_1.badRequest)(res, "Enquiry not found");
            return;
        }
        query.status = status;
        yield query.save();
        (0, errorMessage_1.createSuccess)(res, "Enquiry updated successfully", query);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        (0, errorMessage_1.badRequest)(res, errorMessage);
    }
});
exports.updateQueryStatus = updateQueryStatus;
