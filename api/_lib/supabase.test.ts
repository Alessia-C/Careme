import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createAnonClient,
  createUserClient,
  isRateLimitError,
} from './supabase.js';
import { stubSupabaseEnv } from './test-helpers.js';

// vi.mock is hoisted above the imports, so the fake must be created with
// vi.hoisted to already exist when the mock factory runs.
const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));

vi.mock('@supabase/supabase-js', () => ({ createClient }));

beforeEach(() => {
  stubSupabaseEnv();
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe.each([
  ['createAnonClient', () => createAnonClient()],
  ['createUserClient', () => createUserClient('user-jwt')],
])('%s - environment', (_name, create) => {
  it.each(['SUPABASE_URL', 'SUPABASE_ANON_KEY'])(
    'should throw when %s is missing',
    (name) => {
      vi.stubEnv(name, '');

      expect(create).toThrow('Missing Supabase environment variables');
      expect(createClient).not.toHaveBeenCalled();
    },
  );
});

describe('createAnonClient', () => {
  it('should build the client with the anon key and no stored session', () => {
    createAnonClient();

    expect(createClient).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'anon-key',
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  });
});

describe('createUserClient', () => {
  it('should send the access token as the Authorization header', () => {
    createUserClient('user-jwt');

    expect(createClient).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'anon-key',
      {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: 'Bearer user-jwt' } },
      },
    );
  });

  it('should build a new client on every call', () => {
    createUserClient('first-jwt');
    createUserClient('second-jwt');

    expect(createClient).toHaveBeenCalledTimes(2);
  });
});

describe('isRateLimitError', () => {
  it.each(['over_email_send_rate_limit', 'over_request_rate_limit'])(
    'should return true for %s',
    (code) => {
      expect(isRateLimitError({ code })).toBe(true);
    },
  );

  it.each([
    ['null', null],
    ['an error without a code', {}],
    ['another error code', { code: 'invalid_credentials' }],
  ])('should return false for %s', (_label, error) => {
    expect(isRateLimitError(error)).toBe(false);
  });
});
