/**
 * Hosted BD CRM Analytics service.
 *
 *   GET  /mcp[/*]        → the built React SPA (static assets + index.html fallback)
 *   GET  /mcp/session    → auth state for the SPA: { authed, name? } — NEVER any secret
 *   POST /mcp/login      → verify pasted CRM token via verifyAdmin(); set httpOnly session
 *   POST /mcp/logout     → clear session
 *   POST /mcp/chat       → cookie-gated; LLM + the 7 analytics tools (env admin token)
 *   ALL  /mcp/rpc        → header-gated remote MCP endpoint (Streamable HTTP) for Claude Desktop
 *   ALL  /mcp/sse        → alias of /mcp/rpc
 *
 * Server-only secrets (CRM_ADMIN_TOKEN, LLM_API_KEY, SESSION_SECRET) never reach the browser.
 */

import { createHash } from "node:crypto";
import path from "node:path";

import express from "express";
import cookieParser from "cookie-parser";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import { CrmClient } from "../src/client.js";
import { loadServerConfig, adminCrmConfig } from "./config.js";
import { verifyAdmin, issueSession, readSession, SESSION_COOKIE } from "./auth.js";
import { registerMcpTools } from "./tools.js";
import { runChatStream, chatConfigured, type ChatTurn } from "./chat.js";

// Built frontend (Vite output). Resolved from CWD so it works locally (repo root) and in
// the container (WORKDIR /app). Overridable via WEB_DIST.
const WEB_DIST = process.env.WEB_DIST || path.resolve(process.cwd(), "web/dist");
const WEB_INDEX = path.join(WEB_DIST, "index.html");

const cfg = loadServerConfig();
const app = express();
app.set("trust proxy", true);
app.use(express.json({ limit: "256kb" }));
app.use(cookieParser());

const cookieOpts = {
  httpOnly: true as const,
  sameSite: "lax" as const,
  secure: cfg.secureCookies,
  path: "/mcp",
  maxAge: 12 * 60 * 60 * 1000,
};

/* ---------------- JSON API ---------------- */

app.get("/", (_req, res) => res.redirect("/mcp"));
app.get("/healthz", (_req, res) => res.json({ ok: true, chat: chatConfigured(cfg) }));

// Auth state for the SPA. Returns ONLY whether a valid session exists and the display name —
// never a token, key, or any secret.
app.get("/mcp/session", (req, res) => {
  const session = readSession(req.cookies?.[SESSION_COOKIE], cfg.sessionSecret);
  if (!session) return res.json({ authed: false });
  res.json({ authed: true, name: session.name || session.email || undefined });
});

app.post("/mcp/login", async (req, res) => {
  const token = typeof req.body?.token === "string" ? req.body.token : "";
  const result = await verifyAdmin(cfg, token);
  if (!result.ok) {
    return res.status(result.status).json({ error: result.reason });
  }
  // Token proven — DISCARD it (never stored/logged). Issue a signed httpOnly session.
  const cookie = issueSession(result.identity, cfg.sessionSecret);
  res.cookie(SESSION_COOKIE, cookie, cookieOpts);
  console.log(`[login] ${result.identity.email ?? result.identity.id ?? "unknown"} authorized`);
  res.json({ ok: true });
});

app.post("/mcp/logout", (req, res) => {
  res.clearCookie(SESSION_COOKIE, { ...cookieOpts, maxAge: undefined });
  res.json({ ok: true });
});

/* ---------------- chat backend (cookie-gated) ---------------- */

