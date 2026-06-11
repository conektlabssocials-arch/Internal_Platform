import type { ImportType } from '../models/importJob.model.js';

export type ImportTemplate = {
  name: string;
  fileName: string;
  importType: ImportType;
  description: string;
  fields: string[];
  example: Record<string, string | number | boolean>;
};

const commonInventoryFields = [
  'categoryGroup',
  'subCategory',
  'title',
  'city',
  'area',
  'width',
  'height',
  'ownerName',
  'ownerPhone',
  'supplierName',
  'internalCost',
  'sellingPrice',
  'minSpend',
  'minDurationDays',
  'availabilityStatus',
];

const commonInventoryTail = ['tags', 'internalNotes'];

export const IMPORT_TEMPLATES: ImportTemplate[] = [
  {
    name: 'inventory_outdoor',
    fileName: 'inventory_outdoor_template.csv',
    importType: 'inventory',
    description: 'Outdoor inventory import template',
    fields: [
      'categoryGroup', 'subCategory', 'title', 'city', 'area', 'address',
      'latitude', 'longitude', 'width', 'height', 'ownerName', 'ownerPhone',
      'supplierName', 'internalCost', 'sellingPrice', 'minSpend',
      'minDurationDays', 'availabilityStatus', 'illumination', 'facingDirection',
      'trafficDirection', 'estimatedTraffic', 'loopLengthSeconds', 'spotsPerHour',
      'screenSpecs', ...commonInventoryTail,
    ],
    example: {
      categoryGroup: 'Outdoor',
      subCategory: 'Hoarding',
      title: 'Koramangala Sony World Junction Hoarding',
      city: 'Bangalore',
      area: 'Koramangala',
      address: 'Sony World Junction, Koramangala, Bangalore',
      latitude: 12.9352,
      longitude: 77.6245,
      width: 20,
      height: 10,
      availabilityStatus: 'available',
      tags: 'premium,junction',
    },
  },
  {
    name: 'inventory_auto',
    fileName: 'inventory_auto_template.csv',
    importType: 'inventory',
    description: 'Auto inventory import template',
    fields: [
      ...commonInventoryFields, 'numberOfVehicles', 'route', 'brandingType',
      'ratePerVehiclePerMonth', 'operatorName', ...commonInventoryTail,
    ],
    example: {
      categoryGroup: 'Auto',
      subCategory: 'Auto Back Panel',
      title: 'HSR Auto Back Panel Package',
      city: 'Bangalore',
      area: 'HSR Layout',
      width: 3,
      height: 2,
      numberOfVehicles: 50,
      route: 'HSR Layout, BTM, Koramangala',
      availabilityStatus: 'available',
    },
  },
  {
    name: 'inventory_bus',
    fileName: 'inventory_bus_template.csv',
    importType: 'inventory',
    description: 'Bus inventory import template',
    fields: [
      ...commonInventoryFields, 'numberOfVehicles', 'route', 'depot',
      'brandingType', 'ratePerVehiclePerMonth', 'operatorName',
      ...commonInventoryTail,
    ],
    example: {
      categoryGroup: 'Bus',
      subCategory: 'Bus Panel',
      title: 'BMTC Koramangala Bus Panel Package',
      city: 'Bangalore',
      area: 'Koramangala',
      width: 8,
      height: 3,
      numberOfVehicles: 20,
      route: 'Koramangala to Majestic',
      depot: 'Depot 4',
      availabilityStatus: 'available',
    },
  },
  {
    name: 'inventory_mobile_van',
    fileName: 'inventory_mobile_van_template.csv',
    importType: 'inventory',
    description: 'Mobile Van inventory import template',
    fields: [
      ...commonInventoryFields, 'itinerary', 'operationDays', 'hasLedScreen',
      'hasAudioSystem', 'hasCanopy', 'ratePerDay', ...commonInventoryTail,
    ],
    example: {
      categoryGroup: 'Mobile Van',
      subCategory: 'Van LED Screen',
      title: 'Bangalore Central LED Van',
      city: 'Bangalore',
      area: 'Central Bangalore',
      width: 12,
      height: 6,
      itinerary: 'MG Road, Brigade Road, Indiranagar',
      operationDays: 7,
      hasLedScreen: true,
      availabilityStatus: 'available',
    },
  },
  {
    name: 'crm_entities',
    fileName: 'crm_entities_template.csv',
    importType: 'crm_entities',
    description: 'CRM clients, agencies, individuals, and suppliers',
    fields: [
      'entityType', 'name', 'displayName', 'email', 'phone', 'whatsapp',
      'website', 'gstNumber', 'panNumber', 'addressLine1', 'addressLine2',
      'city', 'state', 'pincode', 'country', 'billingLegalName',
      'billingGstNumber', 'billingEmail', 'billingPhone', 'billingAddress',
      'tags', 'notes',
    ],
    example: {
      entityType: 'Brand',
      name: 'Example Brand India',
      displayName: 'Example Brand',
      email: 'marketing@example.com',
      phone: '9876543210',
      city: 'Bangalore',
      state: 'Karnataka',
      country: 'India',
      tags: 'retail,priority',
    },
  },
  {
    name: 'contacts',
    fileName: 'contacts_template.csv',
    importType: 'contacts',
    description: 'Contacts linked to existing CRM entities',
    fields: [
      'crmEntityName', 'crmEntityEmail', 'contactName', 'role', 'phone',
      'email', 'whatsapp', 'isPrimary', 'notes',
    ],
    example: {
      crmEntityName: 'Example Brand India',
      crmEntityEmail: 'marketing@example.com',
      contactName: 'Rahul Sharma',
      role: 'Marketing Manager',
      phone: '9876543210',
      email: 'rahul@example.com',
      isPrimary: true,
    },
  },
];

export const INVENTORY_SUBCATEGORIES: Record<string, readonly string[]> = {
  Outdoor: ['Bus Shelter', 'Hoarding', 'Digital OOH', 'Digital Bus Shelter'],
  Auto: ['Auto Hood', 'Auto Back Panel'],
  Bus: ['Bus Panel', 'Combo Panel', 'Full Bus Interior', 'Full Bus Exterior'],
  'Mobile Van': ['Hoarding', 'Van LED Screen', '3D Digital Screen'],
};

export const getImportTemplate = (name: string) =>
  IMPORT_TEMPLATES.find((template) => template.name === name);
