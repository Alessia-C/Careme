import { create } from 'zustand';
import { Role } from '../../shared/validation';

type AuthUser = { id: string; email: string } | null;

interface AuthState {
  user: AuthUser;
  role: Role | null;
  setSession: (user: AuthUser, role: Role | null) => void;
  clearSession: () => void;
}

const useAuthStore = create<AuthState>((set) => ({
  user: null,
  role: null,
  setSession: (user: AuthUser, role: Role | null) => set({ user, role }),
  clearSession: () => set({ user: null, role: null }),
}));

export const selectIsAuthenticated = (state: AuthState) => state.user !== null;

export default useAuthStore;
