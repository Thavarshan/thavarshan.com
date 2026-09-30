import { site } from "@/data/site";

export interface ToolFaq {
  question: string;
  answer: string;
}

export interface ToolLink {
  label: string;
  href: string;
  note: string;
}

export interface ToolDefinition {
  slug: string;
  /** Short name used in nav, cards and breadcrumbs. */
  name: string;
  /** SEO title (rendered by the layout template). */
  title: string;
  h1: string;
  description: string;
  /** Why this tool was chosen (documented per the issue, shown on the index). */
  audience: string;
  intro: string[];
  howItWorks: string[];
  examples: Array<{ title: string; body: string }>;
  limitations: string[];
  privacy: string;
  faq: ToolFaq[];
  related: ToolLink[];
  datePublished: string;
  dateModified: string;
}

export const tools: ToolDefinition[] = [
  {
    slug: "laravel-scheduler-cron",
    name: "Laravel Scheduler Cron Helper",
    title: "Laravel Scheduler Cron Expression Helper",
    h1: "Laravel scheduler cron helper",
    description:
      "Paste a cron expression and get a plain-English explanation, the exact Laravel scheduler call (everyFiveMinutes, dailyAt, weeklyOn, cron()…), and the next run times in any timezone — all in your browser.",
    audience: "Laravel developers wiring up `Schedule::command()` and wanting the idiomatic helper for a cron they already have.",
    intro: [
      "Laravel's task scheduler accepts a raw cron string through ->cron(), but most schedules read far better as a fluent helper such as ->weekdays()->at('08:00'). Translating one into the other by hand is error-prone: ->weeklyOn() takes a day number, ->twiceDaily() takes hours rather than minutes, and quarterly schedules are easy to get subtly wrong.",
      "This helper parses a 5-field cron expression (or an @daily-style macro), explains it in plain English, and suggests the Laravel call that produces exactly the same schedule. When no built-in helper is an exact match it says so and falls back to ->cron() instead of guessing. It also lists the next run times so you can check the schedule before you deploy."
    ],
    howItWorks: [
      "The expression is validated field by field with specific errors (for example \"Minute field 60: 60 is outside 0-59\") instead of a generic \"invalid cron\".",
      "It is then matched against Laravel's frequency helpers by comparing the exact set of minutes, hours, days, months and weekdays each helper produces — so a suggestion is only shown when it is genuinely equivalent, not merely similar.",
      "Next runs are computed by walking the calendar in your chosen timezone, including daylight-saving changes: a local time that does not exist is skipped and a repeated local time runs once.",
      "Snippets are provided for Laravel 11+ (routes/console.php with the Schedule facade) and for Laravel 10 and earlier (app/Console/Kernel.php)."
    ],
    examples: [
      { title: "Every weekday at 08:00", body: "0 8 * * 1-5 → ->weekdays()->at('08:00')" },
      { title: "Twice a day at 01:00 and 13:00", body: "0 1,13 * * * → ->twiceDaily(1, 13)" },
      { title: "Quarterly on the 1st", body: "0 0 1 1,4,7,10 * → ->quarterly()" },
      { title: "No exact helper", body: "*/7 * * * * → ->cron('*/7 * * * *') — there is no everySevenMinutes(), and the tool tells you so." }
    ],
    limitations: [
      "Laravel uses 5-field cron. Six-field (seconds) expressions are rejected with a pointer to ->everySecond() and friends.",
      "The W (nearest weekday), LW, # (nth weekday) and day-of-week L tokens are valid in Laravel but are not evaluated here; the tool says so rather than mis-computing them.",
      "When both day-of-month and day-of-week are restricted, classic cron runs the job when either matches, but implementations differ and Laravel's cron library does not document this case. The tool shows the classic behaviour and warns — confirm with `php artisan schedule:list`.",
      "Daylight-saving edge cases follow the rule above; Laravel's own behaviour around transitions can differ, so treat times near a clock change as indicative.",
      "Run times are computed from your browser's clock, not your server's."
    ],
    privacy: "Everything runs in your browser. The expression and command name are never sent anywhere.",
    faq: [
      { question: "How do I run a Laravel task every 7 minutes?", answer: "There is no everySevenMinutes() helper, so use ->cron('*/7 * * * *'). Note that */7 restarts every hour: it runs at minutes 0, 7, 14 … 56, then again at minute 0 — the gap between :56 and :00 is four minutes, not seven." },
      { question: "What is the difference between weeklyOn() and days()?", answer: "weeklyOn(1, '08:00') runs on one weekday at a time. days([1, 3, 5])->at('08:00') covers several weekdays; weekdays() and weekends() are shortcuts for common sets." },
      { question: "Does the scheduler need a cron entry?", answer: "Yes. Laravel's scheduler still needs exactly one system cron entry that runs `php artisan schedule:run` every minute (or `schedule:work` in a long-running process); the expressions here decide which tasks run on each tick." },
      { question: "Why is my schedule running at the wrong hour?", answer: "Schedules use the application's timezone unless you set ->timezone('Region/City') on the event. Pick your timezone in the tool and copy the snippet — it adds the ->timezone() call for you." }
    ],
    related: [
      { label: "Observable, reliable production workflows", href: "/insights/observable-reliable-production-ai-workflows", note: "Why scheduled work needs contracts, traces and fallbacks, not just a cron line." },
      { label: "Matrix — async PHP", href: "/projects/matrix", note: "Open-source async primitives for PHP, where background scheduling and failure boundaries matter." },
      { label: "Event-driven asynchronous PHP: lessons from Matrix", href: "/insights/event-driven-asynchronous-php-matrix-lessons", note: "Task design and failure boundaries for PHP that runs outside the request." }
    ],
    datePublished: "2026-09-30",
    dateModified: "2026-09-30"
  },
  {
    slug: "laravel-env-checker",
    name: "Laravel .env Checker",
    title: "Laravel .env Checker (Private, In-Browser)",
    h1: "Laravel .env checker",
    description:
      "Find missing keys, duplicates, spaces in unquoted values, an empty APP_KEY, APP_DEBUG in production and secrets in .env.example. Runs entirely in your browser; your values are never uploaded or shown.",
    audience: "Laravel developers and reviewers who want to catch configuration mistakes before a deploy, without pasting secrets into a website that sends them to a server.",
    intro: [
      "Most Laravel outages caused by configuration are boring: a variable added to .env.example but never set in production, a value with a space that makes the dotenv parser throw, an APP_KEY left empty, or APP_DEBUG=true on a live server. They are easy to find by eye in a five-line file and easy to miss in a hundred-line one.",
      "Paste your .env and your .env.example and this checker compares them. It follows the same parsing rules as the dotenv library Laravel uses, so it flags what actually breaks a boot. Because .env files are full of secrets, it is built so that values are never displayed, logged or sent anywhere: findings only name keys and line numbers."
    ],
    howItWorks: [
      "Both files are parsed with phpdotenv-style rules: optional export, single and double quotes (including multi-line values), # comments, and the rule that an unquoted value containing spaces is an error.",
      "The two key sets are compared to find keys missing from .env, keys undocumented in .env.example, and defaults that were blanked out.",
      "Built-in checks cover APP_KEY presence and format, APP_DEBUG with APP_ENV=production, duplicate keys, ${VAR} references to variables not defined earlier, a UTF-8 byte-order mark that corrupts the first key, and values in .env.example that look like real credentials.",
      "The \"missing keys\" block gives you `KEY=` lines ready to paste; it only copies an example default when it is clearly not sensitive."
    ],
    examples: [
      { title: "Spaces in an unquoted value", body: "APP_NAME=My Great App → error: wrap it in double quotes, APP_NAME=\"My Great App\"" },
      { title: "Debug left on in production", body: "APP_ENV=production with APP_DEBUG=true → error: stack traces and environment details would be exposed." },
      { title: "A key added to .env.example only", body: "REDIS_HOST is documented but missing from .env → reported, with a ready-made REDIS_HOST= line." }
    ],
    limitations: [
      "It cannot see variables that your server, container or CI injects at runtime, so a key missing from .env may still be provided elsewhere.",
      "Secret detection is heuristic: it can miss an unusual credential and may flag a harmless long random value. It never proves a file is safe.",
      "It checks syntax and consistency, not whether values are correct (a wrong database host still parses).",
      "Very large inputs are refused (256,000 characters or 5,000 lines per file) to keep the page responsive.",
      "Which duplicate definition wins depends on how the file is loaded, so the checker reports duplicates rather than choosing one."
    ],
    privacy: "Your files never leave this page: there is no upload, no request containing your text, no analytics on what you paste, and nothing is stored in cookies or local storage. Findings show key names and line numbers, never values. Closing or reloading the tab discards everything.",
    faq: [
      { question: "Is it safe to paste my production .env?", answer: "The page processes text locally and sends nothing, which you can confirm in your browser's network panel. Even so, treat production secrets carefully: prefer checking a copy with real secrets replaced, and rotate anything you have ever pasted somewhere you did not control." },
      { question: "Why does APP_NAME=My App break Laravel?", answer: "The dotenv parser rejects an unquoted value containing whitespace with an \"unexpected whitespace\" error at boot. Quote the value: APP_NAME=\"My App\"." },
      { question: "What does php artisan key:generate do?", answer: "It writes a random base64 APP_KEY into .env. Laravel uses it to encrypt cookies and sessions, so an empty or changing key logs everyone out and can break encrypted data." },
      { question: "Should .env be committed to git?", answer: "No. Commit .env.example with safe placeholders and keep .env out of version control. This checker warns when .env.example appears to contain a real credential." }
    ],
    related: [
      { label: "Modernizing legacy platforms while shipping", href: "/insights/modernizing-legacy-platforms-during-delivery", note: "Configuration drift is one of the first things to stabilise in a legacy platform." },
      { label: "Fetch PHP", href: "/projects/fetch-php", note: "A widely used open-source PHP HTTP client, maintained with the same attention to safe defaults." },
      { label: "Observable, reliable production workflows", href: "/insights/observable-reliable-production-ai-workflows", note: "Release discipline and guardrails, including configuration, for production systems." }
    ],
    datePublished: "2026-09-30",
    dateModified: "2026-09-30"
  }
];

export function getTool(slug: string): ToolDefinition | undefined {
  return tools.find((tool) => tool.slug === slug);
}

export const toolUrl = (slug: string) => `${site.url}/tools/${slug}`;
