import { injectable } from 'tsyringe';

export type ReverseGeocodeResult = {
  address?: string;
  city?: string;
  area?: string;
  raw?: unknown;
};

export interface IGeocodingService {
  reverseGeocode(latitude: number, longitude: number): Promise<ReverseGeocodeResult>;
}

const getProvider = () => (process.env.GEOCODING_PROVIDER || 'nominatim').toLowerCase();

const getAddressPart = (address: Record<string, string | undefined>, keys: string[]) => {
  for (const key of keys) {
    if (address[key]) {
      return address[key];
    }
  }

  return undefined;
};

@injectable()
export class GeocodingService implements IGeocodingService {
  async reverseGeocode(latitude: number, longitude: number) {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw new Error('Latitude and longitude must be valid numbers');
    }

    try {
      if (getProvider() === 'mapbox') {
        return this.reverseWithMapbox(latitude, longitude);
      }

      return this.reverseWithNominatim(latitude, longitude);
    } catch {
      return {};
    }
  }

  private async reverseWithNominatim(latitude: number, longitude: number) {
    const url = new URL('https://nominatim.openstreetmap.org/reverse');
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('lat', String(latitude));
    url.searchParams.set('lon', String(longitude));

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'ConektAdsInternalPlatform/1.0',
      },
    });

    if (!response.ok) {
      return {};
    }

    const raw = (await response.json()) as {
      display_name?: string;
      address?: Record<string, string | undefined>;
    };
    const address = raw.address || {};

    return {
      address: raw.display_name,
      city: getAddressPart(address, ['city', 'town', 'village', 'county', 'state_district']),
      area: getAddressPart(address, ['suburb', 'neighbourhood', 'quarter', 'road']),
      raw,
    };
  }

  private async reverseWithMapbox(latitude: number, longitude: number) {
    const token = process.env.MAPBOX_ACCESS_TOKEN;

    if (!token) {
      return {};
    }

    const url = new URL(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json`,
    );
    url.searchParams.set('access_token', token);

    const response = await fetch(url);

    if (!response.ok) {
      return {};
    }

    const raw = (await response.json()) as {
      features?: Array<{
        place_name?: string;
        text?: string;
        place_type?: string[];
        context?: Array<{ id?: string; text?: string }>;
      }>;
    };
    const feature = raw.features?.[0];
    const context = feature?.context || [];
    const city = context.find((item) => item.id?.startsWith('place'))?.text;
    const area =
      feature?.place_type?.includes('neighborhood') || feature?.place_type?.includes('locality')
        ? feature.text
        : context.find((item) => item.id?.startsWith('neighborhood'))?.text;

    return {
      address: feature?.place_name,
      city,
      area,
      raw,
    };
  }
}
