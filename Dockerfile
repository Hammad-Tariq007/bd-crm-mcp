# Hosted BD CRM Analytics service (web chat UI + remote MCP endpoint).
# The stdio server (src/index.ts) is NOT run here — it stays a local CLI tool.

# ---- build ----
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
COPY server ./server
RUN npm run build:server

# ---- runtime ----
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8787
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
# Compiled output only (server/dist/server/*.js + the reused server/dist/src/client.js).
COPY --from=build /app/server/dist ./server/dist
EXPOSE 8787
# Simple liveness probe against the health endpoint.
HEALTHCHECK --interval=30s --timeout=4s --start-period=8s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8787)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server/dist/server/main.js"]
