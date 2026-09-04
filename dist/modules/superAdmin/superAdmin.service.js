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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateUserAsSuperAdmin = exports.createUserAsSuperAdmin = exports.getUserTreeDetails = exports.getUsersList = exports.getDashboardStats = void 0;
const sequelize_1 = require("sequelize");
const bcrypt_1 = __importDefault(require("bcrypt"));
const serviceError_1 = require("../shared/serviceError");
const dbConnection_1 = require("../../config/dbConnection");
// ============================================================
// Super Admin Service - Handles System-Wide Aggregations,
// User Management, and Complete User/Company Hierarchy Trees.
// Strictly isolated to super_admin operations.
// ============================================================
const getDashboardStats = () => __awaiter(void 0, void 0, void 0, function* () {
    const totalUsers = yield dbConnection_1.User.count({ where: { status: { [sequelize_1.Op.ne]: "delete" } } });
    const activeUsers = yield dbConnection_1.User.count({ where: { status: "active" } });
    const inactiveUsers = yield dbConnection_1.User.count({ where: { status: "deActive" } });
    const superAdminCount = yield dbConnection_1.User.count({ where: { role: "super_admin", status: { [sequelize_1.Op.ne]: "delete" } } });
    const tenantUserCount = yield dbConnection_1.User.count({ where: { role: "user", status: { [sequelize_1.Op.ne]: "delete" } } });
    const adminCount = yield dbConnection_1.User.count({ where: { role: "admin", status: { [sequelize_1.Op.ne]: "delete" } } });
    const managerCount = yield dbConnection_1.User.count({ where: { role: "manager", status: { [sequelize_1.Op.ne]: "delete" } } });
    const salePersonCount = yield dbConnection_1.User.count({ where: { role: "sale_person", status: { [sequelize_1.Op.ne]: "delete" } } });
    const totalCompanies = yield dbConnection_1.Company.count();
    const companyOwnerIdsRaw = yield dbConnection_1.Company.findAll({
        attributes: ["id", "userId", "adminId"],
        raw: true,
    });
    const usersWithCompaniesSet = new Set();
    companyOwnerIdsRaw.forEach((c) => {
        if (c.userId)
            usersWithCompaniesSet.add(c.userId);
        if (c.adminId)
            usersWithCompaniesSet.add(c.adminId);
    });
    const usersWithCompaniesCount = usersWithCompaniesSet.size;
    const usersWithoutCompaniesCount = Math.max(0, totalUsers - usersWithCompaniesCount);
    // A company "has users" when it has an assigned admin or at least one manager attached.
    const companyIdsWithManagers = new Set((yield dbConnection_1.CompanyManager.findAll({ attributes: ["companyId"], raw: true })).map((m) => m.companyId));
    const companiesWithUsersCount = companyOwnerIdsRaw.filter((c) => c.adminId || companyIdsWithManagers.has(c.id)).length;
    const companiesWithoutUsersCount = Math.max(0, totalCompanies - companiesWithUsersCount);
    const recentUsers = yield dbConnection_1.User.findAll({
        where: { status: { [sequelize_1.Op.ne]: "delete" } },
        attributes: ["id", "firstName", "lastName", "email", "role", "status", "createdAt"],
        order: [["createdAt", "DESC"]],
        limit: 10,
    });
    const recentCompanies = yield dbConnection_1.Company.findAll({
        attributes: ["id", "companyName", "companyEmail", "industry", "createdAt"],
        order: [["createdAt", "DESC"]],
        limit: 5,
    });
    return {
        organizationStats: {
            totalCompanies,
            totalUsers,
            totalSuperAdmins: superAdminCount,
            totalTenantUsers: tenantUserCount,
            totalAdmins: adminCount,
            totalManagers: managerCount,
            totalSalePersons: salePersonCount,
        },
        userStats: {
            totalUsers,
            activeUsers,
            inactiveUsers,
            usersWithCompanies: usersWithCompaniesCount,
            usersWithoutCompanies: usersWithoutCompaniesCount,
        },
        companyStats: {
            totalCompanies,
            companiesWithUsers: companiesWithUsersCount,
            companiesWithoutUsers: companiesWithoutUsersCount,
        },
        recentUsers,
        recentCompanies,
    };
});
exports.getDashboardStats = getDashboardStats;
const getUsersList = (params) => __awaiter(void 0, void 0, void 0, function* () {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(params.limit) || 10));
    const offset = (page - 1) * limit;
    const whereClause = {};
    if (params.status) {
        whereClause.status = params.status;
    }
    else {
        whereClause.status = { [sequelize_1.Op.ne]: "delete" };
    }
    if (params.role) {
        whereClause.role = params.role;
    }
    if (params.search && params.search.trim()) {
        const s = "%" + params.search.trim() + "%";
        whereClause[sequelize_1.Op.or] = [
            { firstName: { [sequelize_1.Op.iLike]: s } },
            { lastName: { [sequelize_1.Op.iLike]: s } },
            { email: { [sequelize_1.Op.iLike]: s } },
            { phone: { [sequelize_1.Op.iLike]: s } },
        ];
    }
    const { count, rows } = yield dbConnection_1.User.findAndCountAll({
        where: whereClause,
        attributes: [
            "id",
            "employeeCode",
            "firstName",
            "lastName",
            "email",
            "phone",
            "role",
            "status",
            "createdBy",
            "tenantId",
            "branchId",
            "departmentId",
            "createdAt",
        ],
        order: [["id", "DESC"]],
        limit,
        offset,
    });
    const userIds = rows.map((u) => u.id).filter((id) => typeof id === "number");
    const creatorIds = Array.from(new Set(rows.map((u) => u.createdBy).filter((id) => typeof id === "number")));
    const creatorsMap = new Map();
    if (creatorIds.length > 0) {
        const creators = yield dbConnection_1.User.findAll({
            where: { id: { [sequelize_1.Op.in]: creatorIds } },
            attributes: ["id", "firstName", "lastName", "email"],
        });
        creators.forEach((c) => {
            const name = [c.firstName, c.lastName].filter(Boolean).join(" ") || c.email || "User #" + c.id;
            creatorsMap.set(c.id, { id: c.id, name, email: c.email || "" });
        });
    }
    const companiesMap = new Map();
    if (userIds.length > 0) {
        const ownedCompanies = yield dbConnection_1.Company.findAll({
            where: {
                [sequelize_1.Op.or]: [{ userId: { [sequelize_1.Op.in]: userIds } }, { adminId: { [sequelize_1.Op.in]: userIds } }],
            },
            attributes: ["id", "companyName", "userId", "adminId"],
        });
        ownedCompanies.forEach((c) => {
            if (c.userId) {
                const list = companiesMap.get(c.userId) || [];
                if (!list.some((existing) => existing.id === c.id))
                    list.push({ id: c.id, companyName: c.companyName });
                companiesMap.set(c.userId, list);
            }
            if (c.adminId && c.adminId !== c.userId) {
                const list = companiesMap.get(c.adminId) || [];
                if (!list.some((existing) => existing.id === c.id))
                    list.push({ id: c.id, companyName: c.companyName });
                companiesMap.set(c.adminId, list);
            }
        });
        const companyAdmins = yield dbConnection_1.CompanyAdmin.findAll({
            where: { adminId: { [sequelize_1.Op.in]: userIds } },
            include: [{ model: dbConnection_1.Company, as: "company", attributes: ["id", "companyName"] }],
        });
        companyAdmins.forEach((ca) => {
            if (ca.company) {
                const list = companiesMap.get(ca.adminId) || [];
                if (!list.some((existing) => existing.id === ca.company.id)) {
                    list.push({ id: ca.company.id, companyName: ca.company.companyName });
                }
                companiesMap.set(ca.adminId, list);
            }
        });
        const companyManagers = yield dbConnection_1.CompanyManager.findAll({
            where: { managerId: { [sequelize_1.Op.in]: userIds } },
            include: [{ model: dbConnection_1.Company, as: "company", attributes: ["id", "companyName"] }],
        });
        companyManagers.forEach((cm) => {
            if (cm.company) {
                const list = companiesMap.get(cm.managerId) || [];
                if (!list.some((existing) => existing.id === cm.company.id)) {
                    list.push({ id: cm.company.id, companyName: cm.company.companyName });
                }
                companiesMap.set(cm.managerId, list);
            }
        });
    }
    const childCountsMap = new Map();
    if (userIds.length > 0) {
        const childCounts = yield dbConnection_1.User.findAll({
            attributes: ["createdBy", [sequelize_1.Sequelize.fn("COUNT", sequelize_1.Sequelize.col("id")), "count"]],
            where: { createdBy: { [sequelize_1.Op.in]: userIds }, status: { [sequelize_1.Op.ne]: "delete" } },
            group: ["createdBy"],
            raw: true,
        });
        childCounts.forEach((c) => {
            if (c.createdBy) {
                childCountsMap.set(Number(c.createdBy), Number(c.count));
            }
        });
    }
    const formattedRows = rows.map((u) => {
        const userObj = u.toJSON();
        const uid = u.id;
        userObj.parentUser = u.createdBy ? creatorsMap.get(u.createdBy) || null : null;
        userObj.companies = companiesMap.get(uid) || [];
        userObj.companiesCount = userObj.companies.length;
        userObj.childUsersCount = childCountsMap.get(uid) || 0;
        return userObj;
    });
    return {
        rows: formattedRows,
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit) || 1,
    };
});
exports.getUsersList = getUsersList;
const getUserTreeDetails = (targetUserId) => __awaiter(void 0, void 0, void 0, function* () {
    const targetUser = yield dbConnection_1.User.findByPk(targetUserId, {
        attributes: [
            "id",
            "employeeCode",
            "firstName",
            "lastName",
            "email",
            "phone",
            "role",
            "status",
            "createdBy",
            "tenantId",
            "branchId",
            "departmentId",
            "createdAt",
        ],
    });
    if (!targetUser)
        throw new serviceError_1.ServiceError("User not found", 404);
    let parentUser = null;
    if (targetUser.createdBy) {
        const parent = yield dbConnection_1.User.findByPk(targetUser.createdBy, {
            attributes: ["id", "firstName", "lastName", "email", "role"],
        });
        if (parent) {
            parentUser = {
                id: parent.id,
                name: [parent.firstName, parent.lastName].filter(Boolean).join(" ") || parent.email,
                email: parent.email,
                role: parent.role,
            };
        }
    }
    function fetchChildren(parentId_1) {
        return __awaiter(this, arguments, void 0, function* (parentId, currentDepth = 1, maxDepth = 5) {
            if (currentDepth > maxDepth)
                return [];
            const children = yield dbConnection_1.User.findAll({
                where: { createdBy: parentId, status: { [sequelize_1.Op.ne]: "delete" } },
                attributes: ["id", "firstName", "lastName", "email", "phone", "role", "status", "createdAt"],
                order: [["id", "ASC"]],
            });
            const result = [];
            for (const child of children) {
                const childObj = child.toJSON();
                childObj.name = [child.firstName, child.lastName].filter(Boolean).join(" ") || child.email;
                childObj.children = yield fetchChildren(child.id, currentDepth + 1, maxDepth);
                result.push(childObj);
            }
            return result;
        });
    }
    const childUsersTree = yield fetchChildren(targetUserId);
    const ownedCompanies = yield dbConnection_1.Company.findAll({
        where: {
            [sequelize_1.Op.or]: [{ userId: targetUserId }, { adminId: targetUserId }],
        },
        order: [["id", "ASC"]],
    });
    const companyTreeList = [];
    let totalAdminsInTree = 0;
    let totalManagersInTree = 0;
    let totalSalesInTree = 0;
    for (const comp of ownedCompanies) {
        const compData = comp.toJSON();
        const branches = yield dbConnection_1.Branch.findAll({
            where: { companyId: comp.id },
            attributes: ["id", "branchName"],
        });
        const departments = yield dbConnection_1.Department.findAll({
            where: { companyId: comp.id },
            attributes: ["id", "deptName"],
        });
        compData.branches = branches;
        compData.departments = departments;
        let companyAdminUser = null;
        if (comp.adminId) {
            const adminUser = yield dbConnection_1.User.findByPk(comp.adminId, {
                attributes: ["id", "firstName", "lastName", "email", "phone", "role", "status"],
            });
            if (adminUser) {
                companyAdminUser = {
                    id: adminUser.id,
                    name: [adminUser.firstName, adminUser.lastName].filter(Boolean).join(" ") || adminUser.email,
                    email: adminUser.email,
                    phone: adminUser.phone,
                    status: adminUser.status,
                };
                totalAdminsInTree++;
            }
        }
        const compManagersJunction = yield dbConnection_1.CompanyManager.findAll({
            where: { companyId: comp.id },
            attributes: ["managerId"],
        });
        const managerIds = compManagersJunction.map((m) => m.managerId);
        let companyManagersList = [];
        if (managerIds.length > 0) {
            const managers = yield dbConnection_1.User.findAll({
                where: { id: { [sequelize_1.Op.in]: managerIds }, status: { [sequelize_1.Op.ne]: "delete" } },
                attributes: ["id", "firstName", "lastName", "email", "phone", "role", "status"],
            });
            companyManagersList = managers.map((m) => ({
                id: m.id,
                name: [m.firstName, m.lastName].filter(Boolean).join(" ") || m.email,
                email: m.email,
                phone: m.phone,
                status: m.status,
            }));
            totalManagersInTree += companyManagersList.length;
        }
        // Scope strictly to THIS company's own branches/departments (and its own
        // admin as creator) — a bare `tenantId: targetUserId` match would pull in
        // every sale_person under the root user and duplicate them onto every
        // company in the loop, since tenantId only identifies the root user, not
        // which of their companies a sale_person actually belongs to.
        const branchIds = branches.map((b) => b.id);
        const departmentIds = departments.map((d) => d.id);
        const salesScopeConditions = [];
        if (branchIds.length > 0)
            salesScopeConditions.push({ branchId: { [sequelize_1.Op.in]: branchIds } });
        if (departmentIds.length > 0)
            salesScopeConditions.push({ departmentId: { [sequelize_1.Op.in]: departmentIds } });
        if (comp.adminId)
            salesScopeConditions.push({ createdBy: comp.adminId });
        const salesPersons = salesScopeConditions.length > 0
            ? yield dbConnection_1.User.findAll({
                where: {
                    role: "sale_person",
                    status: { [sequelize_1.Op.ne]: "delete" },
                    [sequelize_1.Op.or]: salesScopeConditions,
                },
                attributes: ["id", "firstName", "lastName", "email", "phone", "role", "status", "branchId", "departmentId"],
            })
            : [];
        const companySalesList = salesPersons.map((s) => ({
            id: s.id,
            name: [s.firstName, s.lastName].filter(Boolean).join(" ") || s.email,
            email: s.email,
            phone: s.phone,
            status: s.status,
            branchId: s.branchId,
            departmentId: s.departmentId,
        }));
        totalSalesInTree += companySalesList.length;
        compData.admin = companyAdminUser;
        compData.managers = companyManagersList;
        compData.salesPersons = companySalesList;
        compData.totalUsersCount = (companyAdminUser ? 1 : 0) + companyManagersList.length + companySalesList.length;
        companyTreeList.push(compData);
    }
    const countFlatChildren = (nodeList) => {
        let sum = nodeList.length;
        for (const node of nodeList) {
            if (node.children && node.children.length > 0) {
                sum += countFlatChildren(node.children);
            }
        }
        return sum;
    };
    const totalChildUsersCount = countFlatChildren(childUsersTree);
    return {
        user: {
            id: targetUser.id,
            employeeCode: targetUser.employeeCode,
            name: [targetUser.firstName, targetUser.lastName].filter(Boolean).join(" ") || targetUser.email,
            email: targetUser.email,
            phone: targetUser.phone,
            role: targetUser.role,
            status: targetUser.status,
            createdAt: targetUser.createdAt,
        },
        parentUser,
        stats: {
            totalCompanies: companyTreeList.length,
            totalChildUsers: totalChildUsersCount,
            totalAdmins: totalAdminsInTree,
            totalManagers: totalManagersInTree,
            totalSalesPersons: totalSalesInTree,
            totalSubtreeUsers: totalChildUsersCount + (companyTreeList.reduce((acc, c) => acc + c.totalUsersCount, 0)),
        },
        companies: companyTreeList,
        childUsersTree,
    };
});
exports.getUserTreeDetails = getUserTreeDetails;
const createUserAsSuperAdmin = (data, superAdminUserId) => __awaiter(void 0, void 0, void 0, function* () {
    const { email, password, firstName, lastName, role, phone, createdBy, tenantId, branchId, departmentId, shiftId } = data;
    if (!email || !email.trim())
        throw new serviceError_1.ServiceError("Email is required", 400);
    if (!firstName || !firstName.trim())
        throw new serviceError_1.ServiceError("First Name is required", 400);
    if (!role)
        throw new serviceError_1.ServiceError("Role is required", 400);
    const existing = yield dbConnection_1.User.findOne({ where: { email: email.trim().toLowerCase() } });
    if (existing)
        throw new serviceError_1.ServiceError("User with this email already exists", 400);
    const rawPassword = password || "Admin@123";
    const hashedPassword = yield bcrypt_1.default.hash(rawPassword, 10);
    const newUser = yield dbConnection_1.User.create({
        firstName: firstName.trim(),
        lastName: lastName ? lastName.trim() : "",
        email: email.trim().toLowerCase(),
        password: hashedPassword,
        phone: phone ? phone.trim() : "",
        role,
        status: "active",
        createdBy: createdBy || superAdminUserId,
        tenantId: tenantId || null,
        branchId: branchId || null,
        departmentId: departmentId || null,
        shiftId: shiftId || null,
    });
    return {
        id: newUser.id,
        employeeCode: newUser.employeeCode,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        email: newUser.email,
        role: newUser.role,
        status: newUser.status,
        createdAt: newUser.createdAt,
    };
});
exports.createUserAsSuperAdmin = createUserAsSuperAdmin;
const updateUserAsSuperAdmin = (targetUserId, data) => __awaiter(void 0, void 0, void 0, function* () {
    const user = yield dbConnection_1.User.findByPk(targetUserId);
    if (!user)
        throw new serviceError_1.ServiceError("User not found", 404);
    if (data.firstName !== undefined)
        user.firstName = data.firstName.trim();
    if (data.lastName !== undefined)
        user.lastName = data.lastName.trim();
    if (data.phone !== undefined)
        user.phone = data.phone.trim();
    if (data.role !== undefined)
        user.role = data.role;
    if (data.status !== undefined)
        user.status = data.status;
    if (data.branchId !== undefined)
        user.branchId = data.branchId;
    if (data.departmentId !== undefined)
        user.departmentId = data.departmentId;
    if (data.shiftId !== undefined)
        user.shiftId = data.shiftId;
    yield user.save();
    return {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        status: user.status,
        updatedAt: user.updatedAt,
    };
});
exports.updateUserAsSuperAdmin = updateUserAsSuperAdmin;
