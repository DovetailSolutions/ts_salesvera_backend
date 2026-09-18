import { Op, Transaction, UniqueConstraintError, fn, col } from "sequelize";
import { sequelize, User, Company, CompanyAdmin } from "../../config/dbConnection";
import { ServiceError } from "../shared/serviceError";
import { hasCompanyAccess, resolveCompanyEmployeeIds } from "../shared/companyAccess";
import { getCompanyScopedChildUserIdsFast } from "../shared/userHierarchy";
import { generateBusinessId } from "../shared/businessId.service";
import { sendNotification } from "../../config/notificationService";
import { NotificationType } from "../../app/model/Notification";
import { getISTDateString } from "../shared/dateUtils";
import { Asset, AssetAssignment, AssetAuditLog, AssetCategory, SAFE_USER_ATTRIBUTES } from "./asset.models";
import {
  ASSET_CODE_PAD_WIDTH,
  ASSET_CODE_SEQUENCE,
  ASSET_CONDITIONS,
  ASSET_NOTIFICATION_KINDS,
  ASSET_STATUSES,
  ASSIGNABLE_STATUS,
  ASSIGNEE_ROLES,
  AssetAuditAction,
  EDITABLE_STATUSES,
} from "./asset.constants";

// ============================================================
// Asset Management service. Every entry point receives the caller (`actor`)
// exactly as tokenCheck resolved it from the verified JWT — company scope is
// derived from that, never from a companyId in the request.
// ============================================================

export interface Actor {
  userId: number;
  role: string;
  companyId: number | null;
}

const MAX_PAGE_SIZE = 100;

// ── Scope ────────────────────────────────────────────────────────────────

// The company this admin is currently acting in, re-verified against the
// company/admin relationship tables on every call.
export const requireAdminCompany = async (actor: Actor): Promise<number> => {
  if (actor.role !== "admin") {
    throw new ServiceError("Only an admin can manage assets", 403);
  }
  if (!actor.companyId) {
    throw new ServiceError("No active company is associated with your account", 403);
  }
  const companyId = Number(actor.companyId);
  if (!(await hasCompanyAccess(companyId, Number(actor.userId), actor.role))) {
    throw new ServiceError("You do not have access to this company", 403);
  }
  return companyId;
};

// Everyone the admin may hand an asset to: their company-scoped team (the
// same helper every other admin team endpoint uses) plus the company's
// managers and branch-resolved employees, so a second admin of the same
// company can assign to people the first admin created. Filtered to active
// employee/manager accounts only.
const resolveAssignableUserIds = async (adminId: number, companyId: number): Promise<number[]> => {
  const [teamIds, members] = await Promise.all([
    getCompanyScopedChildUserIdsFast(adminId, companyId),
    resolveCompanyEmployeeIds(companyId),
  ]);
  return Array.from(new Set([...teamIds, ...members.managerIds, ...members.salePersonIds]));
};

const findEligibleAssignee = async (adminId: number, companyId: number, userId: number) => {
  const ids = await resolveAssignableUserIds(adminId, companyId);
  if (!ids.includes(userId)) return null;
  return User.findOne({
    where: { id: userId, status: "active", role: { [Op.in]: [...ASSIGNEE_ROLES] } },
    attributes: SAFE_USER_ATTRIBUTES,
  });
};

// ── Validation helpers ─────────────────────────────────────────────────────

const parseId = (value: unknown, label: string): number => {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new ServiceError(`A valid ${label} is required`);
  return n;
};

export const optionalText = (value: unknown, label: string, max: number): string | null => {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  if (s.length === 0) return null;
  if (s.length > max) throw new ServiceError(`${label} must be at most ${max} characters`);
  return s;
};

export const requiredText = (value: unknown, label: string, max: number): string => {
  const s = optionalText(value, label, max);
  if (!s) throw new ServiceError(`${label} is required`);
  return s;
};

