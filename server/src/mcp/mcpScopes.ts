export const MCP_SCOPES = {
  PlatformRead: 'platform:read',
  CampaignsWrite: 'campaigns:write',
  PlansWrite: 'plans:write',
  OperationsWrite: 'operations:write',
} as const;

export const supportedMcpScopes = Object.values(MCP_SCOPES);
