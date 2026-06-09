import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { container } from '../config/container.js';
import { TOKENS } from '../config/tokens.js';
import type { CampaignFiltersDto } from '../dto/campaign.dto.js';
import type { CrmEntityFiltersDto } from '../dto/crm.dto.js';
import type { InventoryFiltersDto } from '../dto/inventory.dto.js';
import type { IActivityService } from '../services/activity.service.js';
import type { ICampaignService } from '../services/campaign.service.js';
import type { ICampaignCommandService } from '../services/campaignCommand.service.js';
import type { ICrmService } from '../services/crm.service.js';
import type { IDashboardService } from '../services/dashboard.service.js';
import type { IInventoryService } from '../services/inventory.service.js';
import type {
  IOperationService,
  OperationFilters,
} from '../services/operation.service.js';
import type { IPlanService } from '../services/plan.service.js';
import type { McpActor } from './mcpAuth.js';
import { MCP_SCOPES } from './mcpScopes.js';

const readOnlyAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};
const writeAnnotations = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: false,
};
const statusWriteAnnotations = {
  ...writeAnnotations,
  destructiveHint: true,
};

const emptyToUndefined = (value: unknown) =>
  value === null || value === '' ? undefined : value;

const optionalText = z.preprocess(
  emptyToUndefined,
  z.string().trim().min(1).optional(),
);
const optionalLimit = z.preprocess(
  emptyToUndefined,
  z.coerce.number().int().min(1).max(50).optional(),
);
const optionalPage = z.preprocess(
  emptyToUndefined,
  z.coerce.number().int().min(1).optional(),
);
const optionalBooleanFilter = z.preprocess(
  emptyToUndefined,
  z.union([z.boolean(), z.enum(['true', 'false'])]).optional(),
);
const optionalInventoryStatus = z.preprocess(
  (value) => {
    if (value === null || value === '') return undefined;
    if (value === true) return 'active';
    if (value === false) return 'inactive';
    return value;
  },
  z.enum(['active', 'inactive']).optional(),
);
const optionalAvailabilityStatus = z.preprocess(
  (value) => {
    if (value === null || value === '') return undefined;
    if (value === true) return 'available';
    if (value === false) return 'unknown';
    return value;
  },
  z.enum(['available', 'booked', 'hold', 'unknown']).optional(),
);

const asQuery = (value: number | undefined) => value?.toString();
const asBooleanQuery = (value: boolean | 'true' | 'false' | undefined) =>
  value === undefined ? undefined : value.toString();

const textResult = (data: unknown) => ({
  content: [
    {
      type: 'text' as const,
      text: JSON.stringify(data, null, 2),
    },
  ],
});

