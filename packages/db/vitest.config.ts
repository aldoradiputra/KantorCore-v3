import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// The db integration suite doubles as the governed-spine isolation suite: it exercises
// tenancy (this package) plus the outbox and audit log against one container. Alias the
// sibling packages to their source so no build step is needed to run it.
export default defineConfig({
  resolve: {
    alias: {
      "@kantorcore/events": fileURLToPath(
        new URL("../events/src/index.ts", import.meta.url),
      ),
      "@kantorcore/audit": fileURLToPath(
        new URL("../audit/src/index.ts", import.meta.url),
      ),
    },
  },
  test: {
    include: ["test/**/*.test.ts"],
    testTimeout: 60_000,
    hookTimeout: 180_000,
    fileParallelism: false,
  },
});
