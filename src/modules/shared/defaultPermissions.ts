import { Op } from "sequelize";
import { Permission, UserPermission } from "../../config/dbConnection";
import { PERMISSION_TEMPLATES } from "../../config/permissionTemplates";
import { invalidatePermissionCache } from "../../config/permissionCache";

// ============================================================
// Default ("template") permissions for new employees — the same
// PERMISSION_TEMPLATES.employee bundle the single "Add employee" form applies
// via /permissions/template/employee + assign. Limited to what the granting
// user holds (nobody can grant a permission they don't have; super_admin
// holds everything). Stored like single-user grants (companyId null).
// Additive only: never removes anything, skips what people already have.
// Returns the number of permission rows added.
// ============================================================
export const grantDefaultEmployeePermissions = async (
  employeeIds: number[],
  grantedBy: number,
  granterRole: string
): Promise<number> => {
  const ids = Array.from(new Set(employeeIds.map(Number).filter(Boolean)));
  if (!ids.length) return 0;

  const templateKeys = new Set((PERMISSION_TEMPLATES.employee || []).map(([m, a]) => `${m}:${a}`));
  const all = (await Permission.findAll({ attributes: ["id", "module", "action"], raw: true })) as any[];
  let perms = all.filter((p) => templateKeys.has(`${p.module}:${p.action}`));

  if (granterRole !== "super_admin") {
    const own = (await UserPermission.findAll({
      where: { userId: grantedBy },
      attributes: ["permissionId"],
      raw: true,
    })) as any[];
    const ownIds = new Set(own.map((r) => Number(r.permissionId)));
    perms = perms.filter((p) => ownIds.has(Number(p.id)));
  }
  const permIds = perms.map((p) => Number(p.id));
  if (!permIds.length) return 0;

  const existing = (await UserPermission.findAll({
    where: { userId: { [Op.in]: ids }, permissionId: { [Op.in]: permIds } },
    attributes: ["userId", "permissionId"],
    raw: true,
  })) as any[];
  const have = new Set(existing.map((r) => `${r.userId}:${r.permissionId}`));

  const rows: any[] = [];
  for (const uid of ids) {
    for (const pid of permIds) {
      if (!have.has(`${uid}:${pid}`)) rows.push({ userId: uid, permissionId: pid, companyId: null, grantedBy });
    }
  }
  if (rows.length) await UserPermission.bulkCreate(rows, { ignoreDuplicates: true });
  ids.forEach((uid) => invalidatePermissionCache(uid));
  return rows.length;
};
