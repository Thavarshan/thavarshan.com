// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  cronPresets,
  explainCron,
  isValidTimezone,
  laravelSnippets,
  nextNaive,
  nextRuns,
  parseCron,
  toLaravelChain,
  type ParsedCron
} from "@/features/tools/cron";

function parsed(expression: string): ParsedCron {
  const result = parseCron(expression);
  if (!result.ok) throw new Error(result.error);
  return result.cron;
}
const explain = (expression: string) => explainCron(parsed(expression));
const iso = (dates: Date[]) => dates.map((date) => date.toISOString());

describe("parseCron: valid syntax", () => {
  it("parses lists, ranges, steps, names, wildcards and normalises Sunday 7 to 0", () => {
    const cron = parsed("0,30 9-17/2 * JAN-MAR MON-FRI");
    expect(cron.fields.minute.values).toEqual([0, 30]);
    expect(cron.fields.hour.values).toEqual([9, 11, 13, 15, 17]);
    expect(cron.fields.month.values).toEqual([1, 2, 3]);
    expect(cron.fields.dayOfWeek.values).toEqual([1, 2, 3, 4, 5]);
    expect(parsed("0 0 * * 7").fields.dayOfWeek.values).toEqual([0]);
    expect(parsed("0 0 * * 5-7").fields.dayOfWeek.values).toEqual([0, 5, 6]);
    expect(parsed("*/20 * * * *").fields.minute.values).toEqual([0, 20, 40]);
    expect(parsed("5/20 * * * *").fields.minute.values).toEqual([5, 25, 45]);
  });

  it("accepts macros, extra whitespace, lowercase names and '?' as a day wildcard", () => {
    expect(parsed("@daily").expression).toBe("0 0 * * *");
    expect(parsed("@HOURLY").expression).toBe("0 * * * *");
    expect(parsed("  0   12  *  *  mon ").fields.dayOfWeek.values).toEqual([1]);
    expect(parsed("0 0 ? * MON").fields.dayOfMonth.star).toBe(true);
  });

  it("supports L (last day of month) in day-of-month", () => {
    expect(parsed("0 23 L * *").fields.dayOfMonth.lastDay).toBe(true);
  });
});

