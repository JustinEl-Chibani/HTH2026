import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets a second instance (e.g. a local-validator test server) build without clobbering .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Monorepo root (silences the multiple-lockfiles warning and keeps file tracing inside the repo).
  outputFileTracingRoot: path.join(__dirname, ".."),
  webpack: (config, { dev }) => {
    if (dev) {
      // Every SQLite write would otherwise trigger a Fast Refresh rebuild mid-navigation.
      config.watchOptions = {
        ...config.watchOptions,
        ignored: ["**/node_modules/**", "**/.git/**", "**/prisma/*.db", "**/prisma/*.db-journal"],
      };
    }
    return config;
  },
};

export default nextConfig;
