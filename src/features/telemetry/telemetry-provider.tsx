"use client";

import { useEffect } from "react";
import { captureLandingAttribution, configureTelemetry, type TelemetryConfig } from "@/features/telemetry/client";

/** Mounted once; server-projected settings exclude the full profile and its Zod parser. */
export function TelemetryProvider({ config }: { config: TelemetryConfig }) {
  // This runs during hydration before client click handlers are interactive.
  configureTelemetry(config);
  useEffect(() => {
    configureTelemetry(config);
    captureLandingAttribution();
  }, [config]);
  return null;
}
