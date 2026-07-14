# BD CRM Analytics — MCP server

A **read-only** [MCP](https://modelcontextprotocol.io) server that exposes the Meissasoft
**BD Leads CRM** analytics (win rate, conversion funnel, connects economics, sales velocity,
forecast, and lead lookup) to MCP clients like **Cursor** and **Claude Desktop**.

It talks only to the CRM **public API** (`/api/v1/`) using a Personal Access Token
(`X-Api-Key`). It never writes anything — every tool is a GET. What a token can see is
governed entirely by the CRM: a token only returns analytics if **its owning user is a
workspace admin AND (the workspace owner OR has been granted analytics access)**.

---

## Tools

| Tool | What it returns |
|---|---|
| `list_metadata` | Custom fields (+ their options) and pipeline states — the valid values for filters. Call this first to discover profiles/countries/contract types/states. |
| `get_win_rate` | Win rate. `dimension="bd"` → overall + per-rep; `profile`/`lead_source`/`country`/`contract_type` → win rate sliced by that field. |
| `get_conversion_funnel` | Applied → … → Won funnel with per-step conversion %, drop-off, and biggest-leak stage. |
| `get_connects_economics` | Connects-per-win overall, ROI by segment (spend, connects/win, est. revenue-per-connect, wasted connects), and boosted-vs-not. `dimension="profile"|"country"`. |
| `get_velocity_and_cycle` | Sales velocity ($/day) with its 4 inputs, plus avg cycle length by Profile and Country. |
| `get_forecast` | Weighted pipeline forecast (open leads × stage win-probability × est. deal value) with per-stage breakdown. |
| `list_leads` | Paginated leads with key fields + BD custom fields. Filter by `state`, `profile`, `country`, date range; `limit`/`offset`. |

Analytics tools accept an optional date range: `date_filter` (e.g. `this_month`, `last_month`,
`last_3_months`) **or** an explicit `start_date`/`end_date` (`YYYY-MM-DD`). Omit for all-time.

---

## 1. Prerequisites

- **Node.js 18+** (uses the built-in `fetch`).

## 2. Install & build

```bash
cd bd-crm-mcp
npm install
npm run build      # compiles to dist/
```

## 3. Mint a CRM Personal Access Token

1. Sign in to the CRM (e.g. `https://bd-crm.meissasoft.com`) as a user who can see BD
   Insights — i.e. a **workspace admin** who is the **workspace owner** or has been granted
   **analytics access**. (If your token's user isn't allowed, every tool returns a clear
   `403` — that's expected.)
2. Go to **Profile → Settings → Personal access tokens** (API tokens) and **create a token**.
3. Copy it — it looks like `plane_api_xxxxxxxx…`. Store it as `CRM_API_TOKEN`.

Find the other values:
- `WORKSPACE_SLUG` — the workspace segment in the CRM URL, e.g. `bd-leads` in
  `…/bd-leads/projects/…`.
- `PROJECT_ID` — open the BD Leads project; it's the UUID in the URL:
  `…/projects/<PROJECT_ID>/…`.

## 4. Environment variables

| Var | Example | Notes |
|---|---|---|
| `CRM_BASE_URL` | `https://bd-crm.meissasoft.com` | No trailing slash. |
| `CRM_API_TOKEN` | `plane_api_…` | Sent as `X-Api-Key`. |
| `WORKSPACE_SLUG` | `bd-leads` | |
| `PROJECT_ID` | `99361d89-…` | The BD Leads project UUID. |

For local testing you can copy `.env.example` to `.env`; when wired into a client, set them
in the client config (below) instead.

---

## 5. Configure your MCP client

Use the **absolute path** to the built `dist/index.js`.

### Cursor

Edit `~/.cursor/mcp.json` (global) or `.cursor/mcp.json` in your project:

```json
{
  "mcpServers": {
    "bd-crm-analytics": {
      "command": "node",
      "args": ["/absolute/path/to/bd-crm-mcp/dist/index.js"],
      "env": {
        "CRM_BASE_URL": "https://bd-crm.meissasoft.com",
        "CRM_API_TOKEN": "plane_api_xxxxxxxxxxxxxxxxxxxx",
        "WORKSPACE_SLUG": "bd-leads",
        "PROJECT_ID": "99361d89-81b6-4eee-83a6-24e622182383"
      }
    }
  }
}
```

Reload Cursor; the `bd-crm-analytics` tools appear in the MCP tool list.

### Claude Desktop

Edit the config file:
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "bd-crm-analytics": {
      "command": "node",
      "args": ["/absolute/path/to/bd-crm-mcp/dist/index.js"],
      "env": {
        "CRM_BASE_URL": "https://bd-crm.meissasoft.com",
        "CRM_API_TOKEN": "plane_api_xxxxxxxxxxxxxxxxxxxx",
        "WORKSPACE_SLUG": "bd-leads",
        "PROJECT_ID": "99361d89-81b6-4eee-83a6-24e622182383"
      }
    }
  }
}
```

Fully quit and reopen Claude Desktop. Ask e.g. *"What's our win rate by profile this
quarter?"* or *"Show the conversion funnel and biggest leak."*

> **Windows note:** if `node` isn't on Claude Desktop's PATH, use its full path
> (e.g. `"command": "C:\\Program Files\\nodejs\\node.exe"`) and a double-backslashed
> `args` path.

---

## Behavior & troubleshooting

- **Read-only.** No tool creates, edits, or deletes anything.
- **`401`** → token missing/invalid/expired: check `CRM_API_TOKEN`.
- **`403`** → the token's user lacks analytics access (needs workspace admin + owner-or-flag).
- **`404`** → check `CRM_BASE_URL` and `WORKSPACE_SLUG`.
- Errors are returned as readable tool results; the server does not crash.
- Estimated figures (deal value, revenue-per-connect, velocity, forecast) come straight from
  the CRM's deal-value proxy and are labelled as estimates there.

## Development

```bash
npm run dev     # run from source with tsx (no build step)
```
