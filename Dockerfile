# Hosted BD CRM Analytics service (React SPA + JSON API + remote MCP endpoint).
# The stdio server (src/index.ts) is NOT run here — it stays a local CLI tool.

# ---- 1. build the React frontend (Vite) ----
FROM node:20-alpine AS web
WORKDIR /app/web
COPY web/package.json web/package-lock.json* ./
RUN npm install
COPY web/ ./
RUN npm run build          # -> /app/web/dist

# ---- 2. build the Node server (TypeScript) ----
FROM node:20-alpine AS server
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
COPY server ./server
RUN npm run build:server   # -> /app/server/dist

# ---- 3. runtime ----
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8787
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
# Compiled server + built frontend only (no source, no dev deps).
COPY --from=server /app/server/dist ./server/dist
COPY --from=web /app/web/dist ./web/dist
EXPOSE 8787
# Liveness probe against the health endpoint.
HEALTHCHECK --interval=30s --timeout=4s --start-period=8s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8787)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server/dist/server/main.js"]
