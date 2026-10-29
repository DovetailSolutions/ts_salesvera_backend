import { isFlexibleTiming, type AttendanceMode, type AttendancePolicyConfig } from "./attendancePolicy.config";

// ============================================================
// The single attendance-day classifier used when a company has saved an
// attendance policy. Pure (no DB, no clock) so the admin "Preview rules"
// screen, punch-out and the auto punch-out job all get exactly the same
// answer for the same inputs.
//
// Precedence (highest first):
//   1. Approved full-day leave        → leave (punches don't change it)
//   2. Missed punch-out + mark_absent → absent, when no session of the day
//      was completed; otherwise the completed sessions decide (rule 3) and
//      the unclosed one counts for nothing
//   3. Eligible hours vs thresholds   → full / half / short / absent
//        eligible = worked (all sessions of the day, or only the in-shift
//                   part in strict "count only shift hours")
//                   − break (if deducted)
//                   + approved short leave (if it counts as worked)
//   4. Strict-mode late / early rules → caps a full day at half day
//   5. Late-count rule (either mode)  → the Nth, 2Nth, … late arrival of
//      the month caps a full day at half day
//
// Manual admin marks and approved regularizations sit ABOVE all of this:
// the caller (attendance.service.ts) never re-classifies a day that has one.
// Late / early departure / overtime are returned as separate facts and only
// change the status through rule 4. Under flexible timing there is no fixed
// start/end, so late / early departure are never flagged.
// ============================================================

export interface ClassifierShift {
  start: Date | null; // shift start instant on this attendance date
  end: Date | null; // shift end instant (next day for a night shift)
  breakMinutes?: number | null;
  workingHours?: number | null;
}

export interface ClassifierSession {
  punchIn: Date;
  punchOut: Date;
  autoPunchedOut?: boolean;
}

export interface ClassifierLeave {
  kind: "full_day" | "half_day" | "short_leave";
  session?: "first_half" | "second_half" | "morning" | "evening" | null;
  durationMinutes?: number | null;
}

export interface ClassifyInput {
  mode: AttendanceMode;
  config: AttendancePolicyConfig;
  shift: ClassifierShift | null;
  sessions: ClassifierSession[];
  leave?: ClassifierLeave | null;
  missedPunchOut?: boolean;
  // Earlier days of the same calendar month already flagged late — for the
  // late-count rule (rule 5). The caller looks these up; 0 when omitted.
  priorLateDaysThisMonth?: number;
}

export interface ClassifyResult {
  status: "out" | "absent" | "leaveApproved";
  dayType: "full_day" | "half_day" | "short_leave" | null;
  label: "P" | "HD" | "S" | "A" | "L";
  reason: string;
  workedHours: number;
  breakHours: number;
  leaveHours: number;
  eligibleHours: number;
  overtimeHours: number;
  late: boolean;
  lateMinutes: number;
  earlyDeparture: boolean;
  earlyMinutes: number;
}

const HOUR = 60 * 60 * 1000;
const round2 = (n: number) => Math.round(n * 100) / 100;
const fmtH = (n: number) => `${round2(n)} h`;

const overlapMs = (aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) =>
  Math.max(0, Math.min(aEnd.getTime(), bEnd.getTime()) - Math.max(aStart.getTime(), bStart.getTime()));

