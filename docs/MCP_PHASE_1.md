# MCP Connector: Phase 1 and Phase 2

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

## Phase 1: Read-only access

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

## Phase 2: Controlled campaign updates

Phase 2 adds two tools when the OAuth token contains `campaigns:write`:

| Tool | Purpose |
| --- | --- |
| `update_campaign_follow_up` | Schedule a campaign's next follow-up |
| `change_campaign_status` | Change a campaign status with an optional reason |

Both tools:

1. Require Claude to read the campaign first.
2. Require `confirm: true` after explicit user confirmation.
3. Carry the last-read follow-up or status to prevent stale overwrites.
4. Run through the same command service as the REST application.
5. Attribute the change to the signed-in platform user.
6. Write the standard campaign activity log.

`change_campaign_status` requires a reason when the new status is `Lost`.
The tools cannot create campaigns, edit campaign pricing or ownership, delete
records, or modify plans and operations.

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

Claude remote custom connectors accept a public HTTPS MCP URL. The server now
supports an OAuth mode so each Claude user signs in with their own Google
Workspace account and is mapped to an active platform user.

### 1. Configure Google OAuth

In Google Cloud Console, use a Web application OAuth client and add this
authorized redirect URI:

```text
https://internal-api.conektads.com/oauth/google/callback
```

The OAuth consent screen should be internal to the `conektads.com` Workspace
organization. Keep the existing frontend JavaScript origins and redirect
configuration if the same Google client is shared with the web application.

### 2. Configure the production server

Update `~/internal-platform/server/.env` on EC2. Preserve the existing MongoDB,
Cloudinary, JWT, and other production values; add or update only:

```env
MCP_ENABLED=true
MCP_AUTH_MODE=oauth
MCP_BASE_URL=https://internal-api.conektads.com
GOOGLE_CLIENT_ID=your_web_oauth_client_id
GOOGLE_CLIENT_SECRET=your_web_oauth_client_secret
GOOGLE_ALLOWED_DOMAIN=conektads.com
```

In OAuth mode, `MCP_ACCESS_TOKEN` and `MCP_ACTOR_EMAIL` are not used. Access
tokens are short-lived, refresh tokens rotate, and only token hashes are stored
in MongoDB.

Copy the updated nginx example to the active nginx configuration. The dedicated
`/mcp` location disables proxy buffering and allows longer MCP responses:

```bash
sudo cp deploy/nginx/internal-api.conektads.com.conf /etc/nginx/conf.d/
sudo nginx -t
sudo systemctl reload nginx
```

### 3. Verify OAuth discovery

These public metadata endpoints must return JSON:

```text
https://internal-api.conektads.com/.well-known/oauth-protected-resource/mcp
https://internal-api.conektads.com/.well-known/oauth-authorization-server
```

The protected-resource document must identify:

```text
resource: https://internal-api.conektads.com/mcp
authorization server: https://internal-api.conektads.com/
scopes: platform:read campaigns:write
```

### 4. Test with MCP Inspector

Remove the manually entered bearer token and use Inspector's authentication
settings:

1. Enter `https://internal-api.conektads.com/mcp`.
2. Open authentication settings.
3. Run the quick OAuth flow.
4. Sign in with an active `@conektads.com` platform user.
5. Connect and list tools.

### 5. Add the Claude connector

In Claude, open `Customize > Connectors`, add a custom connector, and enter:

```text
https://internal-api.conektads.com/mcp
```

The server supports dynamic client registration, so OAuth client ID and secret
advanced settings should normally be left empty. Claude discovers the OAuth
endpoints and opens the Google Workspace sign-in flow.

After deploying Phase 2, disconnect and reconnect the Claude connector. Existing
tokens only contain the scopes granted when they were issued, so reconnecting is
required before the two campaign write tools appear.

Claude reaches this URL from Anthropic's cloud. `localhost`, private EC2 ports,
and internal-only DNS names will not work.

## Production checks

1. Keep `MCP_ENABLED=false` until Google OAuth and the public URL are configured.
2. Use HTTPS only.
3. Never put client secrets or tokens in the connector URL, source control, or logs.
4. Restrict nginx request size and add rate limiting for `/mcp`.
5. Review tool logs for `mcp_tool_completed` and `mcp_tool_failed`.
6. Confirm Claude asks before each write and that the activity appears in Audit Logs.
