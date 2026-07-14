/**
 * Thin read-only HTTP client for the CRM public API (/api/v1/).
 * Every request is authenticated with the `X-Api-Key` header. Errors are turned into
 * readable messages (401/403/404/400/network) so tools never crash the server.
 */

import type { Config } from "./config.js";

export class CrmError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "CrmError";
  }
}

export type DateRange = {
  date_filter?: string;
  start_date?: string;
  end_date?: string;
};

export type LeadFilters = {
  state?: string;
  profile?: string;
  country?: string;
  limit?: number;
  offset?: number;
};

type QueryParams = Record<string, string | number | undefined>;

export type FieldMeta = { id: string; name: string; type: string; options: { id: string; name: string }[] };
export type Metadata = {
  fields: FieldMeta[];
  states: { id: string; name: string; group: string; sequence: number }[];
};

export class CrmClient {
  private metadataCache: Metadata | null = null;

  constructor(private readonly cfg: Config) {}

  private async get(path: string, params: QueryParams): Promise<unknown> {
    const url = new URL(`${this.cfg.baseUrl}/api/v1/workspaces/${this.cfg.workspaceSlug}${path}`);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
    }

    let res: Response;
    try {
      res = await fetch(url, {
        method: "GET",
        headers: { "X-Api-Key": this.cfg.token, Accept: "application/json" },
      });
    } catch (err) {
      throw new CrmError(0, `Could not reach the CRM at ${this.cfg.baseUrl} — ${(err as Error).message}`);
    }

    const raw = await res.text();
    let body: any;
    try {
      body = raw ? JSON.parse(raw) : undefined;
    } catch {
      body = undefined;
    }

    if (!res.ok) {
      const detail = (body && (body.error || body.detail)) || (raw ? raw.slice(0, 200) : "");
      throw new CrmError(res.status, this.explain(res.status, detail));
    }
    return body;
  }

  private explain(status: number, detail: string): string {
    switch (status) {
      case 401:
        return `Unauthorized (401): the API token is missing, invalid or expired — check CRM_API_TOKEN.${detail ? ` [${detail}]` : ""}`;
      case 403:
        return `Forbidden (403): your token's user cannot view BD analytics. It must be a workspace admin AND either the workspace owner or granted analytics access.${detail ? ` [${detail}]` : ""}`;
      case 404:
        return `Not found (404): check CRM_BASE_URL and WORKSPACE_SLUG ("${this.cfg.workspaceSlug}").${detail ? ` [${detail}]` : ""}`;
      case 400:
        return `Bad request (400): ${detail || "check the parameters."}`;
      case 0:
        return detail;
      default:
        return `Request failed (${status})${detail ? `: ${detail}` : ""}`;
    }
  }

  /** Field definitions + options + states, cached for the process lifetime. */
  async metadata(force = false): Promise<Metadata> {
    if (!this.metadataCache || force) {
      this.metadataCache = (await this.get("/bd-insights/metadata/", {
        project_id: this.cfg.projectId,
      })) as Metadata;
    }
    return this.metadataCache;
  }

  /** Resolve a custom-field name (e.g. "Profile") to its id, or undefined if absent. */
  async fieldId(name: string): Promise<string | undefined> {
    const md = await this.metadata();
    return md.fields.find((f) => f.name === name)?.id;
  }

  /** Call a bd-insights analytics `type` with optional extra params + date range. */
  async insight(type: string, extra: QueryParams = {}, date: DateRange = {}): Promise<unknown> {
    return this.get("/bd-insights/", { type, project_id: this.cfg.projectId, ...date, ...extra });
  }

  async leads(filters: LeadFilters, date: DateRange = {}): Promise<unknown> {
    return this.get("/bd-insights/leads/", { project_id: this.cfg.projectId, ...date, ...filters });
  }
}
