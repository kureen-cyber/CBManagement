/** App wall-clock timezone: Trinidad & Tobago (AST, UTC−4, no DST). */
export const APP_TIMEZONE = "America/Port_of_Spain";

/** Fixed offset — Trinidad & Tobago does not observe daylight saving. */
export const APP_UTC_OFFSET = "-04:00";

/** Locale for date/number presentation (Trinidad English). */
export const APP_LOCALE = "en-TT";

export function ensureAppTimezone() {
  if (process.env.TZ !== APP_TIMEZONE) {
    process.env.TZ = APP_TIMEZONE;
  }
}

type DateInput = Date | string | number | null | undefined;

function asDate(value: DateInput): Date | null {
  if (value == null || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Calendar date in Trinidad & Tobago (YYYY-MM-DD), e.g. for <input type="date">. */
export function appDateKey(value: DateInput = new Date()): string {
  const d = asDate(value);
  if (!d) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function appTodayIsoDate(now = new Date()): string {
  return appDateKey(now);
}

/** Midnight in Trinidad & Tobago for the calendar day of `now`. */
export function startOfAppDay(now = new Date()): Date {
  return new Date(`${appDateKey(now)}T00:00:00${APP_UTC_OFFSET}`);
}

/** End of the Trinidad & Tobago calendar day of `now`. */
export function endOfAppDay(now = new Date()): Date {
  return new Date(`${appDateKey(now)}T23:59:59.999${APP_UTC_OFFSET}`);
}

export function startOfAppMonth(now = new Date()): Date {
  const [y, m] = appDateKey(now).split("-");
  return new Date(`${y}-${m}-01T00:00:00${APP_UTC_OFFSET}`);
}

export function endOfAppMonth(now = new Date()): Date {
  const start = startOfAppMonth(now);
  const [y, m] = appDateKey(start).split("-").map(Number);
  const next =
    m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  return new Date(new Date(`${next}T00:00:00${APP_UTC_OFFSET}`).getTime() - 1);
}

/** Parse a YYYY-MM-DD form value as noon in Trinidad & Tobago (avoids UTC midnight shifting the date). */
export function parseFormDate(value: unknown): Date | null {
  if (value == null || value === "") return null;
  if (typeof File !== "undefined" && value instanceof File) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const raw = String(value).trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const d = new Date(`${raw}T12:00:00${APP_UTC_OFFSET}`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return asDate(raw);
}

export function parseFormDateOrNow(value: unknown): Date {
  return parseFormDate(value) ?? new Date();
}

export function addAppCalendarDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00${APP_UTC_OFFSET}`);
  d.setTime(d.getTime() + days * 86400000);
  return appDateKey(d);
}

export function eachAppDateKey(start: Date, end: Date): string[] {
  const keys: string[] = [];
  let cursor = appDateKey(start);
  const last = appDateKey(end);
  if (!cursor || !last || cursor > last) return keys;
  while (cursor <= last) {
    keys.push(cursor);
    cursor = addAppCalendarDays(cursor, 1);
    if (keys.length > 400) break;
  }
  return keys;
}

/** Value for <input type="date"> in Trinidad & Tobago's calendar. */
export function appDateInputValue(value: DateInput): string {
  if (value == null || value === "") return "";
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  }
  return appDateKey(value);
}

const dateOpts: Intl.DateTimeFormatOptions = {
  timeZone: APP_TIMEZONE,
  year: "numeric",
  month: "short",
  day: "numeric",
};

const dateTimeOpts: Intl.DateTimeFormatOptions = {
  ...dateOpts,
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
};

const monthYearOpts: Intl.DateTimeFormatOptions = {
  timeZone: APP_TIMEZONE,
  month: "long",
  year: "numeric",
};

/** Format a date in Trinidad & Tobago time (e.g. 24 Aug 2026). */
export function formatAppDate(value: DateInput): string {
  const d = asDate(value);
  if (!d) return "—";
  return d.toLocaleDateString(APP_LOCALE, dateOpts);
}

/** Format date + time in Trinidad & Tobago time. */
export function formatAppDateTime(value: DateInput): string {
  const d = asDate(value);
  if (!d) return "—";
  return d.toLocaleString(APP_LOCALE, dateTimeOpts);
}

/** Format month + year in Trinidad & Tobago time (e.g. August 2026). */
export function formatAppMonthYear(value: DateInput): string {
  const d = asDate(value);
  if (!d) return "—";
  return d.toLocaleDateString(APP_LOCALE, monthYearOpts);
}

/** Format with custom Intl options, always in Trinidad & Tobago time. */
export function formatAppDateInZone(
  value: DateInput,
  options: Intl.DateTimeFormatOptions,
): string {
  const d = asDate(value);
  if (!d) return "—";
  return d.toLocaleDateString(APP_LOCALE, { timeZone: APP_TIMEZONE, ...options });
}

export function formatAppDateTimeInZone(
  value: DateInput,
  options: Intl.DateTimeFormatOptions,
  locale = APP_LOCALE,
): string {
  const d = asDate(value);
  if (!d) return "—";
  return d.toLocaleString(locale, { timeZone: APP_TIMEZONE, ...options });
}
