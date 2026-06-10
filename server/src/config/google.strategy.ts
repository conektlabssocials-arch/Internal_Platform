import passport from 'passport';
import {
  Strategy as GoogleStrategy,
  type Profile,
  type VerifyCallback,
} from 'passport-google-oauth20';
import type { Request } from 'express';

import { container } from './container.js';
import { TOKENS } from './tokens.js';
import { ACTIVITY_ACTIONS } from '../constants/activity.constants.js';
import type { IActivityService } from '../services/activity.service.js';
import type { IUserService } from '../services/user.service.js';
import { HttpError } from '../utils/httpError.js';

const configured = () =>
  Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_CALLBACK_URL,
  );

const allowedDomains = () =>
  (
    process.env.AUTH_ALLOWED_DOMAINS ||
    process.env.GOOGLE_WORKSPACE_DOMAIN ||
    process.env.GOOGLE_ALLOWED_DOMAIN ||
    ''
  )
    .split(',')
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean);

const profileEmail = (profile: Profile) =>
  profile.emails?.find((email) => email.verified)?.value?.toLowerCase() ||
  profile.emails?.[0]?.value?.toLowerCase();

export const isGoogleOAuthConfigured = configured;

export const configureGoogleStrategy = () => {
  if (!configured()) return;

  const users = container.resolve<IUserService>(TOKENS.UserService);
  const activity = container.resolve<IActivityService>(TOKENS.ActivityService);

  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        callbackURL: process.env.GOOGLE_CALLBACK_URL!,
        passReqToCallback: true,
      },
      async (
        req: Request,
        _accessToken: string,
        _refreshToken: string,
        profile: Profile,
        done: VerifyCallback,
      ) => {
        const email = profileEmail(profile);
        try {
          if (!email) {
            throw new HttpError(401, 'Google account email could not be verified');
          }

          const domains = allowedDomains();
          const domain = email.split('@')[1];
          if (domains.length && !domains.includes(domain)) {
            throw new HttpError(403, 'Google Workspace account is not allowed');
          }

          const user = await users.recordGoogleLogin({
            email,
            googleId: profile.id,
            avatarUrl: profile.photos?.[0]?.value,
          });
          done(null, user);
        } catch (error) {
          const reason =
            error instanceof HttpError && error.statusCode === 403
              ? 'inactive_or_disallowed'
              : 'unknown_or_invalid';
          await activity.logEntityActivity({
            actor: null,
            actorName: 'Google SSO',
            action: ACTIVITY_ACTIONS.USER_LOGIN_BLOCKED,
            entityType: 'User',
            entityTitle: email,
            message: `Google login was blocked for ${email || 'an unverified account'}.`,
            metadata: { email, reason },
            visibility: 'admin_only',
            req,
          });
          done(null, false, { message: 'Google sign-in was not approved' });
        }
      },
    ),
  );
};

