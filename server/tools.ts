/**
 * The 7 read-only BD analytics tools, defined ONCE and consumed by both surfaces:
 *   - the remote MCP endpoint (/mcp/rpc) via registerMcpTools()
 *   - the LLM chat backend via openaiToolDefs() + dispatchTool()
 *
 * Every handler runs against the CRM public API through CrmClient using the env admin
 * token. Read-only: no handler ever writes. (The stdio server in ../src/index.ts is a
 * separate, untouched copy of the same tool surface for local CLI users.)
 */

import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { CrmClient, CrmError } from "../src/client.js";

const dateShape = {
  date_filter: z
    .string()
    .optional()
    .describe('Preset range, e.g. "this_month", "last_month", "last_3_months". Omit for all time.'),
  start_date: z.string().optional().describe("Custom range start (YYYY-MM-DD). Use with end_date."),
  end_date: z.string().optional().describe("Custom range end (YYYY-MM-DD). Use with start_date."),
};
const pickDate = (a: Record<string, unknown>) => ({
  date_filter: a.date_filter as string | undefined,
  start_date: a.start_date as string | undefined,
  end_date: a.end_date as string | undefined,
});

const DIMENSION_FIELD: Record<string, string> = {
  profile: "Profile",
  lead_source: "Lead Source",
  country: "Country",
  contract_type: "Contract Type",
};

export type ToolSpec = {
  name: string;
  description: string;
  inputSchema: z.ZodRawShape;
  handler: (crm: CrmClient, args: any) => Promise<unknown>;
};

export const TOOLS: ToolSpec[] = [
  {
    name: "get_win_rate",
    description:
      "Win rate for the BD Leads pipeline. dimension='bd' gives overall + per-BD-rep win rates; " +
      "dimension in profile|lead_source|country|contract_type gives win rate sliced by that field.",
    inputSchema: {
      dimension: z
        .enum(["bd", "profile", "lead_source", "country", "contract_type"])
        .default("bd")
        .describe("How to slice win rate."),
      ...dateShape,
    },
    handler: async (crm, args) => {
      const date = pickDate(args);
      if ((args.dimension ?? "bd") === "bd") return crm.insight("win-rate", {}, date);
      const fieldName = DIMENSION_FIELD[args.dimension];
      const fieldId = await crm.fieldId(fieldName);
      if (!fieldId) throw new CrmError(400, `Field "${fieldName}" not found in this project's custom fields.`);
      return crm.insight("by-field", { field_id: fieldId }, date);
    },
  },
  {
    name: "get_conversion_funnel",
    description:
      "Stage-conversion funnel (Applied → … → Won) with per-step conversion %, drop-off, and the biggest-leak stage.",
    inputSchema: { ...dateShape },
    handler: (crm, args) => crm.insight("conversion-funnel", {}, pickDate(args)),
  },
  {
    name: "get_connects_economics",
    description:
      "Upwork connects economics: overall connects-per-win, connects ROI by segment (spend, connects/win, " +
      "estimated revenue-per-connect, wasted connects) and a boosted-vs-not comparison.",
    inputSchema: {
      dimension: z.enum(["profile", "country"]).default("profile").describe("Segment for the ROI table."),
      ...dateShape,
    },
    handler: async (crm, args) => {
      const date = pickDate(args);
      const [seg, spent, rate, weeks, contract, flag] = await Promise.all([
        crm.fieldId(DIMENSION_FIELD[args.dimension ?? "profile"]),
        crm.fieldId("Total Connects Spent"),
        crm.fieldId("Rate"),
        crm.fieldId("No. of Weeks"),
        crm.fieldId("Contract Type"),
        crm.fieldId("Boosted Proposal?"),
      ]);
      if (!spent) throw new CrmError(400, 'Field "Total Connects Spent" not found — connects economics needs it.');
      const [overview, bySegment, boosted] = await Promise.all([
        crm.insight("connects", { spent_field_id: spent }, date),
        seg
          ? crm.insight(
              "economics-by-segment",
              {
                field_id: seg,
                spent_field_id: spent,
                rate_field_id: rate,
                weeks_field_id: weeks,
                contract_field_id: contract,
              },
              date
            )
          : Promise.resolve(null),
        flag ? crm.insight("boosted", { flag_field_id: flag, spent_field_id: spent }, date) : Promise.resolve(null),
      ]);
      return { overview, by_segment: bySegment, boosted };
    },
  },
  {
    name: "get_velocity_and_cycle",
    description:
      "Sales velocity ($/day) with its four inputs (open opps, avg deal value, win rate, avg cycle length), " +
      "plus average cycle length (created → Won) broken down by Profile and by Country.",
    inputSchema: { ...dateShape },
    handler: async (crm, args) => {
      const date = pickDate(args);
      const [rate, weeks, contract, profile, country] = await Promise.all([
        crm.fieldId("Rate"),
        crm.fieldId("No. of Weeks"),
        crm.fieldId("Contract Type"),
        crm.fieldId("Profile"),
        crm.fieldId("Country"),
      ]);
      const [velocity, cycleByProfile, cycleByCountry] = await Promise.all([
        crm.insight("velocity", { rate_field_id: rate, weeks_field_id: weeks, contract_field_id: contract }, date),
        profile ? crm.insight("cycle-by-field", { field_id: profile }, date) : Promise.resolve(null),
        country ? crm.insight("cycle-by-field", { field_id: country }, date) : Promise.resolve(null),
      ]);
      return { velocity, cycle_by_profile: cycleByProfile, cycle_by_country: cycleByCountry };
    },
  },
  {
    name: "get_forecast",
    description:
      "Weighted pipeline forecast: total estimated value of open leads, each weighted by its stage's win " +
      "probability, with a per-stage breakdown. Deal value is an estimate.",
    inputSchema: { ...dateShape },
    handler: async (crm, args) => {
      const date = pickDate(args);
      const [rate, weeks, contract] = await Promise.all([
        crm.fieldId("Rate"),
        crm.fieldId("No. of Weeks"),
        crm.fieldId("Contract Type"),
      ]);
      return crm.insight("forecast", { rate_field_id: rate, weeks_field_id: weeks, contract_field_id: contract }, date);
    },
  },
  {
    name: "list_leads",
    description:
      "List BD leads (read-only, paginated) with key fields + BD custom fields. Filter by state (name or " +
      "group), profile, country, and date range. Use list_metadata for valid values.",
    inputSchema: {
      state: z
        .string()
        .optional()
        .describe('State name (e.g. "Won") or group (backlog|unstarted|started|completed|cancelled).'),
      profile: z.string().optional().describe("Profile option name (exact)."),
      country: z.string().optional().describe("Country option name (exact)."),
      limit: z.number().int().min(1).max(200).default(50).describe("Page size (max 200)."),
      offset: z.number().int().min(0).default(0).describe("Rows to skip (pagination)."),
      ...dateShape,
    },
    handler: (crm, args) =>
      crm.leads(
        { state: args.state, profile: args.profile, country: args.country, limit: args.limit, offset: args.offset },
        pickDate(args)
      ),
  },
  {
    name: "list_metadata",
    description:
      "List available custom fields (with their options) and pipeline states — the valid values for filtering " +
      "(profiles, countries, contract types, states). Call this first to discover filters.",
    inputSchema: {},
    handler: (crm) => crm.metadata(true),
  },
];

