// IST is a fixed UTC+5:30 offset (no DST). Computing "today" via
// `new Date().toISOString().slice(0, 10)` converts to UTC first, which
// rolls the calendar day backward for any real-world IST time before
// ~05:30 — e.g. at 02:30 AM IST it still reports the previous day.
// `new Date().getFullYear()/getMonth()/getDate()` avoids that, but only
// resolves to IST if the server process's OS timezone happens to be set
// to Asia/Kolkata — invisible in code and silently wrong if the process
// is ever deployed on a host whose OS timezone is UTC (the common default
// for cloud Linux images). This helper computes the IST calendar date via
// explicit offset arithmetic instead, so it's correct regardless of the
// server's local timezone configuration.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export const getISTDateString = (d: Date = new Date()): string => {
  const ist = new Date(d.getTime() + IST_OFFSET_MS);
  const y = ist.getUTCFullYear();
  const m = String(ist.getUTCMonth() + 1).padStart(2, "0");
  const day = String(ist.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

// Wall-clock times configured in the app (shift start/end, etc.) are always
// meant as IST — e.g. a shift's "09:30" means 9:30 AM in India, not 9:30 in
// whatever timezone the server process happens to be running in. Building
// that instant via `new Date(y, m-1, d, h, min, 0)` (the multi-arg
// constructor) interprets h/min as the server's OS-local time instead, so
// on a host whose OS timezone isn't IST, "09:30" silently means a
// completely different real-world moment (e.g. 09:30 UTC = 3:00 PM IST) —
// this is the exact bug class that broke shift-window punch-in gating.
// Parsing an ISO string with an explicit "+05:30" offset is not
// OS-timezone-dependent, so this is correct regardless of server config.
export const parseISTTime = (dateStr: string, timeStr: string): Date => {
  const [h, min, sec] = String(timeStr).split(":").map(Number);
  const hh = String(h || 0).padStart(2, "0");
  const mm = String(min || 0).padStart(2, "0");
  const ss = String(sec || 0).padStart(2, "0");
  return new Date(`${dateStr}T${hh}:${mm}:${ss}.000+05:30`);
};

// Inverse of parseISTTime — formats an instant back as its IST wall-clock
// "HH:mm", regardless of the server's OS timezone (same +5:30 shift, then
// UTC getters instead of OS-local getters).
export const formatISTTime = (d: Date): string => {
  const ist = new Date(d.getTime() + IST_OFFSET_MS);
  return `${String(ist.getUTCHours()).padStart(2, "0")}:${String(ist.getUTCMinutes()).padStart(2, "0")}`;
};
