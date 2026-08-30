import { create } from 'zustand';
import { storage } from '@/lib/storage';

export interface CurrentUser {
  userId: string;
  username: string;
  nickname?: string;
  roles: string[];
  tenantId?: string;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: CurrentUser | null;
  setTokens: (access: string, refresh: string) => void;
  setUser: (user: CurrentUser) => void;
  clear: () => void;
}

const initialAccess = storage.getString('accessToken');
const initialRefresh = storage.getString('refreshToken');
const initialUser = storage.get<CurrentUser>('user');

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: initialAccess,
  refreshToken: initialRefresh,
  user: initialUser ?? null,
  setTokens: (access, refresh) => {
    storage.setString('accessToken', access);
    storage.setString('refreshToken', refresh);
    set({ accessToken: access, refreshToken: refresh });
  },
  setUser: (user) => {
    storage.set('user', user);
    set({ user });
  },
  clear: () => {
    storage.remove('accessToken');
    storage.remove('refreshToken');
    storage.remove('user');
    set({ accessToken: null, refreshToken: null, user: null });
  },
}));
