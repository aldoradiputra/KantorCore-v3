// Canonical import-boundary policy (AGENTS.md Rule 8; ARCH §2).
// Enforced with the core `no-restricted-imports` rule so no resolver is needed.
//
//   apps -> packages          (one way; a package may never import an app)
//   governed, workflow -> metadata, model   (never the reverse)
//
// This file is data only; the root eslint.config.mjs composes it.

const APP_NAMES = [
  "@kantorcore/web",
  "@kantorcore/console",
  "@kantorcore/site",
  "@kantorcore/worker",
  "@kantorcore/mcp",
];

export const boundaries = [
  {
    name: "kantorcore/apps-to-packages-one-way",
    files: ["packages/**/*.{ts,tsx,mts,cts}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [...APP_NAMES, "**/apps/**"],
              message:
                "Dependencies point apps -> packages. A package may not import an app (AGENTS.md Rule 8).",
            },
          ],
        },
      ],
    },
  },
  {
    name: "kantorcore/model-metadata-no-upward",
    files: [
      "packages/model/**/*.{ts,tsx,mts,cts}",
      "packages/metadata/**/*.{ts,tsx,mts,cts}",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@kantorcore/governed",
                "@kantorcore/governed/**",
                "@kantorcore/workflow",
                "@kantorcore/workflow/**",
              ],
              message:
                "governed/workflow may depend on metadata/model, never the reverse (AGENTS.md Rule 8).",
            },
          ],
        },
      ],
    },
  },
];
