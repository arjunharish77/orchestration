FROM node:22-alpine AS deps
WORKDIR /app
ENV NODE_ENV=development
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
COPY workers/package.json workers/package.json
RUN npm ci --workspace @unnatify/backend --include-workspace-root

FROM node:22-alpine AS build
WORKDIR /app
ENV NODE_ENV=development
RUN apk add --no-cache openssl
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/backend/node_modules ./backend/node_modules
COPY backend ./backend
WORKDIR /app/backend
RUN npx prisma generate
RUN npm run build

FROM node:22-alpine AS prod-deps
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
COPY workers/package.json workers/package.json
RUN npm ci --omit=dev --workspace @unnatify/backend --include-workspace-root && npm cache clean --force

FROM node:22-alpine AS runner
WORKDIR /app/backend
ENV NODE_ENV=production
RUN apk add --no-cache openssl \
  && mkdir -p /app/uploads /app/logs \
  && chown -R node:node /app
COPY --chown=node:node --from=prod-deps /app/node_modules /app/node_modules
COPY --chown=node:node --from=prod-deps /app/backend/node_modules ./node_modules
COPY --chown=node:node --from=build /app/node_modules/.prisma /app/node_modules/.prisma
COPY --chown=node:node --from=build /app/backend/dist ./dist
COPY --chown=node:node --from=build /app/backend/prisma ./prisma
COPY --chown=node:node --from=build /app/backend/node_modules/prisma ./node_modules/prisma
COPY --chown=node:node --from=build /app/backend/node_modules/.bin/prisma ./node_modules/.bin/prisma
COPY --chown=node:node backend/package.json ./
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD wget -qO- http://127.0.0.1:4000/health || exit 1
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node dist/main.js"]
