import type { CategoryGroup } from '../types/inventory';

export const INVENTORY_CATEGORIES: Record<CategoryGroup, string[]> = {
  Outdoor: ['Bus Shelter', 'Hoarding', 'Digital OOH', 'Digital Bus Shelter'],
  Auto: ['Auto Hood', 'Auto Back Panel'],
  Bus: ['Bus Panel', 'Combo Panel', 'Full Bus Interior', 'Full Bus Exterior'],
  'Mobile Van': ['Hoarding', 'Van LED Screen', '3D Digital Screen'],
  'A3 Screens': ['Corporate', 'Residential'],
  'Mall / SOH': ['Mall Façade Signage', 'Mall Lobby Signage', 'Mall Standee'],
};

export const INVENTORY_CATEGORY_DESCRIPTIONS: Record<CategoryGroup, string> = {
  Outdoor: 'Fixed outdoor media like hoardings, bus shelters and digital OOH.',
  Auto: 'Auto-rickshaw branding inventory like hood and back panel.',
  Bus: 'Bus branding inventory including panels, interiors and exteriors.',
  'Mobile Van': 'Mobile activation media including van hoardings and LED screens.',
  'A3 Screens': 'Corporate and residential property screen networks with audience, reach, and monthly pricing data.',
  'Mall / SOH': 'In-mall branding (Space on Hire) like façade signage, lift-lobby panels and standees.',
};

export const INVENTORY_CATEGORY_GROUPS = Object.keys(INVENTORY_CATEGORIES) as CategoryGroup[];
