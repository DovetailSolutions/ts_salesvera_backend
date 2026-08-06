"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatISTTime = exports.parseISTTime = exports.getISTDateString = void 0;
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
const getISTDateString = (d = new Date()) => {
    const ist = new Date(d.getTime() + IST_OFFSET_MS);
    const y = ist.getUTCFullYear();
    const m = String(ist.getUTCMonth() + 1).padStart(2, "0");
    const day = String(ist.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
};
exports.getISTDateString = getISTDateString;
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
// FIX: previously did `String(timeStr).split(":").map(Number)` and fell
// back to 0 for any missing/NaN piece via `h || 0` — an empty string,
// `undefined`, or garbage like "bad" all silently parsed as midnight
// instead of failing loudly, which for a shift start/end time would mean a
// misconfigured/corrupt shift record silently opens the gate at 00:00 IST
// instead of surfacing the bad data. Seconds are still genuinely optional
// (a bare "HH:mm" is valid input and correctly defaults to :00 seconds) —
// only hour/minute (and a present-but-malformed seconds part) are required
// to be real numbers.
const parseISTTime = (dateStr, timeStr) => {
    const parts = String(timeStr !== null && timeStr !== void 0 ? timeStr : "").split(":");
    const h = Number(parts[0]);
    const min = Number(parts[1]);
    const sec = parts.length > 2 ? Number(parts[2]) : 0;
    if (!dateStr || parts.length < 2 || Number.isNaN(h) || Number.isNaN(min) || Number.isNaN(sec)) {
        throw new Error(`parseISTTime: invalid time "${timeStr}" for date "${dateStr}"`);
    }
    const hh = String(h).padStart(2, "0");
    const mm = String(min).padStart(2, "0");
    const ss = String(sec).padStart(2, "0");
    const result = new Date(`${dateStr}T${hh}:${mm}:${ss}.000+05:30`);
    if (isNaN(result.getTime())) {
        throw new Error(`parseISTTime: invalid date "${dateStr}"`);
    }
    return result;
};
exports.parseISTTime = parseISTTime;
// Inverse of parseISTTime — formats an instant back as its IST wall-clock
// "HH:mm", regardless of the server's OS timezone (same +5:30 shift, then
// UTC getters instead of OS-local getters).
const formatISTTime = (d) => {
    const ist = new Date(d.getTime() + IST_OFFSET_MS);
    return `${String(ist.getUTCHours()).padStart(2, "0")}:${String(ist.getUTCMinutes()).padStart(2, "0")}`;
};
exports.formatISTTime = formatISTTime;
