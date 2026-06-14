import mongoose, { Schema } from 'mongoose';
import type { HydratedDocument, InferSchemaType } from 'mongoose';

export const categoryGroups = ['Outdoor', 'Auto', 'Bus', 'Mobile Van', 'A3 Screens'] as const;
export const inventorySubCategories = [
  'Bus Shelter',
  'Hoarding',
  'Digital OOH',
  'Digital Bus Shelter',
  'Auto Hood',
  'Auto Back Panel',
  'Bus Panel',
  'Combo Panel',
  'Full Bus Interior',
  'Full Bus Exterior',
  'Van LED Screen',
  '3D Digital Screen',
  'Corporate',
  'Residential',
  'Residential Screen',
] as const;
export const inventorySubCategoriesByGroup = {
  Outdoor: ['Bus Shelter', 'Hoarding', 'Digital OOH', 'Digital Bus Shelter'],
  Auto: ['Auto Hood', 'Auto Back Panel'],
  Bus: ['Bus Panel', 'Combo Panel', 'Full Bus Interior', 'Full Bus Exterior'],
  'Mobile Van': ['Hoarding', 'Van LED Screen', '3D Digital Screen'],
  'A3 Screens': ['Corporate', 'Residential'],
} as const;
export const availabilityStatuses = ['available', 'booked', 'hold', 'unknown'] as const;
export const inventoryStatuses = ['active', 'inactive'] as const;
export const confirmationStatuses = ['fresh', 'stale', 'never_confirmed'] as const;
export const illuminationTypes = ['Lit', 'Non-lit', 'Backlit', 'Frontlit', 'NA'] as const;

const locationSchema = new Schema(
  {
    latitude: Number,
    longitude: Number,
    address: {
      type: String,
      trim: true,
    },
    source: {
      type: String,
      enum: ['manual', 'map_picker', 'reverse_geocode'],
      default: 'manual',
    },
  },
  { _id: false },
);

const inventorySchema = new Schema(
  {
    inventoryCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    categoryGroup: {
      type: String,
      enum: categoryGroups,
      required: true,
    },
    subCategory: {
      type: String,
      enum: inventorySubCategories,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      trim: true,
    },
    subType: {
      type: String,
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    city: {
      type: String,
      required: true,
      trim: true,
    },
    area: {
      type: String,
      required: true,
      trim: true,
    },
    location: locationSchema,
    photos: {
      type: [String],
      default: [],
    },
    photoUploads: {
      type: [{ type: Schema.Types.ObjectId, ref: 'Upload' }],
      default: [],
    },
    ownerName: {
      type: String,
      trim: true,
    },
    ownerPhone: {
      type: String,
      trim: true,
    },
    supplierName: {
      type: String,
      trim: true,
    },
    ownerEntity: {
      type: Schema.Types.ObjectId,
      ref: 'CrmEntity',
    },
    supplierEntity: {
      type: Schema.Types.ObjectId,
      ref: 'CrmEntity',
    },
    internalCost: Number,
    sellingPrice: Number,
    minSpend: Number,
    minDurationDays: Number,
    availabilityStatus: {
      type: String,
      enum: availabilityStatuses,
      default: 'unknown',
    },
    status: {
      type: String,
      enum: inventoryStatuses,
      default: 'active',
    },
    tags: {
      type: [String],
      default: [],
    },
    internalNotes: {
      type: String,
      trim: true,
    },
    lastConfirmedAt: Date,
    confirmedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    confirmationNote: {
      type: String,
      trim: true,
    },
    confirmationStatus: {
      type: String,
      enum: confirmationStatuses,
      default: 'never_confirmed',
    },
    width: Number,
    height: Number,
    totalSqFt: Number,
    illumination: {
      type: String,
      enum: illuminationTypes,
    },
    facingDirection: {
      type: String,
      trim: true,
    },
    trafficDirection: {
      type: String,
      trim: true,
    },
    estimatedTraffic: {
      type: String,
      trim: true,
    },
    loopLengthSeconds: Number,
    spotsPerHour: Number,
    screenSpecs: {
      type: String,
      trim: true,
    },
    numberOfVehicles: Number,
    route: {
      type: String,
      trim: true,
    },
    depot: {
      type: String,
      trim: true,
    },
    brandingType: {
      type: String,
      trim: true,
    },
    ratePerVehiclePerMonth: Number,
    operatorName: {
      type: String,
      trim: true,
    },
    itinerary: {
      type: String,
      trim: true,
    },
    operationDays: Number,
    hasLedScreen: Boolean,
    hasAudioSystem: Boolean,
    hasCanopy: Boolean,
    ratePerDay: Number,
    propertyName: {
      type: String,
      trim: true,
    },
    phase: {
      type: String,
      trim: true,
    },
    profile: {
      type: String,
      trim: true,
    },
    pinCode: {
      type: String,
      trim: true,
    },
    propertyPriceUptoCr: Number,
    screenSize: {
      type: String,
      trim: true,
    },
    propertyVisualLink: {
      type: String,
      trim: true,
    },
    numberOfScreens: Number,
    households: Number,
    approxReach: Number,
    monthlyImpressions: Number,
    monthlyAdBudget: Number,
    discountedMonthlyAdBudget: Number,
    mediaSiteId: {
      type: String,
      trim: true,
    },
    buildingAge: Number,
    propertyType: {
      type: String,
      trim: true,
    },
    nccsClass: {
      type: String,
      trim: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  },
);

inventorySchema.pre('save', function calculateTotalSqFt(next) {
  if (this.width && this.height) {
    this.totalSqFt = this.width * this.height;
  }

  next();
});

export type CategoryGroup = (typeof categoryGroups)[number];
export type InventorySubCategory = (typeof inventorySubCategories)[number];
export type AvailabilityStatus = (typeof availabilityStatuses)[number];
export type InventoryStatus = (typeof inventoryStatuses)[number];
export type ConfirmationStatus = (typeof confirmationStatuses)[number];
export type IlluminationType = (typeof illuminationTypes)[number];
export type InventorySchema = InferSchemaType<typeof inventorySchema>;
export type InventoryDocument = HydratedDocument<InventorySchema>;

export const InventoryModel = mongoose.model<InventorySchema>('Inventory', inventorySchema);