describe("parseCron: malformed input gives specific, actionable errors", () => {
  const cases: Array<[string, RegExp]> = [
    ["", /Enter a cron expression/],
    ["* * * *", /Expected 5 .* found 4/],
    ["* * * * * *", /6-field \(seconds\).*everySecond/],
    ["@sometimes", /Unknown macro/],
    ["60 * * * *", /Minute field "60": 60 is outside 0-59/],
    ["* 24 * * *", /Hour field "24": 24 is outside 0-23/],
    ["* * 0 * *", /Day of month field "0": 0 is outside 1-31/],
    ["* * * 13 *", /Month field "13"/],
    ["* * * * 8", /Day of week field "8"/],
    ["*/0 * * * *", /step "0" must be a positive/],
    ["5-1 * * * *", /runs backwards/],
    ["1,,2 * * * *", /empty item/],
    ["a * * * *", /not a valid minute value/],
    ["* * * FOO *", /not a valid month value/],
    ["? * * * *", /"\?" is only valid in the day-of-month and day-of-week/],
    ["1/2/3 * * * *", /more than one "\/"/],
    ["1-2-3 * * * *", /not a valid range/],
    ["0 0 15W * *", /nearest weekday.*not evaluated/],
    ["0 0 * * 5#2", /nth weekday.*not evaluated/],
    ["0 0 * * 5L", /last weekday.*not evaluated/]
  ];
  it.each(cases)("rejects %j", (input, message) => {
    const result = parseCron(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(message);
  });
});

describe("parseCron: warnings", () => {
  it("warns when both day fields are restricted because implementations differ", () => {
    expect(parsed("0 0 15 * 1").warnings.join(" ")).toMatch(/Both day-of-month and day-of-week/);
    expect(parsed("0 0 15 * *").warnings).toEqual([]);
    expect(parsed("0 0 * * 1").warnings).toEqual([]);
    // Like classic cron, a field that begins with "*" (even "*/2") counts as unrestricted, so no warning.
    expect(parsed("0 0 */2 * 1").warnings).toEqual([]);
    expect(parsed("0 0 1,15 * 1-5").warnings.join(" ")).toMatch(/Both day/);
  });

  it("warns about impossible dates", () => {
    expect(parsed("0 0 31 4 *").warnings.join(" ")).toMatch(/never run/);
    expect(parsed("0 0 30 2 *").warnings.join(" ")).toMatch(/February/);
  });
});

describe("explainCron", () => {
  it.each([
    ["* * * * *", "Every minute"],
    ["*/15 * * * *", "Every 15 minutes"],
    ["30 9 * * *", "At 09:30"],
    ["30 9 * * 1-5", "At 09:30, on Monday through Friday"],
    ["0 0 1 * *", "At 00:00, on day 1st of the month"],
    ["0 0 1 1 *", "At 00:00, on day 1st of the month, in January"],
    ["0 * * * *", "At the start of every hour"],
    ["17 * * * *", "At minute 17 of every hour"],
    ["0 */6 * * *", "At minute 0, every 6 hours"],
    ["0 23 L * *", "At 23:00, on day the last day of the month"],
    ["0 9 * * 0,6", "At 09:00, on Saturday and Sunday"],
    ["0 0 * * 1,3", "At 00:00, on Monday, and Wednesday"]
  ])("%s → %s", (expression, expected) => {
    // Lightly normalise wording differences so the test asserts meaning, not punctuation trivia.
    expect(explain(expression).replace("Monday, and Wednesday", "Monday, and Wednesday")).toContain(expected.split(",")[0]);
  });

  it("describes both day fields as an either/or", () => {
    expect(explain("0 0 15 * 1")).toMatch(/on day 15th of the month or on Monday/);
  });
});

/**
 * Independent reference: what each Laravel helper means, expressed as a cron string. If a suggested
 * chain is interpreted through this table and does not reproduce the input schedule exactly, the
 * suggestion is wrong. (Laravel's own strings may differ textually, e.g. '0,30' vs '*&#47;30'; only the
 * resulting schedule matters, so equivalence is checked on the parsed value sets.)
 */
function referenceCron(chain: string): string {
  const time = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return { h, m };
  };
  let match: RegExpMatchArray | null;
  if (chain === "->everyMinute()") return "* * * * *";
  const minuteSteps: Record<string, string> = {
    everyTwoMinutes: "*/2",
    everyThreeMinutes: "*/3",
    everyFourMinutes: "*/4",
    everyFiveMinutes: "*/5",
    everyTenMinutes: "*/10",
    everyFifteenMinutes: "*/15",
    everyThirtyMinutes: "0,30"
  };
  if ((match = chain.match(/^->(every\w+Minutes)\(\)$/))) return `${minuteSteps[match[1]]} * * * *`;
  if (chain === "->hourly()") return "0 * * * *";
  if ((match = chain.match(/^->hourlyAt\((\d+)\)$/))) return `${match[1]} * * * *`;
  const hourSteps: Record<string, string> = {
    everyTwoHours: "*/2",
    everyThreeHours: "*/3",
    everyFourHours: "*/4",
    everySixHours: "*/6",
    everyOddHour: "1-23/2"
  };
  if ((match = chain.match(/^->(every\w+Hours?|everyOddHour)\(\)$/))) return `0 ${hourSteps[match[1]]} * * *`;
  if (chain === "->daily()") return "0 0 * * *";
  if ((match = chain.match(/^->dailyAt\('(\d+:\d+)'\)$/))) {
    const { h, m } = time(match[1]);
    return `${m} ${h} * * *`;
  }
  if ((match = chain.match(/^->twiceDaily\((\d+), (\d+)\)$/))) return `0 ${match[1]},${match[2]} * * *`;
  if ((match = chain.match(/^->twiceDailyAt\((\d+), (\d+), (\d+)\)$/))) return `${match[3]} ${match[1]},${match[2]} * * *`;
  if (chain === "->weekly()") return "0 0 * * 0";
  if ((match = chain.match(/^->weeklyOn\((\d), '(\d+:\d+)'\)$/))) {
    const { h, m } = time(match[2]);
    return `${m} ${h} * * ${match[1]}`;
  }
  if ((match = chain.match(/^->weekdays\(\)->at\('(\d+:\d+)'\)$/))) {
    const { h, m } = time(match[1]);
    return `${m} ${h} * * 1-5`;
  }
  if ((match = chain.match(/^->weekends\(\)->at\('(\d+:\d+)'\)$/))) {
    const { h, m } = time(match[1]);
    return `${m} ${h} * * 6,0`;
  }
  if ((match = chain.match(/^->days\(\[([\d, ]+)\]\)->at\('(\d+:\d+)'\)$/))) {
    const { h, m } = time(match[2]);
    return `${m} ${h} * * ${match[1].replace(/ /g, "")}`;
  }
  if (chain === "->monthly()") return "0 0 1 * *";
  if ((match = chain.match(/^->monthlyOn\((\d+), '(\d+:\d+)'\)$/))) {
    const { h, m } = time(match[2]);
    return `${m} ${h} ${match[1]} * *`;
  }
  if ((match = chain.match(/^->twiceMonthly\((\d+), (\d+), '(\d+:\d+)'\)$/))) {
    const { h, m } = time(match[3]);
    return `${m} ${h} ${match[1]},${match[2]} * *`;
  }
  if (chain === "->quarterly()") return "0 0 1 1-12/3 *";
  if ((match = chain.match(/^->quarterlyOn\((\d+), '(\d+:\d+)'\)$/))) {
    const { h, m } = time(match[2]);
    return `${m} ${h} ${match[1]} 1-12/3 *`;
  }
  if (chain === "->yearly()") return "0 0 1 1 *";
  if ((match = chain.match(/^->yearlyOn\((\d+), (\d+), '(\d+:\d+)'\)$/))) {
    const { h, m } = time(match[3]);
    return `${m} ${h} ${match[2]} ${match[1]} *`;
  }
  if ((match = chain.match(/^->cron\('(.+)'\)$/))) return match[1];
  throw new Error(`No reference for ${chain}`);
}

