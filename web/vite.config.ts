import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Served behind Caddy under /mcp/, so assets must be requested from /mcp/.
// The dev server proxies API + MCP calls to the Node backend on :8790.
export default defineConfig({
  base: "/mcp/",
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/mcp/login": "http://localhost:8790",
      "/mcp/logout": "http://localhost:8790",
      "/mcp/chat": "http://localhost:8790",
      "/mcp/session": "http://localhost:8790",
      "/mcp/rpc": "http://localhost:8790",
      "/mcp/sse": "http://localhost:8790",
    },
  },
  build: { outDir: "dist", emptyOutDir: true },
});
