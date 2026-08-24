# syntax=docker/dockerfile:1
# Frontend production image (built from repo root context)

FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY pnpm-workspace.yaml package.json ./
COPY shared/package.json shared/
COPY frontend/package.json frontend/
RUN pnpm install --frozen-lockfile --filter @ac/frontend...

FROM deps AS build
ENV NEXT_TELEMETRY_DISABLED=1
COPY tsconfig.base.json ./
COPY shared/ shared/
COPY frontend/ frontend/
RUN cd shared && pnpm build && cd ../frontend && pnpm build

FROM base AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
COPY --from=build /app/frontend/.next/standalone ./
COPY --from=build /app/frontend/.next/static ./frontend/.next/static
COPY --from=build /app/frontend/public ./frontend/public
EXPOSE 3000
CMD ["node", "frontend/server.js"]
