import { Company, User } from "../config/dbConnection";
(async () => {
  const u = await User.findOne({ where: { role: "manager", status: "active" } });
  console.log("manager", u ? u.get({plain:true}) : null);
  const c = await Company.findAll({ limit: 5 });
  console.log(c.map((x:any) => x.get({plain:true})));
  process.exit(0);
})();
