import { ServiceError } from "../shared/serviceError";

// ============================================================
// Attendance policy configuration — shape, defaults and validation.
//
// A policy is stored as { mode, config } (attendance_policies.config is
// JSONB). Every field is validated here on the server; the frontend form
// only mirrors these rules for a friendlier UX.
// ============================================================

export type AttendanceMode = "strict" | "flexible";

export interface AttendancePolicyConfig {
  // ── Day thresholds, in hours of ELIGIBLE work (after any break deduction)
  // full day  : eligible >= fullDayHours
  // half day  : eligible >= halfDayHours
  // short day : eligible >= shortDayHours   (shown "S", counted absent)
  // absent    : below shortDayHours
  fullDayHours: number;
  halfDayHours: number;
  shortDayHours: number;

  // ── Breaks: deduct the shift's breakMinutes (or breakMinutesOverride)
  // once per day from the worked time.
  deductBreak: boolean;
  breakMinutesOverride: number | null;

  // ── Late arrival / early departure. Always recorded as separate flags;
  // they only change the day's status through the strict-mode rules below.
  lateGraceMinutes: number;
  earlyDepartureGraceMinutes: number;

  // ── Flexible timing (flexible mode only): no fixed start/end time. The
  // day is decided by hours alone — no late / early-departure flags, no
  // punch-in window or shift-start gate, early punch-out never blocked.
  flexibleTiming: boolean;

  // ── Late-count rule (both modes): every Nth late arrival in a calendar
  // month (the Nth, 2Nth, …) makes that day at most a half day.
  lateCount: { enabled: boolean; every: number };

  // ── Comp-off: a full day (P) worked on a weekly off or holiday earns 1
  // day of "Comp Off" leave, a half day (HD) 0.5. The yearly limit, expiry
  // and approval come from the company's Comp Off settings (see
  // modules/compOff).
  compOff: { enabled: boolean };

  // ── Strict-mode-only rules (ignored in flexible mode)
  strict: {
    // Count only the time inside the shift window.
    countOnlyShiftHours: boolean;
    // Late by more than N minutes → at most a half day, even with full hours.
    lateBeyondMarksHalfDay: { enabled: boolean; minutes: number };
    // Left more than N minutes before shift end → at most a half day.
    earlyDepartureBeyondMarksHalfDay: { enabled: boolean; minutes: number };
  };

  // ── Punch controls (enforced on the server)
  punchIn: {
    // Only allow punch-in within [shift start − earlyMinutes, shift start + lateMinutes].
    restrictToWindow: boolean;
    earlyMinutes: number;
    lateMinutes: number;
  };
  punchOut: {
    // Punching out before (shift end − earlyDepartureGraceMinutes):
    // allow = no flag, flag = allowed but flagged, block = refused (use a
    // regularization request instead).
    beforeShiftEnd: "allow" | "flag" | "block";
  };

  overtime: {
    enabled: boolean;
    // Only count overtime once it reaches this many minutes.
    minimumMinutes: number;
  };

  // ── Employee punched in but never punched out
  missedPunchOut: {
    action: "auto_punch_out" | "mark_absent";
    // Where the system punch-out is placed when action = auto_punch_out.
    autoPunchOutAt: "end_of_day" | "shift_end";
  };

  manualCorrectionRequiresReason: boolean;

  // ── Half-day / short leave requests
  leave: {
    halfDayAllowed: boolean;
    shortLeaveAllowed: boolean;
    shortLeaveMaxMinutes: number;
    shortLeaveMaxPerMonth: number;
    // Approved short-leave minutes count toward eligible hours.
    shortLeaveCountsAsWorked: boolean;
    // May a half-day / short leave for today be requested after the shift
    // has already started?
    allowRequestAfterShiftStart: boolean;
    // Weekly offs / holidays and full-day leave requests:
    //   all_days     — every calendar day from–to is charged (previous behaviour)
    //   sandwich     — an off day is charged only when full-day leave is on
    //                  both sides of it, including a separate leave request
    //                  (Fri + Mon leave also charges Sat/Sun)
    //   working_days — only working days are charged
    sandwich: "all_days" | "sandwich" | "working_days";
  };
}

export const DEFAULT_POLICY_CONFIG: AttendancePolicyConfig = {
  fullDayHours: 8,
  halfDayHours: 4,
  shortDayHours: 2,
  deductBreak: false,
  breakMinutesOverride: null,
  lateGraceMinutes: 15,
  earlyDepartureGraceMinutes: 15,
  flexibleTiming: false,
  lateCount: { enabled: false, every: 3 },
  compOff: { enabled: false },
  strict: {
    countOnlyShiftHours: false,
    lateBeyondMarksHalfDay: { enabled: false, minutes: 120 },
    earlyDepartureBeyondMarksHalfDay: { enabled: false, minutes: 120 },
  },
  punchIn: { restrictToWindow: false, earlyMinutes: 30, lateMinutes: 120 },
  punchOut: { beforeShiftEnd: "flag" },
  overtime: { enabled: false, minimumMinutes: 30 },
  missedPunchOut: { action: "auto_punch_out", autoPunchOutAt: "end_of_day" },
  manualCorrectionRequiresReason: false,
  leave: {
    halfDayAllowed: true,
    shortLeaveAllowed: true,
    shortLeaveMaxMinutes: 120,
    shortLeaveMaxPerMonth: 2,
    shortLeaveCountsAsWorked: true,
    allowRequestAfterShiftStart: false,
    sandwich: "all_days",
  },
};

// Flexible timing only applies in flexible mode; a strict policy keeps its
// late / early rules even if the flag was left on from an earlier edit.
export const isFlexibleTiming = (mode: AttendanceMode, config: AttendancePolicyConfig): boolean =>
  mode === "flexible" && config.flexibleTiming === true;

const isObj = (v: unknown): v is Record<string, any> => !!v && typeof v === "object" && !Array.isArray(v);

const num = (errors: string[], label: string, v: unknown, min: number, max: number): number => {
  const n = Number(v);
  if (v === null || v === undefined || v === "" || !Number.isFinite(n)) {
    errors.push(`${label} must be a number`);
    return 0;
  }
  if (n < min || n > max) errors.push(`${label} must be between ${min} and ${max}`);
  return Math.round(n * 100) / 100;
};

const int = (errors: string[], label: string, v: unknown, min: number, max: number): number => {
  const n = num(errors, label, v, min, max);
  if (Number.isFinite(n) && !Number.isInteger(n)) errors.push(`${label} must be a whole number`);
  return Math.round(n);
};

const bool = (errors: string[], label: string, v: unknown): boolean => {
  if (typeof v !== "boolean") errors.push(`${label} must be true or false`);
  return v === true;
};

const oneOf = <T extends string>(errors: string[], label: string, v: unknown, allowed: readonly T[]): T => {
  if (!allowed.includes(v as T)) errors.push(`${label} must be one of: ${allowed.join(", ")}`);
  return (allowed.includes(v as T) ? v : allowed[0]) as T;
};

