import type { NextConfig } from "next";

const repositoryRedirects = [
  ["fetch-php", "fetch-php"],
  ["fetch-php-2", "fetch-php"],
  ["filterable", "filterable"],
  ["phpvm", "phpvm"],
  ["comet", "comet"],
  ["matrix-php", "matrix"],
  ["formlink", "formlink"],
  ["secrets-loader", "secrets-loader"]
] as const;

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/blog",
        destination: "/projects",
        permanent: true
      },
      ...repositoryRedirects.map(([slug, repo]) => ({
        source: `/blog/${slug}`,
        destination: `https://github.com/Thavarshan/${repo}`,
        permanent: true
      }))
    ];
  },
  async headers() {
    return [
      {
        source: "/docs/:path*.pdf",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Content-Security-Policy", value: "default-src 'none'; sandbox" }
        ]
      },
      {
        source: "/:path*",
        headers: [
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" }
        ]
      }
    ];
  }
};

export default nextConfig;
