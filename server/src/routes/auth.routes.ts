import { randomBytes, timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import passport from 'passport';
import type { RequestHandler } from 'express';

import { container } from '../config/container.js';
import { isGoogleOAuthConfigured } from '../config/google.strategy.js';
import {
  AuthController,
  oauthStateClearCookieOptions,
  oauthStateCookieOptions,
} from '../controllers/auth.controller.js';
import { authLimiter } from '../middleware/rateLimit.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../utils/httpError.js';

const router = Router();
const authController = container.resolve(AuthController);
const loginErrorUrl = () =>
  `${process.env.CLIENT_URL || 'http://localhost:5173'}/login?error=sso_failed`;

const requireGoogleConfiguration: RequestHandler = (_req, _res, next) => {
  if (!isGoogleOAuthConfigured()) {
    next(new HttpError(503, 'Google sign-in is not configured'));
    return;
  }
  next();
};

if (process.env.NODE_ENV !== 'production') {
  router.get('/google/config', (_req, res) => {
    const clientId = process.env.GOOGLE_CLIENT_ID || '';
    res.status(200).json({
      callbackUrl: process.env.GOOGLE_CALLBACK_URL,
      clientId,
      clientUrl: process.env.CLIENT_URL,
      configured: isGoogleOAuthConfigured(),
    });
  });
}

router.get(
  '/google',
  authLimiter,
  requireGoogleConfiguration,
  (req, res, next) => {
    const state = randomBytes(32).toString('hex');
    res.cookie('conekt_google_oauth_state', state, oauthStateCookieOptions());
    passport.authenticate('google', {
      scope: ['profile', 'email'],
      session: false,
      state,
      prompt: 'select_account',
      hd:
        process.env.GOOGLE_WORKSPACE_DOMAIN ||
        process.env.GOOGLE_ALLOWED_DOMAIN ||
        undefined,
    })(req, res, next);
  },
);

router.get(
  '/google/callback',
  authLimiter,
  requireGoogleConfiguration,
  (req, res, next) => {
    const expected = req.cookies?.conekt_google_oauth_state;
    const received = typeof req.query.state === 'string' ? req.query.state : '';
    res.clearCookie(
      'conekt_google_oauth_state',
      oauthStateClearCookieOptions(),
    );
    if (
      !expected ||
      expected.length !== received.length ||
      !timingSafeEqual(Buffer.from(expected), Buffer.from(received))
    ) {
      res.redirect(loginErrorUrl());
      return;
    }
    next();
  },
  passport.authenticate('google', {
    session: false,
    failureRedirect: loginErrorUrl(),
  }),
  asyncHandler(authController.getGoogleCallback),
);

// Compatibility endpoint for the previous Google Identity Services ID-token flow.
router.post('/google', authLimiter, asyncHandler(authController.postGoogleLogin));
router.post('/dev-login', authLimiter, asyncHandler(authController.postDevLogin));
router.post('/logout', asyncHandler(authController.postLogout));
router.get('/me', asyncHandler(authController.getMe));

export default router;
