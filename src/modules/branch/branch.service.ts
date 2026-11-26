import { ServiceError } from "../shared/serviceError";
import { hasCompanyAccess } from "../shared/companyAccess";
import { createBranch, findBranches } from "./branch.repository";
import { Branch, sequelize } from "../../config/dbConnection";

// FIX: update/get/delete used findBranchOwnedBy(id, userId) — a match on the
// branch's CREATOR only. Branches are stamped with whoever created them, so
// the company's own admin (e.g. a second admin, or the owner editing what
// the super admin set up) got "Branch not found" when saving. Access now
// follows the company, the same rule the branch list already uses.
const findAccessibleBranch = async (id: number, userId: number, role?: string) => {
  const branch: any = await (Branch as any).findByPk(id);
  if (!branch) throw new ServiceError("Branch not found");
  if (branch.companyId == null) {
    // Legacy row without a company — creator only, as before.
    if (Number(branch.userId) !== Number(userId) && role !== "super_admin") throw new ServiceError("Branch not found");
    return branch;
  }
  const allowed = await hasCompanyAccess(Number(branch.companyId), userId, role);
  if (!allowed) throw new ServiceError("Branch not found");
  return branch;
};

// ============================================================
// Branch service — validation + orchestration. Byte-for-byte port of the
// previous addBranch/updateBranch/getBranch/getBranchById controller
// bodies in admin.ts.
// ============================================================

interface AddBranchInput {
  branchName: string;
  branchCode: string;
  branchCity: string;
  branchState: string;
  branchCountry: string;
  postalCode: string;
  addressLine1: string;
  addressLine2?: string;
  branchEmail?: string;
  branchPhone?: string;
  latitude: unknown;
  longitude: unknown;
  geoRadius: unknown;
  adminId?: number | string | null;
  managerId?: number | string | null;
  companyId: unknown;
  gstNumber?: string | null;
  branchDistrict?: string | null;
}

// GST number / district are optional. FIX: gstNumber was accepted by the
// branch form but never saved (dropped here), so a branch's GST was lost.
const GST_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const cleanGst = (v: unknown): string | null => {
  const s = String(v ?? "").trim().toUpperCase();
  if (!s) return null;
  if (!GST_RE.test(s)) throw new ServiceError("Invalid branch GST number format");
  return s;
};
const cleanEmail = (v: unknown): string | null => {
  const s = String(v ?? "").trim();
  if (!s) return null;
  if (!/^\S+@\S+\.\S+$/.test(s)) throw new ServiceError("Branch email is not valid");
  return s;
};
const cleanPhone = (v: unknown): string | null => {
  const s = String(v ?? "").trim();
  if (!s) return null;
  if (s.replace(/\D/g, "").length < 8) throw new ServiceError("Branch phone is not valid");
  return s;
};
const cleanDistrict = (v: unknown): string | null => {
  const s = String(v ?? "").trim();
  return s ? s.slice(0, 100) : null;
};

