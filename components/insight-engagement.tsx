"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    plausible?: (eventName: string, options?: { props?: Record<string, string> }) => void;
  }
}

type InsightEngagementProps = {
  slug: string;
};

export function InsightEngagement({ slug }: InsightEngagementProps) {
  useEffect(() => {
    let tracked = false;

    function onScroll() {
      if (tracked || typeof window.plausible !== "function") {
        return;
      }

      const documentHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (documentHeight <= 0) {
        return;
      }

      const progress = window.scrollY / documentHeight;
      if (progress >= 0.75) {
        tracked = true;
        window.plausible("Insight 75% Read", { props: { slug } });
        window.removeEventListener("scroll", onScroll);
      }
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => window.removeEventListener("scroll", onScroll);
  }, [slug]);

  return null;
}
