import mongoose, { Schema } from 'mongoose';

const mcpOAuthAuthorizationSchema = new Schema(
  {
    upstreamStateHash: { type: String, required: true, unique: true, index: true },
    clientId: { type: String, required: true, index: true },
    redirectUri: { type: String, required: true },
    requestedState: { type: String },
    scopes: [{ type: String }],
    codeChallenge: { type: String, required: true },
    resource: { type: String, required: true },
    authorizationCodeHash: { type: String, sparse: true, unique: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    usedAt: { type: Date },
  },
  { timestamps: true },
);

export const McpOAuthAuthorizationModel = mongoose.model(
  'McpOAuthAuthorization',
  mcpOAuthAuthorizationSchema,
);