export const addBranch = async (userId: number, input: AddBranchInput) => {
  const {
    branchName, branchCode, branchCity, branchState, branchCountry, postalCode,
    addressLine1, addressLine2, branchEmail, branchPhone,
    latitude, longitude, geoRadius, adminId, managerId, companyId,
    gstNumber, branchDistrict,
  } = input;

  if (!branchName || branchName.trim().length < 2) throw new ServiceError("Branch name is required (min 2 chars)");
  if (!branchCode || branchCode.trim().length < 2) throw new ServiceError("Branch code is required");
  if (!branchCity) throw new ServiceError("Branch city is required");
  if (!branchState) throw new ServiceError("Branch state is required");
  if (!branchCountry) throw new ServiceError("Branch country is required");
  if (!postalCode || postalCode.length < 4) throw new ServiceError("Valid postal code is required");
  if (!addressLine1) throw new ServiceError("Address Line 1 is required");
  // Email / phone are optional (the form says so; migration 0060 made the
  // columns nullable). Checked only when filled in.
  const email = cleanEmail(branchEmail);
  const phone = cleanPhone(branchPhone);

  if (latitude === undefined || isNaN(Number(latitude)) || Number(latitude) < -90 || Number(latitude) > 90) {
    throw new ServiceError("Latitude must be between -90 and 90");
  }
  if (longitude === undefined || isNaN(Number(longitude)) || Number(longitude) < -180 || Number(longitude) > 180) {
    throw new ServiceError("Longitude must be between -180 and 180");
  }
  if (geoRadius === undefined || isNaN(Number(geoRadius)) || Number(geoRadius) <= 0) {
    throw new ServiceError("Geo radius must be a positive number");
  }
  if (adminId && isNaN(Number(adminId))) throw new ServiceError("adminId must be a number");
  if (managerId && isNaN(Number(managerId))) throw new ServiceError("managerId must be a number");

  // companyId is required — the registration wizard's Step2 previously
  // never sent it at all, so every branch created during onboarding ended
  // up orphaned from its company, silently breaking geofencing/shift/
  // department linkage downstream.
  if (!companyId || isNaN(Number(companyId))) throw new ServiceError("Valid companyId is required");

  return createBranch({
    branchName,
    branchCode,
    branchCity,
    branchState,
    branchCountry,
    postalCode,
    addressLine1,
    addressLine2: addressLine2 || null,
    branchEmail: email,
    branchPhone: phone,
    latitude: Number(latitude),
    longitude: Number(longitude),
    geoRadius: Number(geoRadius),
    adminId: adminId ? Number(adminId) : null,
    managerId: managerId ? Number(managerId) : null,
    userId,
    companyId: Number(companyId),
    gstNumber: cleanGst(gstNumber),
    branchDistrict: cleanDistrict(branchDistrict),
  });
};

interface UpdateBranchInput {
  branchName?: string;
  branchCode?: string;
  branchCity?: string;
  branchState?: string;
  branchCountry?: string;
  postalCode?: string;
  addressLine1?: string;
  addressLine2?: string;
  branchEmail?: string;
  branchPhone?: string;
  latitude?: unknown;
  longitude?: unknown;
  geoRadius?: unknown;
  adminId?: number | string | null;
  managerId?: number | string | null;
  gstNumber?: string | null;
  branchDistrict?: string | null;
}

export const updateBranch = async (id: number, userId: number, input: UpdateBranchInput, role?: string) => {
  const branch = await findAccessibleBranch(id, userId, role);

  const {
    branchName, branchCode, branchCity, branchState, branchCountry, postalCode,
    addressLine1, addressLine2, branchEmail, branchPhone,
    latitude, longitude, geoRadius, adminId, managerId,
    gstNumber, branchDistrict,
  } = input;

  if (latitude !== undefined && (isNaN(Number(latitude)) || Number(latitude) < -90 || Number(latitude) > 90)) {
    throw new ServiceError("Latitude must be between -90 and 90");
  }
  if (longitude !== undefined && (isNaN(Number(longitude)) || Number(longitude) < -180 || Number(longitude) > 180)) {
    throw new ServiceError("Longitude must be between -180 and 180");
  }
  if (geoRadius !== undefined && (isNaN(Number(geoRadius)) || Number(geoRadius) <= 0)) {
    throw new ServiceError("Geo radius must be a positive number");
  }

  const b = branch as any;
  if (branchName !== undefined) b.branchName = branchName;
  if (branchCode !== undefined) b.branchCode = branchCode;
  if (branchCity !== undefined) b.branchCity = branchCity;
  if (branchState !== undefined) b.branchState = branchState;
  if (branchCountry !== undefined) b.branchCountry = branchCountry;
  if (postalCode !== undefined) b.postalCode = postalCode;
  if (addressLine1 !== undefined) b.addressLine1 = addressLine1;
  if (addressLine2 !== undefined) b.addressLine2 = addressLine2;
  if (branchEmail !== undefined) b.branchEmail = cleanEmail(branchEmail);
  if (branchPhone !== undefined) b.branchPhone = cleanPhone(branchPhone);
  if (latitude !== undefined) b.latitude = Number(latitude);
  if (longitude !== undefined) b.longitude = Number(longitude);
  if (geoRadius !== undefined) b.geoRadius = Number(geoRadius);
  if (adminId !== undefined) b.adminId = adminId || null;
  if (managerId !== undefined) b.managerId = managerId || null;
  if (gstNumber !== undefined) b.gstNumber = cleanGst(gstNumber);
  if (branchDistrict !== undefined) b.branchDistrict = cleanDistrict(branchDistrict);
  // companyId is intentionally not editable here — re-parenting a branch to
  // a different company is not a supported operation from this form.

  await branch.save();
  return branch;
};

