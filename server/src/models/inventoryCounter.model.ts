import mongoose, { Schema } from 'mongoose';
import type { HydratedDocument, InferSchemaType } from 'mongoose';

const inventoryCounterSchema = new Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
    },
    cityCode: {
      type: String,
      required: true,
      trim: true,
    },
    areaCode: {
      type: String,
      required: true,
      trim: true,
    },
    sequence: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

export type InventoryCounterSchema = InferSchemaType<typeof inventoryCounterSchema>;
export type InventoryCounterDocument = HydratedDocument<InventoryCounterSchema>;

export const InventoryCounterModel = mongoose.model<InventoryCounterSchema>(
  'InventoryCounter',
  inventoryCounterSchema,
);
