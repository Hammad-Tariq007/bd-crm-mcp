#!/usr/bin/env node
/**
 * BD CRM Analytics — read-only MCP server.
 *
 * Exposes the Meissasoft BD Leads CRM analytics as MCP tools, backed entirely by the
 * CRM public API (/api/v1/, X-Api-Key auth). Read-only: no tool ever writes. Every tool
 * returns clean JSON and surfaces 401/403/404 errors readably instead of crashing.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { CrmClient, CrmError } from "./client.js";
import { loadConfig } from "./config.js";

type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean };

const ok = (data: unknown): ToolResult => ({
  content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
});
const fail = (message: string): ToolResult => ({
  content: [{ type: "text", text: `Error: ${message}` }],
  isError: true,
});

/** Wrap a tool body so CRM/network errors become readable results, never crashes. */
async function run(body: () => Promise<ToolResult>): Promise<ToolResult> {
  try {
    return await body();
  } catch (err) {
    if (err instanceof CrmError) return fail(err.message);
    return fail((err as Error).message ?? String(err));
  }
}

// Optional date scoping shared by the analytics tools. date_filter is a preset; or pass an
// explicit start_date/end_date (YYYY-MM-DD). Omit all for "all time".
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

async function main() {
  const config = loadConfig();
  const crm = new CrmClient(config);

  const server = new McpServer({ name: "bd-crm-analytics", version: "1.0.0" });

  server.tool(
    "get_win_rate",
    "Win rate for the BD Leads pipeline. dimension='bd' gives overall + per-BD-rep win rates; " +
      "dimension in profile|lead_source|country|contract_type gives win rate sliced by that field " +
      "(leads, wins, closed and win % per value).",
    {
      dimension: z
        .enum(["bd", "profile", "lead_source", "country", "contract_type"])
        .default("bd")
        .describe("How to slice win rate."),
      ...dateShape,
    },
    async (args) =>
      run(async () => {
        const date = pickDate(args);
        if (args.dimension === "bd") return ok(await crm.insight("win-rate", {}, date));
        const fieldName = DIMENSION_FIELD[args.dimension];
        const fieldId = await crm.fieldId(fieldName);
        if (!fieldId) return fail(`Field "${fieldName}" not found in this project's custom fields.`);
        return ok(await crm.insight("by-field", { field_id: fieldId }, date));
      })
  );

  server.tool(
    "get_conversion_funnel",
    "Stage-conversion funnel (Applied → … → Won) with per-step conversion %, drop-off, and the " +
      "biggest-leak stage. Snapshot of current pipeline positions.",
    { ...dateShape },
    async (args) => run(async () => ok(await crm.insight("conversion-funnel", {}, pickDate(args))))
  );

  server.tool(
    "get_connects_economics",
    "Upwork connects economics: overall connects-per-win, connects ROI by segment (spend, " +
      "connects/win, estimated revenue-per-connect, wasted connects) and a boosted-vs-not comparison.",
    { dimension: z.enum(["profile", "country"]).default("profile").describe("Segment for the ROI table."), ...dateShape },
    async (args) =>
      run(async () => {
        const date = pickDate(args);
        const [seg, spent, rate, weeks, contract, flag] = await Promise.all([
          crm.fieldId(DIMENSION_FIELD[args.dimension]),
          crm.fieldId("Total Connects Spent"),
          crm.fieldId("Rate"),
          crm.fieldId("No. of Weeks"),
          crm.fieldId("Contract Type"),
          crm.fieldId("Boosted Proposal?"),
        ]);
        if (!spent) return fail('Field "Total Connects Spent" not found — connects economics needs it.');
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
        return ok({ overview, by_segment: bySegment, boosted });
      })
  );

  server.tool(
    "get_velocity_and_cycle",
    "Sales velocity ($/day) with its four inputs (open opps, avg deal value, win rate, avg cycle " +
      "length), plus average cycle length (created → Won) broken down by Profile and by Country.",
    { ...dateShape },
    async (args) =>
      run(async () => {
        const date = pickDate(args);
        const [rate, weeks, contract, profile, country] = await Promise.all([
          crm.fieldId("Rate"),
          crm.fieldId("No. of Weeks"),
          crm.fieldId("Contract Type"),
          crm.fieldId("Profile"),
          crm.fieldId("Country"),
        ]);
        const [velocity, cycleByProfile, cycleByCountry] = await Promise.all([
          crm.insight(
            "velocity",
            { rate_field_id: rate, weeks_field_id: weeks, contract_field_id: contract },
            date
          ),
          profile ? crm.insight("cycle-by-field", { field_id: profile }, date) : Promise.resolve(null),
          country ? crm.insight("cycle-by-field", { field_id: country }, date) : Promise.resolve(null),
        ]);
        return ok({ velocity, cycle_by_profile: cycleByProfile, cycle_by_country: cycleByCountry });
      })
  );

  server.tool(
    "get_forecast",
    "Weighted pipeline forecast: total estimated value of open leads, each weighted by its stage's " +
      "win probability, with a per-stage breakdown. Deal value is an estimate.",
    { ...dateShape },
    async (args) =>
      run(async () => {
        const date = pickDate(args);
        const [rate, weeks, contract] = await Promise.all([
          crm.fieldId("Rate"),
          crm.fieldId("No. of Weeks"),
          crm.fieldId("Contract Type"),
        ]);
        return ok(
          await crm.insight(
            "forecast",
            { rate_field_id: rate, weeks_field_id: weeks, contract_field_id: contract },
            date
          )
        );
      })
  );

  server.tool(
    "list_leads",
    "List BD leads (read-only, paginated) with key fields + BD custom fields. Filter by state " +
      "(name or group), profile, country, and date range. Use list_metadata for valid values.",
    {
      state: z.string().optional().describe('State name (e.g. "Won") or group (backlog|unstarted|started|completed|cancelled).'),
      profile: z.string().optional().describe("Profile option name (exact)."),
      country: z.string().optional().describe("Country option name (exact)."),
      limit: z.number().int().min(1).max(200).default(50).describe("Page size (max 200)."),
      offset: z.number().int().min(0).default(0).describe("Rows to skip (pagination)."),
      ...dateShape,
    },
    async (args) =>
      run(async () =>
        ok(
          await crm.leads(
            {
              state: args.state,
              profile: args.profile,
              country: args.country,
              limit: args.limit,
              offset: args.offset,
            },
            pickDate(args)
          )
        )
      )
  );

  server.tool(
    "list_metadata",
    "List available custom fields (with their options) and pipeline states — the valid values for " +
      "filtering (profiles, countries, contract types, states). Call this first to discover filters.",
    {},
    async () => run(async () => ok(await crm.metadata(true)))
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Never log to stdout — stdio is the MCP transport. Diagnostics go to stderr.
  console.error(`[bd-crm-analytics] MCP server ready (workspace="${config.workspaceSlug}", base="${config.baseUrl}").`);
}

main().catch((err) => {
  console.error(`[bd-crm-analytics] fatal: ${(err as Error).message}`);
  process.exit(1);
});
