import type { ChatMessage, Session } from "../types";

/**
 * Thin client for the hosted service's JSON API. All calls are same-origin and rely on
 * the httpOnly session cookie — the browser never handles tokens or secrets directly.
 */

const BASE = "/mcp";

export interface ChatResponse {
  reply: string;
  toolsUsed: string[];
}

/** Thrown for non-2xx responses; carries the HTTP status so callers can branch (e.g. 401). */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function parseError(res: Response): Promise<never> {
  const body = await res.json().catch(() => ({}) as { error?: string });
  throw new ApiError(res.status, body.error || `Request failed (${res.status})`);
}

export async function getSession(): Promise<Session> {
  const res = await fetch(`${BASE}/session`, { headers: { Accept: "application/json" } });
  if (!res.ok) return { authed: false };
  return (await res.json()) as Session;
}

/** Verify a pasted CRM token (proves admin). Resolves on success; throws ApiError otherwise. */
export async function login(token: string): Promise<void> {
  const res = await fetch(`${BASE}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  if (!res.ok) await parseError(res);
}

export async function logout(): Promise<void> {
  await fetch(`${BASE}/logout`, { method: "POST" });
}

export interface ChatStreamHandlers {
  /** A slice of answer text arrived — append it to the live message. */
  onToken: (delta: string) => void;
  /** A tool started running — surface a "running <name>" status. */
  onTool: (name: string) => void;
  /** The turn finished; `toolsUsed` is the final set for the "Used" chips. */
  onDone: (toolsUsed: string[]) => void;
  /** The server reported a mid-stream failure. */
  onError: (message: string) => void;
}

/**
 * Stream a chat turn over Server-Sent Events. Resolves when the stream ends. Pre-stream
 * failures (401 not-signed-in, 503 chat-off, 400 empty) still arrive as JSON and are thrown
 * as ApiError so callers can branch (e.g. 401 → sign out). Everything after that is SSE.
 */
export async function streamChat(
  message: string,
  history: ChatMessage[],
  handlers: ChatStreamHandlers
): Promise<void> {
  const res = await fetch(`${BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      history: history.map(({ role, content }) => ({ role, content })),
    }),
  });

  // A non-OK response is a JSON error envelope (sent before the stream started).
  if (!res.ok || !res.body) {
    await parseError(res);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    // SSE events are separated by a blank line; keep the trailing partial event buffered.
    const events = buf.split("\n\n");
    buf = events.pop() ?? "";
    for (const chunk of events) {
      let event = "message";
      let data = "";
      for (const line of chunk.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data += line.slice(5).trim();
        // lines starting with ":" are heartbeat comments — ignore
      }
      if (!data) continue;
      let obj: any;
      try {
        obj = JSON.parse(data);
      } catch {
        continue;
      }
      if (event === "token") handlers.onToken(typeof obj.delta === "string" ? obj.delta : "");
      else if (event === "tool") handlers.onTool(typeof obj.name === "string" ? obj.name : "");
      else if (event === "done") handlers.onDone(Array.isArray(obj.toolsUsed) ? obj.toolsUsed : []);
      else if (event === "error") handlers.onError(typeof obj.message === "string" ? obj.message : "Chat failed.");
    }
  }
}
