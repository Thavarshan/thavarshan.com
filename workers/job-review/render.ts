import type { Opportunity } from "../../lib/job-opportunities";
import {
  opportunityAgeDays,
  reviewStatuses,
  reviewStatusOf,
  safeExternalUrl,
  type ReviewFilters,
  type ReviewMap
} from "../../lib/job-review";

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

const styles = `
:root{color-scheme:light dark;--bg:#fafaf9;--fg:#1c1917;--muted:#57534e;--line:#d6d3d1;--card:#fff;--accent:#0f766e;--warn:#b45309;--bad:#b91c1c}
@media(prefers-color-scheme:dark){:root{--bg:#131211;--fg:#f5f5f4;--muted:#a8a29e;--line:#3b3835;--card:#1c1a19;--accent:#2dd4bf;--warn:#fbbf24;--bad:#f87171}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.5 system-ui,sans-serif}
main{max-width:64rem;margin:0 auto;padding:1rem}h1{font-size:1.5rem;margin:.5rem 0}
a{color:var(--accent)}a:focus-visible,button:focus-visible,input:focus-visible,select:focus-visible,summary:focus-visible{outline:3px solid var(--accent);outline-offset:2px}
form.filters{display:grid;grid-template-columns:repeat(auto-fit,minmax(11rem,1fr));gap:.75rem;padding:1rem;border:1px solid var(--line);border-radius:.5rem;background:var(--card)}
label{display:flex;flex-direction:column;font-size:.85rem;color:var(--muted);gap:.2rem}fieldset{border:0;margin:0;padding:0}legend{font-size:.85rem;color:var(--muted)}
input,select,button,textarea{font:inherit;padding:.4rem .5rem;border:1px solid var(--line);border-radius:.35rem;background:var(--bg);color:var(--fg);min-height:2.5rem}
button{cursor:pointer;background:var(--accent);color:var(--bg);border-color:var(--accent)}button.secondary{background:transparent;color:var(--fg);border-color:var(--line)}
.banner{padding:.75rem 1rem;border:1px solid var(--warn);border-radius:.5rem;margin:1rem 0;color:var(--warn)}
.error{border-color:var(--bad);color:var(--bad)}
ul.jobs{list-style:none;padding:0;margin:1rem 0;display:grid;gap:.75rem}
li.job{border:1px solid var(--line);border-radius:.5rem;padding:1rem;background:var(--card)}
li.job h2{font-size:1.1rem;margin:0}.meta{color:var(--muted);font-size:.9rem;margin:.25rem 0}
.badges{display:flex;flex-wrap:wrap;gap:.4rem;margin:.5rem 0}.badge{border:1px solid var(--line);border-radius:999px;padding:.1rem .6rem;font-size:.8rem}
.badge.good{border-color:var(--accent);color:var(--accent)}.badge.unknown{border-style:dashed;color:var(--warn);border-color:var(--warn)}.badge.bad{border-color:var(--bad);color:var(--bad)}
table.breakdown{border-collapse:collapse;font-size:.85rem;margin:.5rem 0}table.breakdown td{padding:.15rem .75rem .15rem 0}
form.review{display:flex;flex-wrap:wrap;gap:.5rem;align-items:end;margin-top:.75rem}form.review label{flex:1 1 12rem}
.empty{padding:2rem;text-align:center;color:var(--muted);border:1px dashed var(--line);border-radius:.5rem}
`;

function option(value: string, label: string, selected: string) {
  return `<option value="${escapeHtml(value)}"${value === selected ? " selected" : ""}>${escapeHtml(label)}</option>`;
}

function unknownBadge(text: string) {
  return `<span class="badge unknown">${escapeHtml(text)}: unknown</span>`;
}

function renderFilters(snapshotItems: Opportunity[], filters: ReviewFilters) {
  const sources = [...new Set(snapshotItems.map((item) => item.source))].sort();
  const arrangements = [...new Set(snapshotItems.map((item) => item.workArrangement))].sort();
  const eligibilityBoxes = (["eligible", "unknown", "ineligible"] as const)
    .map((value) => `<label style="flex-direction:row;align-items:center;gap:.4rem"><input type="checkbox" name="elig" value="${value}"${filters.eligibility.includes(value) ? " checked" : ""} style="min-height:auto"> ${value}</label>`)
    .join("");

  return `<form class="filters" method="get" action="/" aria-label="Filter opportunities">
<input type="hidden" name="submitted" value="1">
<fieldset><legend>Eligibility</legend>${eligibilityBoxes}</fieldset>
<label>Min score<input type="number" name="min" min="0" max="100" value="${filters.minScore}"></label>
<label>Source<select name="src">${option("", "Any", filters.source)}${sources.map((s) => option(s, s, filters.source)).join("")}</select></label>
<label>Technology<input type="text" name="tech" value="${escapeHtml(filters.tech)}" placeholder="laravel, vue…" maxlength="40"></label>
<label>Remote scope<select name="arr">${option("", "Any", filters.arrangement)}${arrangements.map((a) => option(a, a, filters.arrangement)).join("")}</select></label>
<label>Sponsorship<select name="spons">${option("", "Any", filters.sponsorship)}${option("confirmed", "Confirmed", filters.sponsorship)}${option("unknown", "Unknown", filters.sponsorship)}${option("unavailable", "Unavailable", filters.sponsorship)}</select></label>
<label>Compensation<select name="sal">${option("any", "Any", filters.salary)}${option("listed", "Salary listed", filters.salary)}</select></label>
<label>Max age (days)<input type="number" name="age" min="1" max="365" value="${filters.maxAgeDays ?? ""}"></label>
<label>Review<select name="review">${option("open", "Not dismissed", filters.review)}${reviewStatuses.map((s) => option(s, s, filters.review)).join("")}${option("all", "All", filters.review)}</select></label>
<label style="flex-direction:row;align-items:center;gap:.4rem"><input type="checkbox" name="closed" value="1"${filters.includeClosed ? " checked" : ""} style="min-height:auto"> Include closed</label>
<div style="display:flex;gap:.5rem;align-items:end"><button type="submit">Apply</button><a href="/" class="secondary" style="padding:.5rem">Reset</a></div>
</form>`;
}

