/**
 * Environment configuration for the HOSTED BD CRM analytics service.
 *
 * All secrets are read from the environment — nothing is hardcoded. The two
 * server-only secrets (CRM_ADMIN_TOKEN, LLM_API_KEY) and the SESSION_SECRET
 * are never sent to the browser.
 */

import type { Config as CrmConfig } from "../src/config.js";

/** Default chat model — one place to change the model. Overridable via LLM_MODEL. */
export const DEFAULT_LLM_MODEL = "anthropic/claude-sonnet-5";

export type ServerConfig = {
  /** CRM public API base (no trailing slash), e.g. https://bd-crm.meissasoft.com */
  crmBaseUrl: string;
  /** Owner-level token used for ALL data fetching. Never leaves the server. */
  adminToken: string;
  /** LLM API key for the chat backend (OpenRouter / any OpenAI-compatible provider). Server-side only. May be empty (chat disabled). */
  llmApiKey: string;
  /** OpenAI-compatible base URL (no trailing slash). Default: OpenRouter. */
  llmBaseUrl: string;
  /** Model slug for the chat backend. Default: a Claude Sonnet on OpenRouter. */
  llmModel: string;
  workspaceSlug: string;
  projectId: string;
  /** HMAC key for signing session cookies. */
  sessionSecret: string;
  port: number;
  /** Set Secure flag on cookies (true in production / behind TLS). */
  secureCookies: boolean;
};

function req(name: string, missing: string[]): string {
  const v = (process.env[name] ?? "").trim();
  if (!v) missing.push(name);
  return v;
}

export function loadServerConfig(): ServerConfig {
  const missing: string[] = [];

  const crmBaseUrl = (process.env.CRM_BASE_URL ?? "").trim().replace(/\/+$/, "");
  if (!crmBaseUrl) missing.push("CRM_BASE_URL");
  const adminToken = req("CRM_ADMIN_TOKEN", missing);
  const workspaceSlug = req("WORKSPACE_SLUG", missing);
  const projectId = req("PROJECT_ID", missing);
  const sessionSecret = req("SESSION_SECRET", missing);

  // Optional at boot: the auth/security surfaces work without it. /mcp/chat returns a
  // clean "chat not configured" error until it is set.
  const llmApiKey = (process.env.LLM_API_KEY ?? "").trim();
  const llmBaseUrl = (process.env.LLM_BASE_URL ?? "https://openrouter.ai/api/v1").trim().replace(/\/+$/, "");
  const llmModel = (process.env.LLM_MODEL ?? DEFAULT_LLM_MODEL).trim();

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(", ")}. ` +
        `See .env.example. (LLM_API_KEY is optional at boot but needed for chat.)`
    );
  }

  const port = Number.parseInt((process.env.PORT ?? "8787").trim(), 10) || 8787;
  const secureCookies =
    (process.env.SECURE_COOKIES ?? "").trim() === "true" || process.env.NODE_ENV === "production";

  return {
    crmBaseUrl,
    adminToken,
    llmApiKey,
    llmBaseUrl,
    llmModel,
    workspaceSlug,
    projectId,
    sessionSecret,
    port,
    secureCookies,
  };
}

/** Build the CrmClient config for DATA FETCHING (always the env admin token). */
export function adminCrmConfig(cfg: ServerConfig): CrmConfig {
  return {
    baseUrl: cfg.crmBaseUrl,
    token: cfg.adminToken,
    workspaceSlug: cfg.workspaceSlug,
    projectId: cfg.projectId,
  };
}
