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

export async function sendChat(message: string, history: ChatMessage[]): Promise<ChatResponse> {
  const res = await fetch(`${BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      history: history.map(({ role, content }) => ({ role, content })),
    }),
  });
  if (!res.ok) await parseError(res);
  return (await res.json()) as ChatResponse;
}
