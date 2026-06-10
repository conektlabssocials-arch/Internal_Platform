import 'reflect-metadata';

import assert from 'node:assert/strict';
import test from 'node:test';

import type { UserDto } from '../dto/user.dto.js';
import type { IUserService } from './user.service.js';
import { AuthService } from './auth.service.js';

const user: UserDto = {
  id: '000000000000000000000001',
  name: 'Admin',
  email: 'admin@conektads.com',
  role: 'admin',
  status: 'active',
  authProvider: 'dev',
};

const withEnvironment = async (
  values: Record<string, string | undefined>,
  action: () => Promise<void> | void,
) => {
  const previous = Object.fromEntries(
    Object.keys(values).map((key) => [key, process.env[key]]),
  );
  Object.entries(values).forEach(([key, value]) => {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  });
  try {
    await action();
  } finally {
    Object.entries(previous).forEach(([key, value]) => {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    });
  }
};

const service = () =>
  new AuthService({
    recordDevLogin: async () => user,
  } as unknown as IUserService);

test('development login requires its explicit feature flag', async () => {
  await withEnvironment(
    { NODE_ENV: 'development', DEV_AUTH_ENABLED: 'false' },
    async () => {
      await assert.rejects(
        () => service().loginForDevelopment(user.email),
        /not available/,
      );
    },
  );
});

test('development login is always disabled in production', async () => {
  await withEnvironment(
    {
      NODE_ENV: 'production',
      DEV_AUTH_ENABLED: 'true',
      JWT_SECRET: 'test-secret',
    },
    async () => {
      await assert.rejects(
        () => service().loginForDevelopment(user.email),
        /not available/,
      );
    },
  );
});

test('production cookies are secure, strict, and httpOnly', async () => {
  await withEnvironment(
    { NODE_ENV: 'production', JWT_EXPIRES_IN: '2h' },
    () => {
      const options = service().getCookieOptions();
      assert.equal(options.httpOnly, true);
      assert.equal(options.secure, true);
      assert.equal(options.sameSite, 'strict');
      assert.equal(options.maxAge, 2 * 60 * 60 * 1000);
    },
  );
});

test('development cookies remain usable over local HTTP', async () => {
  await withEnvironment({ NODE_ENV: 'development' }, () => {
    const options = service().getCookieOptions();
    assert.equal(options.httpOnly, true);
    assert.equal(options.secure, false);
    assert.equal(options.sameSite, 'lax');
  });
});

