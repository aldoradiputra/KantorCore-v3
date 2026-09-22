# syntax=docker/dockerfile:1
# Build context is the MONOREPO ROOT (Coolify: Dockerfile = /apps/web/Dockerfile,
# Base Directory = /). Produces a self-contained Next standalone server.

FROM node:24-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile
# Build web and only its workspace dependencies, in order.
RUN pnpm exec turbo run build --filter=@kantorcore/web

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
RUN useradd -m -u 1001 nextjs
# Standalone output is traced from the monorepo root, so it mirrors apps/web/*.
COPY --from=build --chown=nextjs:nextjs /app/apps/web/.next/standalone ./
COPY --from=build --chown=nextjs:nextjs /app/apps/web/.next/static ./apps/web/.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
