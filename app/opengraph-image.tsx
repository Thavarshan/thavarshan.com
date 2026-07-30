import { ImageResponse } from "next/og";
import { profile } from "@/data/profile";

export const alt = "Jerome Thayananthajothy — Technical Lead and AI Systems Architect";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "flex-start",
          background: "#f7f4ee",
          color: "#202427",
          display: "flex",
          flexDirection: "column",
          height: "100%",
          justifyContent: "space-between",
          padding: "72px 78px",
          width: "100%"
        }}
      >
        <div style={{ color: "#7a4b12", display: "flex", fontSize: 24, fontWeight: 700, letterSpacing: 3 }}>
          TECHNICAL LEAD · AI SYSTEMS ARCHITECT
        </div>
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 1000 }}>
          <div style={{ display: "flex", fontFamily: "Georgia", fontSize: 76, lineHeight: 1.05 }}>
            {profile.identity.name}
          </div>
          <div style={{ color: "#60686f", display: "flex", fontSize: 31, lineHeight: 1.35, marginTop: 28 }}>
            Scalable platforms, AI workflows, cloud architecture, and open-source tools.
          </div>
        </div>
        <div style={{ color: "#244b5a", display: "flex", fontSize: 24 }}>
          thavarshan.com · Colombo, Sri Lanka
        </div>
      </div>
    ),
    size
  );
}
