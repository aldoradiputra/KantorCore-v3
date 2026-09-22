import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const config: NextConfig = {
  // Self-contained server bundle for Docker/Coolify.
  output: "standalone",
  // Trace workspace packages from the monorepo root (pnpm).
  outputFileTracingRoot: fileURLToPath(new URL("../../", import.meta.url)),
  transpilePackages: ["@kantorcore/config", "@kantorcore/db"],
};

export default config;