app.post("/mcp/chat", async (req, res) => {
  const session = readSession(req.cookies?.[SESSION_COOKIE], cfg.sessionSecret);
  if (!session) return res.status(401).json({ error: "Not signed in." });

  if (!chatConfigured(cfg)) {
    return res.status(503).json({ error: "Chat is not configured on the server (LLM_API_KEY is unset)." });
  }
  const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
  if (!message) return res.status(400).json({ error: "Empty message." });
  const history: ChatTurn[] = Array.isArray(req.body?.history)
    ? req.body.history
        .filter((t: any) => (t?.role === "user" || t?.role === "assistant") && typeof t?.content === "string")
        .map((t: any) => ({ role: t.role, content: t.content }))
    : [];

  // Stream the answer to the browser as Server-Sent Events (token/tool/done/error). Any
  // pre-stream failure above (401/503/400) was already sent as JSON; from here on it's SSE.
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // defeat proxy buffering
  res.flushHeaders?.();

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    (res as any).flush?.();
  };
  // Heartbeat comment so idle proxies/load-balancers don't drop a long tool round.
  const heartbeat = setInterval(() => {
    try {
      res.write(`: ping\n\n`);
      (res as any).flush?.();
    } catch {
      /* connection gone; the finally-block will clean up */
    }
  }, 15000);
  // Stop work if the client navigates away mid-stream.
  let aborted = false;
  res.on("close", () => {
    aborted = true;
  });

  try {
    const { toolsUsed } = await runChatStream(cfg, history, message, {
      onToken: (delta) => {
        if (!aborted) send("token", { delta });
      },
      onTool: (name) => {
        if (!aborted) send("tool", { name });
      },
    });
    if (!aborted) send("done", { toolsUsed: [...new Set(toolsUsed)] });
  } catch (err) {
    console.error(`[chat] error: ${(err as Error).message}`);
    if (!aborted) send("error", { message: `Chat failed: ${(err as Error).message}` });
  } finally {
    clearInterval(heartbeat);
    res.end();
  }
});

/* ---------------- remote MCP endpoint (header-gated) ---------------- */

// Small positive-result cache so we don't re-hit the CRM on every MCP message.
const verifyCache = new Map<string, number>(); // sha256(token) -> expiry epoch ms
const VERIFY_TTL_MS = 5 * 60 * 1000;

function bearerToken(req: express.Request): string {
  const auth = req.header("authorization") || "";
  const m = /^Bearer\s+(.+)$/i.exec(auth);
  if (m) return m[1].trim();
  return (req.header("x-api-key") || "").trim();
}

async function gateMcp(req: express.Request): Promise<{ ok: true } | { ok: false; status: number; reason: string }> {
  const token = bearerToken(req);
  if (!token) return { ok: false, status: 401, reason: "Missing credentials: send Authorization: Bearer <your CRM token>." };
  const hash = createHash("sha256").update(token).digest("hex");
  const cached = verifyCache.get(hash);
  if (cached && cached > Date.now()) return { ok: true };
  const result = await verifyAdmin(cfg, token);
  if (result.ok) {
    verifyCache.set(hash, Date.now() + VERIFY_TTL_MS);
    return { ok: true };
  }
  return { ok: false, status: result.status, reason: result.reason };
}

async function handleMcp(req: express.Request, res: express.Response) {
  const gate = await gateMcp(req);
  if (!gate.ok) {
    return res.status(gate.status).json({
      jsonrpc: "2.0",
      error: { code: -32001, message: gate.reason },
      id: null,
    });
  }

  // Stateless: a fresh server + transport per request.
  const server = new McpServer({ name: "bd-crm-analytics", version: "1.0.0" });
  registerMcpTools(server, new CrmClient(adminCrmConfig(cfg)));
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on("close", () => {
    transport.close();
    server.close();
  });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
}

app.all("/mcp/rpc", handleMcp);
app.all("/mcp/sse", handleMcp);

/* ---------------- static frontend (registered AFTER the API/MCP routes) ---------------- */

// Serve the built SPA assets, then fall back to index.html for any other GET under /mcp.
app.use("/mcp", express.static(WEB_DIST));
app.get(/^\/mcp(?:\/.*)?$/, (_req, res) => res.sendFile(WEB_INDEX));

/* ---------------- start ---------------- */

app.listen(cfg.port, () => {
  console.log(
    `[bd-crm-analytics-web] listening on :${cfg.port}  ` +
      `(workspace="${cfg.workspaceSlug}", crm="${cfg.crmBaseUrl}", chat=${chatConfigured(cfg) ? "on" : "OFF"}, ` +
      `secureCookies=${cfg.secureCookies})`
  );
});