/* ---- MCP surface ---- */

type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean };
const ok = (data: unknown): ToolResult => ({ content: [{ type: "text", text: JSON.stringify(data, null, 2) }] });
const fail = (message: string): ToolResult => ({ content: [{ type: "text", text: `Error: ${message}` }], isError: true });

/** Register all 7 tools on an McpServer instance (used by /mcp/rpc). */
export function registerMcpTools(server: McpServer, crm: CrmClient): void {
  for (const spec of TOOLS) {
    server.registerTool(spec.name, { description: spec.description, inputSchema: spec.inputSchema }, async (args: any) => {
      try {
        return ok(await spec.handler(crm, args ?? {}));
      } catch (err) {
        if (err instanceof CrmError) return fail(err.message);
        return fail((err as Error).message ?? String(err));
      }
    });
  }
}

/* ---- Anthropic (chat) surface ---- */

export type OpenAIToolDef = {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
};

/** Tool definitions in OpenAI/OpenRouter chat-completions format (JSON Schema params). */
export function openaiToolDefs(): OpenAIToolDef[] {
  return TOOLS.map((spec) => {
    const schema = zodToJsonSchema(z.object(spec.inputSchema), { target: "jsonSchema7" }) as Record<string, unknown>;
    delete (schema as any).$schema;
    return { type: "function", function: { name: spec.name, description: spec.description, parameters: schema } };
  });
}

/** Execute a tool by name with raw (Claude-supplied) args; validates via the tool's zod shape. */
export async function dispatchTool(crm: CrmClient, name: string, rawArgs: unknown): Promise<{ text: string; isError: boolean }> {
  const spec = TOOLS.find((t) => t.name === name);
  if (!spec) return { text: `Error: unknown tool "${name}".`, isError: true };
  try {
    const args = z.object(spec.inputSchema).parse(rawArgs ?? {});
    const data = await spec.handler(crm, args);
    return { text: JSON.stringify(data, null, 2), isError: false };
  } catch (err) {
    if (err instanceof CrmError) return { text: `Error: ${err.message}`, isError: true };
    if (err instanceof z.ZodError) return { text: `Error: invalid arguments — ${err.message}`, isError: true };
    return { text: `Error: ${(err as Error).message ?? String(err)}`, isError: true };
  }
}
