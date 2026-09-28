import { sequelize } from "./src/config/dbConnection";
(async () => {
  const mode = process.argv[2];
  if (mode === "expire") {
    await sequelize.query(`UPDATE subscriptions SET status='EXPIRED', "endDate"='2026-06-01T00:00:00.000Z', "maxEmployees"=30, "updatedAt"=NOW() WHERE id=10`);
    console.log("tenant 182 -> EXPIRED (endDate 2026-06-01, employee limit 30)");
  } else {
    await sequelize.query(`UPDATE subscriptions SET status='ACTIVE', "endDate"='2027-01-16T00:00:00.000Z', "maxEmployees"=NULL, "updatedAt"=NOW() WHERE id=10`);
    await sequelize.query(`DELETE FROM access_extension_requests WHERE "createdAt" > NOW() - INTERVAL '60 minutes'`);
    await sequelize.query(`DELETE FROM notifications WHERE type='subscription' AND "createdAt" > NOW() - INTERVAL '60 minutes'`);
    await sequelize.query(`DELETE FROM access_audit_log WHERE "createdAt" > NOW() - INTERVAL '60 minutes'`);
    console.log("tenant 182 -> restored to ACTIVE / unlimited, QA rows cleared");
  }
  await sequelize.close();
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });
