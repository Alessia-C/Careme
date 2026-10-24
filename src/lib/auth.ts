import useAuthStore, { selectIsAuthenticated } from '../stores/authStore';

// Plain function, not a hook, so ProtectedRoute can keep calling it as before.
export function isAuthenticated(): boolean {
  return selectIsAuthenticated(useAuthStore.getState());
}
