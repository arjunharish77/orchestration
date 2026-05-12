FROM node:22-alpine AS deps
WORKDIR /app
ENV NODE_ENV=development
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
COPY workers/package.json workers/package.json
RUN npm ci --workspace @unnatify/workers --include-workspace-root

FROM node:22-alpine AS build
WORKDIR /app
ENV NODE_ENV=development
RUN apk add --no-cache openssl
COPY --from=deps /app/node_modules ./node_modules
COPY backend/prisma ./backend/prisma
COPY workers ./workers
WORKDIR /app/workers
RUN npx prisma generate --schema ../backend/prisma/schema.prisma
RUN npm run build

FROM node:22-alpine AS prod-deps
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
COPY workers/package.json workers/package.json
RUN npm ci --omit=dev --workspace @unnatify/workers --include-workspace-root && npm cache clean --force

FROM node:22-alpine AS runner
WORKDIR /app/workers
ENV NODE_ENV=production
RUN apk add --no-cache openssl \
  && mkdir -p /app/uploads /app/logs \
  && chown -R node:node /app
COPY --chown=node:node --from=prod-deps /app/node_modules /app/node_modules
COPY --chown=node:node --from=build /app/node_modules/.prisma /app/node_modules/.prisma
COPY --chown=node:node --from=build /app/workers/dist ./dist
COPY --chown=node:node workers/package.json ./
USER node
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD node -e "const Redis=require('ioredis'); const r=new Redis(process.env.REDIS_URL||'redis://redis:6379',{maxRetriesPerRequest:1,connectTimeout:2000}); r.ping().then(()=>{r.disconnect();process.exit(0)}).catch(()=>process.exit(1));"
CMD ["node", "dist/index.js"]
