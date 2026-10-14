FROM node:24-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN mkdir -p public
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOST=0.0.0.0

RUN addgroup -g 1001 -S roomly && adduser -u 1001 -S roomly -G roomly

COPY --from=prod-deps --chown=roomly:roomly /app/node_modules ./node_modules
COPY --from=build --chown=roomly:roomly /app/public ./public
COPY --from=build --chown=roomly:roomly /app/.next ./.next
COPY --from=build --chown=roomly:roomly /app/dist ./dist
COPY --from=build --chown=roomly:roomly /app/package.json ./package.json
COPY --from=build --chown=roomly:roomly /app/next.config.ts ./next.config.ts
COPY --from=build --chown=roomly:roomly /app/config ./config

USER roomly
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/server/index.js"]
