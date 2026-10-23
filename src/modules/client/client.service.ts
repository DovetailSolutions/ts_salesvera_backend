import { Op, QueryTypes, Transaction } from "sequelize";
import { sequelize, User, Company, MeetingUser } from "../../config/dbConnection";
import { ServiceError } from "../shared/serviceError";
import { hasCompanyAccess, resolveCompanyEmployeeIds } from "../shared/companyAccess";
import { getCompanyScopedChildUserIdsFast } from "../shared/userHierarchy";
import { ClientAssignmentAction, ClientAssignmentLog, SAFE_USER_ATTRIBUTES } from "./client.models";

// ============================================================
// Clients (MeetingUser rows): creation with duplicate protection, and the
// admin's Client Assignment screen (assign / revoke / reassign / departure
// transfer).
//
// A client has exactly one owner — meeting_users.user_id — and every existing
// read path (getMeeting, getClient, getClientDetails, meeting scheduling)
// already scopes clients by it. So assigning a client moves that owner to the
// employee, and revoking moves it back to the company's admin ("the company
// pool", which already holds every bulk-uploaded client and is shared with
// managers — see resolveClientScope in meeting.service.ts). Access therefore
// changes everywhere at once, server-side, with no second ownership system.
// Every move is recorded in client_assignment_log, which also preserves who
// originally created the client.
//
// The caller always comes from req.userData (tokenCheck, verified JWT); no
// company, owner or creator is ever read from the request body.
// ============================================================

export interface Actor {
  userId: number;
  role: string;
  companyId: number | null;
}

const ASSIGNEE_ROLES = ["employee", "manager"];
const MAX_PAGE_SIZE = 100;
const MAX_BATCH = 500;

// ── Field normalization ──────────────────────────────────────────────────

// Same rules the web form (CreateClientModal.jsx) has always enforced.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE_RE = /^\d{10,15}$/;

// Emails compare case-insensitively; blank means "not provided".
export const normalizeEmail = (value: unknown): string | null => {
  if (value === undefined || value === null) return null;
  const s = String(value).trim().toLowerCase();
  return s || null;
};

// Spaces, dashes, dots, brackets and a leading "+" are formatting, not part
// of the number: "+91 98765-43210" and "919876543210" are the same phone.
export const normalizeMobile = (value: unknown): string | null => {
  if (value === undefined || value === null) return null;
  const s = String(value).trim().replace(/[\s\-().]/g, "").replace(/^\+/, "");
  return s || null;
};

// ── Company scope ────────────────────────────────────────────────────────

interface CompanyClientScope {
  // Everyone whose clients are this company's clients.
  ownerIds: Set<number>;
  // The company itself (its owner and admins): a client held by one of these
  // is "unassigned".
  poolIds: Set<number>;
  // Where a revoked client goes back to.
  poolOwnerId: number | null;
}

// The company's owner and admins, its managers and branch-resolved employees,
// and each admin's company-scoped team — the same helpers the asset module
// and the admin team endpoints use to decide who belongs to a company.
export const resolveCompanyClientScope = async (companyId: number): Promise<CompanyClientScope> => {
  const [company, members]: [any, Awaited<ReturnType<typeof resolveCompanyEmployeeIds>>] = await Promise.all([
    (Company as any).findByPk(companyId, { attributes: ["id", "adminId", "userId"] }),
    resolveCompanyEmployeeIds(companyId),
  ]);
  const teams = await Promise.all(members.adminIds.map((id) => getCompanyScopedChildUserIdsFast(id, companyId)));

  const poolIds = new Set<number>(members.adminIds);
  if (company?.userId) poolIds.add(Number(company.userId));
  const ownerIds = new Set<number>([...members.allIds, ...teams.flat(), ...poolIds]);
  const poolOwnerId = company?.adminId ? Number(company.adminId) : members.adminIds[0] ?? null;
  return { ownerIds, poolIds, poolOwnerId };
};

// Transaction-scoped advisory locks, taken in a fixed order so two requests
// sharing a key serialize instead of both passing the duplicate check, and
// never deadlock. Released automatically at commit/rollback.
const lockKeys = async (keys: string[], transaction: Transaction) => {
  for (const key of Array.from(new Set(keys)).sort()) {
    await sequelize.query("SELECT pg_advisory_xact_lock(hashtext(:key))", { replacements: { key }, transaction });
  }
};

