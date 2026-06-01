import { inject, injectable } from 'tsyringe';
import type { Request, Response } from 'express';

import { TOKENS } from '../config/tokens.js';
import type { IGeocodingService } from '../services/geocoding.service.js';
import { HttpError } from '../utils/httpError.js';

@injectable()
export class GeocodeController {
  constructor(
    @inject(TOKENS.GeocodingService)
    private readonly geocodingService: IGeocodingService,
  ) {}

  reverseGeocode = async (req: Request, res: Response) => {
    const latitude = Number(req.query.lat);
    const longitude = Number(req.query.lng);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw new HttpError(400, 'lat and lng are required');
    }

    const result = await this.geocodingService.reverseGeocode(latitude, longitude);
    res.status(200).json(result);
  };
}
