/** Applies the page's new HIDDEN_MODULES filter to the real API payload. */
const HIDDEN = new Set(["Chat", "Departments", "Branches", "Shifts", "Quotations", "Proforma Invoices"]);

(async () => {
  const login = await fetch("http://localhost:4800/admin/login", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "info@dovetailsolutions.in", password: "Admin@123" }),
  });
  const token = ((await login.json()) as any)?.data?.accessToken;

  // 447 = a manager in this tenant; the overview is company-scoped so ask for one directly.
  for (const path of ["/admin/manager-capabilities", "/admin/manager-capabilities/447"]) {
    const r = await fetch("http://localhost:4800" + path, { headers: { Authorization: `Bearer ${token}` } });
    const body: any = await r.json();
    const caps: any[] = body?.data?.capabilities ?? [];
    if (!caps.length) { console.log(`${path} -> ${r.status}, ${caps.length} capabilities (${body?.message ?? ""})`); continue; }

    const byModule = new Map<string, number>();
    caps.forEach((c) => byModule.set(c.module, (byModule.get(c.module) ?? 0) + 1));
    const kept = caps.filter((c) => !HIDDEN.has(c.module));

    console.log(`\n=== ${path} -> ${r.status} ===`);
    console.log(`total ${caps.length} capabilities across ${byModule.size} modules; after filter: ${kept.length}\n`);
    console.table([...byModule.entries()].sort().map(([module, n]) => ({
      module, capabilities: n, shown: HIDDEN.has(module) ? "HIDDEN" : "shown",
    })));
    const shiftAssign = caps.find((c) => /assign employee shift/i.test(c.label ?? ""));
    if (shiftAssign) {
      console.log(`"Assign Employee Shift" -> module "${shiftAssign.module}" -> ${HIDDEN.has(shiftAssign.module) ? "HIDDEN (bad)" : "still shown (correct)"}`);
    }
    break;
  }
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });
