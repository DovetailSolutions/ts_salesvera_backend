import { ServiceError } from "../shared/serviceError";
import { hasCompanyAccess } from "../shared/companyAccess";
import { createShift, findShiftOwnedBy, findShifts, findCompanyById } from "./shift.repository";

// ============================================================
// Shift service — validation + orchestration. Byte-for-byte port of the
// previous addShift/updateShift/getShift/getShiftById controller bodies
// (and their two module-local helpers) in admin.ts.
// ============================================================

const validateShiftItem = (s: any): string | null => {
  if (!s?.shiftName || String(s.shiftName).trim().length < 2) return "Shift name is required";
  if (!s?.shiftCode || String(s.shiftCode).trim().length < 2) return "Shift code is required";
  if (!s?.startTime || !s?.endTime) return "Start time and end time are required";
  if (!/^\d{2}:\d{2}$/.test(s.startTime) || !/^\d{2}:\d{2}$/.test(s.endTime)) return "Time must be in HH:mm format";
  if (s.breakMinutes !== undefined && isNaN(Number(s.breakMinutes))) return "Break minutes must be a number";
  if (s.workingHours !== undefined && isNaN(Number(s.workingHours))) return "Working hours must be a number";
  if (s.lateMarkAfter !== undefined && isNaN(Number(s.lateMarkAfter))) return "lateMarkAfter must be a number";
  if (s.halfDayAfter !== undefined && isNaN(Number(s.halfDayAfter))) return "halfDayAfter must be a number";
  return null;
};

const buildShiftCreateAttrs = (s: any, branchId: number, companyId: number, ownerUserId: number) => ({
  shiftName: s.shiftName,
  shiftCode: s.shiftCode,
  startTime: s.startTime,
  endTime: s.endTime,
  fullDayHours: s.fullDayHours,
  nightShift: !!s.nightShift,
  breakMinutes: s.breakMinutes !== undefined ? Number(s.breakMinutes) : 0,
  workingHours: s.workingHours !== undefined ? Number(s.workingHours) : 8,
  lateMarkAfter: s.lateMarkAfter !== undefined ? Number(s.lateMarkAfter) : 0,
  halfDayAfter: s.halfDayAfter !== undefined ? Number(s.halfDayAfter) : 0,
  branchId,
  companyId,
  userId: ownerUserId,
});

export const addShift = async (userId: number, body: any) => {
  const {
    shifts,
    branchId,
    companyId,
    createdBy,
    // Company-wide attendance policy — collected in the same wizard step
    // (Step3.jsx) as shifts and sent bundled in this same request by the
    // registration wizard. Wire names differ slightly from the Company DB
    // columns (workingDays -> companyWorkingDays, alternateSaturday -> altSaturday).
    workingDays,
    halfSaturday,
    alternateSaturday,
    officeLocationRequired,
    geoFencingRequired,
    overtimeAllowed,
    lateMarkAfter: companyLateMarkAfter,
    autoHalfDayAfter: companyAutoHalfDayAfter,
  } = body;

  if (!branchId || isNaN(Number(branchId))) throw new ServiceError("Valid branchId is required");
  if (!companyId || isNaN(Number(companyId))) throw new ServiceError("Valid companyId is required");

  const ownerUserId = createdBy && !isNaN(Number(createdBy)) ? Number(createdBy) : Number(userId);

  // Duplicate shiftCode is intentionally allowed (see constraintsToDrop in
  // dbConnection.ts — the DB unique constraint was removed on request).

  // Batched shape: { shifts: [...], companyId, branchId, ... } — used by the
  // registration wizard (saveStep3) to create several shifts at once.
  let createdShifts: any[];
  if (Array.isArray(shifts)) {
    if (shifts.length === 0) throw new ServiceError("At least one shift is required");
    for (const s of shifts) {
      const err = validateShiftItem(s);
      if (err) throw new ServiceError(err);
    }
    createdShifts = await Promise.all(
      shifts.map((s: any) => createShift(buildShiftCreateAttrs(s, Number(branchId), Number(companyId), ownerUserId)))
    );
  } else {
    // Legacy single-shift shape: { shiftName, shiftCode, ..., companyId,
    // branchId } — still used by AdminSettings.jsx / CompanyDetailEditor.jsx
    // (one addShift call per shift row).
    const err = validateShiftItem(body);
    if (err) throw new ServiceError(err);
    const shift = await createShift(buildShiftCreateAttrs(body, Number(branchId), Number(companyId), ownerUserId));
    createdShifts = [shift];
  }

  // Only touches fields that were actually sent — callers that don't send
  // any attendance-policy fields (the legacy single-shift call sites, which
  // save company policy via updateCompany separately) leave the company row
  // untouched here.
  const hasCompanySettings =
    workingDays !== undefined || halfSaturday !== undefined || alternateSaturday !== undefined ||
    officeLocationRequired !== undefined || geoFencingRequired !== undefined ||
    overtimeAllowed !== undefined || companyLateMarkAfter !== undefined || companyAutoHalfDayAfter !== undefined;

  if (hasCompanySettings) {
    if (companyLateMarkAfter !== undefined && isNaN(Number(companyLateMarkAfter))) {
      throw new ServiceError("lateMarkAfter must be a number");
    }
    if (companyAutoHalfDayAfter !== undefined && isNaN(Number(companyAutoHalfDayAfter))) {
      throw new ServiceError("autoHalfDayAfter must be a number");
    }

    const company = await findCompanyById(Number(companyId));
    if (company) {
      const updates: any = {};
      if (workingDays !== undefined) updates.companyWorkingDays = Array.isArray(workingDays) ? workingDays : null;
      if (halfSaturday !== undefined) updates.halfSaturday = Boolean(halfSaturday);
      if (alternateSaturday !== undefined) updates.altSaturday = Boolean(alternateSaturday);
      if (officeLocationRequired !== undefined) updates.officeLocationRequired = Boolean(officeLocationRequired);
      if (geoFencingRequired !== undefined) updates.geoFencingRequired = Boolean(geoFencingRequired);
      if (overtimeAllowed !== undefined) updates.overtimeAllowed = Boolean(overtimeAllowed);
      if (companyLateMarkAfter !== undefined) updates.lateMarkAfter = Number(companyLateMarkAfter);
      if (companyAutoHalfDayAfter !== undefined) updates.autoHalfDayAfter = Number(companyAutoHalfDayAfter);
      await (company as any).update(updates);
    }
  }

  return Array.isArray(shifts) ? createdShifts : createdShifts[0];
};

