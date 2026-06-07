import mongoose, { Schema } from 'mongoose';
import type { HydratedDocument, InferSchemaType } from 'mongoose';

const operationCounterSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    year: { type: Number, required: true },
    sequence: { type: Number, required: true, default: 0 },
  },
  { timestamps: true },
);

export type OperationCounterSchema = InferSchemaType<typeof operationCounterSchema>;
export type OperationCounterDocument = HydratedDocument<OperationCounterSchema>;

export const OperationCounterModel = mongoose.model<OperationCounterSchema>(
  'OperationCounter',
  operationCounterSchema,
);
