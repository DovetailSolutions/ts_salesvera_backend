import { sequelize } from "./src/config/dbConnection";
(async () => {
  const q = async (s: string) => (await sequelize.query(s))[0] as any[];
  console.log("--- actions per module ---");
  console.table(await q(`SELECT module, string_agg(action, ', ' ORDER BY action) AS actions, count(*)::int AS n
                         FROM permissions GROUP BY module ORDER BY module`));
  console.log("--- distinct actions overall ---");
  console.table(await q(`SELECT action, count(*)::int AS modules FROM permissions GROUP BY action ORDER BY action`));
  await sequelize.close();
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });
