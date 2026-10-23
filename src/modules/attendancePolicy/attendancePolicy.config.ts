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
  },
};

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
