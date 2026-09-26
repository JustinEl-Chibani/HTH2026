import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Monorepo root (silences the multiple-lockfiles warning and keeps file tracing inside the repo).
  outputFileTracingRoot: path.join(__dirname, ".."),
};

export default nextConfig;
