import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@workspace/api-client-react';
import { isExpiredSession, nextSessionChangedAt, readPersistedSession, selectCurrentSession } from './session-continuity';

interface AuthState {
  token: string | null;
  user: User | null;
  changedAt: number;
  setAuth: (token: string, user: User) => void;
  login: (token: string, user: User) => void;
  logout: () => void;
  synchronize: (serialized: string | null) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      changedAt: 0,
      setAuth: (token, user) => set((current) => selectCurrentSession(current, { token, user, changedAt: nextSessionChangedAt(current.changedAt) })),
      login: (token, user) => set((current) => selectCurrentSession(current, { token, user, changedAt: nextSessionChangedAt(current.changedAt) })),
      logout: () => set((current) => ({ token: null, user: null, changedAt: nextSessionChangedAt(current.changedAt) })),
      synchronize: (serialized) => set((current) => {
        const incoming = readPersistedSession<User>(serialized);
        return incoming ? selectCurrentSession(current, incoming) : current;
      }),
    }),
    {
      name: 'bimlog-auth',
      version: 1,
      merge: (persisted, current) => {
        const candidate = persisted as Partial<AuthState>;
        if (!candidate.token || !candidate.user || isExpiredSession(candidate.token)) return current;
        return { ...current, token: candidate.token, user: candidate.user, changedAt: Number(candidate.changedAt) || 0 };
      },
    }
  )
);

export function installAuthStorageContinuity(): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const listener = (event: StorageEvent) => {
    if (event.key === 'bimlog-auth') useAuthStore.getState().synchronize(event.newValue);
  };
  window.addEventListener('storage', listener);
  return () => window.removeEventListener('storage', listener);
}
