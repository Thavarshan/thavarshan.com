import type { EventName } from "./events";

/** The site's original call-to-action vocabulary, mapped onto the typed taxonomy in one place. */
export type Goal = "Hire" | "Consulting" | "Contact" | "Resume Download" | "LinkedIn Visit" | "GitHub Visit" | "Repository Visit" | "Newsletter Visit";

export interface TrackedEvent {
  name: EventName;
  props?: Record<string, string>;
}

/** A short, valid slug for where on the site something happened ("home", "cv", "projects", ...). */
export function locationFromPath(pathname: string): string {
  const first = pathname.split("/").filter(Boolean)[0];
  const candidate = (first ?? "home").toLowerCase();
  return /^[a-z0-9][a-z0-9-]{0,39}$/.test(candidate) ? candidate : "other";
}

/** `/projects/fetch-php` or `https://github.com/owner/fetch-php` -> `fetch-php`; anything else -> null. */
export function projectFromHref(href: string, pathname: string): string | null {
  const valid = (value: string | undefined) => (value && /^[a-z0-9][a-z0-9-]{0,79}$/.test(value.toLowerCase()) ? value.toLowerCase() : null);
  try {
    const url = new URL(href, "https://placeholder.invalid");
    if (url.hostname === "github.com") return valid(url.pathname.split("/").filter(Boolean)[1]);
    if (url.hostname === "placeholder.invalid") {
      const linked = url.pathname.match(/^\/projects\/([^/]+)/);
      if (linked) return valid(linked[1]);
    }
  } catch {
    // fall through to the page path
  }
  const match = pathname.match(/^\/projects\/([^/]+)/);
  return valid(match?.[1]);
}

export function goalToEvent(goal: Goal, href: string, pathname: string): TrackedEvent | null {
  switch (goal) {
    case "Hire":
      return { name: "hire_cta", props: { location: locationFromPath(pathname) } };
    case "Consulting":
      return { name: "consulting_cta", props: { location: locationFromPath(pathname) } };
    case "Contact":
      return { name: "contact_cta", props: { location: locationFromPath(pathname) } };
    case "Resume Download":
      return { name: "cv_download", props: { location: locationFromPath(pathname) } };
    case "LinkedIn Visit":
      return { name: "profile_click", props: { network: "linkedin" } };
    case "GitHub Visit":
      return { name: "profile_click", props: { network: "github" } };
    case "Newsletter Visit":
      return { name: "newsletter_click" };
    case "Repository Visit": {
      const project = projectFromHref(href, pathname);
      return project ? { name: "repo_click", props: { project } } : null;
    }
  }
}
