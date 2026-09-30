"use client";

import { useEffect } from "react";
import { site } from "@/data/site";
import { captureLandingAttribution, configureTelemetry } from "@/lib/telemetry/client";

// Configure at module load as well, so the first click of a page view is never lost to effect ordering.
const config = {
  endpoint: process.env.NEXT_PUBLIC_METRICS_URL ?? site.metricsUrl,
  activeHost: new URL(site.url).hostname,
  activeEverywhere: process.env.NEXT_PUBLIC_METRICS_LOCAL === "1"
};
configureTelemetry(config);

/** Mounted once in the root layout: records the landing attribution, renders nothing. */
export function TelemetryProvider() {
  useEffect(() => {
    configureTelemetry(config);
    captureLandingAttribution();
  }, []);
  return null;
}
