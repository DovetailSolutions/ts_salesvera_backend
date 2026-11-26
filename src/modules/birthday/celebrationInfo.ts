import { getISTDateString } from "../shared/dateUtils";
import { parseDob, ParsedDob } from "./birthday.utils";

// ============================================================
// Birthday + work anniversary block for a user's OWN profile
// (GET /api/getprofile and GET /admin/getprofile → `celebrations`).
//
//   birthday         from users.dob (free text — parsed like the birthday
//                    announcements, see birthday.utils parseDob)
//   workAnniversary  from employee_extra_details.dateOfJoining
//
// "Today" is the IST calendar day. Same 29 February rule as the
// announcements: celebrated on 28 February in non-leap years. A work
// anniversary is never the joining day itself — the first one is a year
// later. Either entry is null when its date is missing or unreadable.
// ============================================================

export interface CelebrationDate {
  date: string;      // YYYY-MM-DD (birth date / joining date)
  nextDate: string;  // YYYY-MM-DD of the next celebration (today if it's today)
  daysUntil: number; // 0 = today
  isToday: boolean;
}

export interface Celebrations {
  birthday: CelebrationDate | null;
  workAnniversary: (CelebrationDate & { years: number }) | null;
}

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
const pad = (n: number) => String(n).padStart(2, "0");
const ymdOf = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const dayNumber = (ymd: string) => Math.round(Date.parse(`${ymd}T00:00:00Z`) / 86400000);

// The day this date falls on in a given year (29 Feb → 28 Feb in non-leap years).
const occurrenceIn = (p: ParsedDob, year: number) =>
  ymdOf(year, p.month, p.month === 2 && p.day === 29 && !isLeap(year) ? 28 : p.day);

// Next occurrence on/after today; `minYear` keeps anniversaries after the joining year.
const nextOccurrence = (p: ParsedDob, today: string, minYear: number) => {
  let year = Math.max(Number(today.slice(0, 4)), minYear);
  let date = occurrenceIn(p, year);
  if (date < today) {
    year += 1;
    date = occurrenceIn(p, year);
  }
  const daysUntil = dayNumber(date) - dayNumber(today);
  return { year, nextDate: date, daysUntil, isToday: daysUntil === 0 };
};

export const buildCelebrations = (dob: unknown, dateOfJoining: unknown, now: Date = new Date()): Celebrations => {
  const today = getISTDateString(now);

  const birth = parseDob(typeof dob === "string" ? dob : null, today);
  const birthday = birth
    ? (({ nextDate, daysUntil, isToday }) => ({ date: ymdOf(birth.year, birth.month, birth.day), nextDate, daysUntil, isToday }))(
        nextOccurrence(birth, today, birth.year + 1)
      )
    : null;

  const joinedRaw = dateOfJoining ? String(dateOfJoining).slice(0, 10) : null;
  const joined = parseDob(joinedRaw, today);
  const workAnniversary = joined
    ? (({ year, nextDate, daysUntil, isToday }) => ({
        date: ymdOf(joined.year, joined.month, joined.day),
        nextDate,
        daysUntil,
        isToday,
        years: year - joined.year, // years completed on nextDate
      }))(nextOccurrence(joined, today, joined.year + 1))
    : null;

  return { birthday, workAnniversary };
};
