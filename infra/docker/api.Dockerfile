FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY packages/loan-engine/package.json packages/loan-engine/package.json
COPY packages/ledger-engine/package.json packages/ledger-engine/package.json
COPY apps/api/package.json apps/api/package.json
RUN pnpm install --frozen-lockfile --filter @mankopi/api...

FROM deps AS build
COPY packages/shared packages/shared
COPY packages/loan-engine packages/loan-engine
COPY packages/ledger-engine packages/ledger-engine
COPY apps/api apps/api
RUN pnpm --filter @mankopi/shared build \
 && pnpm --filter @mankopi/loan-engine build \
 && pnpm --filter @mankopi/ledger-engine build \
 && pnpm --filter @mankopi/api prisma:generate \
 && pnpm --filter @mankopi/api build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN useradd --system --uid 1001 mankopi
COPY --from=build --chown=mankopi:mankopi /app /app
USER mankopi
EXPOSE 3000
HEALTHCHECK --interval=20s --timeout=5s --retries=5 CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/api/dist/main.js"]