export const listBranches = async (params: { userId: number; role?: string; companyId?: string | number; page: number; limit: number; search?: string }) => {
  if (params.companyId) {
    const allowed = await hasCompanyAccess(Number(params.companyId), params.userId, params.role);
    if (!allowed) throw new ServiceError("You do not have access to this company", 403);
  }

  const { count, rows } = await findBranches({
    userId: params.userId,
    companyId: params.companyId,
    search: params.search,
    limit: params.limit,
    offset: (params.page - 1) * params.limit,
  });

  return {
    total: count,
    page: params.page,
    limit: params.limit,
    totalPages: Math.ceil(count / params.limit),
    data: rows,
  };
};

export const getBranchById = async (id: number, userId: number, role?: string) => {
  return findAccessibleBranch(id, userId, role);
};

// DELETE /admin/deletebranch/:id
// Refused while people or quotations still use the branch, or when it is the
// company's only branch. Otherwise, in one transaction: company settings that
// were merely stamped with this branch (departments, shifts, leave types,
// banks, leave balances) move to another branch of the same company so they
// keep working; this branch's own holiday copies are removed; then the branch.
const count = async (table: string, branchId: number, t: any) => {
  const [rows]: any = await sequelize.query(`SELECT COUNT(*)::int AS n FROM "${table}" WHERE "branchId" = :branchId`, {
    replacements: { branchId },
    transaction: t,
  });
  return Number(rows?.[0]?.n || 0);
};

export const deleteBranch = async (id: number, userId: number, role?: string) => {
  const branch: any = await findAccessibleBranch(id, userId, role);
  const companyId = branch.companyId != null ? Number(branch.companyId) : null;

  return sequelize.transaction(async (t) => {
    const people = Math.max(await count("users", id, t), await count("user_branches", id, t));
    if (people > 0) {
      throw new ServiceError(
        `${people} ${people === 1 ? "person is" : "people are"} assigned to this branch. Move them to another branch first, then delete it.`
      );
    }
    const quotations = await count("quotations", id, t);
    if (quotations > 0) {
      throw new ServiceError(`This branch has ${quotations} quotation(s), so it can't be deleted.`);
    }

    const others: any[] = companyId != null
      ? await (Branch as any).findAll({ where: { companyId }, attributes: ["id"], order: [["id", "ASC"]], transaction: t })
      : [];
    const target = others.map((b) => Number(b.id)).find((bid) => bid !== id);
    if (companyId != null && !target) {
      throw new ServiceError("This is the company's only branch. Add another branch before deleting it.");
    }

    if (target) {
      for (const table of ["departments", "shifts", "company_leaves", "company_banks", "employee_leave_balances"]) {
        await sequelize.query(`UPDATE "${table}" SET "branchId" = :target WHERE "branchId" = :id`, {
          replacements: { target, id },
          transaction: t,
        });
      }
    }
    await sequelize.query(`DELETE FROM "holidays" WHERE "branchId" = :id`, { replacements: { id }, transaction: t });
    await branch.destroy({ transaction: t });
    return { id, movedSettingsTo: target ?? null };
  });
};
