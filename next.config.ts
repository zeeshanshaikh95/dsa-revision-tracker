import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export for GitHub Pages hosting.
  output: "export",
  // Matches the repo subpath so assets resolve on Pages.
  basePath: "/dsa-revision-tracker",
};

export default nextConfig;
