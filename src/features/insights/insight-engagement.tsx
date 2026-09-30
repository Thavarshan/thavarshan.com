"use client";

import { useEffect } from "react";
import { track } from "@/features/telemetry/client";

type InsightEngagementProps = {
  slug: string;
};

export function InsightEngagement({ slug }: InsightEngagementProps) {
  useEffect(() => {
    let tracked = false;

    function onScroll() {
      if (tracked) {
        return;
      }

      const documentHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (documentHeight <= 0) {
        return;
      }

      const progress = window.scrollY / documentHeight;
      if (progress >= 0.75) {
        tracked = true;
        track("insight_read", { slug: slug.toLowerCase() }, { once: true });
        window.removeEventListener("scroll", onScroll);
      }
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => window.removeEventListener("scroll", onScroll);
  }, [slug]);

  return null;
}
