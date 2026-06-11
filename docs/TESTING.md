# Testing

## Backend

Backend tests use Node's test runner, Supertest, and `mongodb-memory-server`. The integration database is created in memory and never connects to development or production MongoDB.

```bash
cd server
npm test
```

Useful commands:

```bash
npm run test:unit
npm run test:integration
npm run test:coverage
npx tsx --test --test-concurrency=1 tests/auth.test.ts
```

Integration fixtures are created inside test files and removed with the in-memory database.

## Frontend

Frontend tests use Vitest, jsdom, and Testing Library.

```bash
cd client
npm test
```

Useful commands:

```bash
npm run test:watch
npx vitest run src/pages/PublicSharedPlan.test.tsx
```

## Build Verification

```bash
cd server && npm run build
cd client && npm run build
```

## Rules

- Never point automated tests at production or development MongoDB.
- Do not add seed scripts or automatically create development records for tests.
- Do not commit real client files, credentials, tokens, or Cloudinary secrets.
- Do not call real Google OAuth accounts in automated tests.
- Mock slow or external systems such as OAuth, PDF rendering, geocoding, and Cloudinary where appropriate.
- Keep all test files synthetic and minimal.

Before deployment, complete [QA_CHECKLIST.md](./QA_CHECKLIST.md) and [REGRESSION_CHECKLIST.md](./REGRESSION_CHECKLIST.md).
