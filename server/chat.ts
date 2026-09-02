/**
 * Chat backend: an LLM drives the 7 analytics tools and composes the answer.
 *
 * Uses an OpenAI-compatible chat/completions API (OpenRouter by default) so the provider
 * and model are configurable via env (LLM_API_KEY / LLM_BASE_URL / LLM_MODEL). The key is
 * read from env and used server-side only. Only this LLM-call layer is provider-specific —
 * the 7 tools and the CrmClient (env admin token) wiring are unchanged.
 */

import { CrmClient } from "../src/client.js";
import type { ServerConfig } from "./config.js";
import { adminCrmConfig, DEFAULT_LLM_MODEL } from "./config.js";
import { openaiToolDefs, dispatchTool } from "./tools.js";

/** Chat model default — one place to change it. Overridable per-deploy via LLM_MODEL. */
export const CHAT_MODEL = DEFAULT_LLM_MODEL;
const MAX_TOKENS = 2048;
const MAX_TOOL_ROUNDS = 8;

const SYSTEM_PROMPT = [
  "You are the analytics assistant for the Meissasoft BD Leads CRM (an Upwork business-development pipeline).",
  "Answer questions about win rate, the conversion funnel, Upwork connects economics, sales velocity & cycle length,",
  "the weighted pipeline forecast, and individual leads — strictly using the provided read-only tools.",
  "",
  "Guidance:",
  "- When a question involves filtering by profile, country, contract type, lead source or pipeline state, call",
  "  list_metadata FIRST to learn the exact valid values, then use them.",
  "- Deal value, revenue-per-connect, velocity and forecast are ESTIMATES from the CRM's deal-value proxy — label them as such.",
  "- Be concise and numeric. Prefer small tables. Never invent numbers a tool did not return.",
  "- You cannot create, edit or delete anything; every tool is read-only. If asked to change data, say so.",
].join("\n");

export type ChatTurn = { role: "user" | "assistant"; content: string };
export type ChatResult = { reply: string; toolsUsed: string[] };

// OpenAI/OpenRouter message shapes (loose — sent/received as JSON).
type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };
type Message =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export function chatConfigured(cfg: ServerConfig): boolean {
  return Boolean(cfg.llmApiKey);
}

async function completion(cfg: ServerConfig, messages: Message[]): Promise<Message> {
  const res = await fetch(`${cfg.llmBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.llmApiKey}`,
      "Content-Type": "application/json",
      // Optional OpenRouter attribution headers (harmless on other providers).
      "X-Title": "BD CRM Analytics",
    },
    body: JSON.stringify({
      model: cfg.llmModel,
      max_tokens: MAX_TOKENS,
      tools: openaiToolDefs(),
      tool_choice: "auto",
      messages,
    }),
  });

  const raw = await res.text();
  let body: any;
  try {
    body = raw ? JSON.parse(raw) : undefined;
  } catch {
    body = undefined;
  }
  if (!res.ok) {
    const detail = body?.error?.message || body?.error || (raw ? raw.slice(0, 300) : "");
    throw new Error(`LLM request failed (${res.status})${detail ? `: ${detail}` : ""}`);
  }
  const msg = body?.choices?.[0]?.message;
  if (!msg) throw new Error("LLM returned no message.");
  return msg as Message;
}

/**
 * Run one assistant turn. `history` is the prior transcript (from the browser, no secrets);
 * `message` is the new user message. Returns the composed reply + which tools were called.
 */
export async function runChat(cfg: ServerConfig, history: ChatTurn[], message: string): Promise<ChatResult> {
  if (!chatConfigured(cfg)) {
    throw new Error("Chat is not configured on the server (LLM_API_KEY is unset).");
  }

  const crm = new CrmClient(adminCrmConfig(cfg));
  const toolsUsed: string[] = [];

  const messages: Message[] = [{ role: "system", content: SYSTEM_PROMPT }];
  for (const turn of history.slice(-20)) messages.push({ role: turn.role, content: turn.content });
  messages.push({ role: "user", content: message });

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const msg = await completion(cfg, messages);
    const toolCalls = (msg as any).tool_calls as ToolCall[] | undefined;

    if (!toolCalls || toolCalls.length === 0) {
      const text = typeof msg.content === "string" ? msg.content.trim() : "";
      return { reply: text || "(no answer produced)", toolsUsed };
    }

    // Record the assistant's tool-call message, then execute each call and feed results back.
    messages.push({ role: "assistant", content: (msg as any).content ?? null, tool_calls: toolCalls });
    for (const tc of toolCalls) {
      toolsUsed.push(tc.function.name);
      let args: unknown = {};
      try {
        args = tc.function.arguments ? JSON.parse(tc.function.arguments) : {};
      } catch {
        args = {};
      }
      const out = await dispatchTool(crm, tc.function.name, args);
      messages.push({ role: "tool", tool_call_id: tc.id, content: out.text });
    }
  }

  return { reply: "Stopped after too many tool calls without a final answer. Please refine the question.", toolsUsed };
}

