import tseslint from "typescript-eslint";
import { boundaries } from "./packages/config/eslint.boundaries.mjs";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/.turbo/**",
      "**/.next/**",
    ],
  },
  ...tseslint.configs.recommended,
  ...boundaries,
);
