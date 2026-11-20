// Lists route paths that look like Pro/Advance features but are not mapped
// in planFeatures.FEATURE_ROUTES. Usage: node -r ts-node/register/transpile-only tests/api/routeAudit.cjs
const fs = require("fs");
const path = require("path");
const { featureForPath } = require("../../src/modules/subscription/planFeatures");
const mounts = { "src/app/router/admin.ts": "/admin", "src/app/router/user.ts": "/api", "src/app/router/bulkSync.ts": "/admin/bulk", "src/app/router/task.ts": "/admin/task" };
const files = Object.keys(mounts);
for (const d of fs.readdirSync("src/modules")) for (const f of fs.readdirSync(path.join("src/modules", d))) if (f.endsWith(".routes.ts")) files.push(`src/modules/${d}/${f}`);
const KEY = /client|meeting|expen|expan|travel|fuel|vehicle|quotation|invoice|categor|subcategor|record-?sale|inventory|asset|separation|top-performer|revenue|sales-?perf|report|tally|bulk/i;
for (const f of files) {
  let mount = mounts[f];
  if (!mount) mount = /Self.routes.ts$/.test(f) ? "/api" : "/admin";
  const src = fs.readFileSync(f, "utf8");
  for (const r of src.matchAll(/router\.(get|post|put|patch|delete)\(\s*["'`]([^"'`]+)["'`]/g)) {
    const full = (mount + r[2]).replace(/\/+/g, "/");
    if (KEY.test(full) && !featureForPath(full.replace(/:[a-zA-Z]+/g, "1"))) console.log(r[1].toUpperCase().padEnd(6), full, " ", f);
  }
}
