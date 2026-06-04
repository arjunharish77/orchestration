FROM node:22-alpine AS deps
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
COPY workers/package.json workers/package.json
RUN npm ci --workspace @unnatify/frontend --include-workspace-root

FROM node:22-alpine AS build
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
COPY --from=deps /app/node_modules ./node_modules
COPY frontend ./frontend
WORKDIR /app/frontend
RUN test -n "$NEXT_PUBLIC_API_URL"
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
RUN mkdir -p /app && chown -R node:node /app
COPY --chown=node:node --from=build /app/frontend/.next/standalone ./
COPY --chown=node:node --from=build /app/frontend/.next/static ./frontend/.next/static
COPY --chown=node:node --from=build /app/frontend/public ./frontend/public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD wget -qO- http://127.0.0.1:3000 || exit 1
CMD ["node", "frontend/server.js"]
