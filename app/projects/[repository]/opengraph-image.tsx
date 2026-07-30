import { ImageResponse } from "next/og";
import { notFound } from "next/navigation";
import githubData from "@/data/github.generated.json";
import { getFeaturedGitHubProject } from "@/lib/projects";
import { githubSnapshotSchema } from "@/lib/github-model";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const dynamic = "force-static";

export function generateStaticParams() {
  return githubSnapshotSchema.parse(githubData).projects.map((project) => ({ repository: project.repository }));
}

export default async function ProjectOpenGraphImage({ params }: { params: Promise<{ repository: string }> }) {
  const { repository } = await params;
  const project = await getFeaturedGitHubProject(repository);
  if (!project) {
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
          OPEN SOURCE · {project.primaryLanguage?.toUpperCase() ?? "SOFTWARE"}
        </div>
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 1020 }}>
          <div style={{ display: "flex", fontFamily: "Georgia", fontSize: 86 }}>{project.name}</div>
          <div style={{ color: "#d8d1c4", display: "flex", fontSize: 30, lineHeight: 1.35, marginTop: 26 }}>
            {project.description}
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 25, justifyContent: "space-between", width: "100%" }}>
          <span>★ {project.stars.toLocaleString()} · Forks {project.forks.toLocaleString()}</span>
          <span>thavarshan.com</span>
        </div>
      </div>
    ),
    size
  );
}
