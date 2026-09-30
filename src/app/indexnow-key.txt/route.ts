export const dynamic = "force-static";

export function GET() {
  return new Response(`${process.env.BING_INDEXNOW_KEY ?? ""}\n`, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Robots-Tag": "noindex, nofollow"
    }
  });
}
