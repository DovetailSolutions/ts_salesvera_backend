import { sequelize } from "./src/config/dbConnection";
(async () => {
  const q = async (s: string) => (await sequelize.query(s))[0] as any[];
  console.table(await q(`SELECT u.id, u.email, u.role, u."tenantId", c.id AS company_id, c."companyName"
    FROM users u LEFT JOIN "companyManagers" cm ON cm."managerId"=u.id
    LEFT JOIN companies c ON c.id=cm."companyId"
    WHERE u."tenantId"=182 AND u.role='manager' AND u.status<>'delete' LIMIT 10`).catch(async () =>
    q(`SELECT id, email, role, "tenantId" FROM users WHERE "tenantId"=182 AND role='manager' AND status<>'delete' LIMIT 10`)));
  await sequelize.close();
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });
