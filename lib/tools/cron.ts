/**
 * Deterministic cron helper for Laravel's scheduler (5-field cron, as used by
 * dragonmantank/cron-expression). Pure functions, no I/O, so everything here runs in the browser and
 * is unit-tested. Supported: `*`, `?` (alias of `*` for day fields), lists, ranges, steps, month and
 * weekday names, the `@yearly/@monthly/@weekly/@daily/@hourly` macros, and `L` (last day) in
 * day-of-month. Recognised but NOT computed here: `W`, `LW`, `#` and `L` in day-of-week — they are
 * valid in Laravel and are reported as unsupported rather than silently mis-evaluated.
 */

export type CronField = "minute" | "hour" | "dayOfMonth" | "month" | "dayOfWeek";

const bounds: Record<CronField, { min: number; max: number; label: string }> = {
  minute: { min: 0, max: 59, label: "minute" },
  hour: { min: 0, max: 23, label: "hour" },
  dayOfMonth: { min: 1, max: 31, label: "day of month" },
  month: { min: 1, max: 12, label: "month" },
  dayOfWeek: { min: 0, max: 7, label: "day of week" }
};

const monthNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const weekdayNames = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const monthLong = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const weekdayLong = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const macros: Record<string, string> = {
  "@yearly": "0 0 1 1 *",
  "@annually": "0 0 1 1 *",
  "@monthly": "0 0 1 * *",
  "@weekly": "0 0 * * 0",
  "@daily": "0 0 * * *",
  "@midnight": "0 0 * * *",
  "@hourly": "0 * * * *"
};

export interface ParsedField {
  raw: string;
  values: number[];
  /** Begins with `*` (or is `?`): the "unrestricted" marker cron uses for day-of-month/day-of-week interaction. */
  star: boolean;
  /** Day-of-month only: the `L` (last day of month) token was used. */
  lastDay: boolean;
}

export interface ParsedCron {
  source: string;
  expression: string;
  fields: Record<CronField, ParsedField>;
  warnings: string[];
}

export type ParseResult = { ok: true; cron: ParsedCron } | { ok: false; error: string };

const fieldOrder: CronField[] = ["minute", "hour", "dayOfMonth", "month", "dayOfWeek"];

function nameToNumber(token: string, field: CronField): number | null {
  const upper = token.toUpperCase();
  if (field === "month") {
    const index = monthNames.indexOf(upper);
    return index === -1 ? null : index + 1;
  }
  if (field === "dayOfWeek") {
    const index = weekdayNames.indexOf(upper);
    return index === -1 ? null : index;
  }
  return null;
}

function toNumber(token: string, field: CronField): number | null {
  if (/^\d+$/.test(token)) return Number(token);
  return nameToNumber(token, field);
}

