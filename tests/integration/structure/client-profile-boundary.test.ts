// @vitest-environment node
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { describe, expect, it } from "vitest";
import generatedProfile from "../../../data/profile.generated.json";
import { parseProfessionalProfile } from "@/features/profile/profile-schema";

describe("validated profile / client bundle boundary", () => {
  it("does not bundle the profile dataset or Zod into navigation and telemetry client entries", async () => {
    const result = await build({
      stdin: {
        contents: [
          'import { SiteNavClient } from "./src/components/layout/site-nav-client.tsx";',
          'import { TelemetryProvider } from "./src/features/telemetry/telemetry-provider.tsx";',
          "console.log(SiteNavClient, TelemetryProvider);"
        ].join("\n"),
        resolveDir: process.cwd()
      },
      bundle: true,
      platform: "browser",
      minify: true,
      write: false,
      metafile: true,
      tsconfig: "tsconfig.json",
      external: ["react", "react-dom", "next/*", "lucide-react"]
    });
    const inputs = Object.keys(result.metafile.inputs);
    expect(inputs.filter((input) => input.includes("/zod/") || input.includes("profile.generated.json") || input.includes("profile-schema.ts"))).toEqual([]);
    expect(inputs).toContain("src/components/layout/site-nav-client.tsx");
    expect(inputs).toContain("src/features/telemetry/telemetry-provider.tsx");
  });

  it("still fails fast on a malformed generated profile at the build/server boundary", () => {
    expect(() => parseProfessionalProfile({ ...generatedProfile, identity: { ...generatedProfile.identity, email: "not-an-email" } })).toThrow();
    const wrapper = readFileSync("src/components/layout/site-nav.tsx", "utf8");
    const layout = readFileSync("src/app/layout.tsx", "utf8");
    expect(wrapper).toContain('from "@/features/profile/site"');
    expect(layout).toContain('from "@/features/profile/site"');
    expect(layout).toContain("NEXT_PUBLIC_METRICS_URL ?? site.metricsUrl");
    expect(layout).toContain('NEXT_PUBLIC_METRICS_LOCAL === "1"');
  });
});
