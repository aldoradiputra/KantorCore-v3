import { defineConfig } from "vitest/config";

// The db integration suite doubles as the governed-spine isolation suite: it exercises
// tenancy (this package) plus the outbox, audit log, identity and authz packages, which
// resolve from their built dist (db dev-depends on them; `test:isolation` builds first).
export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    testTimeout: 60_000,
    hookTimeout: 180_000,
    fileParallelism: false,
  },
});
