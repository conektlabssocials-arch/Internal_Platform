import mongoose, { Schema } from 'mongoose';
import type { HydratedDocument, InferSchemaType } from 'mongoose';

export const operationStatuses = [
  'Pending',
  'In Progress',
  'Partially Mounted',
  'Mounted',
  'Proof Pending',
  'Completed',
  'On Hold',
  'Cancelled',
] as const;
export const operationPriorities = ['Low', 'Medium', 'High'] as const;
export const operationItemStatuses = [
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

const locationSchema = new Schema(
  {
    address: String,
    latitude: Number,
    longitude: Number,
  },
  { _id: false },
);

const creativeSchema = new Schema(
  {
    required: { type: Boolean, default: true },
    received: { type: Boolean, default: false },
    receivedAt: Date,
    fileUrls: { type: [String], default: [] },
    fileUploads: {
      type: [{ type: Schema.Types.ObjectId, ref: 'Upload' }],
      default: [],
    },
    notes: String,
  },
  { _id: false },
);

const purchaseOrderSchema = new Schema(
  {
    required: { type: Boolean, default: true },
    sent: { type: Boolean, default: false },
    sentAt: Date,
    poNumber: String,
    poFileUrl: String,
    fileUploads: {
      type: [{ type: Schema.Types.ObjectId, ref: 'Upload' }],
      default: [],
    },
    notes: String,
  },
  { _id: false },
);

const mountingSchema = new Schema(
  {
    scheduledDate: Date,
    completed: { type: Boolean, default: false },
    completedAt: Date,
    vendorNotes: String,
    internalNotes: String,
  },
  { _id: false },
);

const proofSchema = new Schema(
  {
    uploaded: { type: Boolean, default: false },
    uploadedAt: Date,
    photoUrls: { type: [String], default: [] },
    fileUploads: {
      type: [{ type: Schema.Types.ObjectId, ref: 'Upload' }],
      default: [],
    },
    notes: String,
  },
  { _id: false },
);

const takedownSchema = new Schema(
  {
    required: { type: Boolean, default: false },
    scheduledDate: Date,
    completed: { type: Boolean, default: false },
    completedAt: Date,
    notes: String,
  },
  { _id: false },
);

const operationItemSchema = new Schema({
  planItemId: { type: String, required: true },
  inventory: { type: Schema.Types.ObjectId, ref: 'Inventory' },
  inventoryCode: String,
  title: String,
  categoryGroup: String,
  subCategory: String,
  city: String,
  area: String,
  location: locationSchema,
  route: String,
  depot: String,
  itinerary: String,
  width: Number,
  height: Number,
  totalSqFt: Number,
  campaignStartDate: Date,
  campaignEndDate: Date,
  unitSellingPrice: Number,
  totalSellingPrice: Number,
  unitInternalCost: Number,
  totalInternalCost: Number,
  supplierName: String,
  ownerName: String,
  supplierEntity: { type: Schema.Types.ObjectId, ref: 'CrmEntity' },
  ownerEntity: { type: Schema.Types.ObjectId, ref: 'CrmEntity' },
  creative: { type: creativeSchema, default: () => ({}) },
  purchaseOrder: { type: purchaseOrderSchema, default: () => ({}) },
  mounting: { type: mountingSchema, default: () => ({}) },
  proof: { type: proofSchema, default: () => ({}) },
  takedown: { type: takedownSchema, default: () => ({}) },
  itemStatus: { type: String, enum: operationItemStatuses, default: 'Creative Pending' },
  notes: String,
});

const overallProgressSchema = new Schema(
  {
    totalItems: { type: Number, default: 0 },
    creativeReceivedCount: { type: Number, default: 0 },
    poSentCount: { type: Number, default: 0 },
    mountingCompletedCount: { type: Number, default: 0 },
    proofUploadedCount: { type: Number, default: 0 },
    completedItemCount: { type: Number, default: 0 },
    percentage: { type: Number, default: 0 },
  },
  { _id: false },
);

const importantDatesSchema = new Schema(
  {
    firstMountingDate: Date,
    lastMountingDate: Date,
    firstTakedownDate: Date,
    lastTakedownDate: Date,
  },
  { _id: false },
);

const operationSchema = new Schema(
  {
    operationCode: { type: String, unique: true, required: true, trim: true },
    campaign: { type: Schema.Types.ObjectId, ref: 'Campaign', required: true },
    plan: { type: Schema.Types.ObjectId, ref: 'Plan', required: true, unique: true },
    client: { type: Schema.Types.ObjectId, ref: 'CrmEntity' },
    planVersionLabel: String,
    campaignCode: String,
    campaignTitle: String,
    clientName: String,
    operationOwner: { type: Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: operationStatuses, default: 'Pending' },
    priority: { type: String, enum: operationPriorities, default: 'Medium' },
    items: { type: [operationItemSchema], default: [] },
    overallProgress: { type: overallProgressSchema, default: () => ({}) },
    importantDates: { type: importantDatesSchema, default: () => ({}) },
    notes: String,
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

operationSchema.index({ status: 1, createdAt: -1 });
operationSchema.index({ operationOwner: 1, priority: 1 });
operationSchema.index({ 'items.city': 1, 'items.categoryGroup': 1 });

export type OperationStatus = (typeof operationStatuses)[number];
export type OperationPriority = (typeof operationPriorities)[number];
export type OperationItemStatus = (typeof operationItemStatuses)[number];
export type OperationSchema = InferSchemaType<typeof operationSchema>;
export type OperationDocument = HydratedDocument<OperationSchema>;

export const OperationModel = mongoose.model<OperationSchema>('Operation', operationSchema);
