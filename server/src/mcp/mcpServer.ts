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
import type { IDocumentService } from '../services/document.service.js';
import type { IDocumentCommandService } from '../services/documentCommand.service.js';
import type { IInventoryService } from '../services/inventory.service.js';
import type {
  IOperationService,
  OperationFilters,
} from '../services/operation.service.js';
import type { IOperationCommandService } from '../services/operationCommand.service.js';
import type { IPlanService } from '../services/plan.service.js';
import type { IPlanCommandService } from '../services/planCommand.service.js';
import type { IProofUploadCommandService } from '../services/proofUploadCommand.service.js';
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

const withDocumentDownloadUrl = <T extends { id: string }>(document: T) => ({
  ...document,
  downloadUrl: `${(process.env.CLIENT_URL || '').replace(/\/+$/, '')}/api/documents/${document.id}/download`,
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
    version: '0.4.0',
  });

  const activity = container.resolve<IActivityService>(TOKENS.ActivityService);
  const campaigns = container.resolve<ICampaignService>(TOKENS.CampaignService);
  const crm = container.resolve<ICrmService>(TOKENS.CrmService);
  const dashboard = container.resolve<IDashboardService>(TOKENS.DashboardService);
  const documents = container.resolve<IDocumentService>(TOKENS.DocumentService);
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

  if (scopes.includes(MCP_SCOPES.PlansWrite)) {
    const planCommands = container.resolve<IPlanCommandService>(
      TOKENS.PlanCommandService,
    );

    server.registerTool(
      'change_plan_status',
      {
        title: 'Change plan status',
        description:
          'Changes a plan status using the platform workflow. Read the plan first, explain the current and proposed statuses and side effects, then obtain explicit confirmation. Marking Won also creates an operation work order.',
        inputSchema: {
          planId: z.string().min(1).describe('Plan MongoDB ID'),
          expectedCurrentStatus: z.enum([
            'Draft',
            'Shared',
            'Negotiating',
            'Won',
            'Lost',
          ]),
          newStatus: z.enum([
            'Draft',
            'Shared',
            'Negotiating',
            'Won',
            'Lost',
          ]),
          confirm: z
            .literal(true)
            .describe('Must be true after the user explicitly confirms'),
        },
        annotations: statusWriteAnnotations,
      },
      ({ planId, expectedCurrentStatus, newStatus, confirm: _confirm }) =>
        runTool('change_plan_status', actor, () =>
          planCommands.changeStatus(
            planId,
            {
              expectedCurrentStatus,
              status: newStatus,
            },
            actor,
          ),
        ),
    );
  }

  if (scopes.includes(MCP_SCOPES.OperationsWrite)) {
    const operationCommands = container.resolve<IOperationCommandService>(
      TOKENS.OperationCommandService,
    );
    const operationStatuses = [
      'Pending',
      'In Progress',
      'Partially Mounted',
      'Mounted',
      'Proof Pending',
      'Completed',
      'On Hold',
      'Cancelled',
    ] as const;
    const operationItemStatuses = [
      'Pending',
      'Creative Pending',
      'PO Pending',
      'Mounting Scheduled',
      'Mounted',
      'Proof Uploaded',
      'Completed',
      'On Hold',
      'Cancelled',
    ] as const;
    const expectedUpdatedAt = z
      .string()
      .datetime({ offset: true })
      .describe('Operation updatedAt value from the most recent get_operation call');
    const confirmed = z
      .literal(true)
      .describe('Must be true after the user explicitly confirms');
    const optionalNote = z.preprocess(
      emptyToUndefined,
      z.string().trim().min(1).max(1000).optional(),
    );
    const optionalUrls = z.preprocess(
      (value) => (value === null ? undefined : value),
      z.array(z.string().url()).max(20).optional(),
    );

    server.registerTool(
      'change_operation_status',
      {
        title: 'Change operation status',
        description:
          'Changes an operation status. Read the operation first, explain the current and proposed statuses, then obtain explicit confirmation. Only admins can cancel operations.',
        inputSchema: {
          operationId: z.string().min(1),
          expectedCurrentStatus: z.enum(operationStatuses),
          expectedUpdatedAt,
          newStatus: z.enum(operationStatuses),
          confirm: confirmed,
        },
        annotations: statusWriteAnnotations,
      },
      ({
        operationId,
        expectedCurrentStatus,
        expectedUpdatedAt: lastReadAt,
        newStatus,
        confirm: _confirm,
      }) =>
        runTool('change_operation_status', actor, () =>
          operationCommands.changeStatus(
            operationId,
            {
              expectedCurrentStatus,
              expectedUpdatedAt: lastReadAt,
              status: newStatus,
            },
            actor,
          ),
        ),
    );

    server.registerTool(
      'update_operation_item_status',
      {
        title: 'Update operation item status',
        description:
          'Updates one operation item status and optional notes. Read the operation first and confirm the item and proposed status with the user.',
        inputSchema: {
          operationId: z.string().min(1),
          itemId: z.string().min(1),
          expectedUpdatedAt,
          newItemStatus: z.enum(operationItemStatuses),
          notes: optionalNote,
          confirm: confirmed,
        },
        annotations: statusWriteAnnotations,
      },
      ({
        operationId,
        itemId,
        expectedUpdatedAt: lastReadAt,
        newItemStatus,
        notes,
        confirm: _confirm,
      }) =>
        runTool('update_operation_item_status', actor, () =>
          operationCommands.updateItem(
            operationId,
            itemId,
            'item',
            {
              expectedUpdatedAt: lastReadAt,
              mutation: { itemStatus: newItemStatus, notes },
            },
            actor,
          ),
        ),
    );

    server.registerTool(
      'update_operation_creative',
      {
        title: 'Update operation creative',
        description:
          'Marks creative received or not received for one operation item, with optional file URLs and notes. Read and confirm the item first.',
        inputSchema: {
          operationId: z.string().min(1),
          itemId: z.string().min(1),
          expectedUpdatedAt,
          received: z.boolean(),
          fileUrls: optionalUrls,
          notes: optionalNote,
          confirm: confirmed,
        },
        annotations: statusWriteAnnotations,
      },
      ({
        operationId,
        itemId,
        expectedUpdatedAt: lastReadAt,
        received,
        fileUrls,
        notes,
        confirm: _confirm,
      }) =>
        runTool('update_operation_creative', actor, () =>
          operationCommands.updateItem(
            operationId,
            itemId,
            'creative',
            {
              expectedUpdatedAt: lastReadAt,
              mutation: { received, fileUrls, notes },
            },
            actor,
          ),
        ),
    );

    server.registerTool(
      'update_operation_purchase_order',
      {
        title: 'Update operation purchase order',
        description:
          'Marks a purchase order sent or not sent for one operation item and records its number, file URL, or notes. Read and confirm the item first.',
        inputSchema: {
          operationId: z.string().min(1),
          itemId: z.string().min(1),
          expectedUpdatedAt,
          sent: z.boolean(),
          poNumber: optionalText,
          poFileUrl: z.preprocess(
            emptyToUndefined,
            z.string().url().optional(),
          ),
          notes: optionalNote,
          confirm: confirmed,
        },
        annotations: statusWriteAnnotations,
      },
      ({
        operationId,
        itemId,
        expectedUpdatedAt: lastReadAt,
        sent,
        poNumber,
        poFileUrl,
        notes,
        confirm: _confirm,
      }) =>
        runTool('update_operation_purchase_order', actor, () =>
          operationCommands.updateItem(
            operationId,
            itemId,
            'purchaseOrder',
            {
              expectedUpdatedAt: lastReadAt,
              mutation: { sent, poNumber, poFileUrl, notes },
            },
            actor,
          ),
        ),
    );

    server.registerTool(
      'update_operation_mounting',
      {
        title: 'Update operation mounting',
        description:
          'Updates mounting schedule or completion for one operation item. Read the operation first and confirm the item, date, and completion state.',
        inputSchema: {
          operationId: z.string().min(1),
          itemId: z.string().min(1),
          expectedUpdatedAt,
          scheduledDate: z.preprocess(
            emptyToUndefined,
            z.string().datetime({ offset: true }).optional(),
          ),
          completed: z.boolean(),
          vendorNotes: optionalNote,
          internalNotes: optionalNote,
          confirm: confirmed,
        },
        annotations: statusWriteAnnotations,
      },
      ({
        operationId,
        itemId,
        expectedUpdatedAt: lastReadAt,
        scheduledDate,
        completed,
        vendorNotes,
        internalNotes,
        confirm: _confirm,
      }) =>
        runTool('update_operation_mounting', actor, () =>
          operationCommands.updateItem(
            operationId,
            itemId,
            'mounting',
            {
              expectedUpdatedAt: lastReadAt,
              mutation: {
                scheduledDate,
                completed,
                vendorNotes,
                internalNotes,
              },
            },
            actor,
          ),
        ),
    );

    server.registerTool(
      'update_operation_proof',
      {
        title: 'Update operation proof',
        description:
          'Marks execution proof uploaded or not uploaded and records existing photo URLs or notes for one operation item. This tool does not upload files. Read and confirm first.',
        inputSchema: {
          operationId: z.string().min(1),
          itemId: z.string().min(1),
          expectedUpdatedAt,
          uploaded: z.boolean(),
          photoUrls: optionalUrls,
          notes: optionalNote,
          confirm: confirmed,
        },
        annotations: statusWriteAnnotations,
      },
      ({
        operationId,
        itemId,
        expectedUpdatedAt: lastReadAt,
        uploaded,
        photoUrls,
        notes,
        confirm: _confirm,
      }) =>
        runTool('update_operation_proof', actor, () =>
          operationCommands.updateItem(
            operationId,
            itemId,
            'proof',
            {
              expectedUpdatedAt: lastReadAt,
              mutation: { uploaded, photoUrls, notes },
            },
            actor,
          ),
        ),
    );

    server.registerTool(
      'update_operation_takedown',
      {
        title: 'Update operation takedown',
        description:
          'Updates takedown schedule or completion for one operation item. Read the operation first and confirm the item, date, and completion state.',
        inputSchema: {
          operationId: z.string().min(1),
          itemId: z.string().min(1),
          expectedUpdatedAt,
          scheduledDate: z.preprocess(
            emptyToUndefined,
            z.string().datetime({ offset: true }).optional(),
          ),
          completed: z.boolean(),
          notes: optionalNote,
          confirm: confirmed,
        },
        annotations: statusWriteAnnotations,
      },
      ({
        operationId,
        itemId,
        expectedUpdatedAt: lastReadAt,
        scheduledDate,
        completed,
        notes,
        confirm: _confirm,
      }) =>
        runTool('update_operation_takedown', actor, () =>
          operationCommands.updateItem(
            operationId,
            itemId,
            'takedown',
            {
              expectedUpdatedAt: lastReadAt,
              mutation: { scheduledDate, completed, notes },
            },
            actor,
          ),
        ),
    );
  }

  if (scopes.includes(MCP_SCOPES.DocumentsWrite)) {
    const documentCommands = container.resolve<IDocumentCommandService>(
      TOKENS.DocumentCommandService,
    );
    const planDocumentTypes =
      actor.role === 'admin'
        ? (['PlanProposal', 'Quotation', 'InternalCostSheet'] as const)
        : (['PlanProposal', 'Quotation'] as const);

    server.registerTool(
      'generate_plan_document',
      {
        title: 'Generate plan document',
        description:
          'Generates a PDF from the latest saved plan. Read the plan first, explain the document audience and contents, then obtain explicit confirmation. Internal Cost Sheet contains cost and margin and is admin-only.',
        inputSchema: {
          planId: z.string().min(1),
          expectedUpdatedAt: z
            .string()
            .datetime({ offset: true })
            .describe('Plan updatedAt value from the most recent get_plan call'),
          documentType: z.enum(planDocumentTypes),
          confirm: z
            .literal(true)
            .describe('Must be true after the user explicitly confirms'),
        },
        annotations: statusWriteAnnotations,
      },
      ({ planId, expectedUpdatedAt, documentType, confirm: _confirm }) =>
        runTool('generate_plan_document', actor, async () =>
          withDocumentDownloadUrl(
            await documentCommands.generatePlanDocument(
              planId,
              { expectedUpdatedAt, documentType },
              actor,
            ),
          ),
        ),
    );

    server.registerTool(
      'generate_operation_document',
      {
        title: 'Generate operation document',
        description:
          'Generates a Work Order, Purchase Order, or Execution Report PDF from the latest operation. Read the operation, explain the audience and any partial-report warning, then obtain explicit confirmation.',
        inputSchema: {
          operationId: z.string().min(1),
          expectedUpdatedAt: z
            .string()
            .datetime({ offset: true })
            .describe(
              'Operation updatedAt value from the most recent get_operation call',
            ),
          documentType: z.enum([
            'WorkOrder',
            'PurchaseOrder',
            'ExecutionReport',
          ]),
          confirm: z
            .literal(true)
            .describe('Must be true after the user explicitly confirms'),
        },
        annotations: statusWriteAnnotations,
      },
      ({
        operationId,
        expectedUpdatedAt,
        documentType,
        confirm: _confirm,
      }) =>
        runTool('generate_operation_document', actor, async () =>
          withDocumentDownloadUrl(
            await documentCommands.generateOperationDocument(
              operationId,
              { expectedUpdatedAt, documentType },
              actor,
            ),
          ),
        ),
    );
  }

  if (
    scopes.includes(MCP_SCOPES.UploadsWrite) &&
    scopes.includes(MCP_SCOPES.OperationsWrite)
  ) {
    const proofUploads = container.resolve<IProofUploadCommandService>(
      TOKENS.ProofUploadCommandService,
    );

    server.registerTool(
      'upload_operation_proof_image',
      {
        title: 'Upload operation proof image',
        description:
          'Uploads one JPEG, PNG, or WebP proof image to Cloudinary and attaches it to one operation item. Read the operation first, identify the exact item, explain the file and current proof state, then obtain explicit confirmation. Maximum raw image size is 6 MB.',
        inputSchema: {
          operationId: z.string().min(1),
          itemId: z.string().min(1),
          expectedUpdatedAt: z
            .string()
            .datetime({ offset: true })
            .describe(
              'Operation updatedAt value from the most recent get_operation call',
            ),
          fileName: z.string().trim().min(1).max(180),
          mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
          base64Data: z
            .string()
            .min(4)
            .max(8_500_000)
            .describe('Base64-encoded image bytes, without markdown'),
          notes: z.preprocess(
            emptyToUndefined,
            z.string().trim().min(1).max(1000).optional(),
          ),
          confirm: z
            .literal(true)
            .describe('Must be true after the user explicitly confirms'),
        },
        annotations: statusWriteAnnotations,
      },
      ({
        operationId,
        itemId,
        expectedUpdatedAt,
        fileName,
        mimeType,
        base64Data,
        notes,
        confirm: _confirm,
      }) =>
        runTool('upload_operation_proof_image', actor, () =>
          proofUploads.uploadAndAttach(
            operationId,
            itemId,
            {
              expectedUpdatedAt,
              fileName,
              mimeType,
              base64Data,
              notes,
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

  server.registerTool(
    'list_plan_documents',
    {
      title: 'List plan documents',
      description:
        'Lists PDFs previously generated for a plan, including a same-origin authenticated download URL.',
      inputSchema: {
        planId: z.string().min(1),
      },
      annotations: readOnlyAnnotations,
    },
    ({ planId }) =>
      runTool('list_plan_documents', actor, async () =>
        (await documents.listByPlan(planId)).map((document) =>
          withDocumentDownloadUrl(document as { id: string }),
        ),
      ),
  );

  server.registerTool(
    'list_operation_documents',
    {
      title: 'List operation documents',
      description:
        'Lists PDFs previously generated for an operation, including a same-origin authenticated download URL.',
      inputSchema: {
        operationId: z.string().min(1),
      },
      annotations: readOnlyAnnotations,
    },
    ({ operationId }) =>
      runTool('list_operation_documents', actor, async () =>
        (await documents.listByOperation(operationId)).map((document) =>
          withDocumentDownloadUrl(document as { id: string }),
        ),
      ),
  );

  return server;
};