// ── Duplicate detection ──────────────────────────────────────────────────

type DuplicateField = "email" | "mobile";

// Which of email/mobile already belong to a client owned by someone in
// ownerIds. ownerIds = null (no company context, e.g. super_admin) checks
// every client, which is what this check did before it was company-scoped.
export const findDuplicateFields = async (
  ownerIds: number[] | null,
  email: string | null,
  mobile: string | null,
  transaction?: Transaction
): Promise<DuplicateField[]> => {
  if (!email && !mobile) return [];
  if (ownerIds && ownerIds.length === 0) return [];

  const matches: string[] = [];
  if (email) matches.push(`LOWER(TRIM("email")) = :email`);
  if (mobile) matches.push(`REGEXP_REPLACE("mobile", '[^0-9]', '', 'g') = :mobile`);
  const ownerFilter = ownerIds ? `"user_id" IN (:ownerIds) AND ` : "";

  const [row]: any[] = await sequelize.query(
    `SELECT
       BOOL_OR(${email ? `LOWER(TRIM("email")) = :email` : "false"}) AS "emailTaken",
       BOOL_OR(${mobile ? `REGEXP_REPLACE("mobile", '[^0-9]', '', 'g') = :mobile` : "false"}) AS "mobileTaken"
     FROM "meeting_users"
     WHERE ${ownerFilter}(${matches.join(" OR ")})`,
    { replacements: { email, mobile: mobile?.replace(/\D/g, "") ?? null, ownerIds }, type: QueryTypes.SELECT, transaction }
  );

  const fields: DuplicateField[] = [];
  if (row?.emailTaken) fields.push("email");
  if (row?.mobileTaken) fields.push("mobile");
  return fields;
};

export const duplicateMessage = (fields: DuplicateField[]) =>
  fields.length === 2
    ? "A client with this email and mobile number already exists"
    : fields[0] === "email"
      ? "A client with this email already exists"
      : "A client with this mobile number already exists";

// ── Create ───────────────────────────────────────────────────────────────

const trimmed = (value: unknown) => (typeof value === "string" ? value.trim() : value);

// Backs both POST /admin/create-client (web) and POST /api/create-client
// (mobile). Required fields, their error message, defaults and the owner
// (always the caller) are unchanged from the original controllers.
export const createClient = async (actor: Actor, body: any): Promise<void> => {
  const { panNumber, status, customerType, city, pincode, address, gstNumber } = body || {};
  const name = trimmed(body?.name);
  const state = trimmed(body?.state);
  const country = trimmed(body?.country);
  const companyName = trimmed(body?.companyName);

  if (!name || !state || !country || !companyName) {
    throw new ServiceError("name, state, country, and companyName are required");
  }

  const email = normalizeEmail(body?.email);
  const mobile = normalizeMobile(body?.mobile);
  if (email && (!EMAIL_RE.test(email) || email.length > 255)) {
    throw new ServiceError("Please enter a valid email address", 400, { field: "email" });
  }
  if (mobile && !MOBILE_RE.test(mobile)) {
    throw new ServiceError("Please enter a valid mobile number (10–15 digits)", 400, { field: "mobile" });
  }

  let ownerIds: number[] | null = null;
  if (actor.companyId) {
    const scope = await resolveCompanyClientScope(Number(actor.companyId));
    scope.ownerIds.add(Number(actor.userId));
    ownerIds = Array.from(scope.ownerIds);
  }
  const scopeKey = actor.companyId ?? "global";

  await sequelize.transaction(async (transaction) => {
    await lockKeys(
      [
        ...(email ? [`client:${scopeKey}:email:${email}`] : []),
        ...(mobile ? [`client:${scopeKey}:mobile:${mobile}`] : []),
      ],
      transaction
    );

    const duplicates = await findDuplicateFields(ownerIds, email, mobile, transaction);
    if (duplicates.length > 0) {
      throw new ServiceError(duplicateMessage(duplicates), 400, { duplicateFields: duplicates });
    }

    await MeetingUser.create(
      {
        name,
        email,
        mobile,
        userId: actor.userId,
        companyName,
        customerType: customerType || "new",
        state,
        city,
        pincode,
        country,
        address,
        gstNumber,
        panNumber,
        status: status || "draft",
      },
      { transaction }
    );
  });
};

