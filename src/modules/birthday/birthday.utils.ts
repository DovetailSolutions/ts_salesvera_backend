// ============================================================
// Birthday Celebrations — pure helpers (no DB access), kept separate so the
// date/template rules can be unit-tested in isolation.
// ============================================================

// The app's default timezone everywhere else (cronJobs.ts, dateUtils.ts).
export const DEFAULT_TIMEZONE = "Asia/Kolkata";

export const DEFAULT_TEMPLATE =
  "🎉 Happy Birthday, {{name}}! Wishing you a wonderful birthday filled with happiness, success, and good health. Best wishes from your {{company}} team!";

// {{name}}    → every celebrant's name, joined ("Rahul", "Rahul and Priya",
//               "Rahul, Priya and Amit") — one combined announcement per day.
// {{company}} → the company's name.
// Deliberately nothing that exposes a date of birth or age.
export const SUPPORTED_PLACEHOLDERS = ["name", "company"] as const;

export const MAX_TEMPLATE_LENGTH = 1000;

// ── Date of birth parsing ────────────────────────────────────────────────
// users.dob is a free-text VARCHAR. Formats actually present in the data:
// "YYYY-MM-DD" (web <input type="date">) and "D/M/YYYY" (CSV import / mobile —
// verified day-first: several rows have a first part > 12). Also accepted:
// "DD-MM-YYYY" and an ISO timestamp ("YYYY-MM-DDTHH:mm..."), whose date part
// is used as-is. Anything else — or an impossible date (31/02), a year before
// 1900, or a date in the future — is treated as "no valid date of birth" and
// never generates an announcement.
export interface ParsedDob {
  year: number;
  month: number; // 1-12
  day: number;
}

const isLeapYear = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

const daysInMonth = (y: number, m: number) => [31, isLeapYear(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];

export const parseDob = (raw: unknown, todayYmd?: string): ParsedDob | null => {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s) return null;

  let y: number, m: number, d: number;
  let match: RegExpMatchArray | null;
  if ((match = s.match(/^(\d{4})-(\d{2})-(\d{2})(T.*)?$/))) {
    [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else if ((match = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/))) {
    [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else {
    return null;
  }

  if (y < 1900 || m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) return null;

  if (todayYmd) {
    const ymd = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    if (ymd > todayYmd) return null;
  }
  return { year: y, month: m, day: d };
};

// Leap-day policy: someone born on 29 February is celebrated on 28 February
// in non-leap years (and on 29 February in leap years — never twice).
export const isBirthdayOn = (dob: ParsedDob, ymd: string): boolean => {
  const [y, m, d] = ymd.split("-").map(Number);
  if (dob.month === m && dob.day === d) return true;
  return dob.month === 2 && dob.day === 29 && m === 2 && d === 28 && !isLeapYear(y);
};

// ── Timezone handling ────────────────────────────────────────────────────
// companies.timezone holds IANA names ("Asia/Kolkata", "Asia/Tokyo") or NULL.
// A NULL/unknown value falls back to the app-wide default (IST), so a company
// that never set one behaves exactly like every other scheduled job.
export const resolveTimezone = (tz: unknown): string => {
  if (typeof tz !== "string" || !tz.trim()) return DEFAULT_TIMEZONE;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz.trim() });
    return tz.trim();
  } catch {
    return DEFAULT_TIMEZONE;
  }
};

// Local calendar date ("YYYY-MM-DD") and hour (0-23) of an instant in a zone.
export const localDateParts = (now: Date, timeZone: string): { ymd: string; hour: number } => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { ymd: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) };
};

export const addDaysYmd = (ymd: string, days: number): string => {
  const dt = new Date(`${ymd}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
};

// ── Message template ─────────────────────────────────────────────────────
export const validateTemplate = (template: unknown): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  if (typeof template !== "string" || !template.trim()) {
    return { valid: false, errors: ["Template is required"] };
  }
  if (template.length > MAX_TEMPLATE_LENGTH) {
    errors.push(`Template must be ${MAX_TEMPLATE_LENGTH} characters or fewer`);
  }

  // Every "{{" must close with a well-formed "}}" placeholder.
  const tokens = template.match(/\{\{[^{}]*\}\}/g) ?? [];
  const stripped = template.replace(/\{\{[^{}]*\}\}/g, "");
  if (stripped.includes("{{") || stripped.includes("}}")) {
    errors.push("Template contains an unclosed or malformed placeholder");
  }
  const unsupported = Array.from(
    new Set(
      tokens
        .map((t) => t.slice(2, -2).trim())
        .filter((name) => !(SUPPORTED_PLACEHOLDERS as readonly string[]).includes(name))
    )
  );
  if (unsupported.length) {
    errors.push(
      `Unsupported placeholder(s): ${unsupported.map((n) => `{{${n}}}`).join(", ")}. Supported: ${SUPPORTED_PLACEHOLDERS.map((n) => `{{${n}}}`).join(", ")}`
    );
  }
  if (!tokens.some((t) => t.slice(2, -2).trim() === "name")) {
    errors.push("Template must include the {{name}} placeholder");
  }
  return { valid: errors.length === 0, errors };
};

export const joinNames = (names: string[]): string => {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
};

// Plain-text substitution only — the result is stored as an announcement
// message and rendered as text (React escapes it), never as HTML.
export const renderTemplate = (template: string, values: { name: string; company: string }): string =>
  template.replace(/\{\{\s*(name|company)\s*\}\}/g, (_m, key: "name" | "company") => values[key]);
