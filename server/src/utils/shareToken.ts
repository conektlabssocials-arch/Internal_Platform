import crypto from 'node:crypto';

export const createShareToken = () => crypto.randomBytes(24).toString('hex');
