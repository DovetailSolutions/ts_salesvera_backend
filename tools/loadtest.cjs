/*
 * SalesVera API load test harness.
 *
 *   npm i -D autocannon          # one-time; not a runtime dependency
 *   TOKEN="<bearer>" node tools/loadtest.cjs [base-url] [path]
 *
 * e.g. TOKEN="eyJ..." node tools/loadtest.cjs http://localhost:4800 "/admin/getalluser?page=1&limit=10"
 *
 * ── READ THIS BEFORE POINTING IT ANYWHERE ────────────────────────────────
 * .env's DB_HOST is the PRODUCTION database, so a backend started locally
 * still executes every query against live data — "localhost" is not a safe
 * target on its own. Restore a dump and set DB_HOST=localhost first.
 * There is also no rate limiting anywhere in the app (no express-rate-limit,
 * nothing returns 429), so nothing sheds load: every request reaches
 * Postgres. And `npm start` is a single `node dist/server.js` with no
 * cluster/PM2, so saturating it takes the API down for real users too.
 *
 * ── WHY IT RAMPS ─────────────────────────────────────────────────────────
 * "1000 rps broke it" is not a finding. "Held 250, fell over at 500" tells
 * you where to look. Percentiles, not averages: a 40ms mean with a 3s p99 is
 * a broken API, and the mean hides exactly the users who are suffering.
 */
let autocannon;
try {
  autocannon = require("autocannon");
} catch {
  console.error("autocannon is not installed. Run:  npm i -D autocannon");
  process.exit(1);
}

const BASE = process.argv[2] || "http://localhost:4800";
const PATHNAME = process.argv[3] || "/admin/getalluser?page=1&limit=10";
const TOKEN = process.env.TOKEN;

if (!TOKEN) {
  console.error(
    "ERROR: set TOKEN=<bearer token>.\n" +
    "Without it every request 401s at tokenCheck before touching the DB, and you\n" +
    "will measure a meaningless number. Copy one from DevTools > Network > any\n" +
    "XHR > Request Headers > authorization. Web tokens expire in 15m, so grab a\n" +
    "fresh one right before a long run."
  );
  process.exit(1);
}

const STAGES = [
  { rate: 100,  duration: 10 },
  { rate: 250,  duration: 10 },
  { rate: 500,  duration: 10 },
  { rate: 1000, duration: 10 },
];

const run = (rate, duration) =>
  new Promise((resolve, reject) => {
    autocannon(
      {
        url: BASE + PATHNAME,
        connections: Math.min(rate, 100),
        overallRate: rate,
        duration,
        timeout: 10,
        headers: { authorization: "Bearer " + TOKEN },
        excludeErrorStats: false,
      },
      (err, res) => (err ? reject(err) : resolve(res))
    );
  });

(async () => {
  console.log("target : " + BASE + PATHNAME);
  console.log("stages : " + STAGES.map((s) => s.rate).join(" -> ") + " req/s\n");

  // The first requests pay JIT warmup and connection-pool setup; folding that
  // into stage 1 makes the lowest rate look like the slowest.
  console.log("warmup (5s @ 50 rps)...");
  await run(50, 5);

  const rows = [];
  for (const { rate, duration } of STAGES) {
    process.stdout.write(`running ${rate} req/s for ${duration}s ... `);
    const r = await run(rate, duration);
    rows.push({
      "target rps": rate,
      "actual rps": Math.round(r.requests.average),
      "p50 ms": r.latency.p50,
      "p97.5 ms": r.latency.p97_5,
      "p99 ms": r.latency.p99,
      "max ms": r.latency.max,
      "non-2xx": r.non2xx || 0,
      errors: r.errors + r.timeouts,
    });
    console.log("done");
    // Let the server drain between stages so one stage's queue doesn't
    // poison the next stage's latency.
    await new Promise((res) => setTimeout(res, 3000));
  }

  console.log("\n=== results ===");
  console.table(rows);
  console.log(
    "\nHow to read it:\n" +
    "  actual rps << target rps    -> the SERVER is the bottleneck, not this generator\n" +
    "  p99 climbing, p50 flat      -> queueing; you are at capacity\n" +
    "  non-2xx > 0                 -> check which: 500 = broken, 401 = token expired,\n" +
    "                                 429 = rate limited (you have none, so you won't see these)\n" +
    "\nAlso diff pg_stat_user_tables before/after — Postgres, not Node, is the\n" +
    "likely ceiling while meeting_users.user_id and holidays.companyId are unindexed."
  );
})().catch((e) => {
  console.error("FATAL: " + e.message);
  process.exit(1);
});