export const isValidDateOnly = (s: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00.000Z`);
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

// A calendar date that isn't in the future (IST — the app's business timezone).
const pastOrTodayDate = (value: unknown, label: string): string | null => {
  if (value === undefined || value === null || value === "") return null;
  const s = String(value).slice(0, 10);
  if (!isValidDateOnly(s)) throw new ServiceError(`${label} must be a valid date (YYYY-MM-DD)`);
  if (s > getISTDateString()) throw new ServiceError(`${label} cannot be in the future`);
  return s;
};

// Assignment/return dates are captured as calendar dates in the form; stored
// as an instant. Today's date means "now" so same-day assign → return still
// orders correctly; a past date is anchored to IST noon of that day.
const eventInstant = (dateOnly: string | null): Date => {
  if (!dateOnly || dateOnly === getISTDateString()) return new Date();
  return new Date(`${dateOnly}T12:00:00.000+05:30`);
};

export const parsePrice = (value: unknown): string | null => {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new ServiceError("Purchase price must be a non-negative number");
  if (n >= 1e10) throw new ServiceError("Purchase price is too large");
  return n.toFixed(2);
};

export const parseCondition = (value: unknown, fallback: string | null = null): string | null => {
  if (value === undefined || value === null || value === "") return fallback;
  const c = String(value).toUpperCase();
  if (!(ASSET_CONDITIONS as readonly string[]).includes(c)) {
    throw new ServiceError(`Condition must be one of: ${ASSET_CONDITIONS.join(", ")}`);
  }
  return c;
};

const findUsableCategory = async (categoryId: number, companyId: number, transaction?: Transaction) => {
  const category = await AssetCategory.findOne({
    where: { id: categoryId, isActive: true, [Op.or]: [{ companyId: null }, { companyId }] },
    attributes: ["id", "name"],
    transaction,
  });
  if (!category) throw new ServiceError("Asset type not found");
  return category;
};

const writeAudit = (
  entry: {
    companyId: number;
    assetId: number | null;
    action: AssetAuditAction;
    actor: Actor;
    targetUserId?: number | null;
    detail?: Record<string, any> | null;
  },
  transaction?: Transaction
) =>
  AssetAuditLog.create(
    {
      companyId: entry.companyId,
      assetId: entry.assetId,
      action: entry.action,
      actorId: Number(entry.actor.userId),
      actorRole: entry.actor.role,
      targetUserId: entry.targetUserId ?? null,
      detail: entry.detail ?? null,
    },
    { transaction }
  );

const fullName = (u: any) => `${u?.firstName ?? ""} ${u?.lastName ?? ""}`.trim() || u?.email || "a team member";

// Other admins of the company (primary + additional), excluding the actor.
const otherCompanyAdminIds = async (companyId: number, actorId: number): Promise<number[]> => {
  const [company, links]: [any, any[]] = await Promise.all([
    Company.findByPk(companyId, { attributes: ["adminId"] }),
    CompanyAdmin.findAll({ where: { companyId }, attributes: ["adminId"] }),
  ]);
  const ids = new Set<number>(links.map((l: any) => Number(l.adminId)));
  if (company?.adminId) ids.add(Number(company.adminId));
  ids.delete(Number(actorId));
  return Array.from(ids);
};

// Notifications are sent only after the transaction commits — a notification
// must never announce an assignment that was rolled back. They run in the
// background (not awaited by the request): sendNotification still persists
// the row, emits over Socket.IO and pushes to devices, but the admin's
// response no longer waits on push delivery. Failures are logged, never
// thrown (the asset action itself has already succeeded).
const notifySafely = (fn: () => Promise<void>): void => {
  void fn().catch((err) => console.error("Asset notification failed:", err));
};

const actorName = async (actorId: number) => {
  const actor = await User.findByPk(actorId, { attributes: ["firstName", "lastName", "email"] });
  return fullName(actor);
};

const assetListInclude = (holderWhere?: Record<string, any>) => [
  { model: AssetCategory, as: "category", attributes: ["id", "name"] },
  {
    model: AssetAssignment,
    as: "activeAssignment",
    required: !!holderWhere,
    where: holderWhere,
    attributes: ["id", "assignedToId", "assignedAt", "conditionAtAssignment", "remarks"],
    include: [{ model: User, as: "assignedTo", attributes: SAFE_USER_ATTRIBUTES }],
  },
];

export const isUniqueViolation = (err: unknown, constraint: string) =>
  err instanceof UniqueConstraintError &&
  ((err as any).parent?.constraint === constraint || String((err as any).parent?.detail ?? "").includes(constraint) ||
    (err as any).original?.constraint === constraint);

// ── Metadata ─────────────────────────────────────────────────────────────────

export const getMeta = () => ({
  statuses: ASSET_STATUSES,
  editableStatuses: EDITABLE_STATUSES,
  assignableStatus: ASSIGNABLE_STATUS,
  conditions: ASSET_CONDITIONS,
  assigneeRoles: ASSIGNEE_ROLES,
});

// ── Categories ───────────────────────────────────────────────────────────────

export const listCategories = async (actor: Actor, query: any) => {
  const companyId = await requireAdminCompany(actor);
  const includeInactive = String(query.includeInactive) === "true";

  const categories = await AssetCategory.findAll({
    where: {
      [Op.or]: [{ companyId: null }, { companyId }],
      ...(includeInactive ? {} : { isActive: true }),
    },
    attributes: ["id", "name", "companyId", "isActive", "createdAt"],
    order: [["name", "ASC"]],
  });

  // One grouped count for this company's usage of every category.
  const counts: any[] = await Asset.findAll({
    where: { companyId },
    attributes: ["categoryId", [fn("COUNT", col("id")), "count"]],
    group: ["categoryId"],
    raw: true,
  });
  const countByCategory = new Map(counts.map((c: any) => [Number(c.categoryId), Number(c.count)]));

  return categories.map((c: any) => ({
    id: c.id,
    name: c.name,
    isActive: c.isActive,
    isDefault: c.companyId == null,
    assetCount: countByCategory.get(c.id) ?? 0,
  }));
};

export const createCategory = async (actor: Actor, body: any) => {
  const companyId = await requireAdminCompany(actor);
  const name = requiredText(body?.name, "Category name", 80);

  const clash = await AssetCategory.findOne({
    where: {
      [Op.or]: [{ companyId: null }, { companyId }],
      [Op.and]: [sequelize.where(fn("LOWER", col("name")), name.toLowerCase())],
    },
    attributes: ["id"],
  });
  if (clash) throw new ServiceError("An asset type with this name already exists", 409);

  return sequelize.transaction(async (transaction) => {
    const category = await AssetCategory.create(
      { companyId, name, isActive: true, createdBy: Number(actor.userId) },
      { transaction }
    );
    await writeAudit({ companyId, assetId: null, action: "CATEGORY_CREATED", actor, detail: { categoryId: category.id, name } }, transaction);
    return { id: category.id, name: category.name, isActive: true, isDefault: false, assetCount: 0 };
  });
};

// Only a company's own categories can be renamed/deactivated/deleted — the
// shared defaults are read-only for every company.
const findOwnCategory = async (companyId: number, categoryId: number, transaction?: Transaction) => {
  const category = await AssetCategory.findOne({ where: { id: categoryId }, transaction, lock: transaction ? transaction.LOCK.UPDATE : undefined });
  if (!category || (category.companyId != null && Number(category.companyId) !== companyId)) {
    throw new ServiceError("Asset type not found", 404);
  }
  if (category.companyId == null) {
    throw new ServiceError("Default asset types cannot be modified", 403);
  }
  return category;
};

export const updateCategory = async (actor: Actor, idParam: unknown, body: any) => {
  const companyId = await requireAdminCompany(actor);
  const categoryId = parseId(idParam, "asset type id");

  return sequelize.transaction(async (transaction) => {
    const category = await findOwnCategory(companyId, categoryId, transaction);
    const updates: Record<string, any> = {};
    if (body?.name !== undefined) {
      const name = requiredText(body.name, "Category name", 80);
      const clash = await AssetCategory.findOne({
        where: {
          id: { [Op.ne]: categoryId },
          [Op.or]: [{ companyId: null }, { companyId }],
          [Op.and]: [sequelize.where(fn("LOWER", col("name")), name.toLowerCase())],
        },
        attributes: ["id"],
        transaction,
      });
      if (clash) throw new ServiceError("An asset type with this name already exists", 409);
      updates.name = name;
    }
    if (body?.isActive !== undefined) updates.isActive = body.isActive === true || body.isActive === "true";

    const previous = { name: category.name, isActive: category.isActive };
    await category.update(updates, { transaction });
    await writeAudit(
      { companyId, assetId: null, action: "CATEGORY_UPDATED", actor, detail: { categoryId, previous, updates } },
      transaction
    );
    return { id: category.id, name: category.name, isActive: category.isActive, isDefault: false };
  });
};

export const deleteCategory = async (actor: Actor, idParam: unknown) => {
  const companyId = await requireAdminCompany(actor);
  const categoryId = parseId(idParam, "asset type id");

  return sequelize.transaction(async (transaction) => {
    const category = await findOwnCategory(companyId, categoryId, transaction);
    const inUse = await Asset.count({ where: { categoryId }, transaction });
    if (inUse > 0) {
      throw new ServiceError(`This asset type is used by ${inUse} asset(s). Deactivate it instead.`, 409);
    }
    await category.destroy({ transaction });
    await writeAudit({ companyId, assetId: null, action: "CATEGORY_DELETED", actor, detail: { categoryId, name: category.name } }, transaction);
    return { id: categoryId };
  });
};

// ── Assets: read ─────────────────────────────────────────────────────────────

const SORTABLE = new Set(["createdAt", "assetCode", "name", "purchaseDate", "status", "brand"]);

// Filters + sort shared by the paginated list and the Excel export, so an
// export always contains exactly what the admin is looking at.
export const buildAssetQuery = (companyId: number, query: any) => {
  const where: Record<string | symbol, any> = { companyId };

  const search = String(query.search ?? "").trim();
  if (search) {
    const like = { [Op.iLike]: `%${search}%` };
    where[Op.or] = [
      { assetCode: like },
      { name: like },
      { serialNumber: like },
      { brand: like },
      { model: like },
    ];
  }

  if (query.categoryId) where.categoryId = parseId(query.categoryId, "asset type id");

  if (query.status) {
    const status = String(query.status).toUpperCase();
    if (!(ASSET_STATUSES as readonly string[]).includes(status)) throw new ServiceError("Invalid status filter");
    where.status = status;
  }

  if (query.assigned === "true") where.status = "ASSIGNED";
  if (query.assigned === "false") where.status = where.status && where.status !== "ASSIGNED" ? where.status : { [Op.ne]: "ASSIGNED" };

  const holderWhere = query.assignedToId ? { assignedToId: parseId(query.assignedToId, "holder id") } : undefined;

  const sortBy = SORTABLE.has(String(query.sortBy)) ? String(query.sortBy) : "createdAt";
  const sortDir = String(query.sortDir).toUpperCase() === "ASC" ? "ASC" : "DESC";

  return {
    where,
    include: assetListInclude(holderWhere),
    order: [[sortBy, sortDir], ["id", "DESC"]] as [string, string][],
  };
};

export const listAssets = async (actor: Actor, query: any) => {
  const companyId = await requireAdminCompany(actor);

  const page = Math.max(1, Math.floor(Number(query.page)) || 1);
  const limit = Math.min(Math.max(1, Math.floor(Number(query.limit)) || 10), MAX_PAGE_SIZE);
  const offset = (page - 1) * limit;

  const { where, include, order } = buildAssetQuery(companyId, query);

  const { rows, count } = await Asset.findAndCountAll({
    where,
    attributes: [
      "id", "assetCode", "name", "brand", "model", "serialNumber", "purchaseDate",
      "purchasePrice", "status", "condition", "categoryId", "createdAt", "updatedAt",
    ],
    include,
    order,
    limit,
    offset,
    distinct: true,
  });

  return {
    rows,
    total: count,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(count / limit)),
  };
};

const findCompanyAsset = async (companyId: number, assetId: number, transaction?: Transaction, lock = false) => {
  const asset = await Asset.findOne({
    where: { id: assetId, companyId },
    transaction,
    lock: lock && transaction ? transaction.LOCK.UPDATE : undefined,
  });
  // Another company's asset is reported exactly like a nonexistent one, so
  // ids can't be probed across companies.
  if (!asset) throw new ServiceError("Asset not found", 404);
  return asset;
};

const assignmentHistory = (assetId: number) =>
  AssetAssignment.findAll({
    where: { assetId },
    attributes: [
      "id", "status", "assignedAt", "returnedAt", "conditionAtAssignment",
      "conditionAtReturn", "remarks", "returnRemarks",
    ],
    include: [
      { model: User, as: "assignedTo", attributes: SAFE_USER_ATTRIBUTES },
      { model: User, as: "assigner", attributes: ["id", "firstName", "lastName"] },
      { model: User, as: "returner", attributes: ["id", "firstName", "lastName"] },
    ],
    order: [["assignedAt", "DESC"], ["id", "DESC"]],
    limit: 200,
  });

export const getAsset = async (actor: Actor, idParam: unknown) => {
  const companyId = await requireAdminCompany(actor);
  const assetId = parseId(idParam, "asset id");

  const asset = await Asset.findOne({
    where: { id: assetId, companyId },
    attributes: {
      exclude: ["companyId"],
    },
    include: [
      ...assetListInclude(),
      { model: User, as: "creator", attributes: ["id", "firstName", "lastName"] },
      { model: User, as: "updater", attributes: ["id", "firstName", "lastName"] },
    ],
  });
  if (!asset) throw new ServiceError("Asset not found", 404);

  const history = await assignmentHistory(assetId);
  return { asset, history };
};

export const getAssetHistory = async (actor: Actor, idParam: unknown) => {
  const companyId = await requireAdminCompany(actor);
  const assetId = parseId(idParam, "asset id");
  await findCompanyAsset(companyId, assetId);
  return assignmentHistory(assetId);
};

export const getStats = async (actor: Actor) => {
  const companyId = await requireAdminCompany(actor);

  const [byStatus, holders]: [any[], number] = await Promise.all([
    Asset.findAll({
      where: { companyId },
      attributes: ["status", [fn("COUNT", col("id")), "count"]],
      group: ["status"],
      raw: true,
    }),
    AssetAssignment.count({ where: { companyId, status: "ACTIVE" }, distinct: true, col: "assignedToId" }),
  ]);

  const counts: Record<string, number> = Object.fromEntries(ASSET_STATUSES.map((s) => [s, 0]));
  byStatus.forEach((r: any) => {
    counts[r.status] = Number(r.count);
  });
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return {
    total,
    available: counts.AVAILABLE,
    assigned: counts.ASSIGNED,
    maintenance: counts.MAINTENANCE,
    lost: counts.LOST,
    damaged: counts.DAMAGED,
    retired: counts.RETIRED,
    holders,
  };
};

// ── Assets: create / update / delete ─────────────────────────────────────────

export const createAsset = async (actor: Actor, body: any) => {
  const companyId = await requireAdminCompany(actor);

  const categoryId = parseId(body?.categoryId, "asset type");
  const name = requiredText(body?.name, "Asset name", 150);
  const brand = optionalText(body?.brand, "Brand", 100);
  const model = optionalText(body?.model, "Model", 100);
  const serialNumber = optionalText(body?.serialNumber, "Serial number", 100);
  const purchaseDate = pastOrTodayDate(body?.purchaseDate, "Purchase date");
  const purchasePrice = parsePrice(body?.purchasePrice);
  const condition = parseCondition(body?.condition, "GOOD") as string;
  const description = optionalText(body?.description, "Description", 2000);

  // A brand-new asset starts AVAILABLE unless the admin records it straight
  // into a non-assignable state (e.g. arrived DAMAGED). Never ASSIGNED.
  let status = "AVAILABLE";
  if (body?.status !== undefined && body?.status !== null && body?.status !== "") {
    status = String(body.status).toUpperCase();
    if (!EDITABLE_STATUSES.includes(status as any)) {
      throw new ServiceError("A new asset can't be created as ASSIGNED — create it, then assign it");
    }
  }

  await findUsableCategory(categoryId, companyId);

  if (serialNumber) {
    const duplicate = await Asset.findOne({
      where: { companyId, [Op.and]: [sequelize.where(fn("LOWER", col("serialNumber")), serialNumber.toLowerCase())] },
      attributes: ["assetCode"],
    });
    if (duplicate) throw new ServiceError(`Serial number already used by ${duplicate.assetCode}`, 409);
  }

  // Allocated outside the insert transaction on purpose — see
  // businessId.service.ts (gaps are acceptable, reuse is not).
  const assetCode = await generateBusinessId(sequelize, ASSET_CODE_SEQUENCE, ASSET_CODE_PAD_WIDTH);

  try {
    const assetId = await sequelize.transaction(async (transaction) => {
      const asset = await Asset.create(
        {
          assetCode, companyId, categoryId, name, brand, model, serialNumber, purchaseDate,
          purchasePrice, status, condition, description,
          createdBy: Number(actor.userId), updatedBy: Number(actor.userId),
        },
        { transaction }
      );
      await writeAudit(
        { companyId, assetId: asset.id, action: "ASSET_CREATED", actor, detail: { assetCode, name, categoryId, status } },
        transaction
      );
      return asset.id;
    });
    return (await getAsset(actor, assetId)).asset;
  } catch (err) {
    if (isUniqueViolation(err, "assets_company_serial_uq")) {
      throw new ServiceError("Serial number already exists in your company", 409);
    }
    throw err;
  }
};

const UPDATABLE_FIELDS = ["categoryId", "name", "brand", "model", "serialNumber", "purchaseDate", "purchasePrice", "condition", "description", "status"];

export const updateAsset = async (actor: Actor, idParam: unknown, body: any) => {
  const companyId = await requireAdminCompany(actor);
  const assetId = parseId(idParam, "asset id");

  const updates: Record<string, any> = {};
  if (body?.categoryId !== undefined) updates.categoryId = parseId(body.categoryId, "asset type");
  if (body?.name !== undefined) updates.name = requiredText(body.name, "Asset name", 150);
  if (body?.brand !== undefined) updates.brand = optionalText(body.brand, "Brand", 100);
  if (body?.model !== undefined) updates.model = optionalText(body.model, "Model", 100);
  if (body?.serialNumber !== undefined) updates.serialNumber = optionalText(body.serialNumber, "Serial number", 100);
  if (body?.purchaseDate !== undefined) updates.purchaseDate = pastOrTodayDate(body.purchaseDate, "Purchase date");
  if (body?.purchasePrice !== undefined) updates.purchasePrice = parsePrice(body.purchasePrice);
  if (body?.condition !== undefined) updates.condition = parseCondition(body.condition, "GOOD");
  if (body?.description !== undefined) updates.description = optionalText(body.description, "Description", 2000);
  if (body?.status !== undefined && body?.status !== null && body?.status !== "") {
    updates.status = String(body.status).toUpperCase();
  }

  if (Object.keys(updates).length === 0) throw new ServiceError("Nothing to update");

  try {
    await sequelize.transaction(async (transaction) => {
      const asset = await findCompanyAsset(companyId, assetId, transaction, true);

      // ASSIGNED is never accepted from the edit form, even as a no-op.
      if (updates.status === "ASSIGNED" && asset.status !== "ASSIGNED") {
        throw new ServiceError("Use Assign Asset to assign an asset — status can't be set to ASSIGNED directly");
      }
      if (updates.status !== undefined && updates.status !== asset.status) {
        if (asset.status === "ASSIGNED") {
          throw new ServiceError("This asset is currently assigned. Return it before changing its status", 409);
        }
        if (!EDITABLE_STATUSES.includes(updates.status)) {
          throw new ServiceError(`Status must be one of: ${EDITABLE_STATUSES.join(", ")}`);
        }
      } else {
        delete updates.status;
      }

      if (updates.categoryId !== undefined && updates.categoryId !== asset.categoryId) {
        await findUsableCategory(updates.categoryId, companyId, transaction);
      }

      if (updates.serialNumber) {
        const duplicate = await Asset.findOne({
          where: {
            companyId,
            id: { [Op.ne]: assetId },
            [Op.and]: [sequelize.where(fn("LOWER", col("serialNumber")), updates.serialNumber.toLowerCase())],
          },
          attributes: ["assetCode"],
          transaction,
        });
        if (duplicate) throw new ServiceError(`Serial number already used by ${duplicate.assetCode}`, 409);
      }

      const previous: Record<string, any> = {};
      const changed: Record<string, any> = {};
      UPDATABLE_FIELDS.forEach((f) => {
        if (updates[f] !== undefined && String((asset as any)[f] ?? "") !== String(updates[f] ?? "")) {
          previous[f] = (asset as any)[f];
          changed[f] = updates[f];
        }
      });
      if (Object.keys(changed).length === 0) return;

      await asset.update({ ...changed, updatedBy: Number(actor.userId) }, { transaction });
      await writeAudit(
        {
          companyId,
          assetId,
          action: changed.status === "RETIRED" ? "ASSET_RETIRED" : "ASSET_UPDATED",
          actor,
          detail: { assetCode: asset.assetCode, previous, changed },
        },
        transaction
      );
    });
  } catch (err) {
    if (isUniqueViolation(err, "assets_company_serial_uq")) {
      throw new ServiceError("Serial number already exists in your company", 409);
    }
    throw err;
  }

  return (await getAsset(actor, assetId)).asset;
};

// An asset with any assignment history is never hard-deleted (that history
// must survive) — it is retired instead. Only a never-assigned asset is
// removed outright. An asset that is currently assigned must be returned
// first.
export const deleteAsset = async (actor: Actor, idParam: unknown) => {
  const companyId = await requireAdminCompany(actor);
  const assetId = parseId(idParam, "asset id");

  return sequelize.transaction(async (transaction) => {
    const asset = await findCompanyAsset(companyId, assetId, transaction, true);
    if (asset.status === "ASSIGNED") {
      throw new ServiceError("This asset is currently assigned. Return it before deleting it", 409);
    }

    const historyCount = await AssetAssignment.count({ where: { assetId }, transaction });
    if (historyCount > 0) {
      if (asset.status !== "RETIRED") {
        const previousStatus = asset.status;
        await asset.update({ status: "RETIRED", updatedBy: Number(actor.userId) }, { transaction });
        await writeAudit(
          {
            companyId, assetId, action: "ASSET_RETIRED", actor,
            detail: { assetCode: asset.assetCode, previousStatus, reason: "delete requested; asset has assignment history" },
          },
          transaction
        );
      }
      return { id: assetId, assetCode: asset.assetCode, result: "retired" as const };
    }

    const snapshot = { assetCode: asset.assetCode, name: asset.name, categoryId: asset.categoryId, serialNumber: asset.serialNumber };
    await asset.destroy({ transaction });
    await writeAudit({ companyId, assetId, action: "ASSET_DELETED", actor, detail: snapshot }, transaction);
    return { id: assetId, assetCode: snapshot.assetCode, result: "deleted" as const };
  });
};

// ── Assign / return ─────────────────────────────────────────────────────────

export const listAssignableUsers = async (actor: Actor, query: any) => {
  const companyId = await requireAdminCompany(actor);
  const ids = await resolveAssignableUserIds(Number(actor.userId), companyId);

  const page = Math.max(1, Math.floor(Number(query.page)) || 1);
  const limit = Math.min(Math.max(1, Math.floor(Number(query.limit)) || 20), MAX_PAGE_SIZE);
  const offset = (page - 1) * limit;

  if (ids.length === 0) return { rows: [], total: 0, page, limit, totalPages: 1 };

  const roles = query.role && (ASSIGNEE_ROLES as readonly string[]).includes(String(query.role))
    ? [String(query.role)]
    : [...ASSIGNEE_ROLES];

  const where: Record<string | symbol, any> = {
    id: { [Op.in]: ids },
    status: "active",
    role: { [Op.in]: roles },
  };
  const search = String(query.search ?? "").trim();
  if (search) {
    const like = { [Op.iLike]: `%${search}%` };
    where[Op.or] = [
      { firstName: like },
      { lastName: like },
      { email: like },
      { employeeCode: like },
      sequelize.where(fn("concat_ws", " ", col("firstName"), col("lastName")), like),
    ];
  }

  const { rows, count } = await User.findAndCountAll({
    where,
    attributes: SAFE_USER_ATTRIBUTES,
    order: [["firstName", "ASC"], ["lastName", "ASC"]],
    limit,
    offset,
  });

  // How many assets each person on this page already holds — one grouped
  // query for the page, not one per person.
  const pageIds = rows.map((u: any) => u.id);
  const held: any[] = pageIds.length
    ? await AssetAssignment.findAll({
        where: { companyId, status: "ACTIVE", assignedToId: { [Op.in]: pageIds } },
        attributes: ["assignedToId", [fn("COUNT", col("id")), "count"]],
        group: ["assignedToId"],
        raw: true,
      })
    : [];
  const heldById = new Map(held.map((h: any) => [Number(h.assignedToId), Number(h.count)]));

  return {
    rows: rows.map((u: any) => ({ ...u.get({ plain: true }), activeAssetCount: heldById.get(u.id) ?? 0 })),
    total: count,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(count / limit)),
  };
};

export const assignAsset = async (actor: Actor, idParam: unknown, body: any) => {
  const companyId = await requireAdminCompany(actor);
  const assetId = parseId(idParam, "asset id");
  const assigneeId = parseId(body?.assignedToId ?? body?.employeeId, "employee or manager");
  const assignedDate = pastOrTodayDate(body?.assignedAt, "Assignment date");
  const remarks = optionalText(body?.remarks, "Remarks", 1000);

  // Eligibility is resolved before the transaction so the asset row lock is
  // held only for the short write below.
  const assignee = await findEligibleAssignee(Number(actor.userId), companyId, assigneeId);
  if (!assignee) {
    throw new ServiceError("This person is not an active employee or manager in your company", 404);
  }

  let result: { assignmentId: number; assetCode: string; assetName: string; categoryName: string; assignedAt: Date };
  try {
    result = await sequelize.transaction(async (transaction) => {
      // Row lock: a concurrent assign/return/edit/delete of the same asset
      // waits here until this transaction finishes.
      const asset = await findCompanyAsset(companyId, assetId, transaction, true);

      const active = await AssetAssignment.findOne({
        where: { assetId, status: "ACTIVE" },
        include: [{ model: User, as: "assignedTo", attributes: ["id", "firstName", "lastName", "email"] }],
        transaction,
      });
      if (active || asset.status === "ASSIGNED") {
        const holder = active ? fullName((active as any).assignedTo) : "someone";
        throw new ServiceError(`Asset ${asset.assetCode} is already assigned to ${holder}. Return it first.`, 409);
      }
      if (asset.status !== ASSIGNABLE_STATUS) {
        throw new ServiceError(`Asset ${asset.assetCode} is ${asset.status} and can't be assigned. Mark it AVAILABLE first.`, 409);
      }

      const assignedAt = eventInstant(assignedDate);
      if (asset.purchaseDate && assignedDate && assignedDate < String(asset.purchaseDate)) {
        throw new ServiceError("Assignment date can't be before the purchase date");
      }
      const condition = parseCondition(body?.condition, asset.condition) as string;

      const assignment = await AssetAssignment.create(
        {
          assetId,
          companyId,
          assignedToId: assigneeId,
          assignedBy: Number(actor.userId),
          assignedAt,
          status: "ACTIVE",
          conditionAtAssignment: condition,
          remarks,
        },
        { transaction }
      );

      await asset.update({ status: "ASSIGNED", condition, updatedBy: Number(actor.userId) }, { transaction });

      const category = await AssetCategory.findByPk(asset.categoryId, { attributes: ["name"], transaction });

      await writeAudit(
        {
          companyId, assetId, action: "ASSET_ASSIGNED", actor, targetUserId: assigneeId,
          detail: { assetCode: asset.assetCode, assignmentId: assignment.id, condition, assignedAt },
        },
        transaction
      );

      return {
        assignmentId: assignment.id,
        assetCode: asset.assetCode,
        assetName: asset.name,
        categoryName: category?.name ?? "Asset",
        assignedAt,
      };
    });
  } catch (err) {
    // The partial unique index is the last line of defense when two assign
    // requests race past the application check.
    if (isUniqueViolation(err, "asset_assignments_one_active_per_asset")) {
      throw new ServiceError("This asset was just assigned by another request. Refresh and try again.", 409);
    }
    throw err;
  }

  const assignedDateLabel = getISTDateString(result.assignedAt);
  notifySafely(async () =>
    sendNotification({
      receiverId: assigneeId,
      senderId: Number(actor.userId),
      type: NotificationType.SYSTEM,
      title: "New Asset Assigned",
      body: `${result.categoryName} ${result.assetCode} (${result.assetName}) has been assigned to you by ${await actorName(Number(actor.userId))}.`,
      data: {
        kind: ASSET_NOTIFICATION_KINDS.ASSIGNED,
        assetId,
        assignmentId: result.assignmentId,
        assetCode: result.assetCode,
        assetType: result.categoryName,
        assignedAt: assignedDateLabel,
      },
    })
  );
  notifySafely(async () => {
    const adminIds = await otherCompanyAdminIds(companyId, Number(actor.userId));
    await Promise.all(
      adminIds.map((adminId) =>
        sendNotification({
          receiverId: adminId,
          senderId: Number(actor.userId),
          type: NotificationType.SYSTEM,
          title: "Asset Assigned",
          body: `${result.categoryName} ${result.assetCode} was assigned to ${fullName(assignee)}.`,
          data: { kind: ASSET_NOTIFICATION_KINDS.ASSIGNED, assetId, assignmentId: result.assignmentId, assetCode: result.assetCode },
        })
      )
    );
  });

  return (await getAsset(actor, assetId));
};

