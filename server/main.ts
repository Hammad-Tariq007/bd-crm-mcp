/**
 * Hosted BD CRM Analytics service.
 *
 *   GET  /mcp            → login screen, or chat UI when signed in
 *   POST /mcp/login      → verify pasted CRM token via verifyAdmin(); set httpOnly session
 *   POST /mcp/logout     → clear session
 *   POST /mcp/chat       → cookie-gated; Claude + the 7 analytics tools (env admin token)
 *   ALL  /mcp/rpc        → header-gated remote MCP endpoint (Streamable HTTP) for Claude Desktop
 *   ALL  /mcp/sse        → alias of /mcp/rpc
 *
 * Server-only secrets (CRM_ADMIN_TOKEN, LLM_API_KEY, SESSION_SECRET) never reach the browser.
 */

import { createHash } from "node:crypto";

import express from "express";
import cookieParser from "cookie-parser";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import { CrmClient } from "../src/client.js";
import { loadServerConfig, adminCrmConfig } from "./config.js";
import { verifyAdmin, issueSession, readSession, SESSION_COOKIE } from "./auth.js";
import { registerMcpTools } from "./tools.js";
import { runChat, chatConfigured, type ChatTurn } from "./chat.js";
import { loginPage, chatPage } from "./ui.js";

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

/* ---------------- web UI ---------------- */

app.get("/", (_req, res) => res.redirect("/mcp"));
app.get("/healthz", (_req, res) => res.json({ ok: true, chat: chatConfigured(cfg) }));

app.get("/mcp", (req, res) => {
  const session = readSession(req.cookies?.[SESSION_COOKIE], cfg.sessionSecret);
  res.type("html").send(session ? chatPage(session.name || session.email || "signed in") : loginPage());
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

  try {
    const result = await runChat(cfg, history, message);
    res.json({ reply: result.reply, toolsUsed: [...new Set(result.toolsUsed)] });
  } catch (err) {
    console.error(`[chat] error: ${(err as Error).message}`);
    res.status(502).json({ error: `Chat failed: ${(err as Error).message}` });
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

/* ---------------- start ---------------- */

app.listen(cfg.port, () => {
  console.log(
    `[bd-crm-analytics-web] listening on :${cfg.port}  ` +
      `(workspace="${cfg.workspaceSlug}", crm="${cfg.crmBaseUrl}", chat=${chatConfigured(cfg) ? "on" : "OFF"}, ` +
      `secureCookies=${cfg.secureCookies})`
  );
});