function renderJob(item: Opportunity, reviews: ReviewMap, returnQuery: string, now: Date) {
  const status = reviewStatusOf(reviews, item.id);
  const entry = reviews[item.id];
  const href = safeExternalUrl(item.canonicalUrl);
  const eligibilityClass = item.eligibility === "eligible" ? "good" : item.eligibility === "unknown" ? "unknown" : "bad";
  const salary = item.salary
    ? `<span class="badge">${escapeHtml(item.salary)}</span>`
    : unknownBadge("Salary");
  const breakdown = item.scoreBreakdown.length
    ? `<table class="breakdown"><caption class="sr-only" style="position:absolute;left:-9999px">Score breakdown</caption>${item.scoreBreakdown
        .map((row) => `<tr><td>${escapeHtml(row.factor)}</td><td>${row.points > 0 ? "+" : ""}${row.points}</td></tr>`)
        .join("")}</table>`
    : `<p class="meta">Breakdown not recorded for this snapshot; reasons below.</p>`;

  return `<li class="job" id="job-${item.id}">
<h2>${href ? `<a href="${escapeHtml(href)}" rel="noopener noreferrer nofollow" target="_blank">${escapeHtml(item.title)}</a>` : escapeHtml(item.title)}</h2>
<p class="meta">${escapeHtml(item.company ?? "Company unknown")} · ${escapeHtml(item.location ?? "Location unknown")} · ${escapeHtml(item.source)} · ${opportunityAgeDays(item, now)}d old${item.status === "closed" ? " · <strong>closed</strong>" : ""}</p>
<div class="badges">
<span class="badge ${eligibilityClass}">${escapeHtml(item.eligibility)}</span>
<span class="badge"><strong>${item.score}</strong> fit</span>
${item.confidence === null ? unknownBadge("Confidence") : `<span class="badge${item.confidence < 50 ? " unknown" : ""}"><strong>${item.confidence}</strong> confidence</span>`}
${item.sponsorship === "unknown" ? unknownBadge("Sponsorship") : `<span class="badge">sponsorship ${escapeHtml(item.sponsorship)}</span>`}
${item.workArrangement === "unknown" ? unknownBadge("Remote scope") : `<span class="badge">${escapeHtml(item.workArrangement)}</span>`}
${salary}
${status !== "new" ? `<span class="badge good">${escapeHtml(status)}</span>` : ""}
</div>
<details><summary>Why this score</summary>${breakdown}
${item.confidenceBreakdown.length ? `<p class="meta">Confidence: ${item.confidenceBreakdown.map((row) => `${escapeHtml(row.factor)} (${row.points > 0 ? "+" : ""}${row.points})`).join("; ")}</p>` : ""}
${item.reasons.length ? `<p class="meta">Positive: ${item.reasons.map(escapeHtml).join("; ")}</p>` : ""}
${item.concerns.length ? `<p class="meta">Concerns: ${item.concerns.map(escapeHtml).join("; ")}</p>` : ""}
<p class="meta">Tags: ${item.tags.length ? item.tags.map(escapeHtml).join(", ") : "none extracted"}</p></details>
<form class="review" method="post" action="/review">
<input type="hidden" name="id" value="${item.id}"><input type="hidden" name="return" value="${escapeHtml(returnQuery)}">
<label>Status<select name="status">${reviewStatuses.map((s) => option(s, s, status)).join("")}</select></label>
<label>Private note<input type="text" name="note" maxlength="500" value="${escapeHtml(entry?.note ?? "")}"></label>
<button type="submit">Save</button>
</form></li>`;
}

export interface PageModel {
  items: Opportunity[];
  allItems: Opportunity[];
  filters: ReviewFilters;
  reviews: ReviewMap;
  generatedAt: string | null;
  stale: boolean;
  returnQuery: string;
  now: Date;
  error?: string;
}

export function renderPage(model: PageModel) {
  const banner = model.error
    ? `<div class="banner error" role="alert">${escapeHtml(model.error)}</div>`
    : model.stale
      ? `<div class="banner" role="status">Job data looks stale (generated ${escapeHtml(model.generatedAt ?? "unknown")}). The scheduled refresh may have failed.</div>`
      : "";

  const body = model.error
    ? ""
    : model.items.length
      ? `<ul class="jobs">${model.items.map((item) => renderJob(item, model.reviews, model.returnQuery, model.now)).join("")}</ul>`
      : `<p class="empty">No opportunities match these filters.</p>`;

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Job review</title><style>${styles}</style></head><body><main>
<h1>Job review</h1>
<p class="meta">${model.error ? "" : `${model.items.length} of ${model.allItems.length} opportunities · data generated ${escapeHtml(model.generatedAt ?? "unknown")}`}</p>
${banner}${model.error ? "" : renderFilters(model.allItems, model.filters)}${body}
</main></body></html>`;
}
