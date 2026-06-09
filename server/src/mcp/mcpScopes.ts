export const MCP_SCOPES = {
  PlatformRead: 'platform:read',
  CampaignsWrite: 'campaigns:write',
  PlansWrite: 'plans:write',
  OperationsWrite: 'operations:write',
  DocumentsWrite: 'documents:write',
  UploadsWrite: 'uploads:write',
  SharesWrite: 'shares:write',
} as const;

export const supportedMcpScopes = Object.values(MCP_SCOPES);

export const configuredMcpScopes = (
  fallback: readonly string[] = supportedMcpScopes,
) => {
  const configured = process.env.MCP_SHARED_SCOPES
    ?.split(/[\s,]+/)
    .filter(Boolean)
    .filter((scope) => supportedMcpScopes.includes(scope as never));

  return configured?.length ? configured : [...fallback];
};
