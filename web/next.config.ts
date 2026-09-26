import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
