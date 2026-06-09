import mongoose, { Schema } from 'mongoose';

const mcpOAuthClientSchema = new Schema(
  {
    clientId: { type: String, required: true, unique: true, index: true },
    client: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true },
);

export const McpOAuthClientModel = mongoose.model(
  'McpOAuthClient',
  mcpOAuthClientSchema,
);
