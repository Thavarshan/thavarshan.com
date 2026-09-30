/**
 * Minimal robots.txt support (RFC 9309 semantics): user-agent groups, Allow/Disallow with `*` and
 * `$`, longest-match wins, Allow wins ties. The collector consults it before fetching anything so
 * "do not circumvent robots restrictions" is enforced in code rather than by convention.
 */
export interface RobotsRule {
  allow: boolean;
  pattern: string;
}

export interface RobotsRules {
  rules: RobotsRule[];
}

/** Rules that apply to `agent`: the most specific matching group, falling back to `*`. */
export function parseRobots(text: string, agent: string): RobotsRules {
  const token = agent.toLowerCase();
  const groups: Array<{ agents: string[]; rules: RobotsRule[] }> = [];
  let current: { agents: string[]; rules: RobotsRule[] } | null = null;
  let lastWasAgent = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const separator = line.indexOf(":");
    if (separator === -1) continue;
    const field = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();

    if (field === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else if (field === "allow" || field === "disallow") {
      lastWasAgent = false;
      // A rule before any user-agent line has no group to belong to.
      if (!current) continue;
      current.rules.push({ allow: field === "allow", pattern: value });
    } else {
      lastWasAgent = false;
    }
  }

  const specific = groups.filter((group) => group.agents.some((name) => name !== "*" && token.includes(name)));
  const chosen = specific.length > 0 ? specific : groups.filter((group) => group.agents.includes("*"));
  return { rules: chosen.flatMap((group) => group.rules) };
}

function patternToRegExp(pattern: string): RegExp {
  const anchored = pattern.endsWith("$");
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${body}${anchored ? "$" : ""}`);
}

export function isPathAllowed(robots: RobotsRules, pathAndQuery: string): boolean {
  let best: { length: number; allow: boolean } | null = null;
  for (const rule of robots.rules) {
    // An empty Disallow means "nothing is disallowed"; an empty Allow is meaningless.
    if (rule.pattern === "") continue;
    if (!patternToRegExp(rule.pattern).test(pathAndQuery)) continue;
    const length = rule.pattern.length;
    if (!best || length > best.length || (length === best.length && rule.allow && !best.allow)) {
      best = { length, allow: rule.allow };
    }
  }
  return best ? best.allow : true;
}

export type RobotsFetcher = (url: string) => Promise<{ status: number; text: () => Promise<string> }>;

export interface RobotsGuard {
  isAllowed(url: string): Promise<boolean>;
}

/**
 * Per-origin cached checker. Missing robots.txt (4xx) means allowed, per the RFC; server errors
 * and network failures mean "cannot verify", which fails closed so we never fetch on a guess.
 */
export function createRobotsGuard(fetcher: RobotsFetcher, agent: string): RobotsGuard {
  const cache = new Map<string, Promise<RobotsRules | "deny-all">>();

  function load(origin: string): Promise<RobotsRules | "deny-all"> {
    let pending = cache.get(origin);
    if (!pending) {
      pending = (async () => {
        try {
          const response = await fetcher(`${origin}/robots.txt`);
          if (response.status >= 200 && response.status < 300) return parseRobots(await response.text(), agent);
          if (response.status >= 400 && response.status < 500) return { rules: [] };
          return "deny-all" as const;
        } catch {
          return "deny-all" as const;
        }
      })();
      cache.set(origin, pending);
    }
    return pending;
  }

  return {
    async isAllowed(url: string) {
      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        return false;
      }
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
      const robots = await load(parsed.origin);
      if (robots === "deny-all") return false;
      return isPathAllowed(robots, `${parsed.pathname}${parsed.search}`);
    }
  };
}