export const returnAsset = async (actor: Actor, idParam: unknown, body: any) => {
  const companyId = await requireAdminCompany(actor);
  const assetId = parseId(idParam, "asset id");
  const returnDate = pastOrTodayDate(body?.returnedAt, "Return date");
  const returnRemarks = optionalText(body?.remarks, "Remarks", 1000);

  const result = await sequelize.transaction(async (transaction) => {
    const asset = await findCompanyAsset(companyId, assetId, transaction, true);

    // Locked without an include — Postgres rejects FOR UPDATE on the
    // nullable side of the LEFT JOIN an include would add.
    const active = await AssetAssignment.findOne({
      where: { assetId, status: "ACTIVE" },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!active) {
      throw new ServiceError(`Asset ${asset.assetCode} is not currently assigned`, 409);
    }
    const holder = await User.findByPk(active.assignedToId, {
      attributes: ["id", "firstName", "lastName", "email"],
      transaction,
    });

    const returnedAt = eventInstant(returnDate);
    if (returnedAt.getTime() < new Date(active.assignedAt).getTime()) {
      throw new ServiceError("Return date can't be before the assignment date");
    }
    const condition = parseCondition(body?.condition, asset.condition) as string;

    await active.update(
      {
        status: "RETURNED",
        returnedAt,
        returnedBy: Number(actor.userId),
        conditionAtReturn: condition,
        returnRemarks,
      },
      { transaction }
    );
    await asset.update({ status: "AVAILABLE", condition, updatedBy: Number(actor.userId) }, { transaction });

    const category = await AssetCategory.findByPk(asset.categoryId, { attributes: ["name"], transaction });

    await writeAudit(
      {
        companyId, assetId, action: "ASSET_RETURNED", actor, targetUserId: active.assignedToId,
        detail: { assetCode: asset.assetCode, assignmentId: active.id, condition, returnedAt },
      },
      transaction
    );

    return {
      assignmentId: active.id,
      holderId: active.assignedToId,
      holder,
      assetCode: asset.assetCode,
      assetName: asset.name,
      categoryName: category?.name ?? "Asset",
    };
  });

  notifySafely(() =>
    sendNotification({
      receiverId: result.holderId,
      senderId: Number(actor.userId),
      type: NotificationType.SYSTEM,
      title: "Asset Returned",
      body: `${result.categoryName} ${result.assetCode} (${result.assetName}) has been removed from your assigned assets.`,
      data: {
        kind: ASSET_NOTIFICATION_KINDS.RETURNED,
        assetId,
        assignmentId: result.assignmentId,
        assetCode: result.assetCode,
        assetType: result.categoryName,
      },
    })
  );
  notifySafely(async () => {
    const adminIds = await otherCompanyAdminIds(companyId, Number(actor.userId));
    await Promise.all(
      adminIds.map((adminId) =>
        sendNotification({
          receiverId: adminId,
          senderId: Number(actor.userId),
          type: NotificationType.SYSTEM,
          title: "Asset Returned",
          body: `${result.categoryName} ${result.assetCode} was returned by ${fullName(result.holder)}.`,
          data: { kind: ASSET_NOTIFICATION_KINDS.RETURNED, assetId, assignmentId: result.assignmentId, assetCode: result.assetCode },
        })
      )
    );
  });

  return getAsset(actor, assetId);
};

// ── Assignments register ────────────────────────────────────────────────────

export const listAssignments = async (actor: Actor, query: any) => {
  const companyId = await requireAdminCompany(actor);

  const page = Math.max(1, Math.floor(Number(query.page)) || 1);
  const limit = Math.min(Math.max(1, Math.floor(Number(query.limit)) || 10), MAX_PAGE_SIZE);
  const offset = (page - 1) * limit;

  const where: Record<string | symbol, any> = { companyId };
  if (query.status) {
    const status = String(query.status).toUpperCase();
    if (status !== "ACTIVE" && status !== "RETURNED") throw new ServiceError("Invalid assignment status filter");
    where.status = status;
  }
  if (query.assignedToId) where.assignedToId = parseId(query.assignedToId, "holder id");

  const search = String(query.search ?? "").trim();
  if (search) {
    const like = { [Op.iLike]: `%${search}%` };
    where[Op.or] = [
      { "$asset.assetCode$": like },
      { "$asset.name$": like },
      { "$asset.serialNumber$": like },
      { "$assignedTo.firstName$": like },
      { "$assignedTo.lastName$": like },
      { "$assignedTo.employeeCode$": like },
    ];
  }

  const { rows, count } = await AssetAssignment.findAndCountAll({
    where,
    attributes: [
      "id", "status", "assignedAt", "returnedAt", "conditionAtAssignment",
      "conditionAtReturn", "remarks", "returnRemarks",
    ],
    include: [
      {
        model: Asset,
        as: "asset",
        required: true,
        attributes: ["id", "assetCode", "name", "brand", "model", "serialNumber", "status"],
        include: [{ model: AssetCategory, as: "category", attributes: ["id", "name"] }],
      },
      { model: User, as: "assignedTo", required: true, attributes: SAFE_USER_ATTRIBUTES },
      { model: User, as: "assigner", attributes: ["id", "firstName", "lastName"] },
    ],
    order: [["assignedAt", "DESC"], ["id", "DESC"]],
    limit,
    offset,
    distinct: true,
    subQuery: false,
  });

  return { rows, total: count, page, limit, totalPages: Math.max(1, Math.ceil(count / limit)) };
};

// ── Self-service: the caller's own assets (employee / manager) ──────────────

export const listMyAssets = async (actor: Actor, query: any) => {
  const includeReturned = String(query.includeReturned) === "true";
  const assignments = await AssetAssignment.findAll({
    where: {
      assignedToId: Number(actor.userId),
      ...(includeReturned ? {} : { status: "ACTIVE" }),
    },
    attributes: ["id", "status", "assignedAt", "returnedAt", "conditionAtAssignment", "conditionAtReturn", "remarks"],
    include: [
      {
        model: Asset,
        as: "asset",
        required: true,
        attributes: ["id", "assetCode", "name", "brand", "model", "serialNumber", "condition"],
        include: [{ model: AssetCategory, as: "category", attributes: ["id", "name"] }],
      },
      { model: User, as: "assigner", attributes: ["id", "firstName", "lastName"] },
    ],
    order: [["status", "ASC"], ["assignedAt", "DESC"]],
    limit: 200,
  });
  return assignments;
};