export const updateShift = async (id: number, userId: number, input: any) => {
  const shift = await findShiftOwnedBy(id, userId);
  if (!shift) throw new ServiceError("Shift not found");

  const {
    shiftName, shiftCode, startTime, endTime, fullDayHours, nightShift,
    breakMinutes, workingHours, lateMarkAfter, halfDayAfter, branchId,
  } = input;

  if (startTime !== undefined && !/^\d{2}:\d{2}$/.test(startTime)) {
    throw new ServiceError("startTime must be in HH:mm format");
  }
  if (endTime !== undefined && !/^\d{2}:\d{2}$/.test(endTime)) {
    throw new ServiceError("endTime must be in HH:mm format");
  }

  const s = shift as any;
  if (shiftName !== undefined) s.shiftName = shiftName;
  if (shiftCode !== undefined) s.shiftCode = shiftCode;
  if (startTime !== undefined) s.startTime = startTime;
  if (endTime !== undefined) s.endTime = endTime;
  if (fullDayHours !== undefined) s.fullDayHours = Number(fullDayHours);
  if (nightShift !== undefined) s.nightShift = !!nightShift;
  if (breakMinutes !== undefined) s.breakMinutes = Number(breakMinutes);
  if (workingHours !== undefined) s.workingHours = Number(workingHours);
  if (lateMarkAfter !== undefined) s.lateMarkAfter = Number(lateMarkAfter);
  if (halfDayAfter !== undefined) s.halfDayAfter = Number(halfDayAfter);
  if (branchId !== undefined) s.branchId = Number(branchId);
  // companyId is intentionally not editable here.

  await shift.save();
  return shift;
};

export const listShifts = async (params: {
  userId: number;
  role?: string;
  page: number;
  limit: number;
  search?: string;
  branchId?: string;
  companyId?: string;
}) => {
  const limit = Math.min(params.limit, 50);
  const offset = (params.page - 1) * limit;

  if (params.companyId) {
    const allowed = await hasCompanyAccess(Number(params.companyId), params.userId, params.role);
    if (!allowed) throw new ServiceError("You do not have access to this company", 403);
  }

  const { count, rows } = await findShifts({
    userId: params.userId,
    search: params.search,
    branchId: params.branchId,
    companyId: params.companyId,
    limit,
    offset,
  });

  return {
    total: count,
    page: params.page,
    limit,
    totalPages: Math.ceil(count / limit),
    data: rows,
  };
};

export const getShiftById = async (id: number, userId: number) => {
  const shift = await findShiftOwnedBy(id, userId);
  if (!shift) throw new ServiceError("Shift not found");
  return shift;
};
