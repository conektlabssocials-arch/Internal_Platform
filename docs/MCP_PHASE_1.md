# MCP Phase 1: Read-only Claude access

## What MCP does

Model Context Protocol (MCP) gives Claude a structured list of tools it can call.
Instead of copying platform data into a chat, Claude can request current data from
the internal platform when the user asks a relevant question.

The Phase 1 endpoint is:

```text
POST https://internal-api.conektads.com/mcp
```

It uses the Streamable HTTP MCP transport. The implementation is stateless, so
each request is independent and the server does not keep Claude conversation data.

## Why Phase 1 is read-only

Claude can search and explain platform data, but it cannot create, update, delete,
approve, or change anything. This lets the team validate usefulness, permissions,
tool descriptions, and returned data before allowing actions.

Every Phase 1 tool is marked with MCP read-only and non-destructive annotations.

## Available tools

| Tool | Purpose |
| --- | --- |
| `get_dashboard_overview` | Explain current work, due items, and platform summaries |
| `search_crm_entities` | Find clients, agencies, individuals, or suppliers |
| `get_crm_entity` | Read one CRM record, its contacts, and linked inventory |
| `search_inventory` | Find inventory by category, location, availability, or freshness |
| `get_inventory_item` | Read the complete details of one inventory item |
| `search_campaigns` | Find campaigns and follow-ups using business filters |
| `get_campaign` | Read one complete campaign |
| `list_plans` | List recent plans or plans belonging to a campaign |
| `get_plan` | Read plan items, dates, and pricing |
| `search_operations` | Find execution work, pending proof, or overdue items |
| `get_operation` | Read complete execution progress and item states |
| `get_recent_activity` | Read the internal activity history |

## Temporary Phase 1 authentication

Phase 1 uses one long random bearer token bound to one active platform user:

```env
MCP_ENABLED=true
MCP_ACCESS_TOKEN=generate_a_long_random_secret
MCP_ACTOR_EMAIL=admin@conektads.com
```

Generate a token:

```bash
openssl rand -hex 32
```

`MCP_ACTOR_EMAIL` must already be an active user in the platform. It is used for
the user-specific dashboard and MCP invocation logs.

This bearer-token setup is suitable for MCP Inspector and controlled technical
testing. Do not expose an authless endpoint. Claude custom connectors should use
per-user OAuth before organization-wide production use.

## Local test

Start MongoDB and the server, then call the MCP endpoint with MCP Inspector:

```bash
npx @modelcontextprotocol/inspector
```

Configure:

```text
Transport: Streamable HTTP
URL: http://localhost:5000/mcp
Authorization: Bearer <MCP_ACCESS_TOKEN>
```

Confirm that the tool list contains only the 12 tools documented above and that
tool calls return data without changing MongoDB records.

## Claude connector requirement

Claude remote custom connectors accept a public HTTPS MCP URL. For a personal
proof of concept, first validate the endpoint with MCP Inspector.

Before adding it as a normal Claude organization connector, replace the shared
Phase 1 token with OAuth so each Claude user signs in individually and platform
roles can be enforced per person. The connector URL will then be:

```text
https://internal-api.conektads.com/mcp
```

## Production checks

1. Keep `MCP_ENABLED=false` until the token and actor email are configured.
2. Use HTTPS only.
3. Never put the token in the connector URL, source control, or logs.
4. Restrict nginx request size and add rate limiting for `/mcp`.
5. Review tool logs for `mcp_tool_completed` and `mcp_tool_failed`.
6. Move to per-user OAuth before enabling write tools or broad team access.
