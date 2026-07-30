import { site } from "../../data/site";
import { getAllInsights } from "../../lib/insights";

async function main() {
  const key = process.env.BING_INDEXNOW_KEY;
  const urls = [site.url, `${site.url}/insights`, ...getAllInsights().map((insight) => `${site.url}/insights/${insight.slug}`)];

  if (!key) {
    console.log("BING_INDEXNOW_KEY is not set. URLs ready for submission:");
    for (const url of urls) {
      console.log(url);
    }
    return;
  }

  const response = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host: new URL(site.url).hostname,
      key,
      keyLocation: `${site.url}/indexnow-key.txt`,
      urlList: urls
    })
  });

  if (!response.ok) {
    throw new Error(`IndexNow submission failed with ${response.status}`);
  }

  console.log(`Submitted ${urls.length} URLs to IndexNow`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
