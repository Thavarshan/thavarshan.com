import { ImageResponse } from "next/og";
import { notFound } from "next/navigation";
import { site } from "@/data/site";
import { getAllInsights, getInsightBySlug } from "@/lib/insights";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const dynamic = "force-static";

export function generateStaticParams() {
  return getAllInsights().map((insight) => ({ slug: insight.slug }));
}

export default async function InsightOpenGraphImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const insight = getInsightBySlug(slug);
  if (!insight) {
    notFound();
  }

  return new ImageResponse(
    (
      <div
        style={{
          background: "#202427",
          color: "#ffffff",
          display: "flex",
          flexDirection: "column",
          height: "100%",
          justifyContent: "space-between",
          padding: "72px 78px",
          width: "100%"
        }}
      >
        <div style={{ color: "#f0c37b", display: "flex", fontSize: 24, fontWeight: 700, letterSpacing: 3 }}>
          ENGINEERING INSIGHT
        </div>
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 1020 }}>
          <div style={{ display: "flex", fontFamily: "Georgia", fontSize: 72, lineHeight: 1.05 }}>
            {insight.title}
          </div>
          <div style={{ color: "#d8d1c4", display: "flex", fontSize: 28, lineHeight: 1.35, marginTop: 26 }}>
            {insight.description}
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 25, justifyContent: "space-between", width: "100%" }}>
          <span>{site.name}</span>
          <span>thavarshan.com/insights</span>
        </div>
      </div>
    ),
    size
  );
}