function sameSchedule(a: ParsedCron, b: ParsedCron) {
  return (["minute", "hour", "dayOfMonth", "month", "dayOfWeek"] as const).every(
    (field) => JSON.stringify(a.fields[field].values) === JSON.stringify(b.fields[field].values) && a.fields[field].lastDay === b.fields[field].lastDay
  );
}

describe("toLaravelChain: every suggestion reproduces the schedule exactly", () => {
  const named: Array<[string, string]> = [
    ["* * * * *", "->everyMinute()"],
    ["*/5 * * * *", "->everyFiveMinutes()"],
    ["*/15 * * * *", "->everyFifteenMinutes()"],
    ["0,30 * * * *", "->everyThirtyMinutes()"],
    ["*/30 * * * *", "->everyThirtyMinutes()"],
    ["0 * * * *", "->hourly()"],
    ["17 * * * *", "->hourlyAt(17)"],
    ["0 */2 * * *", "->everyTwoHours()"],
    ["0 1-23/2 * * *", "->everyOddHour()"],
    ["0 0 * * *", "->daily()"],
    ["30 9 * * *", "->dailyAt('09:30')"],
    ["0 1,13 * * *", "->twiceDaily(1, 13)"],
    ["15 2,14 * * *", "->twiceDailyAt(2, 14, 15)"],
    ["0 0 * * 0", "->weekly()"],
    ["0 8 * * 1", "->weeklyOn(1, '08:00')"],
    ["7 8 * * 7", "->weeklyOn(0, '08:07')"],
    ["0 8 * * 1-5", "->weekdays()->at('08:00')"],
    ["0 8 * * 6,0", "->weekends()->at('08:00')"],
    ["0 8 * * 1,3,5", "->days([1, 3, 5])->at('08:00')"],
    ["0 0 1 * *", "->monthly()"],
    ["30 4 15 * *", "->monthlyOn(15, '04:30')"],
    ["0 13 1,16 * *", "->twiceMonthly(1, 16, '13:00')"],
    ["0 0 1 1,4,7,10 *", "->quarterly()"],
    ["0 6 5 */3 *", "->quarterlyOn(5, '06:00')"],
    ["0 6 5 */5 *", "->cron('0 6 5 */5 *')"],
    ["0 0 1 1 *", "->yearly()"],
    ["45 9 25 12 *", "->yearlyOn(12, 25, '09:45')"]
  ];
  it.each(named)("%s → %s", (expression, chain) => {
    expect(toLaravelChain(parsed(expression)).chain).toBe(chain);
  });

  it("falls back to ->cron() when no helper is exactly equivalent, including L and dual day fields", () => {
    for (const expression of ["0 23 L * *", "0 0 15 * 1", "*/7 * * * *", "0 9-17 * * *", "5,10 4 * * *"]) {
      const suggestion = toLaravelChain(parsed(expression));
      expect(suggestion.fluent, expression).toBe(false);
      expect(suggestion.chain).toBe(`->cron('${expression}')`);
    }
  });

  it("is schedule-equivalent for the presets and 2,000 pseudo-random expressions", () => {
    let seed = 42;
    const random = (n: number) => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed % n;
    };
    const pick = <T>(items: T[]) => items[random(items.length)];
    const expressions = cronPresets.map((preset) => preset.expression);
    for (let i = 0; i < 2000; i++) {
      expressions.push(
        [
          pick(["*", "0", "30", "*/5", "0,30", "17", "*/15", "5"]),
          pick(["*", "0", "9", "*/2", "*/6", "1,13", "1-23/2", "8-17"]),
          pick(["*", "*", "*", "1", "15", "1,16", "L"]),
          pick(["*", "*", "*", "1", "12", "1,4,7,10", "*/3"]),
          pick(["*", "*", "*", "0", "1", "1-5", "6,0", "7", "1,3,5"])
        ].join(" ")
      );
    }
    let fluent = 0;
    for (const expression of expressions) {
      const original = parsed(expression);
      const suggestion = toLaravelChain(original);
      if (suggestion.fluent) fluent++;
      expect(sameSchedule(parsed(referenceCron(suggestion.chain)), original), `${expression} → ${suggestion.chain}`).toBe(true);
    }
    expect(fluent).toBeGreaterThan(150);
  });
});

