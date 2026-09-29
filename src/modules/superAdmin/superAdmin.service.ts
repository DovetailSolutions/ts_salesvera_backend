import { Op, Sequelize } from "sequelize";
import bcrypt from "bcrypt";
import { ServiceError } from "../shared/serviceError";
import {
  User,
  Company,
  CompanyAdmin,
  CompanyManager,
  Branch,
  Department,
  TenantSetupStatus,
} from "../../config/dbConnection";
import * as SetupTracking from "../setupTracking/setupTracking.service";
import * as SubscriptionRepo from "../subscription/subscription.repository";
import * as SubscriptionLimit from "../subscription/subscriptionLimit.service";
import { AccessAuditLog } from "../../config/dbConnection";
import * as AccessNotify from "../accessExtension/accessNotification.service";

// ============================================================
// Super Admin Service - Handles System-Wide Aggregations,
// User Management, and Complete User/Company Hierarchy Trees.
// Strictly isolated to super_admin operations.
// ============================================================

export const getDashboardStats = async () => {
  const totalUsers = await User.count({ where: { status: { [Op.ne]: "delete" } } });
  const activeUsers = await User.count({ where: { status: "active" } });
  const inactiveUsers = await User.count({ where: { status: "deActive" } });

  const superAdminCount = await User.count({ where: { role: "super_admin", status: { [Op.ne]: "delete" } } });
  const tenantUserCount = await User.count({ where: { role: "user", status: { [Op.ne]: "delete" } } });
  const adminCount = await User.count({ where: { role: "admin", status: { [Op.ne]: "delete" } } });
  const managerCount = await User.count({ where: { role: "manager", status: { [Op.ne]: "delete" } } });
  const salePersonCount = await User.count({ where: { role: "employee", status: { [Op.ne]: "delete" } } });

  const totalCompanies = await Company.count();

  const companyOwnerIdsRaw = await Company.findAll({
    attributes: ["id", "userId", "adminId"],
    raw: true,
  });
  const usersWithCompaniesSet = new Set<number>();
  companyOwnerIdsRaw.forEach((c: any) => {
    if (c.userId) usersWithCompaniesSet.add(c.userId);
    if (c.adminId) usersWithCompaniesSet.add(c.adminId);
  });

  const usersWithCompaniesCount = usersWithCompaniesSet.size;
  const usersWithoutCompaniesCount = Math.max(0, totalUsers - usersWithCompaniesCount);

  // A company "has users" when it has an assigned admin or at least one manager attached.
  const companyIdsWithManagers = new Set<number>(
    (await CompanyManager.findAll({ attributes: ["companyId"], raw: true })).map((m: any) => m.companyId)
  );
  const companiesWithUsersCount = companyOwnerIdsRaw.filter(
    (c: any) => c.adminId || companyIdsWithManagers.has(c.id)
  ).length;
  const companiesWithoutUsersCount = Math.max(0, totalCompanies - companiesWithUsersCount);

  const recentUsers = await User.findAll({
    where: { status: { [Op.ne]: "delete" } },
    attributes: ["id", "firstName", "lastName", "email", "role", "status", "createdAt"],
    order: [["createdAt", "DESC"]],
    limit: 10,
  });

  const recentCompanies = await Company.findAll({
    attributes: ["id", "companyName", "companyEmail", "industry", "createdAt"],
    order: [["createdAt", "DESC"]],
    limit: 5,
  });

  const setupStats = await computeSetupStatsForAllTenants();

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
    setupStats,
  };
};

// Batched (no N+1) tenant setup-status tally for the dashboard's "Setup
// Overview" — completed/skipped come from the explicit override
// (setupTracking.service's TenantSetupStatus); everything else is
// pending/in_progress purely from whether an admin/company exists yet.
const computeSetupStatsForAllTenants = async () => {
  const tenantUsers = await User.findAll({
    where: { role: "user", status: { [Op.ne]: "delete" } },
    attributes: ["id"],
  });
  const tenantUserIds = tenantUsers.map((u: any) => u.id as number);
  if (tenantUserIds.length === 0) {
    return { completed: 0, inProgress: 0, pending: 0, skipped: 0 };
  }

  const [overrides, adminRows, companyRows] = await Promise.all([
    (TenantSetupStatus as any).findAll({ where: { userId: { [Op.in]: tenantUserIds } }, raw: true }),
    User.findAll({
      where: { tenantId: { [Op.in]: tenantUserIds }, role: "admin", status: { [Op.ne]: "delete" } },
      attributes: ["tenantId"],
      group: ["tenantId"],
      raw: true,
    }),
    Company.findAll({
      where: { userId: { [Op.in]: tenantUserIds } },
      attributes: ["userId"],
      group: ["userId"],
      raw: true,
    }),
  ]);

  const overrideMap = new Map<number, string>(overrides.map((o: any) => [o.userId, o.overrideStatus]));
  const adminTenantSet = new Set(adminRows.map((r: any) => r.tenantId));
  const companyTenantSet = new Set(companyRows.map((r: any) => r.userId));

  let completed = 0, skipped = 0, inProgress = 0, pending = 0;
  for (const id of tenantUserIds) {
    const override = overrideMap.get(id);
    if (override === "completed") completed++;
    else if (override === "skipped") skipped++;
    else if (adminTenantSet.has(id) || companyTenantSet.has(id)) inProgress++;
    else pending++;
  }

  return { completed, inProgress, pending, skipped };
};

