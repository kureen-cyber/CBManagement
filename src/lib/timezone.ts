/** App wall-clock timezone: Trinidad & Tobago (AST, UTC−4, no DST). */
export const APP_TIMEZONE = "America/Port_of_Spain";

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