// Merges the caller's partial config over the defaults, then validates every
// field and the relationships between them. Throws a 400 listing every
// problem at once, so the admin can fix the form in one go.
export const validatePolicy = (rawMode: unknown, rawConfig: unknown): { mode: AttendanceMode; config: AttendancePolicyConfig } => {
  const errors: string[] = [];
  const mode = oneOf(errors, "Attendance mode", rawMode, ["strict", "flexible"] as const);
  const c: any = isObj(rawConfig) ? rawConfig : {};
  const d = DEFAULT_POLICY_CONFIG;
  const sub = (k: string) => (isObj(c[k]) ? c[k] : {});

  const config: AttendancePolicyConfig = {
    fullDayHours: num(errors, "Full day hours", c.fullDayHours ?? d.fullDayHours, 0.5, 24),
    halfDayHours: num(errors, "Half day hours", c.halfDayHours ?? d.halfDayHours, 0.25, 24),
    shortDayHours: num(errors, "Short day hours", c.shortDayHours ?? d.shortDayHours, 0, 24),
    deductBreak: bool(errors, "Deduct break", c.deductBreak ?? d.deductBreak),
    breakMinutesOverride:
      c.breakMinutesOverride === null || c.breakMinutesOverride === undefined || c.breakMinutesOverride === ""
        ? null
        : int(errors, "Break duration override", c.breakMinutesOverride, 0, 240),
    lateGraceMinutes: int(errors, "Late arrival grace period", c.lateGraceMinutes ?? d.lateGraceMinutes, 0, 600),
    earlyDepartureGraceMinutes: int(errors, "Early departure grace period", c.earlyDepartureGraceMinutes ?? d.earlyDepartureGraceMinutes, 0, 600),
    flexibleTiming: bool(errors, "Flexible timing", c.flexibleTiming ?? d.flexibleTiming),
    lateCount: {
      enabled: bool(errors, "Late-count rule", sub("lateCount").enabled ?? d.lateCount.enabled),
      every: int(errors, "Late arrivals per half day", sub("lateCount").every ?? d.lateCount.every, 1, 31),
    },
    compOff: {
      enabled: bool(errors, "Earn comp-off", sub("compOff").enabled ?? d.compOff.enabled),
    },
    strict: {
      countOnlyShiftHours: bool(errors, "Count only in-shift hours", sub("strict").countOnlyShiftHours ?? d.strict.countOnlyShiftHours),
      lateBeyondMarksHalfDay: {
        enabled: bool(errors, "Late arrival half-day rule", sub("strict").lateBeyondMarksHalfDay?.enabled ?? d.strict.lateBeyondMarksHalfDay.enabled),
        minutes: int(errors, "Late arrival half-day limit", sub("strict").lateBeyondMarksHalfDay?.minutes ?? d.strict.lateBeyondMarksHalfDay.minutes, 1, 720),
      },
      earlyDepartureBeyondMarksHalfDay: {
        enabled: bool(errors, "Early departure half-day rule", sub("strict").earlyDepartureBeyondMarksHalfDay?.enabled ?? d.strict.earlyDepartureBeyondMarksHalfDay.enabled),
        minutes: int(errors, "Early departure half-day limit", sub("strict").earlyDepartureBeyondMarksHalfDay?.minutes ?? d.strict.earlyDepartureBeyondMarksHalfDay.minutes, 1, 720),
      },
    },
    punchIn: {
      restrictToWindow: bool(errors, "Restrict punch-in to a time window", sub("punchIn").restrictToWindow ?? d.punchIn.restrictToWindow),
      earlyMinutes: int(errors, "Earliest punch-in", sub("punchIn").earlyMinutes ?? d.punchIn.earlyMinutes, 0, 720),
      lateMinutes: int(errors, "Latest punch-in", sub("punchIn").lateMinutes ?? d.punchIn.lateMinutes, 0, 720),
    },
    punchOut: {
      beforeShiftEnd: oneOf(errors, "Early punch-out", sub("punchOut").beforeShiftEnd ?? d.punchOut.beforeShiftEnd, ["allow", "flag", "block"] as const),
    },
    overtime: {
      enabled: bool(errors, "Track overtime", sub("overtime").enabled ?? d.overtime.enabled),
      minimumMinutes: int(errors, "Minimum overtime", sub("overtime").minimumMinutes ?? d.overtime.minimumMinutes, 0, 600),
    },
    missedPunchOut: {
      action: oneOf(errors, "Missed punch-out action", sub("missedPunchOut").action ?? d.missedPunchOut.action, ["auto_punch_out", "mark_absent"] as const),
      autoPunchOutAt: oneOf(errors, "System punch-out time", sub("missedPunchOut").autoPunchOutAt ?? d.missedPunchOut.autoPunchOutAt, ["end_of_day", "shift_end"] as const),
    },
    manualCorrectionRequiresReason: bool(errors, "Require a reason for manual corrections", c.manualCorrectionRequiresReason ?? d.manualCorrectionRequiresReason),
    leave: {
      halfDayAllowed: bool(errors, "Allow half-day leave", sub("leave").halfDayAllowed ?? d.leave.halfDayAllowed),
      shortLeaveAllowed: bool(errors, "Allow short leave", sub("leave").shortLeaveAllowed ?? d.leave.shortLeaveAllowed),
      shortLeaveMaxMinutes: int(errors, "Maximum short leave duration", sub("leave").shortLeaveMaxMinutes ?? d.leave.shortLeaveMaxMinutes, 15, 480),
      shortLeaveMaxPerMonth: int(errors, "Maximum short leaves per month", sub("leave").shortLeaveMaxPerMonth ?? d.leave.shortLeaveMaxPerMonth, 0, 31),
      shortLeaveCountsAsWorked: bool(errors, "Count approved short leave as worked time", sub("leave").shortLeaveCountsAsWorked ?? d.leave.shortLeaveCountsAsWorked),
      allowRequestAfterShiftStart: bool(errors, "Allow same-day requests after shift start", sub("leave").allowRequestAfterShiftStart ?? d.leave.allowRequestAfterShiftStart),
      sandwich: oneOf(errors, "Weekly offs and holidays in leave", sub("leave").sandwich ?? d.leave.sandwich, ["all_days", "sandwich", "working_days"] as const),
    },
  };

  // Thresholds must strictly descend so every number of hours falls into
  // exactly one bucket — no overlapping classifications.
  if (config.halfDayHours >= config.fullDayHours) {
    errors.push("Half day hours must be less than full day hours");
  }
  if (config.shortDayHours >= config.halfDayHours) {
    errors.push("Short day hours must be less than half day hours");
  }
  if (config.leave.shortLeaveMaxMinutes / 60 >= config.fullDayHours) {
    errors.push("Maximum short leave duration must be shorter than a full day");
  }

  if (errors.length) {
    throw new ServiceError(errors.join("; "), 400, { errors });
  }
  return { mode, config };
};
