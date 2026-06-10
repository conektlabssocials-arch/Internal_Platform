# Production Security Checklist

## Authentication

- [ ] Production uses Google Workspace SSO only.
- [ ] `DEV_AUTH_ENABLED` is absent or false in production.
- [ ] No public registration or self-signup route exists.
- [ ] Every user is added by an Admin before first login.
- [ ] Inactive users cannot create a session or use an existing session.
- [ ] Google OAuth redirect URI exactly matches `GOOGLE_CALLBACK_URL`.
- [ ] `AUTH_ALLOWED_DOMAINS` contains only approved Workspace domains.

## Sessions

- [ ] `JWT_SECRET` is long, random, and stored outside source control.
- [ ] Session JWTs are stored only in an httpOnly cookie.
- [ ] Production cookies are `Secure` and `SameSite=Strict`.
- [ ] Logout clears the cookie with matching path and security settings.
- [ ] The frontend does not store auth tokens in localStorage or sessionStorage.

## API Security

- [ ] `CLIENT_URL` contains only approved frontend origins.
- [ ] CORS never uses `*` with credentials.
- [ ] Helmet, compression, Mongo sanitization, and HPP are enabled.
- [ ] General and auth-specific rate limits are configured.
- [ ] JSON and URL-encoded request bodies are limited to 2 MB.
- [ ] Upload MIME types, signatures, counts, and sizes are validated.
- [ ] Internal downloads require authentication.
- [ ] Public uploads are active and marked public-safe.

## Public Data

- [ ] Shared plans expose no internal costs, margins, internal notes, or supplier contacts.
- [ ] Share links are active, unexpired, and use secure random tokens.
- [ ] Creative, PO, and internal document uploads are never available publicly.
- [ ] Public endpoints return no storage keys, filesystem paths, or credentials.

## Environment And Operations

- [ ] Production startup environment validation passes.
- [ ] Cloudinary, Google, MongoDB, and JWT secrets are configured in the deployment secret store.
- [ ] `.env` and `.env.local` are not committed.
- [ ] `/api/health` exposes only environment, time, and database connection status.
- [ ] Login success and blocked login events appear in Admin Audit Logs.
- [ ] Production error responses do not expose stack traces or secrets.