/* ---------------- streaming variant (for the web chat SSE endpoint) ---------------- */

export type StreamHandlers = {
  /** Called with each incremental slice of answer text as the model emits it. */
  onToken: (delta: string) => void;
  /** Called once per tool when it starts executing (for a "running <tool>" status). */
  onTool: (name: string) => void;
};

/**
 * Stream ONE assistant turn from the LLM. Forwards answer-text deltas to `onToken` as they
 * arrive, while assembling any tool_calls internally (their argument fragments come piecemeal,
 * keyed by index). Returns the full assembled content + tool_calls for the caller's loop.
 */
async function streamOneTurn(
  cfg: ServerConfig,
  messages: Message[],
  onToken: (delta: string) => void
): Promise<{ content: string; toolCalls: ToolCall[] }> {
  const res = await fetch(`${cfg.llmBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.llmApiKey}`,
      "Content-Type": "application/json",
      "X-Title": "BD CRM Analytics",
    },
    body: JSON.stringify({
      model: cfg.llmModel,
      max_tokens: MAX_TOKENS,
      tools: openaiToolDefs(),
      tool_choice: "auto",
      stream: true,
      messages,
    }),
  });

  if (!res.ok || !res.body) {
    const raw = await res.text().catch(() => "");
    let detail = "";
    try {
      detail = JSON.parse(raw)?.error?.message || "";
    } catch {
      detail = raw ? raw.slice(0, 300) : "";
    }
    throw new Error(`LLM request failed (${res.status})${detail ? `: ${detail}` : ""}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let content = "";
  // Accumulate streamed tool_calls by their `index` (id/name/arguments arrive in fragments).
  const acc = new Map<number, { id: string; name: string; args: string }>();

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? ""; // keep the trailing partial line for the next chunk

    for (const line of lines) {
      const s = line.trim();
      if (!s.startsWith("data:")) continue; // ignore SSE comments / blank lines
      const payload = s.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      let obj: any;
      try {
        obj = JSON.parse(payload);
      } catch {
        continue;
      }
      const delta = obj?.choices?.[0]?.delta;
      if (!delta) continue;
      if (typeof delta.content === "string" && delta.content) {
        content += delta.content;
        onToken(delta.content);
      }
      if (Array.isArray(delta.tool_calls)) {
        for (const tc of delta.tool_calls) {
          const idx = typeof tc.index === "number" ? tc.index : 0;
          const cur = acc.get(idx) ?? { id: "", name: "", args: "" };
          if (tc.id) cur.id = tc.id;
          if (tc.function?.name) cur.name = tc.function.name;
          if (tc.function?.arguments) cur.args += tc.function.arguments;
          acc.set(idx, cur);
        }
      }
    }
  }

  const toolCalls: ToolCall[] = [...acc.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, v]) => ({ id: v.id, type: "function", function: { name: v.name, arguments: v.args } }));
  return { content, toolCalls };
}

/**
 * Streaming counterpart of runChat: same tool loop, but the FINAL answer is streamed to the
 * client token-by-token via `handlers.onToken`, and each tool invocation is announced via
 * `handlers.onTool`. Intermediate tool-calling rounds usually emit little/no prose, so
 * streaming content every round is safe (and any brief "let me check…" reads naturally).
 * Returns the set of tools used (for the final "Used" chips).
 */
export async function runChatStream(
  cfg: ServerConfig,
  history: ChatTurn[],
  message: string,
  handlers: StreamHandlers
): Promise<{ toolsUsed: string[] }> {
  if (!chatConfigured(cfg)) {
    throw new Error("Chat is not configured on the server (LLM_API_KEY is unset).");
  }

  const crm = new CrmClient(adminCrmConfig(cfg));
  const toolsUsed: string[] = [];

  const messages: Message[] = [{ role: "system", content: SYSTEM_PROMPT }];
  for (const turn of history.slice(-20)) messages.push({ role: turn.role, content: turn.content });
  messages.push({ role: "user", content: message });

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const { content, toolCalls } = await streamOneTurn(cfg, messages, handlers.onToken);

    if (toolCalls.length === 0) {
      return { toolsUsed }; // final answer already streamed via onToken
    }

    messages.push({ role: "assistant", content: content || null, tool_calls: toolCalls });
    for (const tc of toolCalls) {
      toolsUsed.push(tc.function.name);
      handlers.onTool(tc.function.name);
      let args: unknown = {};
      try {
        args = tc.function.arguments ? JSON.parse(tc.function.arguments) : {};
      } catch {
        args = {};
      }
      const out = await dispatchTool(crm, tc.function.name, args);
      messages.push({ role: "tool", tool_call_id: tc.id, content: out.text });
    }
  }

  handlers.onToken(
    "\n\n_Stopped after too many tool calls without a final answer. Please refine the question._"
  );
  return { toolsUsed };
}
