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
