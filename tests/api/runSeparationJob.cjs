// Runs the real separation deactivation job, scoped to the given request ids.
// Usage: node -r ts-node/register/transpile-only tests/api/runSeparationJob.cjs <today YYYY-MM-DD> <requestId,...>
const { deactivateDueSeparations } = require("../../src/modules/separation/separation.service");

const [today, ids] = process.argv.slice(2);
const requestIds = String(ids || "").split(",").map(Number).filter(Boolean);
if (!today || !requestIds.length) {
  console.error("usage: runSeparationJob.cjs <today> <requestId,...>");
  process.exit(2);
}

deactivateDueSeparations(today, { requestIds })
  .then((r) => { console.log("RESULT" + JSON.stringify(r)); process.exit(0); })
  .catch((e) => { console.error(e); process.exit(1); });
