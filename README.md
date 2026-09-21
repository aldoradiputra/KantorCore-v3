# KantorCore

The foundation Indonesian businesses build their systems on. Turborepo + pnpm monorepo,
packages scoped `@kantorcore/*` (D15).

> **Docs are the source of truth.** Architecture, decisions, and specs live in the
> `kantorcore-docs` doc set (`AGENTS.md`, `CLAUDE.md`, `docs/`). This repo implements
> **Approved** specs only. Current phase: **0a — Infrastructure** (`docs/specs/0a-plan.md`).

## Layout (ARCH §2)

```
apps/       web · console · site · worker · mcp
packages/   config · db · auth · access · tenancy · billing · events · jobs · audit ·
            model · metadata · workflow · simulate · docgen · ai · blocks · ui ·
            importer · connectors · governed
```

## Prerequisites

Node 24, pnpm 12 (`corepack` or global). Enforced via `.node-version` and `engines`.

## Commands

```
pnpm install            # install workspace deps
pnpm build              # turbo: build all packages
pnpm typecheck          # turbo: type-check all packages
pnpm lint               # eslint across apps + packages, incl. import boundaries (Rule 8)
pnpm test               # turbo: run tests
```

## Import boundaries (Rule 8)

`apps -> packages` only; `governed`/`workflow` may depend on `metadata`/`model`, never the
reverse. Enforced by `eslint.config.mjs` composing `packages/config/eslint.boundaries.mjs`.