function parseField(raw: string, field: CronField): { ok: true; value: ParsedField } | { ok: false; error: string } {
  const { min, max, label } = bounds[field];
  const fail = (message: string) => ({ ok: false as const, error: `${label[0].toUpperCase()}${label.slice(1)} field "${raw}": ${message}` });

  if (raw === "") return fail("is empty");
  if (raw === "?" ) {
    if (field !== "dayOfMonth" && field !== "dayOfWeek") return fail('"?" is only valid in the day-of-month and day-of-week fields');
    return { ok: true, value: { raw, values: rangeValues(min, field === "dayOfWeek" ? 6 : max, 1), star: true, lastDay: false } };
  }

  let lastDay = false;
  const values = new Set<number>();

  for (const part of raw.split(",")) {
    if (part === "") return fail("has an empty item in the list (stray comma?)");
    if (field === "dayOfMonth" && part.toUpperCase() === "L") {
      lastDay = true;
      continue;
    }
    if (/^\d*L$/i.test(part) && field === "dayOfWeek") return fail(`"${part}" (last weekday of the month) is valid in Laravel but is not evaluated by this tool`);
    if (/#/.test(part)) return fail(`"${part}" (nth weekday of the month) is valid in Laravel but is not evaluated by this tool`);
    if (/W$/i.test(part) && field === "dayOfMonth") return fail(`"${part}" (nearest weekday) is valid in Laravel but is not evaluated by this tool`);

    const [rangePart, stepPart, ...extra] = part.split("/");
    if (extra.length > 0) return fail(`"${part}" has more than one "/"`);

    let step = 1;
    if (stepPart !== undefined) {
      if (!/^\d+$/.test(stepPart) || Number(stepPart) < 1) return fail(`step "${stepPart}" must be a positive whole number`);
      step = Number(stepPart);
    }

    let from: number;
    let to: number;
    if (rangePart === "*") {
      from = min;
      to = field === "dayOfWeek" ? 6 : max;
    } else if (rangePart.includes("-")) {
      const [a, b, ...more] = rangePart.split("-");
      const start = toNumber(a, field);
      const end = toNumber(b, field);
      if (more.length > 0 || start === null || end === null) return fail(`"${rangePart}" is not a valid range`);
      if (start < min || start > max || end < min || end > max) return fail(`"${rangePart}" is outside ${min}-${max}`);
      if (start > end) return fail(`range "${rangePart}" runs backwards (start is after end)`);
      from = start;
      to = end;
    } else {
      const single = toNumber(rangePart, field);
      if (single === null) return fail(`"${rangePart}" is not a valid ${label} value`);
      if (single < min || single > max) return fail(`${single} is outside ${min}-${max}`);
      from = single;
      to = stepPart !== undefined ? (field === "dayOfWeek" ? 6 : max) : single;
    }

    for (let value = from; value <= to; value += step) values.add(field === "dayOfWeek" && value === 7 ? 0 : value);
  }

  const star = raw.startsWith("*");
  return { ok: true, value: { raw, values: [...values].sort((a, b) => a - b), star, lastDay } };
}

function rangeValues(from: number, to: number, step: number) {
  const out: number[] = [];
  for (let value = from; value <= to; value += step) out.push(value);
  return out;
}

export function parseCron(input: string): ParseResult {
  const source = input.trim().replace(/\s+/g, " ");
  if (source === "") return { ok: false, error: "Enter a cron expression, for example */15 * * * *" };

  let expression = source;
  if (source.startsWith("@")) {
    const expanded = macros[source.toLowerCase()];
    if (!expanded) return { ok: false, error: `Unknown macro "${source}". Supported: ${Object.keys(macros).join(", ")}` };
    expression = expanded;
  }

  const parts = expression.split(" ");
  if (parts.length === 6) {
    return { ok: false, error: "This looks like a 6-field (seconds) expression. Laravel's scheduler uses 5 fields (minute hour day month weekday); for sub-minute tasks use ->everySecond(), ->everyFiveSeconds(), … instead." };
  }
  if (parts.length !== 5) return { ok: false, error: `Expected 5 space-separated fields (minute hour day-of-month month day-of-week) but found ${parts.length}.` };

  const fields = {} as Record<CronField, ParsedField>;
  for (const [index, field] of fieldOrder.entries()) {
    const result = parseField(parts[index], field);
    if (!result.ok) return result;
    fields[field] = result.value;
  }

  const warnings: string[] = [];
  const dom = fields.dayOfMonth;
  const dow = fields.dayOfWeek;
  if (!dom.star && !dow.star) {
    warnings.push("Both day-of-month and day-of-week are set. Classic cron runs the job when EITHER matches, but implementations differ and Laravel's cron library does not document this case. This tool shows the classic behaviour — confirm with `php artisan schedule:list`, or use a single day field plus ->when() / ->days().");
  }
  if (dom.values.some((day) => day > 28) && fields.month.values.some((month) => month === 2) && fields.month.values.length === 1 && !dom.lastDay && !dom.values.some((day) => day <= 29)) {
    warnings.push("February never has more than 29 days, so this schedule only runs on leap years or never.");
  }
  if (dom.values.some((day) => day === 31) && !fields.month.star && fields.month.values.every((month) => [2, 4, 6, 9, 11].includes(month)) && dom.values.length === 1 && !dom.lastDay) {
    warnings.push("Day 31 does not exist in the selected month(s), so this schedule will never run.");
  }

  return { ok: true, cron: { source, expression, fields, warnings } };
}

// ---------------------------------------------------------------------------------------------
// Human-readable explanation
// ---------------------------------------------------------------------------------------------

const pad = (value: number) => String(value).padStart(2, "0");

function list(items: string[]) {
  if (items.length <= 1) return items.join("");
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}`;
}

function isFull(field: ParsedField, field2: CronField) {
  const expected = field2 === "dayOfWeek" ? 7 : bounds[field2].max - bounds[field2].min + 1;
  return field.values.length === expected && !field.lastDay;
}

function stepOf(values: number[], min: number, max: number): number | null {
  if (values.length < 2 || values[0] !== min) return null;
  const step = values[1] - values[0];
  for (let index = 1; index < values.length; index++) if (values[index] - values[index - 1] !== step) return null;
  const expectedCount = Math.floor((max - min) / step) + 1;
  return values.length === expectedCount ? step : null;
}

function describeRuns(values: number[]): string[] {
  const groups: string[] = [];
  let start = 0;
  for (let index = 1; index <= values.length; index++) {
    if (index === values.length || values[index] !== values[index - 1] + 1) {
      const from = values[start];
      const to = values[index - 1];
      groups.push(to - from >= 2 ? `${from} through ${to}` : values.slice(start, index).join(" and "));
      start = index;
    }
  }
  return groups;
}

export function explainCron(cron: ParsedCron): string {
  const { minute, hour, dayOfMonth, month, dayOfWeek } = cron.fields;
  const minuteStep = stepOf(minute.values, 0, 59);
  const hourStep = stepOf(hour.values, 0, 23);

  let time: string;
  if (isFull(minute, "minute") && isFull(hour, "hour")) time = "Every minute";
  else if (minute.values.length === 1 && hour.values.length === 1) time = `At ${pad(hour.values[0])}:${pad(minute.values[0])}`;
  else if (isFull(hour, "hour") && minuteStep && minuteStep > 1) time = `Every ${minuteStep} minutes`;
  else if (isFull(hour, "hour") && minute.values.length === 1) time = minute.values[0] === 0 ? "At the start of every hour" : `At minute ${minute.values[0]} of every hour`;
  else if (minute.values.length === 1 && hourStep && hourStep > 1) time = `At minute ${minute.values[0]}, every ${hourStep} hours`;
  else if (minute.values.length === 1) time = `At minute ${minute.values[0]} past ${list(hour.values.map((h) => `${pad(h)}:00`))}`;
  else if (isFull(hour, "hour")) time = `At minutes ${list(describeRuns(minute.values))} of every hour`;
  else time = `At minutes ${list(describeRuns(minute.values))} past hour${hour.values.length > 1 ? "s" : ""} ${list(describeRuns(hour.values))}`;

  const dayParts: string[] = [];
  const domRestricted = !dayOfMonth.star;
  const dowRestricted = !dayOfWeek.star;
  if (domRestricted) {
    const days = dayOfMonth.values.map((day) => `${day}${ordinal(day)}`);
    if (dayOfMonth.lastDay) days.push("the last day");
    dayParts.push(`on day ${list(days)} of the month`);
  }
  if (dowRestricted) {
    const names = dayOfWeek.values.map((day) => weekdayLong[day]);
    const runs = describeWeekdayRuns(dayOfWeek.values);
    dayParts.push(`on ${runs ?? list(names)}`);
  }
  let days = "";
  if (dayParts.length === 2) days = `${dayParts[0]} ${dayParts[1].replace(/^on /, "or on ")}`;
  else if (dayParts.length === 1) days = dayParts[0];

  const months = !month.star || !isFull(month, "month") ? (isFull(month, "month") ? "" : `in ${list(month.values.map((value) => monthLong[value - 1]))}`) : "";
  const monthStep = stepOf(month.values, 1, 12);
  const monthText = monthStep && monthStep > 1 && month.values.length > 2 ? `every ${monthStep} months` : months;

  return [time, days, monthText].filter(Boolean).join(", ");
}

function ordinal(day: number) {
  if (day % 100 >= 11 && day % 100 <= 13) return "th";
  return ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[day % 10] ?? "th";
}

function describeWeekdayRuns(values: number[]): string | null {
  const ordered = [...values].sort((a, b) => a - b);
  if (ordered.join() === "1,2,3,4,5") return "Monday through Friday";
  if (ordered.join() === "0,6") return "Saturday and Sunday";
  return null;
}

// ---------------------------------------------------------------------------------------------
// Laravel code generation
// ---------------------------------------------------------------------------------------------

const same = (values: number[], expected: number[]) => values.length === expected.length && values.every((value, index) => value === expected[index]);
const single = (field: ParsedField) => (field.values.length === 1 && !field.lastDay ? field.values[0] : null);
const stepValues = (min: number, max: number, step: number) => rangeValues(min, max, step);
const clock = (hour: number, minute: number) => `${pad(hour)}:${pad(minute)}`;

export interface LaravelSuggestion {
  /** Fluent chain, e.g. `->dailyAt('09:30')`. */
  chain: string;
  /** True when a named Laravel helper reproduces the schedule exactly; false means `->cron()` is used. */
  fluent: boolean;
}

const minuteHelpers: Array<[number, string]> = [[2, "everyTwoMinutes"], [3, "everyThreeMinutes"], [4, "everyFourMinutes"], [5, "everyFiveMinutes"], [10, "everyTenMinutes"], [15, "everyFifteenMinutes"]];
const hourHelpers: Array<[number, string]> = [[2, "everyTwoHours"], [3, "everyThreeHours"], [4, "everyFourHours"], [6, "everySixHours"]];

/** Picks the most readable Laravel schedule call that is exactly equivalent to the parsed expression. */
export function toLaravelChain(cron: ParsedCron): LaravelSuggestion {
  const { minute, hour, dayOfMonth: dom, month, dayOfWeek: dow } = cron.fields;
  const cronCall: LaravelSuggestion = { chain: `->cron('${cron.expression}')`, fluent: false };

  // Mixed day fields or `L` cannot be expressed with the fluent helpers without changing meaning.
  if (dom.lastDay || (!dom.star && !dow.star)) return cronCall;

  const fullMinutes = isFull(minute, "minute");
  const fullHours = isFull(hour, "hour");
  const fullDom = isFull(dom, "dayOfMonth");
  const fullMonth = isFull(month, "month");
  const fullDow = isFull(dow, "dayOfWeek");
  const m = single(minute);
  const h = single(hour);
  const d = single(dom);
  const mo = single(month);
  const w = single(dow);

  if (fullMinutes && fullHours && fullDom && fullMonth && fullDow) return { chain: "->everyMinute()", fluent: true };

  if (fullHours && fullDom && fullMonth && fullDow) {
    if (same(minute.values, [0, 30])) return { chain: "->everyThirtyMinutes()", fluent: true };
    for (const [step, name] of minuteHelpers) if (same(minute.values, stepValues(0, 59, step))) return { chain: `->${name}()`, fluent: true };
    if (m !== null) return { chain: m === 0 ? "->hourly()" : `->hourlyAt(${m})`, fluent: true };
    return cronCall;
  }

  if (m === 0 && fullDom && fullMonth && fullDow) {
    for (const [step, name] of hourHelpers) if (same(hour.values, stepValues(0, 23, step))) return { chain: `->${name}()`, fluent: true };
    if (same(hour.values, stepValues(1, 23, 2))) return { chain: "->everyOddHour()", fluent: true };
  }

  if (m !== null && fullDom && fullMonth && hour.values.length === 2 && fullDow) {
    const [a, b] = hour.values;
    return { chain: m === 0 ? `->twiceDaily(${a}, ${b})` : `->twiceDailyAt(${a}, ${b}, ${m})`, fluent: true };
  }

  if (m !== null && h !== null && fullDom && fullMonth) {
    const time = clock(h, m);
    if (fullDow) return { chain: h === 0 && m === 0 ? "->daily()" : `->dailyAt('${time}')`, fluent: true };
    const ordered = [...dow.values].sort((x, y) => x - y);
    if (same(ordered, [1, 2, 3, 4, 5])) return { chain: `->weekdays()->at('${time}')`, fluent: true };
    if (same(ordered, [0, 6])) return { chain: `->weekends()->at('${time}')`, fluent: true };
    if (w !== null) return { chain: w === 0 && h === 0 && m === 0 ? "->weekly()" : `->weeklyOn(${w}, '${time}')`, fluent: true };
    return { chain: `->days([${ordered.join(", ")}])->at('${time}')`, fluent: true };
  }

  if (m !== null && h !== null && fullDow) {
    const time = clock(h, m);
    if (fullMonth && d !== null) return { chain: d === 1 && h === 0 && m === 0 ? "->monthly()" : `->monthlyOn(${d}, '${time}')`, fluent: true };
    if (fullMonth && dom.values.length === 2) return { chain: `->twiceMonthly(${dom.values[0]}, ${dom.values[1]}, '${time}')`, fluent: true };
    if (d !== null && same(month.values, [1, 4, 7, 10])) return { chain: d === 1 && h === 0 && m === 0 ? "->quarterly()" : `->quarterlyOn(${d}, '${time}')`, fluent: true };
    if (d !== null && mo !== null) return { chain: mo === 1 && d === 1 && h === 0 && m === 0 ? "->yearly()" : `->yearlyOn(${mo}, ${d}, '${time}')`, fluent: true };
  }

  return cronCall;
}

export function laravelSnippets(command: string, chain: string, timezone?: string) {
  const tz = timezone && timezone !== "UTC" ? `\n    ->timezone('${timezone}')` : "";
  const call = (prefix: string) => `${prefix}('${command}')\n    ${chain}${tz};`;
  return {
    modern: `<?php\n\nuse Illuminate\\Support\\Facades\\Schedule;\n\n${call("Schedule::command")}\n`,
    legacy: `protected function schedule(Schedule $schedule): void\n{\n    ${call("$schedule->command").replace(/\n/g, "\n    ")}\n}\n`
  };
}

// ---------------------------------------------------------------------------------------------
// Next run times
// ---------------------------------------------------------------------------------------------

interface Naive {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

const daysIn = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();
const weekdayOf = (year: number, month: number, day: number) => new Date(Date.UTC(year, month - 1, day)).getUTCDay();

function dayMatches(cron: ParsedCron, year: number, month: number, day: number): boolean {
  const { dayOfMonth: dom, dayOfWeek: dow } = cron.fields;
  const domMatch = dom.values.includes(day) || (dom.lastDay && day === daysIn(year, month));
  const dowMatch = dow.values.includes(weekdayOf(year, month, day));
  // Classic cron: when both day fields are restricted, either may match; otherwise both must.
  return !dom.star && !dow.star ? domMatch || dowMatch : (dom.star || domMatch) && (dow.star || dowMatch);
}

/** Next wall-clock time strictly after `from` (a naive local time) that matches the schedule, or null within `maxYears`. */
export function nextNaive(cron: ParsedCron, from: Naive, maxYears = 9): Naive | null {
  const { minute, hour, month } = cron.fields;
  let { year, month: mo, day, hour: hr, minute: mi } = from;
  mi += 1;
  const limit = from.year + maxYears;

  while (year <= limit) {
    if (mi > 59) { mi = 0; hr += 1; }
    if (hr > 23) { hr = 0; day += 1; mi = 0; }
    if (day > daysIn(year, mo)) { day = 1; mo += 1; hr = 0; mi = 0; }
    if (mo > 12) { mo = 1; year += 1; day = 1; hr = 0; mi = 0; continue; }

    if (!month.values.includes(mo)) { mo += 1; day = 1; hr = 0; mi = 0; continue; }
    if (!dayMatches(cron, year, mo, day)) { day += 1; hr = 0; mi = 0; continue; }
    if (!hour.values.includes(hr)) { hr += 1; mi = 0; continue; }
    if (!minute.values.includes(mi)) { mi += 1; continue; }
    return { year, month: mo, day, hour: hr, minute: mi };
  }
  return null;
}

/** Offset (minutes east of UTC) of `timezone` at the instant `utcMs`. */
function offsetMinutes(timezone: string, utcMs: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric"
  }).formatToParts(new Date(utcMs));
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - Math.floor(utcMs / 1000) * 1000) / 60_000);
}

/**
 * Converts a wall-clock time in `timezone` to an instant. Times that do not exist (spring-forward gap)
 * return null so the run is skipped; times that occur twice (fall-back) resolve to the first occurrence.
 */
export function zonedToInstant(naive: Naive, timezone: string): number | null {
  const wall = Date.UTC(naive.year, naive.month - 1, naive.day, naive.hour, naive.minute);
  if (timezone === "UTC") return wall;
  const candidates = new Set<number>();
  for (const guess of [wall - 36e5 * 14, wall - 36e5 * 5, wall, wall + 36e5 * 5, wall + 36e5 * 14]) {
    candidates.add(wall - offsetMinutes(timezone, guess) * 60_000);
  }
  const valid = [...candidates].filter((instant) => wall - offsetMinutes(timezone, instant) * 60_000 === instant).sort((a, b) => a - b);
  return valid.length > 0 ? valid[0] : null;
}

function instantToNaive(instant: number, timezone: string): Naive {
  const shifted = new Date(instant + (timezone === "UTC" ? 0 : offsetMinutes(timezone, instant) * 60_000));
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate(), hour: shifted.getUTCHours(), minute: shifted.getUTCMinutes() };
}

export function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

/** The next `count` run instants after `from` in `timezone`, honouring DST (skipped/repeated local times). */
export function nextRuns(cron: ParsedCron, from: Date, count = 5, timezone = "UTC"): Date[] {
  const runs: Date[] = [];
  let cursor = instantToNaive(from.getTime(), timezone);
  for (let guard = 0; runs.length < count && guard < count * 50; guard++) {
    const candidate = nextNaive(cron, cursor);
    if (!candidate) break;
    cursor = candidate;
    const instant = zonedToInstant(candidate, timezone);
    if (instant !== null && instant > from.getTime() && (runs.length === 0 || instant > runs.at(-1)!.getTime())) runs.push(new Date(instant));
  }
  return runs;
}

export const cronPresets: Array<{ label: string; expression: string }> = [
  { label: "Every minute", expression: "* * * * *" },
  { label: "Every 5 minutes", expression: "*/5 * * * *" },
  { label: "Every 15 minutes", expression: "*/15 * * * *" },
  { label: "Hourly at :17", expression: "17 * * * *" },
  { label: "Daily at 09:30", expression: "30 9 * * *" },
  { label: "Weekdays at 08:00", expression: "0 8 * * 1-5" },
  { label: "Mondays at 06:00", expression: "0 6 * * 1" },
  { label: "1st of month, midnight", expression: "0 0 1 * *" },
  { label: "Last day of month, 23:00", expression: "0 23 L * *" },
  { label: "Quarterly", expression: "0 0 1 1,4,7,10 *" },
  { label: "Twice daily (01:00, 13:00)", expression: "0 1,13 * * *" },
  { label: "Every 6 hours", expression: "0 */6 * * *" }
];
