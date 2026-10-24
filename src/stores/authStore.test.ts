import useAuthStore, { selectIsAuthenticated } from './authStore';
import { describe, it, expect, beforeEach } from 'vitest';

beforeEach(() => {
  useAuthStore.setState({ user: null, role: null });
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

  it('should derive isAuthenticated from the user in the store', () => {
    const user = { id: 'user-1', email: 'test@example.com' };
    const role = 'user';
    useAuthStore.getState().setSession(user, role);

    expect(selectIsAuthenticated(useAuthStore.getState())).toBe(true);

    useAuthStore.getState().clearSession();

    expect(selectIsAuthenticated(useAuthStore.getState())).toBe(false);
  });
});
