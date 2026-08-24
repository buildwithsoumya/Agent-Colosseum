# syntax=docker/dockerfile:1
# Evaluator worker production image (built from repo root context)

FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY pnpm-workspace.yaml package.json ./
COPY shared/package.json shared/
COPY evaluator/package.json evaluator/
RUN pnpm install --frozen-lockfile --filter @ac/evaluator...

FROM deps AS build
COPY tsconfig.base.json ./
COPY shared/ shared/
COPY evaluator/ evaluator/
# Prisma client generation needs the schema (owned by the backend package)
COPY backend/prisma/schema.prisma ./prisma.schema
RUN cd shared && pnpm build \
    && cd ../evaluator \
    && npx prisma generate --schema ../prisma.schema \
    && pnpm build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/evaluator/dist ./evaluator/dist
COPY --from=build /app/shared ./shared
COPY evaluator/package.json evaluator/
WORKDIR /app/evaluator
CMD ["node", "dist/src/worker.js"]