// ── Client Assignment (admin) ────────────────────────────────────────────

const requireAdminCompany = async (actor: Actor): Promise<number> => {
  if (actor.role !== "admin") {
    throw new ServiceError("Only an admin can assign or transfer clients", 403);
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

const resolveAdminScope = async (actor: Actor) => {
  const companyId = await requireAdminCompany(actor);
  const scope = await resolveCompanyClientScope(companyId);
  scope.ownerIds.add(Number(actor.userId));
  scope.poolIds.add(Number(actor.userId));
  return { companyId, ...scope, poolOwnerId: scope.poolOwnerId ?? Number(actor.userId) };
};

const parseId = (value: unknown, label: string): number => {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new ServiceError(`A valid ${label} is required`);
  return n;
};

const parseIdList = (value: unknown, label: string): number[] => {
  const list = Array.isArray(value) ? value : value === undefined || value === null || value === "" ? [] : [value];
  if (list.length === 0) throw new ServiceError(`Select at least one ${label}`);
  if (list.length > MAX_BATCH) throw new ServiceError(`You can select at most ${MAX_BATCH} clients at a time`);
  return Array.from(new Set(list.map((v) => parseId(v, label))));
};

const parseReason = (value: unknown): string | null => {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  if (s.length > 500) throw new ServiceError("Reason must be at most 500 characters");
  return s || null;
};

const personName = (u: any) => (u ? `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.email : "");

const plainUser = (u: any) =>
  u
    ? {
        id: Number(u.id),
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        employeeCode: u.employeeCode ?? null,
        role: u.role,
        status: u.status,
      }
    : null;

const usersById = async (ids: number[], transaction?: Transaction) => {
  const unique = Array.from(new Set(ids.filter((id) => id != null).map(Number)));
  if (unique.length === 0) return new Map<number, any>();
  const rows: any[] = await User.findAll({ where: { id: { [Op.in]: unique } }, attributes: SAFE_USER_ATTRIBUTES, transaction });
  return new Map<number, any>(rows.map((u) => [Number(u.id), plainUser(u)]));
};

// The original owner of each client: whoever held it before its first
// recorded move, or — never moved — its current owner.
const creatorIdsFor = async (clientIds: number[]) => {
  if (clientIds.length === 0) return new Map<number, number | null>();
  const rows: any[] = await sequelize.query(
    `SELECT DISTINCT ON ("clientId") "clientId", "previousUserId"
       FROM "client_assignment_log"
      WHERE "clientId" IN (:clientIds)
      ORDER BY "clientId", "createdAt" ASC, "id" ASC`,
    { replacements: { clientIds }, type: QueryTypes.SELECT }
  );
  return new Map<number, number | null>(rows.map((r) => [Number(r.clientId), r.previousUserId == null ? null : Number(r.previousUserId)]));
};

// An active employee/manager of the admin's company — the only people a
// client can be assigned or transferred to.
const findEligibleAssignee = async (scope: { ownerIds: Set<number>; poolIds: Set<number> }, userId: number, transaction?: Transaction) => {
  if (!scope.ownerIds.has(userId) || scope.poolIds.has(userId)) return null;
  return User.findOne({
    where: { id: userId, status: "active", role: { [Op.in]: ASSIGNEE_ROLES } },
    attributes: SAFE_USER_ATTRIBUTES,
    transaction,
    ...(transaction ? { lock: transaction.LOCK.SHARE } : {}),
  });
};

const CLIENT_ATTRIBUTES = ["id", "name", "email", "mobile", "companyName", "city", "state", "userId", "createdAt"];

const shapeClient = (c: any, users: Map<number, any>, creators: Map<number, number | null>, poolIds: Set<number>) => {
  const holderId = Number(c.userId);
  const creatorId = creators.has(Number(c.id)) ? creators.get(Number(c.id)) : holderId;
  return {
    id: Number(c.id),
    name: c.name,
    email: c.email || null,
    mobile: c.mobile || null,
    companyName: c.companyName || null,
    city: c.city || null,
    state: c.state || null,
    createdAt: c.createdAt,
    isAssigned: !poolIds.has(holderId),
    assignee: poolIds.has(holderId) ? null : users.get(holderId) ?? { id: holderId },
    createdBy: creatorId == null ? null : users.get(creatorId) ?? { id: creatorId },
  };
};

export const listClients = async (actor: Actor, query: any) => {
  const scope = await resolveAdminScope(actor);
  const page = Math.max(1, Math.floor(Number(query.page)) || 1);
  const limit = Math.min(Math.max(1, Math.floor(Number(query.limit)) || 20), MAX_PAGE_SIZE);
  const offset = (page - 1) * limit;

  const owners = Array.from(scope.ownerIds);
  const pool = Array.from(scope.poolIds);
  const assignedOwners = owners.filter((id) => !scope.poolIds.has(id));

  let ownerFilter: number[] = owners;
  if (query.assigneeId !== undefined && query.assigneeId !== "") {
    const assigneeId = parseId(query.assigneeId, "employee");
    ownerFilter = scope.ownerIds.has(assigneeId) ? [assigneeId] : [];
  } else if (query.state === "assigned") {
    ownerFilter = assignedOwners;
  } else if (query.state === "unassigned") {
    ownerFilter = pool;
  }

  const where: Record<string | symbol, any> = { userId: { [Op.in]: ownerFilter.length ? ownerFilter : [0] } };
  const search = String(query.search ?? "").trim();
  if (search) {
    const like = { [Op.iLike]: `%${search}%` };
    where[Op.or] = [{ name: like }, { companyName: like }, { email: like }, { mobile: like }];
  }

  const [{ rows, count }, assignedCount, unassignedCount] = await Promise.all([
    MeetingUser.findAndCountAll({ where, attributes: CLIENT_ATTRIBUTES, order: [["createdAt", "DESC"], ["id", "DESC"]], limit, offset }),
    MeetingUser.count({ where: { userId: { [Op.in]: assignedOwners.length ? assignedOwners : [0] } } }),
    MeetingUser.count({ where: { userId: { [Op.in]: pool } } }),
  ]);

  const creators = await creatorIdsFor(rows.map((r: any) => Number(r.id)));
  const users = await usersById([
    ...rows.map((r: any) => Number(r.userId)),
    ...Array.from(creators.values()).filter((v): v is number => v != null),
  ]);

  return {
    rows: rows.map((c) => shapeClient(c, users, creators, scope.poolIds)),
    total: count,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(count / limit)),
    summary: { total: assignedCount + unassignedCount, assigned: assignedCount, unassigned: unassignedCount },
  };
};

// People clients can be assigned to (active only) — or, with
// includeInactive=true, everyone who can currently hold clients, so a
// departed (deactivated) employee can still be picked as the transfer source.
export const listAssignableUsers = async (actor: Actor, query: any) => {
  const scope = await resolveAdminScope(actor);
  const ids = Array.from(scope.ownerIds).filter((id) => !scope.poolIds.has(id));
  if (ids.length === 0) return { rows: [] };

  const where: Record<string | symbol, any> = { id: { [Op.in]: ids }, role: { [Op.in]: ASSIGNEE_ROLES } };
  if (String(query.includeInactive) === "true") {
    where.status = { [Op.in]: ["active", "deActive"] };
  } else {
    where.status = "active";
  }
  const search = String(query.search ?? "").trim();
  if (search) {
    const like = { [Op.iLike]: `%${search}%` };
    where[Op.or] = [{ firstName: like }, { lastName: like }, { email: like }, { employeeCode: like }];
  }
  const limit = Math.min(Math.max(1, Math.floor(Number(query.limit)) || 50), MAX_PAGE_SIZE);

  const users: any[] = await User.findAll({
    where,
    attributes: SAFE_USER_ATTRIBUTES,
    order: [["firstName", "ASC"], ["lastName", "ASC"]],
    limit,
  });
  const counts: any[] = users.length
    ? await MeetingUser.findAll({
        where: { userId: { [Op.in]: users.map((u) => u.id) } },
        attributes: ["userId", [sequelize.fn("COUNT", sequelize.col("id")), "count"]],
        group: ["userId"],
        raw: true,
      })
    : [];
  const countBy = new Map<number, number>(counts.map((r) => [Number(r.userId), Number(r.count)]));

  return { rows: users.map((u) => ({ ...plainUser(u), clientCount: countBy.get(Number(u.id)) ?? 0 })) };
};

// Locks the selected clients and rejects the whole request if any of them is
// missing or outside the admin's company — nothing is applied partially.
const lockClientsInScope = async (clientIds: number[], ownerIds: Set<number>, transaction: Transaction) => {
  const clients: any[] = await MeetingUser.findAll({
    where: { id: { [Op.in]: clientIds } },
    attributes: ["id", "name", "userId"],
    lock: transaction.LOCK.UPDATE,
    transaction,
  });
  const found = new Set(clients.filter((c) => ownerIds.has(Number(c.userId))).map((c) => Number(c.id)));
  const missing = clientIds.filter((id) => !found.has(id));
  if (missing.length > 0) {
    throw new ServiceError(
      clientIds.length === 1 ? "Client not found" : `${missing.length} of the selected clients were not found in your company`,
      404,
      { clientIds: missing }
    );
  }
  return clients;
};

const writeLog = (
  rows: { clientId: number; action: ClientAssignmentAction; previousUserId: number | null; newUserId: number | null }[],
  base: { companyId: number; actor: Actor; reason: string | null; requestKey?: string | null },
  transaction: Transaction
) =>
  ClientAssignmentLog.bulkCreate(
    rows.map((r) => ({
      ...r,
      companyId: base.companyId,
      actorId: Number(base.actor.userId),
      actorRole: base.actor.role,
      reason: base.reason,
      requestKey: base.requestKey ?? null,
    })),
    { transaction }
  );

// Assign (or reassign) one or more clients to an employee/manager.
export const assignClients = async (actor: Actor, body: any) => {
  const scope = await resolveAdminScope(actor);
  const clientIds = parseIdList(body?.clientIds ?? body?.clientId, "client");
  const assigneeId = parseId(body?.userId, "employee");
  const reason = parseReason(body?.reason);

  return sequelize.transaction(async (transaction) => {
    const assignee = await findEligibleAssignee(scope, assigneeId, transaction);
    if (!assignee) {
      throw new ServiceError("The selected employee is not an active employee or manager of your company");
    }
    const clients = await lockClientsInScope(clientIds, scope.ownerIds, transaction);
    const already = clients.filter((c) => Number(c.userId) === assigneeId);
    const moving = clients.filter((c) => Number(c.userId) !== assigneeId);

    if (moving.length === 0) {
      throw new ServiceError(
        clients.length === 1
          ? `This client is already assigned to ${personName(assignee)}`
          : `All selected clients are already assigned to ${personName(assignee)}`,
        409
      );
    }

    await MeetingUser.update(
      { userId: assigneeId },
      { where: { id: { [Op.in]: moving.map((c) => Number(c.id)) } }, transaction }
    );
    await writeLog(
      moving.map((c) => ({
        clientId: Number(c.id),
        action: scope.poolIds.has(Number(c.userId)) ? "assign" : "reassign",
        previousUserId: Number(c.userId),
        newUserId: assigneeId,
      })),
      { companyId: scope.companyId, actor, reason },
      transaction
    );

    return {
      assignee: plainUser(assignee),
      assigned: moving.map((c) => ({ id: Number(c.id), name: c.name, previousUserId: Number(c.userId) })),
      alreadyAssigned: already.map((c) => ({ id: Number(c.id), name: c.name })),
    };
  });
};

// Revoke: the client goes back to the company pool (the company admin).
// The client itself — and every meeting, note and image linked to it — is
// left untouched; this is never a delete.
export const revokeClients = async (actor: Actor, body: any) => {
  const scope = await resolveAdminScope(actor);
  const clientIds = parseIdList(body?.clientIds ?? body?.clientId, "client");
  const reason = parseReason(body?.reason);

  return sequelize.transaction(async (transaction) => {
    const clients = await lockClientsInScope(clientIds, scope.ownerIds, transaction);
    const revoking = clients.filter((c) => !scope.poolIds.has(Number(c.userId)));
    const notAssigned = clients.filter((c) => scope.poolIds.has(Number(c.userId)));

    if (revoking.length === 0) {
      throw new ServiceError(
        clients.length === 1 ? "This client is not currently assigned to anyone" : "None of the selected clients are currently assigned",
        409
      );
    }

    await MeetingUser.update(
      { userId: scope.poolOwnerId },
      { where: { id: { [Op.in]: revoking.map((c) => Number(c.id)) } }, transaction }
    );
    await writeLog(
      revoking.map((c) => ({ clientId: Number(c.id), action: "revoke", previousUserId: Number(c.userId), newUserId: scope.poolOwnerId })),
      { companyId: scope.companyId, actor, reason },
      transaction
    );

    return {
      revoked: revoking.map((c) => ({ id: Number(c.id), name: c.name, previousUserId: Number(c.userId) })),
      notAssigned: notAssigned.map((c) => ({ id: Number(c.id), name: c.name })),
    };
  });
};

export const getClientHistory = async (actor: Actor, idParam: unknown) => {
  const scope = await resolveAdminScope(actor);
  const clientId = parseId(idParam, "client id");
  const client: any = await MeetingUser.findByPk(clientId, { attributes: CLIENT_ATTRIBUTES });
  if (!client || !scope.ownerIds.has(Number(client.userId))) throw new ServiceError("Client not found", 404);

  const logs: any[] = await ClientAssignmentLog.findAll({
    where: { clientId },
    order: [["createdAt", "DESC"], ["id", "DESC"]],
    limit: 200,
  });
  const creators = await creatorIdsFor([clientId]);
  const users = await usersById([
    Number(client.userId),
    ...Array.from(creators.values()).filter((v): v is number => v != null),
    ...logs.flatMap((l) => [l.previousUserId, l.newUserId, l.actorId]),
  ]);

  return {
    client: shapeClient(client, users, creators, scope.poolIds),
    history: logs.map((l) => ({
      id: l.id,
      action: l.action,
      createdAt: l.createdAt,
      reason: l.reason,
      previousUser: l.previousUserId ? users.get(Number(l.previousUserId)) ?? { id: l.previousUserId } : null,
      newUser: l.newUserId ? users.get(Number(l.newUserId)) ?? { id: l.newUserId } : null,
      actor: l.actorId ? users.get(Number(l.actorId)) ?? { id: l.actorId } : null,
      previousWasPool: l.previousUserId ? scope.poolIds.has(Number(l.previousUserId)) : false,
      newIsPool: l.newUserId ? scope.poolIds.has(Number(l.newUserId)) : false,
    })),
  };
};

// ── Employee departure transfer ──────────────────────────────────────────

// The departing person: an employee/manager of this company, active or
// already deactivated (deactivation happens elsewhere and must not strand
// their clients).
const findDepartingUser = async (scope: { ownerIds: Set<number>; poolIds: Set<number> }, userId: number) => {
  if (!scope.ownerIds.has(userId) || scope.poolIds.has(userId)) return null;
  return User.findOne({ where: { id: userId, role: { [Op.in]: ASSIGNEE_ROLES } }, attributes: SAFE_USER_ATTRIBUTES });
};

export const getTransferPreview = async (actor: Actor, query: any) => {
  const scope = await resolveAdminScope(actor);
  const fromUserId = parseId(query.fromUserId, "departing employee");
  const from = await findDepartingUser(scope, fromUserId);
  if (!from) throw new ServiceError("Employee not found in your company", 404);

  const clients: any[] = await MeetingUser.findAll({
    where: { userId: fromUserId },
    attributes: CLIENT_ATTRIBUTES,
    order: [["name", "ASC"], ["id", "ASC"]],
  });
  return {
    employee: plainUser(from),
    total: clients.length,
    clients: clients.map((c) => ({
      id: Number(c.id),
      name: c.name,
      email: c.email || null,
      mobile: c.mobile || null,
      companyName: c.companyName || null,
      createdAt: c.createdAt,
    })),
  };
};

const REQUEST_KEY_RE = /^[A-Za-z0-9_-]{8,64}$/;

// Moves the departing person's clients (all, or the selected subset) to one
// replacement in a single transaction. Only meeting_users.user_id changes —
// meetings, quotations, invoices, expenses and every other record keep
// pointing at whoever actually did that work. requestKey makes a
// re-submitted transfer (double click, retry after a timeout) return the
// first result instead of running again.
export const transferClients = async (actor: Actor, body: any) => {
  const scope = await resolveAdminScope(actor);
  const fromUserId = parseId(body?.fromUserId, "departing employee");
  const toUserId = parseId(body?.toUserId, "replacement employee");
  const reason = parseReason(body?.reason);
  const requestKey = String(body?.requestKey ?? "");
  if (!REQUEST_KEY_RE.test(requestKey)) throw new ServiceError("A valid requestKey is required");
  if (fromUserId === toUserId) throw new ServiceError("The replacement must be a different person");
  const selectedIds = body?.clientIds === undefined || body?.clientIds === null ? null : parseIdList(body.clientIds, "client");

  const from = await findDepartingUser(scope, fromUserId);
  if (!from) throw new ServiceError("Employee not found in your company", 404);

  return sequelize.transaction(async (transaction) => {
    await lockKeys([`client-transfer:${scope.companyId}:${fromUserId}`], transaction);

    const previous: any[] = await ClientAssignmentLog.findAll({
      where: { companyId: scope.companyId, requestKey },
      attributes: ["clientId", "previousUserId", "newUserId"],
      transaction,
    });
    if (previous.length > 0) {
      const users = await usersById([previous[0].previousUserId, previous[0].newUserId], transaction);
      return {
        alreadyProcessed: true,
        transferred: previous.length,
        from: users.get(Number(previous[0].previousUserId)) ?? null,
        to: users.get(Number(previous[0].newUserId)) ?? null,
        clients: previous.map((l) => ({ id: Number(l.clientId) })),
      };
    }

    // Re-checked inside the transaction with a share lock, so a replacement
    // deactivated mid-transfer stops it here with nothing changed.
    const to = await findEligibleAssignee(scope, toUserId, transaction);
    if (!to) throw new ServiceError("The replacement is not an active employee or manager of your company");

    const clients: any[] = await MeetingUser.findAll({
      where: { userId: fromUserId, ...(selectedIds ? { id: { [Op.in]: selectedIds } } : {}) },
      attributes: ["id", "name", "userId"],
      lock: transaction.LOCK.UPDATE,
      transaction,
    });
    if (selectedIds && clients.length !== selectedIds.length) {
      throw new ServiceError(
        `${selectedIds.length - clients.length} of the selected clients are no longer held by ${personName(from)}. Refresh and try again.`,
        409
      );
    }
    if (clients.length === 0) throw new ServiceError(`${personName(from)} has no clients to transfer`, 409);

    const ids = clients.map((c) => Number(c.id));
    await MeetingUser.update({ userId: toUserId }, { where: { id: { [Op.in]: ids }, userId: fromUserId }, transaction });
    await writeLog(
      ids.map((clientId) => ({ clientId, action: "transfer" as const, previousUserId: fromUserId, newUserId: toUserId })),
      { companyId: scope.companyId, actor, reason, requestKey },
      transaction
    );

    return {
      alreadyProcessed: false,
      transferred: ids.length,
      from: plainUser(from),
      to: plainUser(to),
      clients: clients.map((c) => ({ id: Number(c.id), name: c.name })),
    };
  });
};

// ── Access after a move ──────────────────────────────────────────────────

// True once a client has been moved away from this user (revoked,
// reassigned or transferred). getClientDetails uses it so the user's own
// past meetings with the client no longer open it once it has been taken
// from them; if it is later assigned back they own it again and ownership
// grants access as usual.
export const wasMovedAwayFrom = async (clientId: number, userId: number): Promise<boolean> =>
  !!(await ClientAssignmentLog.findOne({ where: { clientId, previousUserId: userId }, attributes: ["id"] }));
