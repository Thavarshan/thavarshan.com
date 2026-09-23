const nonNumericPattern = /^(competitive|negotiable|doe|depends on experience|n\/?a)$/i;
const currencyCodePattern = /\b(USD|EUR|GBP|CAD|AUD|NZD|CHF|SEK|NOK|DKK|INR|SGD|JPY)\b/i;
const currencySymbols: Array<[string, string]> = [
  ["$", "USD"],
  ["€", "EUR"],
  ["£", "GBP"],
  ["₹", "INR"]
];

const numberToken = String.raw`[$€£]?\s?\d[\d,]*(?:\.\d+)?\s?[kK]?`;
const rangePattern = new RegExp(`(${numberToken})\\s*(?:-|–|—|to)\\s*(${numberToken})`, "i");
const singleNumberPattern = new RegExp(numberToken);
const upToPattern = /\bup to\b/i;
const fromPattern = /\b(from|starting at|minimum)\b/i;

function parseAmount(token: string): number | null {
  const trimmed = token.trim();
  const isThousands = /[kK]$/.test(trimmed);
  const numeric = trimmed.replace(/[$€£,\skK]/g, "");
  if (!numeric) return null;
  const value = Number.parseFloat(numeric);
  if (Number.isNaN(value)) return null;
  return isThousands ? value * 1000 : value;
}

function detectCurrency(raw: string): string | null {
  const codeMatch = raw.match(currencyCodePattern);
  if (codeMatch) return codeMatch[1].toUpperCase();
  for (const [symbol, code] of currencySymbols) {
    if (raw.includes(symbol)) return code;
  }
  return null;
}

export interface ParsedSalary {
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
}

export function parseSalary(raw: string | null | undefined): ParsedSalary {
  const value = (raw ?? "").trim();
  if (!value || nonNumericPattern.test(value)) {
    return { salaryMin: null, salaryMax: null, salaryCurrency: null };
  }

  const salaryCurrency = detectCurrency(value);

  const rangeMatch = value.match(rangePattern);
  if (rangeMatch) {
    const min = parseAmount(rangeMatch[1]);
    const max = parseAmount(rangeMatch[2]);
    if (min !== null && max !== null) {
      return { salaryMin: Math.min(min, max), salaryMax: Math.max(min, max), salaryCurrency };
    }
  }

  const singleMatch = value.match(singleNumberPattern);
  if (!singleMatch) {
    return { salaryMin: null, salaryMax: null, salaryCurrency: null };
  }

  const amount = parseAmount(singleMatch[0]);
  if (amount === null) {
    return { salaryMin: null, salaryMax: null, salaryCurrency: null };
  }

  const prefix = value.slice(0, singleMatch.index ?? 0);
  const suffix = value.slice((singleMatch.index ?? 0) + singleMatch[0].length);

  if (upToPattern.test(prefix)) {
    return { salaryMin: null, salaryMax: amount, salaryCurrency };
  }
  if (fromPattern.test(prefix) || /^\s*\+/.test(suffix)) {
    return { salaryMin: amount, salaryMax: null, salaryCurrency };
  }

  return { salaryMin: amount, salaryMax: amount, salaryCurrency };
}