export const getUsersList = async (params: {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
  status?: string;
  companyId?: number;
}) => {
  const page = Math.max(1, Number(params.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(params.limit) || 10));
  const offset = (page - 1) * limit;

  const whereClause: any = {};

  if (params.status) {
    whereClause.status = params.status;
  } else {
    whereClause.status = { [Op.ne]: "delete" };
  }

  if (params.role) {
    whereClause.role = params.role;
  }

  if (params.search && params.search.trim()) {
    const s = "%" + params.search.trim() + "%";
    whereClause[Op.or] = [
      { firstName: { [Op.iLike]: s } },
      { lastName: { [Op.iLike]: s } },
      { email: { [Op.iLike]: s } },
      { phone: { [Op.iLike]: s } },
    ];
  }

  const { count, rows } = await User.findAndCountAll({
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

  const userIds: number[] = rows.map((u) => u.id as number).filter((id): id is number => typeof id === "number");

  const creatorIds: number[] = Array.from(new Set(rows.map((u) => u.createdBy).filter((id): id is number => typeof id === "number")));
  const creatorsMap = new Map<number, { id: number; name: string; email: string }>();

  // FIX: parentUser was resolved purely from users.createdBy, which is NULL
  // for every row in the table — so this page's "Parent User" column rendered
  // "—" for all 143 users, on the one screen whose entire job is showing the
  // org hierarchy. The hierarchy actually lives in the UserCreators junction
  // (the same "creators" association GetAllUser reads, and the same table
  // getCompanyScopedChildUserIdsFast walks). Batched into one query, and only
  // used as a FALLBACK so any row that does start populating createdBy keeps
  // its current behaviour.
  const junctionParentMap = new Map<number, { id: number; name: string; email: string }>();
  if (userIds.length > 0) {
    const withCreators: any[] = await User.findAll({
      where: { id: { [Op.in]: userIds } },
      attributes: ["id"],
      include: [
        {
          model: User,
          as: "creators",
          attributes: ["id", "firstName", "lastName", "email"],
          through: { attributes: [] },
          required: false,
        },
      ],
    });
    withCreators.forEach((row: any) => {
      // A user can carry more than one creator row; the lowest id is the
      // earliest link, which is the one that reflects who actually created them.
      const parent = (row.creators || []).slice().sort((a: any, b: any) => a.id - b.id)[0];
      if (!parent) return;
      const name = [parent.firstName, parent.lastName].filter(Boolean).join(" ") || parent.email || "User #" + parent.id;
      junctionParentMap.set(row.id as number, { id: parent.id, name, email: parent.email || "" });
    });
  }
  if (creatorIds.length > 0) {
    const creators = await User.findAll({
      where: { id: { [Op.in]: creatorIds } },
      attributes: ["id", "firstName", "lastName", "email"],
    });
    creators.forEach((c) => {
      const name = [c.firstName, c.lastName].filter(Boolean).join(" ") || c.email || "User #" + c.id;
      creatorsMap.set(c.id as number, { id: c.id as number, name, email: c.email || "" });
    });
  }

  const companiesMap = new Map<number, Array<{ id: number; companyName: string }>>();
  if (userIds.length > 0) {
    const ownedCompanies = await Company.findAll({
      where: {
        [Op.or]: [{ userId: { [Op.in]: userIds } }, { adminId: { [Op.in]: userIds } }],
      },
      attributes: ["id", "companyName", "userId", "adminId"],
    });

    ownedCompanies.forEach((c) => {
      if (c.userId) {
        const list = companiesMap.get(c.userId) || [];
        if (!list.some((existing) => existing.id === c.id)) list.push({ id: c.id, companyName: c.companyName });
        companiesMap.set(c.userId, list);
      }
      if (c.adminId && c.adminId !== c.userId) {
        const list = companiesMap.get(c.adminId) || [];
        if (!list.some((existing) => existing.id === c.id)) list.push({ id: c.id, companyName: c.companyName });
        companiesMap.set(c.adminId, list);
      }
    });

    const companyAdmins = await CompanyAdmin.findAll({
      where: { adminId: { [Op.in]: userIds } },
      include: [{ model: Company, as: "company", attributes: ["id", "companyName"] }],
    });
    companyAdmins.forEach((ca: any) => {
      if (ca.company) {
        const list = companiesMap.get(ca.adminId) || [];
        if (!list.some((existing) => existing.id === ca.company.id)) {
          list.push({ id: ca.company.id, companyName: ca.company.companyName });
        }
        companiesMap.set(ca.adminId, list);
      }
    });

    const companyManagers = await CompanyManager.findAll({
      where: { managerId: { [Op.in]: userIds } },
      include: [{ model: Company, as: "company", attributes: ["id", "companyName"] }],
    });
    companyManagers.forEach((cm: any) => {
      if (cm.company) {
        const list = companiesMap.get(cm.managerId) || [];
        if (!list.some((existing) => existing.id === cm.company.id)) {
          list.push({ id: cm.company.id, companyName: cm.company.companyName });
        }
        companiesMap.set(cm.managerId, list);
      }
    });
  }

  // FIX: this grouped on users.createdBy, which is NULL for every row in the
  // table — so the "Child Users" column rendered 0 for all 143 users. Same dead
  // column that blanked parentUser. The live signal is tenantId (100% populated
  // for admin/manager/employee), which is also what the breakdown below needs,
  // so both come from one grouped query instead of two.
  const childCountsMap = new Map<number, number>();
  const teamBreakdownMap = new Map<number, { admins: number; managers: number; employees: number; total: number }>();
  if (userIds.length > 0) {
    const teamRows: any[] = await User.findAll({
      attributes: ["tenantId", "role", [Sequelize.fn("COUNT", Sequelize.col("id")), "count"]],
      where: { tenantId: { [Op.in]: userIds }, status: { [Op.ne]: "delete" } },
      group: ["tenantId", "role"],
      raw: true,
    });
    teamRows.forEach((r: any) => {
      const tid = Number(r.tenantId);
      if (!tid) return;
      const entry = teamBreakdownMap.get(tid) || { admins: 0, managers: 0, employees: 0, total: 0 };
      const n = Number(r.count) || 0;
      if (r.role === "admin") entry.admins += n;
      else if (r.role === "manager") entry.managers += n;
      else if (r.role === "employee") entry.employees += n;
      // A tenant owner never sits under another tenant, so "user" rows here are
      // noise; keep them out of the total rather than double-counting a tenant.
      if (r.role !== "user") entry.total += n;
      teamBreakdownMap.set(tid, entry);
    });
    teamBreakdownMap.forEach((v, k) => childCountsMap.set(k, v.total));
  }

  // Setup status is only meaningful for tenant-root ("user") rows — batched
  // the same way as computeSetupStatsForAllTenants, scoped to this page.
  const tenantIdsOnPage = rows.filter((u) => u.role === "user").map((u) => u.id as number);
  const setupStatusMap = new Map<number, string>();
  if (tenantIdsOnPage.length > 0) {
    const [overrides, adminRows, companyRows] = await Promise.all([
      (TenantSetupStatus as any).findAll({ where: { userId: { [Op.in]: tenantIdsOnPage } }, raw: true }),
      User.findAll({
        where: { tenantId: { [Op.in]: tenantIdsOnPage }, role: "admin", status: { [Op.ne]: "delete" } },
        attributes: ["tenantId"],
        group: ["tenantId"],
        raw: true,
      }),
      Company.findAll({ where: { userId: { [Op.in]: tenantIdsOnPage } }, attributes: ["userId"], group: ["userId"], raw: true }),
    ]);
    const overrideMap = new Map<number, string>(overrides.map((o: any) => [o.userId, o.overrideStatus]));
    const adminTenantSet = new Set(adminRows.map((r: any) => r.tenantId));
    const companyTenantSet = new Set(companyRows.map((r: any) => r.userId));
    for (const id of tenantIdsOnPage) {
      const override = overrideMap.get(id);
      setupStatusMap.set(
        id,
        override === "completed" || override === "skipped"
          ? override
          : adminTenantSet.has(id) || companyTenantSet.has(id)
          ? "in_progress"
          : "not_started"
      );
    }
  }

  const formattedRows = rows.map((u) => {
    const userObj = u.toJSON() as any;
    const uid = u.id as number;
    userObj.parentUser =
      (u.createdBy ? creatorsMap.get(u.createdBy) : null) || junctionParentMap.get(uid) || null;
    userObj.companies = companiesMap.get(uid) || [];
    userObj.companiesCount = userObj.companies.length;
    userObj.childUsersCount = childCountsMap.get(uid) || 0;
    userObj.teamBreakdown = teamBreakdownMap.get(uid) || { admins: 0, managers: 0, employees: 0, total: 0 };
    userObj.setupStatus = u.role === "user" ? setupStatusMap.get(uid) || "not_started" : null;
    return userObj;
  });

  return {
    rows: formattedRows,
    total: count,
    page,
    limit,
    totalPages: Math.ceil(count / limit) || 1,
  };
};

export const getUserTreeDetails = async (targetUserId: number) => {
  const targetUser = await User.findByPk(targetUserId, {
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

  if (!targetUser) throw new ServiceError("User not found", 404);

  let parentUser = null;
  if (targetUser.createdBy) {
    const parent = await User.findByPk(targetUser.createdBy, {
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

  // FIX: this walked users.createdBy, which is NULL for every row in the table,
  // so childUsersTree came back empty for every tenant while still firing one
  // query per node to discover nothing. Fourth place the dead column was read
  // (see parentUser and the team counts in getUsersList). The live hierarchy is
  // the UserCreators junction, reached through the existing "createdUsers"
  // association. Also switched from one-query-per-node recursion to one query
  // per LEVEL (breadth-first, same shape GetAllUser uses), so a wide tenant
  // costs <= maxDepth queries instead of one per member.
  async function fetchChildren(rootId: number, maxDepth = 5): Promise<any[]> {
    const nodesById = new Map<number, any>();
    const childIdsByParent = new Map<number, number[]>();
    let frontier: number[] = [rootId];

    for (let depth = 0; depth < maxDepth && frontier.length > 0; depth++) {
      const parents: any[] = await User.findAll({
        where: { id: { [Op.in]: frontier } },
        attributes: ["id"],
        include: [
          {
            model: User,
            as: "createdUsers",
            attributes: ["id", "firstName", "lastName", "email", "phone", "role", "status", "createdAt"],
            through: { attributes: [] },
            where: { status: { [Op.ne]: "delete" } },
            required: false,
          },
        ],
      });

      const nextFrontier: number[] = [];
      for (const parent of parents) {
        const kids = (parent.createdUsers || [])
          .slice()
          .sort((a: any, b: any) => a.id - b.id);
        childIdsByParent.set(
          Number(parent.id),
          kids.map((k: any) => Number(k.id))
        );
        for (const k of kids) {
          const id = Number(k.id);
          // A user can be linked to more than one creator; keep the first node
          // we build for them so the tree stays acyclic and finite.
          if (nodesById.has(id)) continue;
          const obj = k.toJSON ? k.toJSON() : { ...k };
          obj.name = [k.firstName, k.lastName].filter(Boolean).join(" ") || k.email;
          obj.children = [];
          nodesById.set(id, obj);
          nextFrontier.push(id);
        }
      }
      frontier = nextFrontier;
    }

    const attach = (parentId: number, seen: Set<number>): any[] => {
      const ids = childIdsByParent.get(parentId) || [];
      const out: any[] = [];
      for (const id of ids) {
        if (seen.has(id)) continue;
        const node = nodesById.get(id);
        if (!node) continue;
        seen.add(id);
        node.children = attach(id, seen);
        out.push(node);
      }
      return out;
    };
    return attach(rootId, new Set<number>([rootId]));
  }

  const childUsersTree = await fetchChildren(targetUserId);

  const ownedCompanies = await Company.findAll({
    where: {
      [Op.or]: [{ userId: targetUserId }, { adminId: targetUserId }],
    },
    order: [["id", "ASC"]],
  });

  const companyTreeList = [];
  let totalAdminsInTree = 0;
  let totalManagersInTree = 0;
  let totalSalesInTree = 0;

  for (const comp of ownedCompanies) {
    const compData = comp.toJSON() as any;

    const branches = await Branch.findAll({
      where: { companyId: comp.id },
      attributes: ["id", "branchName"],
    });
    const departments = await Department.findAll({
      where: { companyId: comp.id },
      attributes: ["id", "deptName"],
    });

    compData.branches = branches;
    compData.departments = departments;

    let companyAdminUser = null;
    if (comp.adminId) {
      const adminUser = await User.findByPk(comp.adminId, {
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

    const compManagersJunction = await CompanyManager.findAll({
      where: { companyId: comp.id },
      attributes: ["managerId"],
    });
    const managerIds = compManagersJunction.map((m) => m.managerId);
    let companyManagersList: any[] = [];
    if (managerIds.length > 0) {
      const managers = await User.findAll({
        where: { id: { [Op.in]: managerIds }, status: { [Op.ne]: "delete" } },
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
    // every employee under the root user and duplicate them onto every
    // company in the loop, since tenantId only identifies the root user, not
    // which of their companies a employee actually belongs to.
    const branchIds = branches.map((b) => b.id);
    const departmentIds = departments.map((d) => d.id);
    const salesScopeConditions: any[] = [];
    if (branchIds.length > 0) salesScopeConditions.push({ branchId: { [Op.in]: branchIds } });
    if (departmentIds.length > 0) salesScopeConditions.push({ departmentId: { [Op.in]: departmentIds } });
    if (comp.adminId) salesScopeConditions.push({ createdBy: comp.adminId });

    const salesPersons =
      salesScopeConditions.length > 0
        ? await User.findAll({
            where: {
              role: "employee",
              status: { [Op.ne]: "delete" },
              [Op.or]: salesScopeConditions,
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

  const countFlatChildren = (nodeList: any[]): number => {
    let sum = nodeList.length;
    for (const node of nodeList) {
      if (node.children && node.children.length > 0) {
        sum += countFlatChildren(node.children);
      }
    }
    return sum;
  };
  const totalChildUsersCount = countFlatChildren(childUsersTree);

  // Access / subscription summary — only tenant roots ("user") carry one, so
  // this is null for every other role and the UI just omits the section.
  let access: any = null;
  if (targetUser.role === "user") {
    const sub: any = await SubscriptionRepo.findLatestSubscriptionForUser(targetUserId);
    if (sub) {
      const plan: any = sub.planId ? await SubscriptionRepo.findPlanById(sub.planId) : null;
      access = {
        subscriptionId: sub.id,
        status: sub.status,
        planName: plan?.name ?? null,
        startDate: sub.startDate,
        endDate: sub.endDate,
        usage: {
          companies: { used: companyTreeList.length, limit: sub.maxCompanies ?? null },
          admins: { used: totalAdminsInTree, limit: sub.maxAdmins ?? null },
          managers: { used: totalManagersInTree, limit: sub.maxManagers ?? null },
          employees: { used: totalSalesInTree, limit: sub.maxEmployees ?? null },
          users: { used: totalAdminsInTree + totalManagersInTree + totalSalesInTree, limit: sub.maxEmployees ?? null },
        },
      };
    }
  }

  return {
    access,
    user: {
      id: targetUser.id,
      employeeCode: targetUser.employeeCode,
      name: [targetUser.firstName, targetUser.lastName].filter(Boolean).join(" ") || targetUser.email,
      email: targetUser.email,
      phone: targetUser.phone,
      role: targetUser.role,
      status: targetUser.status,
      createdAt: (targetUser as any).createdAt,
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
};

export const createUserAsSuperAdmin = async (
  data: {
    firstName: string;
    lastName?: string;
    email: string;
    password?: string;
    phone?: string;
    role: "user" | "admin" | "manager" | "employee";
    createdBy?: number;
    tenantId?: number;
    branchId?: number;
    departmentId?: number;
    shiftId?: number;
    companyId?: number;
  },
  superAdminUserId: number
) => {
  const { email, password, firstName, lastName, role, phone, createdBy, tenantId, branchId, departmentId, shiftId, companyId } = data;

  if (!email || !email.trim()) throw new ServiceError("Email is required", 400);
  if (!firstName || !firstName.trim()) throw new ServiceError("First Name is required", 400);
  if (!role) throw new ServiceError("Role is required", 400);

  const existing = await User.findOne({ where: { email: email.trim().toLowerCase() } });
  if (existing) throw new ServiceError("User with this email already exists", 400);

  const rawPassword = password || "Admin@123";

  let resolvedTenantId = tenantId ? Number(tenantId) : null;
  if (companyId) {
    const comp = await Company.findByPk(Number(companyId));
    if (comp && !resolvedTenantId && comp.userId) {
      resolvedTenantId = comp.userId;
    }
  }

  // Same limit enforcement as the self-service register() path
  // (auth.service.ts) — a super_admin creating an admin/manager/employee
  // FOR a tenant still counts against that tenant's own subscription; only
  // super_admin's OWN account (role === "user" tenant bootstrap, or a
  // brand-new super_admin) is unrestricted.
  const isLimitedRole = role === "admin" || role === "manager" || role === "employee";
  if (isLimitedRole) {
    await SubscriptionLimit.assertCanCreate(role, resolvedTenantId);
  }

  // Serialized per tenant across the count and the insert, same as
  // register()'s path — a Super Admin bulk-onboarding a tenant's team from
  // several tabs at once is exactly the concurrent case the bare
  // assertCanCreate above cannot hold against.
  const newUser = await SubscriptionLimit.withCreationLimitLock(
    role as any,
    isLimitedRole ? resolvedTenantId : null,
    () =>
      User.create({
        firstName: firstName.trim(),
        lastName: lastName ? lastName.trim() : "",
        email: email.trim().toLowerCase(),
        password: rawPassword,
        phone: phone ? phone.trim() : "",
        role,
        status: "active",
        createdBy: createdBy || superAdminUserId,
        tenantId: resolvedTenantId,
        branchId: branchId ? Number(branchId) : null,
        departmentId: departmentId ? Number(departmentId) : null,
        shiftId: shiftId ? Number(shiftId) : null,
      })
  );

  if (role === "user" && !resolvedTenantId) {
    await newUser.update({ tenantId: newUser.id as number });
    // Same trial-subscription bootstrap as auth.service.ts's register() —
    // this is the OTHER path a brand-new tenant account gets created
    // through (Super Admin onboarding one directly, rather than
    // self-signup), and needs the same subscription row for the limit
    // checks above to ever allow this tenant to hire anyone.
    try {
      const trialPlan = await SubscriptionRepo.findTrialPlan();
      if (trialPlan) {
        const trialDays = (trialPlan as any).trialDays ?? 90;
        const startDate = new Date();
        const endDate = new Date(startDate.getTime() + trialDays * 24 * 60 * 60 * 1000);
        await SubscriptionRepo.createSubscription({
          userId: newUser.id as number,
          planId: (trialPlan as any).id,
          status: "TRIALING",
          startDate,
          endDate,
          maxAdmins: (trialPlan as any).maxAdmins,
          maxCompanies: (trialPlan as any).maxCompanies,
          maxManagers: (trialPlan as any).maxManagers,
          maxEmployees: (trialPlan as any).maxEmployees,
        });
      }
    } catch (e) {
      console.error("Failed to create trial subscription for new tenant:", e);
    }
  }

  if (companyId) {
    if (role === "manager") {
      await CompanyManager.create({
        companyId: Number(companyId),
        managerId: newUser.id as number,
      }).catch((e) => console.error("CompanyManager link error:", e));
    } else if (role === "admin") {
      await CompanyAdmin.findOrCreate({
        where: { companyId: Number(companyId), adminId: newUser.id as number },
        defaults: { companyId: Number(companyId), adminId: newUser.id as number },
      }).catch((e) => console.error("CompanyAdmin link error:", e));
      await Company.update(
        { adminId: newUser.id as number },
        { where: { id: Number(companyId) } }
      ).catch((e) => console.error("Company adminId update error:", e));
    }
  }

  // Setup Tracking: best-effort audit trail — never block user creation.
  try {
    await SetupTracking.recordUserCreated({
      newUserId: newUser.id as number,
      newUserRole: role,
      newUserTenantId: resolvedTenantId,
      actorId: superAdminUserId,
      actorRole: "super_admin",
      companyId: companyId ? Number(companyId) : null,
    });
  } catch (e) {
    console.error("setupTracking.recordUserCreated failed:", e);
  }

  return {
    id: newUser.id,
    employeeCode: newUser.employeeCode,
    firstName: newUser.firstName,
    lastName: newUser.lastName,
    email: newUser.email,
    role: newUser.role,
    status: newUser.status,
    createdAt: (newUser as any).createdAt,
  };
};

export const updateUserAsSuperAdmin = async (
  targetUserId: number,
  data: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    role?: "user" | "admin" | "manager" | "employee";
    status?: "active" | "deActive" | "delete";
    branchId?: number | null;
    departmentId?: number | null;
    shiftId?: number | null;
  }
) => {
  const user = await User.findByPk(targetUserId);
  if (!user) throw new ServiceError("User not found", 404);

  if (data.firstName !== undefined) user.firstName = data.firstName.trim();
  if (data.lastName !== undefined) user.lastName = data.lastName.trim();
  if (data.phone !== undefined) user.phone = data.phone.trim();
  if (data.role !== undefined) user.role = data.role;
  if (data.status !== undefined) user.status = data.status;
  if (data.branchId !== undefined) user.branchId = data.branchId;
  if (data.departmentId !== undefined) user.departmentId = data.departmentId;
  if (data.shiftId !== undefined) user.shiftId = data.shiftId;

  await user.save();

  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: user.role,
    status: user.status,
    updatedAt: (user as any).updatedAt,
  };
};

// ============================================================
// Access management — Super Admin oversight of tenant subscriptions
// (limits, expiry, suspend/reactivate). Built entirely on the existing
// Subscription/SubscriptionPlan models and subscription.repository.ts's
// already-written "Super Admin oversight" queries (findAllSubscriptions
// Paginated/findSubscriptionWithPaymentsById) — those existed since
// migration 0021 but had no controller/route ever calling them.
// ============================================================

const REMAINING_DAYS = (endDate: Date) =>
  Math.ceil((new Date(endDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000));

// Warning threshold for "expiring soon" — not currently a configurable
// per-plan/per-tenant field anywhere in the existing schema, so kept as one
// named constant rather than hardcoding the number inline at every call
// site (easy to promote to a real config field later without touching the
// call sites).
const EXPIRING_SOON_THRESHOLD_DAYS = 7;

const deriveEffectiveStatus = (subscription: any): string => {
  if (subscription.status === "CANCELLED" || subscription.status === "PAYMENT_FAILED") return subscription.status;
  const remaining = REMAINING_DAYS(subscription.endDate);
  if (remaining < 0) return "EXPIRED";
  if (remaining <= EXPIRING_SOON_THRESHOLD_DAYS) return "EXPIRING_SOON";
  return subscription.status;
};

export const listTenantSubscriptions = async (params: { page: number; limit: number; offset: number; search?: string }) => {
  const { rows, count } = await SubscriptionRepo.findAllSubscriptionsPaginated(params);

  // PERF: this used to await getUsageSummary(userId) per row — a subscription
  // lookup plus four COUNTs each, so ~5 queries per tenant per page (measured
  // at ~2.5s for a single page). Replaced with two grouped queries covering
  // every tenant on the page at once, so the query count no longer scales
  // with page size. The limits themselves need no extra query at all: they
  // live on the subscription row this listing has already loaded.
  const plainRows = rows.map((sub: any) => sub.get({ plain: true }));
  const tenantIds = [...new Set(plainRows.map((p: any) => Number(p.userId)).filter(Boolean))];

  const [roleCounts, companyCounts] = await Promise.all([
    SubscriptionRepo.countUsersByRoleForTenants(tenantIds),
    SubscriptionRepo.countCompaniesForTenants(tenantIds),
  ]);

  // tenantId -> role -> used. A tenant/role pair with no rows is simply
  // absent from the grouped result, hence the ?? 0 at lookup time.
  const usedByTenant = new Map<number, Record<string, number>>();
  for (const row of roleCounts as any[]) {
    const tid = Number(row.tenantId);
    if (!usedByTenant.has(tid)) usedByTenant.set(tid, {});
    usedByTenant.get(tid)![row.role] = Number(row.count);
  }
  const companiesByTenant = new Map<number, number>();
  for (const row of companyCounts as any[]) companiesByTenant.set(Number(row.userId), Number(row.count));

  const data = plainRows.map((plain: any) => {
    const tid = Number(plain.userId);
    const used = usedByTenant.get(tid) ?? {};
    return {
      id: plain.id,
      businessCode: plain.businessCode,
      owner: plain.user,
      plan: plain.plan,
      status: plain.status,
      effectiveStatus: deriveEffectiveStatus(plain),
      startDate: plain.startDate,
      endDate: plain.endDate,
      remainingDays: REMAINING_DAYS(plain.endDate),
      limits: {
        admins: { used: used.admin ?? 0, limit: plain.maxAdmins },
        companies: { used: companiesByTenant.get(tid) ?? 0, limit: plain.maxCompanies },
        managers: { used: used.manager ?? 0, limit: plain.maxManagers },
        employees: { used: used.employee ?? 0, limit: plain.maxEmployees },
        users: { used: (used.admin ?? 0) + (used.manager ?? 0) + (used.employee ?? 0), limit: plain.maxEmployees },
      },
    };
  });

  return {
    totalRecords: count,
    totalPages: Math.ceil(count / params.limit) || 1,
    currentPage: params.page,
    data,
  };
};

export const getTenantSubscriptionDetail = async (subscriptionId: number) => {
  const subscription: any = await SubscriptionRepo.findSubscriptionWithPaymentsById(subscriptionId);
  if (!subscription) throw new ServiceError("Subscription not found", 404);

  const plain = subscription.get({ plain: true });
  const usage = await SubscriptionLimit.getUsageSummary(plain.userId).catch(() => null);
  const auditLog = await AccessAuditLog.findAll({
    where: { entityType: "subscription", entityId: plain.id },
    order: [["createdAt", "DESC"]],
    limit: 20,
  });

  return {
    ...plain,
    effectiveStatus: deriveEffectiveStatus(plain),
    remainingDays: REMAINING_DAYS(plain.endDate),
    usage,
    auditLog,
  };
};

const VALID_STATUSES = ["TRIALING", "ACTIVE", "PAST_DUE", "CANCELLED", "EXPIRED", "PAYMENT_FAILED", "SUSPENDED"];

export const updateTenantSubscription = async (
  actorId: number,
  subscriptionId: number,
  updates: {
    status?: string;
    startDate?: string;
    endDate?: string;
    maxAdmins?: number | null;
    maxCompanies?: number | null;
    maxManagers?: number | null;
    maxEmployees?: number | null;
  },
  reason?: string
) => {
  const subscription: any = await SubscriptionRepo.findSubscriptionById(subscriptionId);
  if (!subscription) throw new ServiceError("Subscription not found", 404);

  const before = {
    status: subscription.status,
    startDate: subscription.startDate,
    endDate: subscription.endDate,
    maxAdmins: subscription.maxAdmins,
    maxCompanies: subscription.maxCompanies,
    maxManagers: subscription.maxManagers,
    maxEmployees: subscription.maxEmployees,
  };

  const fields: any = {};

  if (updates.status !== undefined) {
    if (!VALID_STATUSES.includes(updates.status)) {
      throw new ServiceError(`status must be one of: ${VALID_STATUSES.join(", ")}`);
    }
    fields.status = updates.status;
  }

  const newStart = updates.startDate !== undefined ? new Date(updates.startDate) : new Date(subscription.startDate);
  const newEnd = updates.endDate !== undefined ? new Date(updates.endDate) : new Date(subscription.endDate);
  if (updates.startDate !== undefined) {
    if (isNaN(newStart.getTime())) throw new ServiceError("startDate is not a valid date");
    fields.startDate = newStart;
  }
  if (updates.endDate !== undefined) {
    if (isNaN(newEnd.getTime())) throw new ServiceError("endDate is not a valid date");
    fields.endDate = newEnd;
  }
  if (newEnd < newStart) {
    throw new ServiceError("endDate cannot be earlier than startDate");
  }

  // Extending an expired tenant: the edit form re-submits the status it
  // loaded ("EXPIRED") alongside the new date, which left the tenant locked
  // out (login/tokenCheck gate on status) despite a future expiry. A future
  // end date with status EXPIRED is contradictory — reactivate it.
  // SUSPENDED/CANCELLED remain the way to cut access before the end date.
  const resultingStatus = fields.status ?? subscription.status;
  if (resultingStatus === "EXPIRED" && newEnd >= new Date()) {
    fields.status = "ACTIVE";
  }

  (["maxAdmins", "maxCompanies", "maxManagers", "maxEmployees"] as const).forEach((field) => {
    if (updates[field] !== undefined) {
      const v = updates[field];
      if (v !== null && (!Number.isInteger(v) || v < 0)) {
        throw new ServiceError(`${field} must be a non-negative whole number, or null for unlimited`);
      }
      fields[field] = v;
    }
  });

  if (Object.keys(fields).length === 0) {
    throw new ServiceError("No changes supplied");
  }

  await SubscriptionRepo.updateSubscription(subscriptionId, fields);

  const after = { ...before, ...fields };
  await AccessAuditLog.create({
    entityType: "subscription",
    entityId: subscriptionId,
    action: "updated_by_super_admin",
    actorId,
    actorRole: "super_admin",
    previousValue: before,
    newValue: after,
    reason: reason || null,
  } as any);

  // Tell the tenant what changed. Previously a Super Admin could cut a
  // tenant's employee limit, move their expiry date or suspend them outright
  // and the tenant would find out only by being refused mid-task — the
  // SUBSCRIPTION notification type existed (migration 0022) but nothing ever
  // sent one. Driven off the real before/after diff, so re-submitting the
  // edit form unchanged notifies nobody. Best-effort and deliberately not
  // awaited into the return value's critical path: a notification failure
  // must not undo a persisted access change (see
  // accessNotification.service.ts).
  //
  // `fields` is passed as the "after" side rather than the merged object so
  // the notifier can tell an untouched field (undefined) from one that was
  // explicitly set — it only reports what the Super Admin actually edited.
  await AccessNotify.notifySubscriptionChanged({
    ownerUserId: Number(subscription.userId),
    actorId,
    subscriptionId,
    before,
    after: fields,
    reason: reason || null,
  }).catch((e) => console.error("[access-notification] subscription update notify failed:", e));

  return SubscriptionRepo.findSubscriptionById(subscriptionId);
};
