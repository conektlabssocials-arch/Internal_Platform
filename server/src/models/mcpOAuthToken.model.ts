import mongoose, { Schema } from 'mongoose';

const mcpOAuthTokenSchema = new Schema(
  {
    tokenHash: { type: String, required: true, unique: true, index: true },
    tokenType: {
      type: String,
      enum: ['access', 'refresh'],
      required: true,
      index: true,
    },
    clientId: { type: String, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    scopes: [{ type: String }],
    resource: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    revokedAt: { type: Date },
  },
  { timestamps: true },
);

export const McpOAuthTokenModel = mongoose.model(
  'McpOAuthToken',
  mcpOAuthTokenSchema,
);