export const classifyAttendanceDay = (input: ClassifyInput): ClassifyResult => {
  const { mode, config, shift, leave } = input;
  const sessions = [...input.sessions]
    .filter((s) => s.punchIn && s.punchOut && s.punchOut.getTime() > s.punchIn.getTime())
    .sort((a, b) => a.punchIn.getTime() - b.punchIn.getTime());

  const base = {
    workedHours: 0, breakHours: 0, leaveHours: 0, eligibleHours: 0, overtimeHours: 0,
    late: false, lateMinutes: 0, earlyDeparture: false, earlyMinutes: 0,
  };

  // 1. Approved full-day leave wins over everything computed below.
  if (leave?.kind === "full_day") {
    return { ...base, status: "leaveApproved", dayType: null, label: "L", reason: "Approved full-day leave" };
  }

  // 2. Missed punch-out under a "mark absent" policy. FIX: this used to mark
  // the whole day absent even when earlier sessions were properly closed
  // (e.g. a morning session, then a missed punch-out after lunch) — those
  // hours were thrown away. Now only a day with no completed session is
  // absent; otherwise the completed sessions are classified as usual.
  const missedUnderMarkAbsent = !!input.missedPunchOut && config.missedPunchOut.action === "mark_absent";
  if (missedUnderMarkAbsent && sessions.length === 0) {
    return { ...base, status: "absent", dayType: null, label: "A", reason: "Missed punch-out — marked absent by attendance policy" };
  }

  // 3. Worked → eligible hours.
  const strictShiftOnly = mode === "strict" && config.strict.countOnlyShiftHours && !!shift?.start && !!shift?.end;
  const workedMs = sessions.reduce(
    (sum, s) => sum + (strictShiftOnly
      ? overlapMs(s.punchIn, s.punchOut, shift!.start!, shift!.end!)
      : s.punchOut.getTime() - s.punchIn.getTime()),
    0
  );
  const workedHours = workedMs / HOUR;

  const breakMinutes = config.breakMinutesOverride ?? shift?.breakMinutes ?? 0;
  const breakHours = config.deductBreak && workedHours > 0 ? Math.min(workedHours, (breakMinutes || 0) / 60) : 0;

  const leaveHours =
    leave?.kind === "short_leave" && config.leave.shortLeaveCountsAsWorked
      ? Math.max(0, Number(leave.durationMinutes) || 0) / 60
      : 0;

  const eligibleHours = Math.max(0, workedHours - breakHours) + leaveHours;

  // Late / early flags, relative to the shift — shifted by an approved
  // morning/first-half leave (late) or evening/second-half leave (early).
  let late = false, lateMinutes = 0, earlyDeparture = false, earlyMinutes = 0;
  if (shift?.start && shift?.end && sessions.length && !isFlexibleTiming(mode, config)) {
    const shiftMs = shift.end.getTime() - shift.start.getTime();
    let expectedStart = shift.start.getTime();
    let expectedEnd = shift.end.getTime();
    if (leave?.kind === "half_day" && leave.session === "first_half") expectedStart += shiftMs / 2;
    if (leave?.kind === "half_day" && leave.session === "second_half") expectedEnd -= shiftMs / 2;
    if (leave?.kind === "short_leave" && leave.session === "morning") expectedStart += (Number(leave.durationMinutes) || 0) * 60000;
    if (leave?.kind === "short_leave" && leave.session === "evening") expectedEnd -= (Number(leave.durationMinutes) || 0) * 60000;

    const firstIn = sessions[0].punchIn.getTime();
    const last = sessions[sessions.length - 1];
    const lateBy = Math.round((firstIn - expectedStart) / 60000);
    if (lateBy > config.lateGraceMinutes) { late = true; lateMinutes = lateBy; }
    // A system punch-out isn't the employee leaving early — nor is the end of
    // the last completed session when a later one was never punched out
    // (when they actually left is unknown).
    if (!last.autoPunchedOut && !missedUnderMarkAbsent) {
      const earlyBy = Math.round((expectedEnd - last.punchOut.getTime()) / 60000);
      if (earlyBy > config.earlyDepartureGraceMinutes) { earlyDeparture = true; earlyMinutes = earlyBy; }
    }
  }

  const required = shift?.workingHours && shift.workingHours > 0 ? Number(shift.workingHours) : config.fullDayHours;
  const extraMin = Math.max(0, (eligibleHours - required) * 60);
  const overtimeHours = config.overtime.enabled && extraMin >= config.overtime.minimumMinutes ? round2(extraMin / 60) : 0;

  const facts = {
    workedHours: round2(workedHours), breakHours: round2(breakHours), leaveHours: round2(leaveHours),
    eligibleHours: round2(eligibleHours), overtimeHours, late, lateMinutes, earlyDeparture, earlyMinutes,
  };

  const parts: string[] = [];
  parts.push(`${fmtH(eligibleHours)} eligible${strictShiftOnly ? " (in-shift only)" : ""}`);
  if (breakHours > 0) parts.push(`${fmtH(breakHours)} break deducted`);
  if (leaveHours > 0) parts.push(`${fmtH(leaveHours)} approved short leave counted`);
  if (leave?.kind === "half_day") parts.push(`approved ${leave.session === "second_half" ? "second" : "first"}-half leave`);

  let status: ClassifyResult["status"];
  let dayType: ClassifyResult["dayType"];
  let label: ClassifyResult["label"];
  if (eligibleHours >= config.fullDayHours) {
    status = "out"; dayType = "full_day"; label = "P";
    parts.unshift(`Full day — needs ${config.fullDayHours} h`);
  } else if (eligibleHours >= config.halfDayHours) {
    status = "out"; dayType = "half_day"; label = "HD";
    parts.unshift(`Half day — needs ${config.halfDayHours} h (full day ${config.fullDayHours} h)`);
  } else if (eligibleHours >= config.shortDayHours && sessions.length) {
    status = "absent"; dayType = "short_leave"; label = "S";
    parts.unshift(`Short day — below half day (${config.halfDayHours} h)`);
  } else {
    status = "absent"; dayType = null; label = "A";
    parts.unshift(sessions.length ? `Absent — below short day (${config.shortDayHours} h)` : "Absent — no completed punch session");
  }

  // 4. Strict-mode caps.
  if (mode === "strict" && dayType === "full_day") {
    const lb = config.strict.lateBeyondMarksHalfDay;
    const eb = config.strict.earlyDepartureBeyondMarksHalfDay;
    // parts[0] is the threshold headline set above — replace it rather than
    // add a second, contradictory one.
    if (lb.enabled && late && lateMinutes > lb.minutes) {
      dayType = "half_day"; label = "HD";
      parts[0] = `Half day — late by ${lateMinutes} min (strict limit ${lb.minutes} min)`;
    } else if (eb.enabled && earlyDeparture && earlyMinutes > eb.minutes) {
      dayType = "half_day"; label = "HD";
      parts[0] = `Half day — left ${earlyMinutes} min early (strict limit ${eb.minutes} min)`;
    }
  }

  // 5. Late-count rule. A day already lowered by rule 4 (or below a full
  // day on hours) isn't lowered again.
  if (config.lateCount.enabled && late && dayType === "full_day") {
    const nth = Math.max(0, Number(input.priorLateDaysThisMonth) || 0) + 1;
    if (nth % config.lateCount.every === 0) {
      dayType = "half_day"; label = "HD";
      parts[0] = `Half day — late arrival no. ${nth} this month (every ${config.lateCount.every} late arrivals = half day)`;
    }
  }

  // Early punch-out "allow" means leaving early is fine and isn't flagged —
  // only "flag" (and "block", for whatever still gets through) records it.
  // FIX: "allow" used to flag exactly like "flag". The strict early-departure
  // half-day rule above is its own switch and still applies either way.
  const flagEarly = config.punchOut.beforeShiftEnd !== "allow";

  if (late) parts.push(`late ${lateMinutes} min`);
  if (earlyDeparture && flagEarly) parts.push(`left ${earlyMinutes} min early`);
  if (overtimeHours > 0) parts.push(`overtime ${fmtH(overtimeHours)}`);
  if (sessions.some((s) => s.autoPunchedOut)) parts.push("auto punch-out");
  if (missedUnderMarkAbsent) parts.push("missed punch-out on a later session — not counted");

  return {
    status, dayType, label, reason: parts.join("; ").slice(0, 255), ...facts,
    earlyDeparture: flagEarly && earlyDeparture,
    earlyMinutes: flagEarly ? earlyMinutes : 0,
  };
};