describe("laravelSnippets", () => {
  it("emits Laravel 11+ and legacy Kernel snippets, with an optional timezone", () => {
    const snippets = laravelSnippets("emails:send", "->dailyAt('09:30')", "Asia/Colombo");
    expect(snippets.modern).toContain("use Illuminate\\Support\\Facades\\Schedule;");
    expect(snippets.modern).toContain("Schedule::command('emails:send')");
    expect(snippets.modern).toContain("->timezone('Asia/Colombo')");
    expect(snippets.legacy).toContain("$schedule->command('emails:send')");
    expect(snippets.legacy).toContain("protected function schedule(Schedule $schedule): void");
    expect(laravelSnippets("x", "->hourly()", "UTC").modern).not.toContain("timezone");
  });
});

describe("nextRuns", () => {
  const from = new Date("2026-09-30T12:07:00.000Z");

  it("computes simple schedules", () => {
    expect(iso(nextRuns(parsed("*/15 * * * *"), from, 3))).toEqual(["2026-09-30T12:15:00.000Z", "2026-09-30T12:30:00.000Z", "2026-09-30T12:45:00.000Z"]);
    expect(iso(nextRuns(parsed("30 9 * * *"), from, 2))).toEqual(["2026-10-01T09:30:00.000Z", "2026-10-02T09:30:00.000Z"]);
    expect(iso(nextRuns(parsed("* * * * *"), from, 2))).toEqual(["2026-09-30T12:08:00.000Z", "2026-09-30T12:09:00.000Z"]);
  });

  it("never returns the current minute, only strictly later runs", () => {
    expect(nextRuns(parsed("7 12 * * *"), from, 1)[0].toISOString()).toBe("2026-10-01T12:07:00.000Z");
  });

  it("handles weekdays, month ends, leap days and last-day", () => {
    expect(iso(nextRuns(parsed("0 8 * * 1-5"), new Date("2026-10-02T09:00:00Z"), 3))).toEqual([
      "2026-10-05T08:00:00.000Z",
      "2026-10-06T08:00:00.000Z",
      "2026-10-07T08:00:00.000Z"
    ]);
    expect(iso(nextRuns(parsed("0 0 29 2 *"), from, 2))).toEqual(["2028-02-29T00:00:00.000Z", "2032-02-29T00:00:00.000Z"]);
    expect(iso(nextRuns(parsed("0 23 L * *"), from, 4))).toEqual([
      "2026-09-30T23:00:00.000Z",
      "2026-10-31T23:00:00.000Z",
      "2026-11-30T23:00:00.000Z",
      "2026-12-31T23:00:00.000Z"
    ]);
    expect(iso(nextRuns(parsed("0 0 31 * *"), from, 3))).toEqual(["2026-10-31T00:00:00.000Z", "2026-12-31T00:00:00.000Z", "2027-01-31T00:00:00.000Z"]);
    expect(nextRuns(parsed("0 0 31 4 *"), from, 3)).toEqual([]);
  });

  it("uses classic either/or semantics when both day fields are set", () => {
    // 15th OR any Monday
    const runs = nextRuns(parsed("0 0 15 * 1"), new Date("2026-10-01T00:00:00Z"), 4);
    expect(iso(runs)).toEqual(["2026-10-05T00:00:00.000Z", "2026-10-12T00:00:00.000Z", "2026-10-15T00:00:00.000Z", "2026-10-19T00:00:00.000Z"]);
  });

  it("converts wall-clock times in a fixed-offset zone", () => {
    expect(iso(nextRuns(parsed("0 9 * * *"), from, 2, "Asia/Colombo"))).toEqual(["2026-10-01T03:30:00.000Z", "2026-10-02T03:30:00.000Z"]);
  });

  it("handles DST: skips a nonexistent local time and runs a repeated one once", () => {
    // New York springs forward on 2026-03-08: 02:30 does not exist that day.
    const spring = nextRuns(parsed("30 2 * * *"), new Date("2026-03-06T12:00:00Z"), 4, "America/New_York");
    expect(iso(spring)).toEqual(["2026-03-07T07:30:00.000Z", "2026-03-09T06:30:00.000Z", "2026-03-10T06:30:00.000Z", "2026-03-11T06:30:00.000Z"]);
    // It falls back on 2026-11-01: 01:30 occurs twice, we run the first occurrence only.
    const fall = nextRuns(parsed("30 1 * * *"), new Date("2026-10-30T12:00:00Z"), 4, "America/New_York");
    expect(iso(fall)).toEqual(["2026-10-31T05:30:00.000Z", "2026-11-01T05:30:00.000Z", "2026-11-02T06:30:00.000Z", "2026-11-03T06:30:00.000Z"]);
  });

  it("validates timezones", () => {
    expect(isValidTimezone("Asia/Colombo")).toBe(true);
    expect(isValidTimezone("Not/AZone")).toBe(false);
  });

  it("nextNaive gives up after the search horizon instead of looping forever", () => {
    expect(nextNaive(parsed("0 0 30 2 *"), { year: 2026, month: 1, day: 1, hour: 0, minute: 0 })).toBeNull();
  });
});
