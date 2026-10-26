import useAuthStore, { selectIsAuthenticated } from './authStore';
import { describe, it, expect, beforeEach } from 'vitest';

beforeEach(() => {
  useAuthStore.setState({ user: null, role: null, restoreStatus: 'pending' });
});

describe('authStore', () => {
  it('should set the session correctly', () => {
    const user = { id: 'user-1', email: 'test@example.com' };
    const role = 'user';
    useAuthStore.getState().setSession(user, role);

    const state = useAuthStore.getState();
    expect(state.user).toEqual(user);
    expect(state.role).toEqual(role);
  });

  it('should clear the session correctly', () => {
    const user = { id: 'user-1', email: 'test@example.com' };
    const role = 'user';
    useAuthStore.getState().setSession(user, role);

    useAuthStore.getState().clearSession();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.role).toBeNull();
  });

  it('should keep the session expiry and drop it on clear', () => {
    const user = { id: 'user-1', email: 'test@example.com' };
    useAuthStore.getState().setSession(user, 'user', 1790000000);
    expect(useAuthStore.getState().expiresAt).toBe(1790000000);

    useAuthStore.getState().setExpiresAt(1790003600);
    expect(useAuthStore.getState().expiresAt).toBe(1790003600);

    useAuthStore.getState().clearSession();
    expect(useAuthStore.getState().expiresAt).toBeNull();
  });

  it('should derive isAuthenticated from the user in the store', () => {
    const user = { id: 'user-1', email: 'test@example.com' };
    const role = 'user';
    useAuthStore.getState().setSession(user, role);

    expect(selectIsAuthenticated(useAuthStore.getState())).toBe(true);

    useAuthStore.getState().clearSession();

    expect(selectIsAuthenticated(useAuthStore.getState())).toBe(false);
  });

  it('should start with the session restore pending', () => {
    expect(useAuthStore.getState().restoreStatus).toBe('pending');
  });

  it('should not go back to pending when the session is cleared', () => {
    useAuthStore.getState().setRestoreStatus('restored');

    useAuthStore.getState().clearSession();

    expect(useAuthStore.getState().restoreStatus).toBe('restored');
  });
});
