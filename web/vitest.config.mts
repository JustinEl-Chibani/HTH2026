import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(here),
      // Next's `server-only` guard throws outside the React server runtime; stub it for unit tests.
      "server-only": path.resolve(here, "test/server-only-stub.ts"),
    },
  },
  test: { environment: "node", include: ["**/*.test.ts"], exclude: ["node_modules/**", ".next/**"] },
});
