# syntax=docker/dockerfile:1
# Backend production image (built from repo root context)

FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY pnpm-workspace.yaml package.json ./
COPY shared/package.json shared/
COPY backend/package.json backend/
RUN pnpm install --frozen-lockfile --filter @ac/backend...

FROM deps AS build
COPY tsconfig.base.json ./
COPY shared/ shared/
COPY backend/ backend/
RUN cd backend && pnpm db:generate && pnpm build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/backend/prisma ./backend/prisma
COPY --from=build /app/shared ./shared
COPY backend/package.json backend/
EXPOSE 4000
WORKDIR /app/backend
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/server.js"]
