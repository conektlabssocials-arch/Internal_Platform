import type { CategoryGroup } from '../models/inventory.model.js';

const categoryCodeMap: Record<CategoryGroup, string> = {
  Outdoor: 'OUT',
  Auto: 'AUTO',
  Bus: 'BUS',
  'Mobile Van': 'MV',
  'A3 Screens': 'A3',
  'Mall / SOH': 'MALL',
};

const cityCodeMap: Record<string, string> = {
  bangalore: 'BLR',
  bengaluru: 'BLR',
  mumbai: 'MUM',
  delhi: 'DEL',
  hyderabad: 'HYD',
  chennai: 'CHE',
  pune: 'PUN',
};

const areaCodeMap: Record<string, string> = {
  ejipura: 'EJP',
  'hsr layout': 'HSR',
  'mg road': 'MGR',
  koramangala: 'KOR',
  'outer ring road': 'ORR',
};

const cleanLetters = (value: string) => value.replace(/[^a-zA-Z]/g, '').toUpperCase();

const getSignificantWords = (value: string) =>
  value
    .trim()
    .split(/\s+/)
    .map((word) => cleanLetters(word))
    .filter(Boolean);

export const getCategoryCode = (categoryGroup: CategoryGroup) => categoryCodeMap[categoryGroup];

export const getCityCode = (city: string) => {
  const normalizedCity = city.trim().toLowerCase();
  return cityCodeMap[normalizedCity] || cleanLetters(city).slice(0, 3).padEnd(3, 'X');
};

export const getAreaCode = (area: string) => {
  const normalizedArea = area.trim().toLowerCase();

  if (areaCodeMap[normalizedArea]) {
    return areaCodeMap[normalizedArea];
  }

  const words = getSignificantWords(area);

  if (words.length >= 3) {
    return words
      .slice(0, 3)
      .map((word) => word[0])
      .join('')
      .padEnd(3, 'X');
  }

  if (words.length === 2) {
    return `${words[0][0]}${words[1].slice(0, 2)}`.padEnd(3, 'X');
  }

  return cleanLetters(area).slice(0, 3).padEnd(3, 'X');
};

export const buildCounterKey = (categoryGroup: CategoryGroup, city: string, area: string) => {
  return `${getCategoryCode(categoryGroup)}-${getCityCode(city)}-${getAreaCode(area)}`;
};

export const formatInventoryCode = (
  categoryGroup: CategoryGroup,
  city: string,
  area: string,
  sequence: number,
) => {
  return `${buildCounterKey(categoryGroup, city, area)}-${sequence.toString().padStart(4, '0')}`;
};
