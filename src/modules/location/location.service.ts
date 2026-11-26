import { ServiceError } from "../shared/serviceError";

// ============================================================
// Location lookups for address forms (branch form: country / state / city /
// district). Proxied server-side so the browser never calls third parties,
// and cached in memory — this reference data changes rarely.
//
//   countries / states / cities → countriesnow.space (free, no key)
//   PIN code → district/state/places (India) → api.postalpincode.in (India Post)
//
// City lists from countriesnow are not exhaustive (e.g. Zirakpur is missing
// for Punjab), so the form keeps city/district as free text with these as
// suggestions; the PIN-code lookup fills the exact values for India.
// ============================================================

const COUNTRIES_NOW = "https://countriesnow.space/api/v0.1";
const PINCODE_API = "https://api.postalpincode.in/pincode";
const TTL_MS = 24 * 60 * 60 * 1000;
const TIMEOUT_MS = 10_000;

const cache = new Map<string, { at: number; value: any }>();
const cached = async <T>(key: string, load: () => Promise<T>): Promise<T> => {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value as T;
  const value = await load();
  cache.set(key, { at: Date.now(), value });
  return value;
};

const getJson = async (url: string): Promise<any> => {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { Accept: "application/json" } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } catch (e) {
    throw new ServiceError("Location service is unavailable right now — you can type the value instead", 503);
  } finally {
    clearTimeout(timer);
  }
};

const byName = (a: string, b: string) => a.localeCompare(b);

/** [{ name: "India", code: "IN" }, …] */
export const listCountries = () =>
  cached("countries", async () => {
    const j = await getJson(`${COUNTRIES_NOW}/countries/iso`);
    const rows = Array.isArray(j?.data) ? j.data : [];
    return rows
      .map((c: any) => ({ name: String(c.name || "").trim(), code: String(c.Iso2 || "").trim() }))
      .filter((c: any) => c.name)
      .sort((a: any, b: any) => byName(a.name, b.name));
  });

/** Accepts a country name ("India") or ISO-2 code ("IN"); returns the name. */
const resolveCountryName = async (country: string): Promise<string> => {
  const raw = String(country || "").trim();
  if (!raw) throw new ServiceError("country is required");
  if (raw.length === 2) {
    const match = (await listCountries()).find((c: any) => c.code.toUpperCase() === raw.toUpperCase());
    if (match) return match.name;
  }
  return raw;
};

/** [{ name: "Punjab", code: "PB" }, …] */
export const listStates = async (country: string) => {
  const name = await resolveCountryName(country);
  return cached(`states:${name.toLowerCase()}`, async () => {
    const j = await getJson(`${COUNTRIES_NOW}/countries/states/q?country=${encodeURIComponent(name)}`);
    const rows = Array.isArray(j?.data?.states) ? j.data.states : [];
    return rows
      .map((s: any) => ({ name: String(s.name || "").replace(/\s+(State|Province)$/i, "").trim(), code: String(s.state_code || "").trim() }))
      .filter((s: any) => s.name)
      .sort((a: any, b: any) => byName(a.name, b.name));
  });
};

/** ["Amritsar", "Mohali", …] */
export const listCities = async (country: string, state: string) => {
  const name = await resolveCountryName(country);
  const st = String(state || "").trim();
  if (!st) throw new ServiceError("state is required");
  return cached(`cities:${name.toLowerCase()}:${st.toLowerCase()}`, async () => {
    // countriesnow sometimes lists a state as "Xyz State"; try both spellings.
    for (const candidate of [st, `${st} State`]) {
      const j = await getJson(
        `${COUNTRIES_NOW}/countries/state/cities/q?country=${encodeURIComponent(name)}&state=${encodeURIComponent(candidate)}`
      ).catch(() => null);
      const rows = Array.isArray(j?.data) ? j.data : [];
      if (rows.length) return Array.from(new Set<string>(rows.map((c: any) => String(c).trim()).filter(Boolean))).sort(byName);
    }
    return [] as string[];
  });
};

/** India PIN code → { pincode, country, state, district, districts[], places[] } */
export const lookupPincode = async (pin: string) => {
  const p = String(pin || "").trim();
  if (!/^[1-9][0-9]{5}$/.test(p)) throw new ServiceError("PIN code must be 6 digits");
  return cached(`pin:${p}`, async () => {
    const j = await getJson(`${PINCODE_API}/${p}`);
    const offices = Array.isArray(j?.[0]?.PostOffice) ? j[0].PostOffice : [];
    if (!offices.length) throw new ServiceError("No location found for this PIN code", 404);
    const count = (key: string) => {
      const m = new Map<string, number>();
      offices.forEach((o: any) => { const v = String(o?.[key] || "").trim(); if (v && v !== "NA") m.set(v, (m.get(v) || 0) + 1); });
      return Array.from(m.entries()).sort((a, b) => b[1] - a[1]).map(([v]) => v);
    };
    const districts = count("District");
    return {
      pincode: p,
      country: "India",
      state: count("State")[0] || "",
      district: districts[0] || "",
      districts,
      // Post-office / area names and blocks — offered as city suggestions.
      places: Array.from(new Set([...count("Block"), ...offices.map((o: any) => String(o.Name || "").trim())].filter(Boolean))),
      // One PIN can span districts (140603: Zirakpur → Mohali, Chhatt →
      // Patiala) — per-office district lets the form match the city.
      offices: offices.map((o: any) => ({
        name: String(o.Name || "").trim(),
        block: String(o.Block || "").trim(),
        district: String(o.District || "").trim(),
      })),
    };
  });
};

/**
 * India: city / town name (+ state) → district (+ a PIN code), via India Post's
 * post-office-by-name search. Same-named places in other states are ignored;
 * an exact office-name match wins, else the most common district.
 * → { city, state, district, districts[], pincode }
 */
export const lookupCityDistrict = async (state: string, city: string) => {
  const st = String(state || "").trim();
  const ct = String(city || "").trim();
  if (!st || !ct) throw new ServiceError("state and city are required");
  return cached(`city:${st.toLowerCase()}:${ct.toLowerCase()}`, async () => {
    const j = await getJson(`https://api.postalpincode.in/postoffice/${encodeURIComponent(ct)}`);
    const all = Array.isArray(j?.[0]?.PostOffice) ? j[0].PostOffice : [];
    const same = (a: any, b: string) => String(a || "").trim().toLowerCase() === b.toLowerCase();
    const inState = all.filter((o: any) => same(o.State, st));
    if (!inState.length) return { city: ct, state: st, district: "", districts: [] as string[], pincode: "" };
    const exact = inState.filter((o: any) => same(o.Name, ct) || same(o.Block, ct));
    const pool = exact.length ? exact : inState;
    const tally = new Map<string, number>();
    pool.forEach((o: any) => { const d = String(o.District || "").trim(); if (d) tally.set(d, (tally.get(d) || 0) + 1); });
    const districts = Array.from(tally.entries()).sort((a, b) => b[1] - a[1]).map(([d]) => d);
    const head = exact.find((o: any) => /head|sub/i.test(String(o.BranchType || ""))) || exact[0];
    return { city: ct, state: st, district: districts[0] || "", districts, pincode: head ? String(head.Pincode || "") : "" };
  });
};
