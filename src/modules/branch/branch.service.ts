import { ServiceError } from "../shared/serviceError";
import { hasCompanyAccess } from "../shared/companyAccess";
import { createBranch, findBranchOwnedBy, findBranches } from "./branch.repository";

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
}

export const addBranch = async (userId: number, input: AddBranchInput) => {
  const {
    branchName, branchCode, branchCity, branchState, branchCountry, postalCode,
    addressLine1, addressLine2, branchEmail, branchPhone,
    latitude, longitude, geoRadius, adminId, managerId, companyId,
  } = input;

  if (!branchName || branchName.trim().length < 2) throw new ServiceError("Branch name is required (min 2 chars)");
  if (!branchCode || branchCode.trim().length < 2) throw new ServiceError("Branch code is required");
  if (!branchCity) throw new ServiceError("Branch city is required");
  if (!branchState) throw new ServiceError("Branch state is required");
  if (!branchCountry) throw new ServiceError("Branch country is required");
  if (!postalCode || postalCode.length < 4) throw new ServiceError("Valid postal code is required");
  if (!addressLine1) throw new ServiceError("Address Line 1 is required");

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
    branchEmail,
    branchPhone,
    latitude: Number(latitude),
    longitude: Number(longitude),
    geoRadius: Number(geoRadius),
    adminId: adminId ? Number(adminId) : null,
    managerId: managerId ? Number(managerId) : null,
    userId,
    companyId: Number(companyId),
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
}

export const updateBranch = async (id: number, userId: number, input: UpdateBranchInput) => {
  const branch = await findBranchOwnedBy(id, userId);
  if (!branch) throw new ServiceError("Branch not found");

  const {
    branchName, branchCode, branchCity, branchState, branchCountry, postalCode,
    addressLine1, addressLine2, branchEmail, branchPhone,
    latitude, longitude, geoRadius, adminId, managerId,
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
  if (branchEmail !== undefined) b.branchEmail = branchEmail;
  if (branchPhone !== undefined) b.branchPhone = branchPhone;
  if (latitude !== undefined) b.latitude = Number(latitude);
  if (longitude !== undefined) b.longitude = Number(longitude);
  if (geoRadius !== undefined) b.geoRadius = Number(geoRadius);
  if (adminId !== undefined) b.adminId = adminId || null;
  if (managerId !== undefined) b.managerId = managerId || null;
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

export const getBranchById = async (id: number, userId: number) => {
  const branch = await findBranchOwnedBy(id, userId);
  if (!branch) throw new ServiceError("Branch not found");
  return branch;
};
