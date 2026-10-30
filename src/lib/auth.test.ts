import { beforeEach, describe, expect, it } from 'vitest';
import useAuthStore from '../stores/authStore';
import { isAuthenticated } from './auth';

describe('isAuthenticated', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, role: null });
  });

  it('returns false when no session is stored', () => {
    expect(isAuthenticated()).toBe(false);
  });

  it('returns true after a session is set in the store', () => {
    useAuthStore
      .getState()
      .setSession({ id: 'user-1', email: 'test@example.com' }, 'user');

    expect(isAuthenticated()).toBe(true);
  });

  it('returns false again after the session is cleared', () => {
    useAuthStore
      .getState()
      .setSession({ id: 'user-1', email: 'test@example.com' }, 'user');
    useAuthStore.getState().clearSession();

    expect(isAuthenticated()).toBe(false);
  });
});
