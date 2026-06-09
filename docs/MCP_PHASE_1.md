# MCP Connector: Phases 1-5

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
| `list_plan_documents` | List PDFs already generated for a plan |
| `list_operation_documents` | List PDFs already generated for an operation |

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

## Phase 3: Plan and operation workflows

Phase 3 introduces `plans:write` and `operations:write`.

Plan tool:

| Tool | Purpose |
| --- | --- |
| `change_plan_status` | Move a plan through its existing validated workflow |

Operation tools:

| Tool | Purpose |
| --- | --- |
| `change_operation_status` | Change the overall operation status |
| `update_operation_item_status` | Change one execution item's status and notes |
| `update_operation_creative` | Record creative receipt and existing file URLs |
| `update_operation_purchase_order` | Record PO state, number, and existing file URL |
| `update_operation_mounting` | Schedule or complete mounting |
| `update_operation_proof` | Record proof state and existing photo URLs |
| `update_operation_takedown` | Schedule or complete takedown |

The plan service continues to enforce transitions:

```text
Draft -> Shared or Lost
Shared -> Negotiating, Won, or Lost
Negotiating -> Won or Lost
```

Marking a plan `Won` creates its operation work order using the existing
platform workflow. Operation cancellation still requires an Admin user.

All Phase 3 tools require explicit confirmation. Operation item tools also
require the `updatedAt` value returned by the most recent `get_operation` call.
If another user changes the operation first, the tool returns a conflict and
Claude must read it again.

Phase 3 records existing file URLs but does not upload files.

## Phase 4: Documents and proof uploads

Phase 4 introduces `documents:write` and `uploads:write`.

Document tools:

| Tool | Purpose |
| --- | --- |
| `generate_plan_document` | Generate a Plan Proposal, Quotation, or Internal Cost Sheet PDF |
| `generate_operation_document` | Generate a Work Order, Purchase Order, or Execution Report PDF |

Proof upload tool:

| Tool | Purpose |
| --- | --- |
| `upload_operation_proof_image` | Upload one proof image to Cloudinary and attach it to an operation item |

All three write tools require `confirm: true` after explicit user confirmation.
Generation also requires the latest `updatedAt` value from `get_plan` or
`get_operation`. This prevents Claude from generating a document from data that
another user changed after Claude last read it.

Document audiences are intentionally separated:

| Document | Audience and contents |
| --- | --- |
| Plan Proposal | Client-safe campaign and inventory proposal |
| Quotation | Client-safe pricing quotation |
| Internal Cost Sheet | Internal costs and margins; Admin only |
| Work Order | Internal execution instructions |
| Purchase Order | Supplier-facing cost information |
| Execution Report | Client-safe execution proof; requires at least one proof photo |

Generated PDFs are stored as authenticated Cloudinary raw assets. The MCP result
returns an application download URL rather than exposing the Cloudinary asset
directly, so the normal platform authentication remains in the download path.

Proof uploads accept JPEG, PNG, or WebP. The decoded file limit defaults to
6 MB, the server checks the file signature against the declared MIME type, and
the new URL is appended to existing proof photos. If attaching the URL fails,
the uploaded Cloudinary asset is deleted to avoid orphaned files.

`upload_operation_proof_image` requires both `uploads:write` and
`operations:write`, because it uploads a file and updates an operation item.

## Phase 5: Plan authoring and client sharing

Phase 5 expands `plans:write` and introduces `shares:write`.

Plan authoring tools:

| Tool | Purpose |
| --- | --- |
| `create_draft_plan` | Create a priced Draft plan from confirmed inventory |
| `update_draft_plan` | Update an unlocked Draft plan and recalculate pricing |
| `clone_plan_to_draft` | Copy an existing plan into the next Draft version |

Share tools:

| Tool | Purpose |
| --- | --- |
| `list_plan_share_links` | List recipients, URLs, statuses, expiry, and views |
| `create_plan_share_link` | Create a client-facing share URL |
| `disable_plan_share_link` | Disable an active share URL |

Claude must read the campaign, plan, and inventory before authoring. Inventory
still has to be active, commercially available, and freshly confirmed. Pricing
is calculated by the platform from quantity, dates, selling price, internal
cost, and tax; Claude does not calculate or persist totals directly.

`update_draft_plan` replaces the inventory list when `items` is supplied. Claude
must therefore send the complete desired final list, not only newly added
locations.

Creating a share from a Draft has important side effects:

1. The plan moves to `Shared`.
2. The plan becomes locked.
3. The campaign moves to `Plan Shared`.
4. A client-safe public URL is created.

Claude must explain these effects and the recipient/channel/expiry before asking
for confirmation. Client share output excludes internal costs, margins, and
internal notes.

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

With only `platform:read`, confirm that the tool list contains the 15 read tools
documented above and that tool calls return data without changing MongoDB
records.

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
MCP_SHARED_SCOPES=platform:read campaigns:write plans:write operations:write documents:write uploads:write shares:write
MCP_MAX_UPLOAD_BYTES=6291456
CLOUDINARY_DOCUMENT_FOLDER=documents
CLOUDINARY_DOCUMENT_DELIVERY_TYPE=authenticated
```

In OAuth mode, `MCP_ACCESS_TOKEN` and `MCP_ACTOR_EMAIL` are not used. Access
tokens are short-lived, refresh tokens rotate, and only token hashes are stored
in MongoDB. `MCP_SHARED_SCOPES` is the OAuth connector allowlist and is included
in the `/mcp` authentication challenge, so Claude requests those scopes during
sign-in.

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
scopes: platform:read campaigns:write plans:write operations:write documents:write uploads:write shares:write
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

After deploying a phase with new scopes, remove and add the Claude connector
again. Existing OAuth clients or tokens may retain the scope list granted when
they were created.

## Deploy Phase 4

Build and deploy the updated backend image using the existing pipeline, or run
the production Compose commands manually on EC2:

```bash
cd ~/internal-platform
docker compose -f docker-compose.prod.yml pull server
docker compose -f docker-compose.prod.yml up -d server
docker compose -f docker-compose.prod.yml logs --tail=100 server
```

No MongoDB migration or nginx route change is required. Keep nginx
`client_max_body_size 10M`; base64 increases the HTTP request size above the
decoded image size.

Verify the deployment:

```bash
curl https://internal-api.conektads.com/api/health
curl https://internal-api.conektads.com/.well-known/oauth-authorization-server
```

The OAuth metadata must contain the configured scopes. Remove and re-add the
Claude connector, sign in again, then ask Claude to list its Conekt Ads tools.
A fully scoped Admin connection exposes 33 tools.

Recommended smoke tests:

1. List documents for an existing plan.
2. Generate a Plan Proposal after confirming it.
3. Confirm a member cannot generate an Internal Cost Sheet.
4. Upload a small proof image to a known operation item.
5. Generate an Execution Report after at least one proof photo exists.
6. Confirm each write appears in Audit Logs.

Claude reaches this URL from Anthropic's cloud. `localhost`, private EC2 ports,
and internal-only DNS names will not work.

## Production checks

1. Keep `MCP_ENABLED=false` until Google OAuth and the public URL are configured.
2. Use HTTPS only.
3. Never put client secrets or tokens in the connector URL, source control, or logs.
4. Restrict nginx request size and add rate limiting for `/mcp`.
5. Review tool logs for `mcp_tool_completed` and `mcp_tool_failed`.
6. Confirm Claude asks before each write and that the activity appears in Audit Logs.
