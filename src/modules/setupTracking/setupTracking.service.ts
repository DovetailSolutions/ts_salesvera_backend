import { Op } from "sequelize";
import { ServiceError } from "../shared/serviceError";
import {
  User,
  Company,
  Shift,
  Department,
  UserGeoFencing,
  TenantSetupStatus,
  CompanySetupStatus,
  SetupAuditLog,
} from "../../config/dbConnection";
import { hasCompanyAccess, resolveCompanyEmployeeIds } from "../shared/companyAccess";
import { sendNotification } from "../../config/notificationService";

// ============================================================
// Setup Tracking service. See app/model/setupStatus.ts for why the checklist
// is computed live from existing tables while only the explicit
// complete/skip decision (+ audit trail) is persisted.
// ============================================================

type EffectiveStatus = "not_started" | "in_progress" | "completed" | "skipped" | "blocked";

const computedFromFlags = (flags: boolean[]): EffectiveStatus => {
  if (flags.every((f) => !f)) return "not_started";
  return "in_progress";
};

// A company created for a tenant is always stamped Company.userId = that
// tenant's id (company.service.ts:addCompany) — same lookup
// superAdmin.service.ts:getUserTreeDetails already uses.
const getCompaniesForTenant = (userId: number) =>
  Company.findAll({ where: { [Op.or]: [{ userId }, { adminId: userId }] }, order: [["id", "ASC"]] });

export const computeTenantChecklist = async (userId: number) => {
  const adminCreated =
    (await User.count({ where: { tenantId: userId, role: "admin", status: { [Op.ne]: "delete" } } })) > 0;
  const companies = await getCompaniesForTenant(userId);
  return { adminCreated, companyCreated: companies.length > 0, companies };
};

export const computeCompanyChecklist = async (companyId: number) => {
  const company = await Company.findByPk(companyId);
  if (!company) throw new ServiceError("Company not found", 404);

  const { adminIds, managerIds, salePersonIds, allIds } = await resolveCompanyEmployeeIds(companyId);

  const [shiftCount, departmentCount, geoFenceCount, securityConfiguredCount] = await Promise.all([
    Shift.count({ where: { companyId } }),
    Department.count({ where: { companyId } }),
    (UserGeoFencing as any).count({ where: { companyId, enabled: true } }),
    allIds.length > 0
      ? User.count({
          where: {
            id: { [Op.in]: allIds },
            [Op.or]: [
              { isAttendancePhotoRequired: true },
              { isDeviceSecurityRequired: true },
              { isPunchOutGeofenceRequired: true },
            ],
          },
        })
      : Promise.resolve(0),
  ]);

  return {
    company,
    adminAssigned: adminIds.length > 0,
    managerCreated: managerIds.length > 0,
    salePersonCreated: salePersonIds.length > 0,
    travelConfigured: company.vehicleAllowanceRatePerKm !== null && company.vehicleAllowanceRatePerKm !== undefined,
    geoFencingConfigured: Boolean(company.geoFencingRequired) && geoFenceCount > 0,
    attendanceSecurityConfigured: securityConfiguredCount > 0,
    shiftConfigured: shiftCount > 0,
    departmentConfigured: departmentCount > 0,
  };
};

const notifySuperAdmins = async (payload: { title: string; body: string; senderId?: number | null; data?: Record<string, any> }) => {
  const superAdmins = await User.findAll({ where: { role: "super_admin", status: { [Op.ne]: "delete" } }, attributes: ["id"] });
  await Promise.all(
    superAdmins.map((sa: any) =>
      sendNotification({
        receiverId: sa.id,
        senderId: payload.senderId ?? null,
        type: "system",
        title: payload.title,
        body: payload.body,
        data: payload.data,
      })
    )
  );
};

