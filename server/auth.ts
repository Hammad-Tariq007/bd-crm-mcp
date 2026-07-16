/**
 * Auth core for the hosted service.
 *
 *  verifyAdmin(userToken) — the ONE gate. Proves the person is an analytics-authorized
 *  workspace admin by presenting THEIR OWN CRM token: we probe the analytics gate
 *  (bd-insights) with it. 200 => authorized. The token is used only for this check —
 *  never stored, never logged, never used to fetch data (that always uses the env admin
 *  token). On success we read users/me/ to capture identity for the session.
 *
 *  Session = HMAC-SHA256 signed, httpOnly cookie. No secret ever reaches the browser.
 */

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import type { ServerConfig } from "./config.js";

export const SESSION_COOKIE = "bdmcp_session";
const SESSION_TTL_SECONDS = 12 * 60 * 60; // 12h

export type Identity = { id?: string; email?: string; name?: string };
export type VerifyResult =
  | { ok: true; identity: Identity }
  | { ok: false; status: 401 | 403 | 502; reason: string };

/** Low-level CRM GET returning status + parsed body, without throwing on HTTP errors. */
async function crmGet(
  baseUrl: string,
  token: string,
  path: string,
  params: Record<string, string | undefined>
): Promise<{ status: number; body: any }> {
  const url = new URL(`${baseUrl}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") url.searchParams.set(k, v);
  }
  const res = await fetch(url, {
    method: "GET",
    headers: { "X-Api-Key": token, Accept: "application/json" },
  });
  const raw = await res.text();
  let body: any;
  try {
    body = raw ? JSON.parse(raw) : undefined;
  } catch {
    body = raw;
  }
  return { status: res.status, body };
}

/** True when a CRM 4xx body indicates the token itself is invalid/expired (vs. authorized-but-not-admin). */
function isInvalidToken(body: any): boolean {
  const detail = (body && (body.detail || body.error)) || "";
  return /not valid|invalid|expired|authentication/i.test(String(detail));
}

/**
 * Verify that `userToken` belongs to an analytics-authorized workspace admin.
 * Never persists the token.
 */
export async function verifyAdmin(cfg: ServerConfig, userToken: string): Promise<VerifyResult> {
  const token = (userToken || "").trim();
  if (!token) return { ok: false, status: 401, reason: "No token provided." };

  let probe: { status: number; body: any };
  try {
    probe = await crmGet(
      cfg.crmBaseUrl,
      token,
      `/api/v1/workspaces/${cfg.workspaceSlug}/bd-insights/`,
      { type: "win-rate", project_id: cfg.projectId }
    );
  } catch (err) {
    return { ok: false, status: 502, reason: `Could not reach the CRM to verify the token (${(err as Error).message}).` };
  }

  if (probe.status === 200) {
    // Authorized. Capture identity (best-effort) for the session + audit.
    let identity: Identity = {};
    try {
      const me = await crmGet(cfg.crmBaseUrl, token, `/api/v1/users/me/`, {});
      if (me.status === 200 && me.body) {
        identity = {
          id: me.body.id,
          email: me.body.email,
          name: me.body.display_name || me.body.first_name || me.body.email,
        };
      }
    } catch {
      /* identity is best-effort; authorization already proven */
    }
    return { ok: true, identity };
  }

  if (probe.status === 401 || isInvalidToken(probe.body)) {
    return { ok: false, status: 401, reason: "Token is missing, invalid, or expired. Paste a current CRM personal token." };
  }
  if (probe.status === 403) {
    return {
      ok: false,
      status: 403,
      reason:
        "This token is valid but not authorized for BD analytics. You must be a workspace admin who is the workspace owner or has been granted analytics access.",
    };
  }
  return { ok: false, status: 502, reason: `Unexpected CRM response (${probe.status}) while verifying the token.` };
}

/* ------------------------------------------------------------------ */
/* Session cookie: base64url(payload).base64url(hmac)                  */
/* ------------------------------------------------------------------ */

type SessionPayload = { sub?: string; email?: string; name?: string; exp: number; iat: number };

const b64url = (b: Buffer) => b.toString("base64url");

function sign(data: string, secret: string): string {
  return createHmac("sha256", secret).update(data).digest("base64url");
}

export function issueSession(identity: Identity, secret: string, ttl = SESSION_TTL_SECONDS): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    sub: identity.id,
    email: identity.email,
    name: identity.name,
    iat: now,
    exp: now + ttl,
  };
  const body = b64url(Buffer.from(JSON.stringify(payload)));
  return `${body}.${sign(body, secret)}`;
}

export function readSession(cookie: string | undefined, secret: string): SessionPayload | null {
  if (!cookie || !cookie.includes(".")) return null;
  const [body, sig] = cookie.split(".", 2);
  const expected = sign(body, secret);
  // Constant-time compare
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

/** A random secret suggestion (used only by the CLI helper / docs, never at runtime). */
export function randomSecret(): string {
  return randomBytes(32).toString("hex");
}
