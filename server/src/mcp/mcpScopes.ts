export const MCP_SCOPES = {
  PlatformRead: 'platform:read',
  CampaignsWrite: 'campaigns:write',
} as const;

export const supportedMcpScopes = Object.values(MCP_SCOPES);
