import { User } from "../../config/dbConnection";

type UserWithChildren = any & {
  createdUsers?: UserWithChildren[];
};

// Walks the createdBy/createdUsers self-referential chain to collect every
// user (at any depth) that the given userId created, directly or through an
// intermediate manager. Used throughout admin/leave/attendance/expense
// endpoints to scope "my team" queries — extracted verbatim from admin.ts.
export async function getAllChildUserIds(userId: number): Promise<number[]> {
  const result = new Set<number>();

  async function fetchLevel(id: number) {
    const user = (await User.findByPk(id, {
      include: [
        {
          model: User,
          as: "createdUsers",
          attributes: ["id"],
          through: { attributes: [] },
        },
      ],
    })) as UserWithChildren;

    if (!user?.createdUsers) return;

    for (const child of user.createdUsers) {
      if (!result.has(child.id)) {
        result.add(child.id);
        await fetchLevel(child.id);
      }
    }
  }

  await fetchLevel(userId);

  return Array.from(result);
}

// Returns the given user's immediate creator (one level up the createdBy
// chain) — e.g. a sale_person's direct manager, or a manager's direct
// admin. Used to route "task completed" / other escalation notifications
// to the right person without walking the whole chain. Returns null if the
// user has no creator (e.g. a tenant-root "user" or super_admin).
export async function getDirectCreator(userId: number): Promise<{ id: number; role: string } | null> {
  const user = (await User.findByPk(userId, {
    include: [
      {
        model: User,
        as: "creators",
        attributes: ["id", "role"],
        through: { attributes: [] },
      },
    ],
  })) as any;

  const plain = user?.get ? user.get({ plain: true }) : user;
  const creator = plain?.creators?.[0];
  return creator ? { id: creator.id, role: creator.role } : null;
}
