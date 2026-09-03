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
} from "../../config/dbConnection";

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
  const salePersonCount = await User.count({ where: { role: "sale_person", status: { [Op.ne]: "delete" } } });

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

  const childCountsMap = new Map<number, number>();
  if (userIds.length > 0) {
    const childCounts = await User.findAll({
      attributes: ["createdBy", [Sequelize.fn("COUNT", Sequelize.col("id")), "count"]],
      where: { createdBy: { [Op.in]: userIds }, status: { [Op.ne]: "delete" } },
      group: ["createdBy"],
      raw: true,
    });
    childCounts.forEach((c: any) => {
      if (c.createdBy) {
        childCountsMap.set(Number(c.createdBy), Number(c.count));
      }
    });
  }

  const formattedRows = rows.map((u) => {
    const userObj = u.toJSON() as any;
    const uid = u.id as number;
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

  async function fetchChildren(parentId: number, currentDepth = 1, maxDepth = 5): Promise<any[]> {
    if (currentDepth > maxDepth) return [];
    const children = await User.findAll({
      where: { createdBy: parentId, status: { [Op.ne]: "delete" } },
      attributes: ["id", "firstName", "lastName", "email", "phone", "role", "status", "createdAt"],
      order: [["id", "ASC"]],
    });

    const result = [];
    for (const child of children) {
      const childObj = child.toJSON() as any;
      childObj.name = [child.firstName, child.lastName].filter(Boolean).join(" ") || child.email;
      childObj.children = await fetchChildren(child.id as number, currentDepth + 1, maxDepth);
      result.push(childObj);
    }
    return result;
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
    // every sale_person under the root user and duplicate them onto every
    // company in the loop, since tenantId only identifies the root user, not
    // which of their companies a sale_person actually belongs to.
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
              role: "sale_person",
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

  return {
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
    role: "user" | "admin" | "manager" | "sale_person";
    createdBy?: number;
    tenantId?: number;
    branchId?: number;
    departmentId?: number;
    shiftId?: number;
  },
  superAdminUserId: number
) => {
  const { email, password, firstName, lastName, role, phone, createdBy, tenantId, branchId, departmentId, shiftId } = data;

  if (!email || !email.trim()) throw new ServiceError("Email is required", 400);
  if (!firstName || !firstName.trim()) throw new ServiceError("First Name is required", 400);
  if (!role) throw new ServiceError("Role is required", 400);

  const existing = await User.findOne({ where: { email: email.trim().toLowerCase() } });
  if (existing) throw new ServiceError("User with this email already exists", 400);

  const rawPassword = password || "Admin@123";
  const hashedPassword = await bcrypt.hash(rawPassword, 10);

  const newUser = await User.create({
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
    createdAt: (newUser as any).createdAt,
  };
};

export const updateUserAsSuperAdmin = async (
  targetUserId: number,
  data: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    role?: "user" | "admin" | "manager" | "sale_person";
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
