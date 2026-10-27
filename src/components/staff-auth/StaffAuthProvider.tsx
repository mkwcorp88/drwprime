'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

type StaffClientUser = { name: string; email: string | null; phone: string | null; cmsAccess: boolean };
type StaffAuth = {
  staff: StaffClientUser | null;
  isLoaded: boolean;
  isSignedIn: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const Context = createContext<StaffAuth | null>(null);

export function StaffAuthProvider({ children }: { children: React.ReactNode }) {
  const [staff, setStaff] = useState<StaffClientUser | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/staff/session', { cache: 'no-store' });
      if (!response.ok) throw new Error();
      const data = await response.json();
      setStaff(data.isAdmin ? data.staff : null);
    } catch { setStaff(null); }
    finally { setIsLoaded(true); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const signOut = useCallback(async () => {
    const response = await fetch('/api/staff/auth/logout', { method: 'POST' });
    if (!response.ok) throw new Error('Belum dapat keluar. Silakan coba lagi.');
    setStaff(null);
    window.location.assign('/staff/sign-in');
  }, []);

  return <Context.Provider value={{ staff, isLoaded, isSignedIn: Boolean(staff), refresh, signOut }}>{children}</Context.Provider>;
}

export function useStaffAuth() {
  const context = useContext(Context);
  if (!context) throw new Error('StaffAuthProvider is required');
  return context;
}