export const getTenantSetupStatus = async (userId: number) => {
  const user = await User.findByPk(userId, { attributes: ["id", "firstName", "lastName", "email", "role"] });
  if (!user) throw new ServiceError("User not found", 404);

  const { adminCreated, companyCreated, companies } = await computeTenantChecklist(userId);
  const override = await TenantSetupStatus.findOne({ where: { userId } });

  const companySummaries = await Promise.all(
    companies.map(async (c: any) => {
      const checklist = await computeCompanyChecklist(c.id);
      const companyOverride = await CompanySetupStatus.findOne({ where: { companyId: c.id } });
      const flags = [
        checklist.adminAssigned,
        checklist.managerCreated,
        checklist.salePersonCreated,
        checklist.travelConfigured,
        checklist.geoFencingConfigured,
        checklist.attendanceSecurityConfigured,
        checklist.shiftConfigured,
        checklist.departmentConfigured,
      ];
      return {
        id: c.id,
        companyName: c.companyName,
        effectiveStatus: (companyOverride?.overrideStatus as EffectiveStatus) ?? computedFromFlags(flags),
        progressPercent: Math.round((flags.filter(Boolean).length / flags.length) * 100),
      };
    })
  );

  const effectiveStatus: EffectiveStatus = (override?.overrideStatus as EffectiveStatus) ?? computedFromFlags([adminCreated, companyCreated]);

  const auditHistory = await SetupAuditLog.findAll({
    where: { entityType: "tenant", entityId: userId },
    order: [["createdAt", "DESC"]],
    limit: 50,
  });

  return {
    user: {
      id: user.id,
      name: [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email,
      email: user.email,
      role: user.role,
    },
    checklist: { adminCreated, companyCreated },
    effectiveStatus,
    override: override
      ? {
          overrideStatus: override.overrideStatus,
          completedBy: override.completedBy,
          completedAt: override.completedAt,
          skippedBy: override.skippedBy,
          skippedAt: override.skippedAt,
          notes: override.notes,
        }
      : null,
    companies: companySummaries,
    auditHistory,
  };
};

export const getCompanySetupStatus = async (companyId: number, callerId: number, callerRole?: string) => {
  const allowed = await hasCompanyAccess(companyId, callerId, callerRole);
  if (!allowed) throw new ServiceError("Company not found", 404);

  const checklist = await computeCompanyChecklist(companyId);
  const override = await CompanySetupStatus.findOne({ where: { companyId } });

  const flags = [
    checklist.adminAssigned,
    checklist.managerCreated,
    checklist.salePersonCreated,
    checklist.travelConfigured,
    checklist.geoFencingConfigured,
    checklist.attendanceSecurityConfigured,
    checklist.shiftConfigured,
    checklist.departmentConfigured,
  ];
  const effectiveStatus: EffectiveStatus = (override?.overrideStatus as EffectiveStatus) ?? computedFromFlags(flags);

  const auditHistory = await SetupAuditLog.findAll({
    where: { entityType: "company", entityId: companyId },
    order: [["createdAt", "DESC"]],
    limit: 50,
  });

  return {
    companyId,
    companyName: checklist.company.companyName,
    checklist: {
      adminAssigned: checklist.adminAssigned,
      managerCreated: checklist.managerCreated,
      salePersonCreated: checklist.salePersonCreated,
      travelConfigured: checklist.travelConfigured,
      geoFencingConfigured: checklist.geoFencingConfigured,
      attendanceSecurityConfigured: checklist.attendanceSecurityConfigured,
      shiftConfigured: checklist.shiftConfigured,
      departmentConfigured: checklist.departmentConfigured,
    },
    effectiveStatus,
    progressPercent: Math.round((flags.filter(Boolean).length / flags.length) * 100),
    override: override
      ? {
          overrideStatus: override.overrideStatus,
          completedBy: override.completedBy,
          completedAt: override.completedAt,
          skippedBy: override.skippedBy,
          skippedAt: override.skippedAt,
          notes: override.notes,
        }
      : null,
    auditHistory,
  };
};

// Tenant setup routes are mounted super_admin-only (see setupTracking.routes.ts)
// — this is a defense-in-depth check, not the primary gate.
const assertCanActOnTenant = (targetUserId: number, actorId: number, actorRole?: string) => {
  if (actorRole === "super_admin") return;
  throw new ServiceError("You do not have permission to change this setup status", 403);
};

const assertCanActOnCompany = async (companyId: number, actorId: number, actorRole?: string) => {
  if (actorRole === "super_admin") return;
  if (actorRole === "user" || actorRole === "admin") {
    const allowed = await hasCompanyAccess(companyId, actorId, actorRole);
    if (allowed) return;
  }
  throw new ServiceError("You do not have permission to change this setup status", 403);
};

export const setTenantSetupStatus = async (
  targetUserId: number,
  action: "complete" | "skip" | "reopen",
  actorId: number,
  actorRole: string | undefined,
  reason?: string
) => {
  assertCanActOnTenant(targetUserId, actorId, actorRole);

  const user = await User.findByPk(targetUserId, { attributes: ["id"] });
  if (!user) throw new ServiceError("User not found", 404);

  const now = new Date();
  const [row] = await TenantSetupStatus.findOrCreate({ where: { userId: targetUserId }, defaults: { userId: targetUserId } as any });

  if (action === "complete") {
    await row.update({ overrideStatus: "completed", completedBy: actorId, completedAt: now, notes: reason ?? row.notes });
  } else if (action === "skip") {
    await row.update({ overrideStatus: "skipped", skippedBy: actorId, skippedAt: now, notes: reason ?? row.notes });
  } else {
    await row.update({ overrideStatus: null, completedBy: null, completedAt: null, skippedBy: null, skippedAt: null });
  }

  await SetupAuditLog.create({
    entityType: "tenant",
    entityId: targetUserId,
    action: action === "complete" ? "completed" : action === "skip" ? "skipped" : "reopened",
    actorId,
    actorRole: actorRole ?? null,
    detail: reason ? { reason } : null,
  });

  if (actorRole !== "super_admin" && action === "complete") {
    await notifySuperAdmins({
      senderId: actorId,
      title: "Tenant setup marked complete",
      body: `User #${targetUserId} marked their own setup as complete.`,
      data: { subtype: "setup_complete", tenantUserId: targetUserId },
    }).catch(() => {});
  }

  return getTenantSetupStatus(targetUserId);
};

export const setCompanySetupStatus = async (
  companyId: number,
  action: "complete" | "skip" | "reopen",
  actorId: number,
  actorRole: string | undefined,
  reason?: string
) => {
  await assertCanActOnCompany(companyId, actorId, actorRole);

  const company = await Company.findByPk(companyId, { attributes: ["id"] });
  if (!company) throw new ServiceError("Company not found", 404);

  const now = new Date();
  const [row] = await CompanySetupStatus.findOrCreate({ where: { companyId }, defaults: { companyId } as any });

  if (action === "complete") {
    await row.update({ overrideStatus: "completed", completedBy: actorId, completedAt: now, notes: reason ?? row.notes });
  } else if (action === "skip") {
    await row.update({ overrideStatus: "skipped", skippedBy: actorId, skippedAt: now, notes: reason ?? row.notes });
  } else {
    await row.update({ overrideStatus: null, completedBy: null, completedAt: null, skippedBy: null, skippedAt: null });
  }

  await SetupAuditLog.create({
    entityType: "company",
    entityId: companyId,
    action: action === "complete" ? "completed" : action === "skip" ? "skipped" : "reopened",
    actorId,
    actorRole: actorRole ?? null,
    detail: reason ? { reason } : null,
  });

  if (actorRole !== "super_admin" && action === "complete") {
    await notifySuperAdmins({
      senderId: actorId,
      title: "Company setup marked complete",
      body: `Company #${companyId}'s setup was marked complete.`,
      data: { subtype: "setup_complete", companyId },
    }).catch(() => {});
  }

  return getCompanySetupStatus(companyId, actorId, actorRole);
};

// ── Best-effort hooks, called from auth.service/superAdmin.service/company.service ──
// Every call site wraps these in try/catch — a setup-tracking write must
// never fail the actual registration/company-creation it's attached to.

export const recordUserCreated = async (params: {
  newUserId: number;
  newUserRole: string;
  newUserTenantId: number | null;
  actorId: number | null;
  actorRole: string | null;
  companyId?: number | null;
}) => {
  const { newUserId, newUserRole, newUserTenantId, actorId, actorRole, companyId } = params;
  if (!["admin", "manager", "sale_person"].includes(newUserRole)) return;

  if (newUserTenantId) {
    await SetupAuditLog.create({
      entityType: "tenant",
      entityId: newUserTenantId,
      action: "created",
      actorId,
      actorRole,
      detail: { createdRole: newUserRole, createdUserId: newUserId },
    });
  }

  if (companyId) {
    await SetupAuditLog.create({
      entityType: "company",
      entityId: companyId,
      action: "created",
      actorId,
      actorRole,
      detail: { createdRole: newUserRole, createdUserId: newUserId },
    });
  }
};

export const recordCompanyCreated = async (params: {
  companyId: number;
  companyName: string;
  tenantUserId: number | null;
  actorId: number | null;
  actorRole: string | null;
}) => {
  const { companyId, companyName, tenantUserId, actorId, actorRole } = params;

  await SetupAuditLog.create({
    entityType: "company",
    entityId: companyId,
    action: "created",
    actorId,
    actorRole,
    detail: { companyName },
  });

  if (tenantUserId) {
    await SetupAuditLog.create({
      entityType: "tenant",
      entityId: tenantUserId,
      action: "item_added",
      actorId,
      actorRole,
      detail: { companyId, companyName },
    });
  }

  // Spec: a User self-serving a new company (not the super_admin doing
  // assisted setup) should be surfaced to the Super Admin as needing review.
  if (actorRole && actorRole !== "super_admin" && tenantUserId) {
    await notifySuperAdmins({
      senderId: actorId,
      title: "New company created",
      body: `A new company ("${companyName}") was created and its setup needs review.`,
      data: { subtype: "setup_needed", companyId, tenantUserId },
    }).catch(() => {});
  }
};
