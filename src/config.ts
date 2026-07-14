/**
 * Environment configuration for the BD CRM analytics MCP server.
 * Read once at startup; a clear error is thrown if anything required is missing.
 */

export type Config = {
  baseUrl: string;
  token: string;
  workspaceSlug: string;
  projectId: string;
};

export function loadConfig(): Config {
  const baseUrl = (process.env.CRM_BASE_URL ?? "").trim().replace(/\/+$/, "");
  const token = (process.env.CRM_API_TOKEN ?? "").trim();
  const workspaceSlug = (process.env.WORKSPACE_SLUG ?? "").trim();
  const projectId = (process.env.PROJECT_ID ?? "").trim();

  const missing: string[] = [];
  if (!baseUrl) missing.push("CRM_BASE_URL");
  if (!token) missing.push("CRM_API_TOKEN");
  if (!workspaceSlug) missing.push("WORKSPACE_SLUG");
  if (!projectId) missing.push("PROJECT_ID");

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(", ")}. ` +
        `Set them in your MCP client config (see README) or a .env file.`
    );
  }

  return { baseUrl, token, workspaceSlug, projectId };
}
