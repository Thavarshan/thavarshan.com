import { ImageResponse } from "next/og";
import { notFound } from "next/navigation";
import { site } from "@/features/profile/site";
import { getTool, tools } from "@/features/tools/registry";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const dynamic = "force-static";

export function generateStaticParams() {
  return tools.map((tool) => ({ slug: tool.slug }));
}

export default async function ToolOpenGraphImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tool = getTool(slug);
  if (!tool) notFound();

  return new ImageResponse(
    (
      <div style={{ background: "#202427", color: "#ffffff", display: "flex", flexDirection: "column", height: "100%", justifyContent: "space-between", padding: "72px 78px", width: "100%" }}>
        <div style={{ color: "#f0c37b", display: "flex", fontSize: 24, fontWeight: 700, letterSpacing: 3 }}>FREE DEVELOPER TOOL</div>
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 1020 }}>
          <div style={{ display: "flex", fontFamily: "Georgia", fontSize: 76, lineHeight: 1.05 }}>{tool.h1}</div>
          <div style={{ color: "#d8d1c4", display: "flex", fontSize: 28, lineHeight: 1.35, marginTop: 26 }}>Runs in your browser. Nothing is uploaded.</div>
        </div>
        <div style={{ display: "flex", fontSize: 25, justifyContent: "space-between", width: "100%" }}>
          <span>{site.name}</span>
          <span>thavarshan.com/tools</span>
        </div>
      </div>
    ),
    size
  );
}
