import { NextResponse } from "next/server";

export const revalidate = 3600;

const releaseApi = "https://api.github.com/repos/Thavarshan/thavarshan.com/releases/tags/cv-latest";
const assetName = "Jerome-Resume.pdf";

export async function GET(request: Request) {
  try {
    const response = await fetch(releaseApi, {
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28"
      },
      next: { revalidate: 3600 }
    });

    if (response.ok) {
      const release = (await response.json()) as {
        assets?: Array<{ name: string; browser_download_url: string }>;
      };
      const asset = release.assets?.find((candidate) => candidate.name === assetName);
      if (asset) {
        const redirect = NextResponse.redirect(asset.browser_download_url, 307);
        redirect.headers.set("X-Robots-Tag", "noindex, nofollow");
        return redirect;
      }
    }
  } catch {
    // The checked-in CV remains available if GitHub Releases is unavailable.
  }

  const fallback = NextResponse.redirect(new URL("/docs/Jerome-Resume-fallback.pdf", request.url), 307);
  fallback.headers.set("X-Robots-Tag", "noindex, nofollow");
  return fallback;
}
