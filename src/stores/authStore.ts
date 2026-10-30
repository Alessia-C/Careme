import { create } from 'zustand';
import { Role } from '../../shared/validation';

type AuthUser = { id: string; email: string } | null;

// 'pending': the first GET /api/auth/me after a page load is still running.
// 'failed': it could not tell (network error, 5xx): the login page warns once,
// then moves on to 'restored'. Logging out never goes back to 'pending'.
export type RestoreStatus = 'pending' | 'restored' | 'failed';

interface AuthState {
  user: AuthUser;
  role: Role | null;
  // Unix time (seconds) when the access token expires, null without session.
  expiresAt: number | null;
  restoreStatus: RestoreStatus;
  setSession: (
    user: AuthUser,
    role: Role | null,
    expiresAt?: number | null,
  ) => void;
  setExpiresAt: (expiresAt: number) => void;
  clearSession: () => void;
  setRestoreStatus: (status: RestoreStatus) => void;
}

const useAuthStore = create<AuthState>((set) => ({
  user: null,
  role: null,
  expiresAt: null,
  restoreStatus: 'pending',
  setSession: (user, role, expiresAt = null) => set({ user, role, expiresAt }),
  setExpiresAt: (expiresAt) => set({ expiresAt }),
  clearSession: () => set({ user: null, role: null, expiresAt: null }),
  setRestoreStatus: (restoreStatus: RestoreStatus) => set({ restoreStatus }),
}));

export const selectIsAuthenticated = (state: AuthState) => state.user !== null;

export default useAuthStore;