const runTool = async (
  toolName: string,
  actor: McpActor,
  callback: () => Promise<unknown>,
) => {
  const startedAt = Date.now();

  try {
    const data = await callback();
    console.info(
      JSON.stringify({
        event: 'mcp_tool_completed',
        tool: toolName,
        actorEmail: actor.email,
        durationMs: Date.now() - startedAt,
      }),
    );
    return textResult(data);
  } catch (error) {
    console.error(
      JSON.stringify({
        event: 'mcp_tool_failed',
        tool: toolName,
        actorEmail: actor.email,
        durationMs: Date.now() - startedAt,
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    );
    throw error;
  }
};

export const createPhase1McpServer = (
  actor: McpActor,
  scopes: string[] = [MCP_SCOPES.PlatformRead],
) => {
  const server = new McpServer({
    name: 'conekt-ads-internal-platform',
    version: '0.2.0',
  });

  const activity = container.resolve<IActivityService>(TOKENS.ActivityService);
  const campaigns = container.resolve<ICampaignService>(TOKENS.CampaignService);
  const crm = container.resolve<ICrmService>(TOKENS.CrmService);
  const dashboard = container.resolve<IDashboardService>(TOKENS.DashboardService);
  const inventory = container.resolve<IInventoryService>(TOKENS.InventoryService);
  const operations = container.resolve<IOperationService>(TOKENS.OperationService);
  const plans = container.resolve<IPlanService>(TOKENS.PlanService);

  if (scopes.includes(MCP_SCOPES.CampaignsWrite)) {
    const campaignCommands = container.resolve<ICampaignCommandService>(
      TOKENS.CampaignCommandService,
    );

    server.registerTool(
      'update_campaign_follow_up',
      {
        title: 'Update campaign follow-up',
        description:
          'Schedules the next follow-up for a campaign. Before calling, read the campaign, tell the user the campaign code, current follow-up, and proposed follow-up, then obtain explicit confirmation. Set confirm to true only after confirmation.',
        inputSchema: {
          campaignId: z.string().min(1).describe('Campaign MongoDB ID'),
          nextFollowUpAt: z
            .string()
            .datetime({ offset: true })
            .describe('Confirmed follow-up date and time in ISO 8601 format'),
          expectedCurrentFollowUpAt: z
            .union([z.string().datetime({ offset: true }), z.null()])
            .describe(
              'Follow-up value most recently read from the campaign, or null when none is scheduled',
            ),
          followUpNote: z.preprocess(
            emptyToUndefined,
            z.string().trim().min(1).max(500).optional(),
          ),
          confirm: z
            .literal(true)
            .describe('Must be true after the user explicitly confirms'),
        },
        annotations: writeAnnotations,
      },
      ({ campaignId, confirm: _confirm, ...input }) =>
        runTool('update_campaign_follow_up', actor, () =>
          campaignCommands.updateFollowUp(campaignId, input, actor),
        ),
    );

    server.registerTool(
      'change_campaign_status',
      {
        title: 'Change campaign status',
        description:
          'Changes a campaign status. Before calling, read the campaign, explain the current and proposed statuses and any reason, then obtain explicit user confirmation. Lost requires a reason. Set confirm to true only after confirmation.',
        inputSchema: {
          campaignId: z.string().min(1).describe('Campaign MongoDB ID'),
          expectedCurrentStatus: z.enum([
            'New',
            'In Discussion',
            'Plan Shared',
            'Negotiating',
            'Won',
            'Lost',
            'On Hold',
          ]),
          newStatus: z.enum([
            'New',
            'In Discussion',
            'Plan Shared',
            'Negotiating',
            'Won',
            'Lost',
            'On Hold',
          ]),
          reason: z.preprocess(
            emptyToUndefined,
            z.string().trim().min(1).max(500).optional(),
          ),
          confirm: z
            .literal(true)
            .describe('Must be true after the user explicitly confirms'),
        },
        annotations: statusWriteAnnotations,
      },
      ({
        campaignId,
        expectedCurrentStatus,
        newStatus,
        reason,
        confirm: _confirm,
      }) =>
        runTool('change_campaign_status', actor, () =>
          campaignCommands.changeStatus(
            campaignId,
            {
              expectedCurrentStatus,
              status: newStatus,
              reason,
            },
            actor,
          ),
        ),
    );
  }

  server.registerTool(
    'get_dashboard_overview',
    {
      title: 'Get dashboard overview',
      description:
        'Returns the current user work queue plus campaign, plan, inventory, operation, and recent activity summaries.',
      annotations: readOnlyAnnotations,
    },
    () =>
      runTool('get_dashboard_overview', actor, () =>
        dashboard.overview(actor.userId),
      ),
  );

  server.registerTool(
    'search_crm_entities',
    {
      title: 'Search CRM entities',
      description:
        'Finds clients, agencies, individuals, and suppliers in CRM using optional filters.',
      inputSchema: {
        search: optionalText.describe('Name, email, phone, or other search text'),
        entityType: optionalText.describe(
          'Brand, Agency, Individual, or SupplierOwner',
        ),
        status: optionalText.describe('active or inactive'),
        city: optionalText,
        tag: optionalText,
        page: optionalPage,
        limit: optionalLimit,
      },
      annotations: readOnlyAnnotations,
    },
    (input) =>
      runTool('search_crm_entities', actor, () =>
        crm.listEntities({
          ...input,
          page: asQuery(input.page),
          limit: asQuery(input.limit),
        } satisfies CrmEntityFiltersDto),
      ),
  );

  server.registerTool(
    'get_crm_entity',
    {
      title: 'Get CRM entity',
      description:
        'Returns one CRM entity with contacts and linked inventory information.',
      inputSchema: {
        id: z.string().min(1).describe('CRM entity MongoDB ID'),
      },
      annotations: readOnlyAnnotations,
    },
    ({ id }) =>
      runTool('get_crm_entity', actor, () => crm.getEntityById(id)),
  );

  server.registerTool(
    'search_inventory',
    {
      title: 'Search inventory',
      description:
        'Searches advertising inventory. For available inventory, set availabilityStatus to available and status to active. Use city for the requested city and categoryGroup for Outdoor, Auto, Bus, or Mobile Van.',
      inputSchema: {
        search: optionalText,
        categoryGroup: z.preprocess(
          emptyToUndefined,
          z.enum(['Outdoor', 'Auto', 'Bus', 'Mobile Van']).optional(),
        ),
        subCategory: optionalText,
        city: optionalText.describe(
          'City name, for example Bangalore or Bengaluru',
        ),
        area: optionalText,
        status: optionalInventoryStatus.describe(
          'Record status. Use active for inventory currently in use.',
        ),
        availabilityStatus: optionalAvailabilityStatus.describe(
          'Commercial availability: available, booked, hold, or unknown.',
        ),
        confirmationStatus: z.preprocess(
          emptyToUndefined,
          z.enum(['fresh', 'stale', 'never_confirmed']).optional(),
        ),
        page: optionalPage,
        limit: optionalLimit,
      },
      annotations: readOnlyAnnotations,
    },
    (input) =>
      runTool('search_inventory', actor, () =>
        inventory.listInventory({
          ...input,
          page: asQuery(input.page),
          limit: asQuery(input.limit),
        } satisfies InventoryFiltersDto),
      ),
  );

  server.registerTool(
    'get_inventory_item',
    {
      title: 'Get inventory item',
      description:
        'Returns complete details for one advertising inventory item.',
      inputSchema: {
        id: z.string().min(1).describe('Inventory MongoDB ID'),
      },
      annotations: readOnlyAnnotations,
    },
    ({ id }) =>
      runTool('get_inventory_item', actor, () =>
        inventory.getInventoryById(id),
      ),
  );

  server.registerTool(
    'search_campaigns',
    {
      title: 'Search campaigns',
      description:
        'Searches campaigns using status, owner, client, priority, category, geography, follow-up, or text filters.',
      inputSchema: {
        search: optionalText,
        status: optionalText,
        client: optionalText.describe('CRM client MongoDB ID'),
        ownerUser: optionalText.describe('Owner user MongoDB ID'),
        clientType: optionalText,
        source: optionalText,
        category: optionalText,
        geo: optionalText,
        priority: optionalText,
        followUpDue: optionalBooleanFilter.describe(
          'Set true to find due follow-ups',
        ),
        page: optionalPage,
        limit: optionalLimit,
      },
      annotations: readOnlyAnnotations,
    },
    (input) =>
      runTool('search_campaigns', actor, () =>
        campaigns.listCampaigns({
          ...input,
          followUpDue: asBooleanQuery(input.followUpDue),
          page: asQuery(input.page),
          limit: asQuery(input.limit),
        } satisfies CampaignFiltersDto),
      ),
  );

  server.registerTool(
    'get_campaign',
    {
      title: 'Get campaign',
      description: 'Returns complete details for one campaign.',
      inputSchema: {
        id: z.string().min(1).describe('Campaign MongoDB ID'),
      },
      annotations: readOnlyAnnotations,
    },
    ({ id }) =>
      runTool('get_campaign', actor, () => campaigns.getCampaignById(id)),
  );

  server.registerTool(
    'list_plans',
    {
      title: 'List plans',
      description:
        'Lists plans for a campaign when campaignId is supplied; otherwise returns the 50 most recently updated plans.',
      inputSchema: {
        campaignId: optionalText.describe('Campaign MongoDB ID'),
      },
      annotations: readOnlyAnnotations,
    },
    ({ campaignId }) =>
      runTool('list_plans', actor, () =>
        campaignId ? plans.listByCampaign(campaignId) : plans.listRecent(),
      ),
  );

  server.registerTool(
    'get_plan',
    {
      title: 'Get plan',
      description:
        'Returns one plan with campaign, inventory items, dates, and pricing.',
      inputSchema: {
        id: z.string().min(1).describe('Plan MongoDB ID'),
      },
      annotations: readOnlyAnnotations,
    },
    ({ id }) => runTool('get_plan', actor, () => plans.getById(id)),
  );

  server.registerTool(
    'search_operations',
    {
      title: 'Search operations',
      description:
        'Searches execution operations by status, location, category, owner, priority, mounting dates, proof state, or overdue state.',
      inputSchema: {
        search: optionalText,
        status: optionalText,
        city: optionalText,
        categoryGroup: optionalText,
        operationOwner: optionalText.describe('Owner user MongoDB ID'),
        priority: optionalText,
        mountingFrom: optionalText.describe('ISO date'),
        mountingTo: optionalText.describe('ISO date'),
        proofPending: optionalBooleanFilter.describe(
          'Set true for pending proof',
        ),
        overdue: optionalBooleanFilter.describe('Set true for overdue work'),
        page: optionalPage,
        limit: optionalLimit,
      },
      annotations: readOnlyAnnotations,
    },
    (input) =>
      runTool('search_operations', actor, () =>
        operations.list({
          ...input,
          proofPending: asBooleanQuery(input.proofPending),
          overdue: asBooleanQuery(input.overdue),
          page: asQuery(input.page),
          limit: asQuery(input.limit),
        } satisfies OperationFilters),
      ),
  );

  server.registerTool(
    'get_operation',
    {
      title: 'Get operation',
      description:
        'Returns one operation with execution items, progress, creative, purchase order, mounting, proof, and takedown state.',
      inputSchema: {
        id: z.string().min(1).describe('Operation MongoDB ID'),
      },
      annotations: readOnlyAnnotations,
    },
    ({ id }) =>
      runTool('get_operation', actor, () => operations.getById(id)),
  );

  server.registerTool(
    'get_recent_activity',
    {
      title: 'Get recent activity',
      description:
        'Returns recent internal activity, optionally filtered by entity type, action, actor, date, or text.',
      inputSchema: {
        entityType: optionalText,
        action: optionalText,
        actor: optionalText.describe('Actor user MongoDB ID'),
        from: optionalText.describe('Start date in YYYY-MM-DD format'),
        to: optionalText.describe('End date in YYYY-MM-DD format'),
        search: optionalText,
        page: optionalPage,
        limit: optionalLimit,
      },
      annotations: readOnlyAnnotations,
    },
    (input) =>
      runTool('get_recent_activity', actor, () =>
        activity.getActivities({
          ...input,
          page: asQuery(input.page),
          limit: asQuery(input.limit),
        }),
      ),
  );

  return server;
};
