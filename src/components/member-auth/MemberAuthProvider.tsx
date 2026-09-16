'use client';

import { useClerk, useUser } from '@clerk/nextjs';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { MemberClientUser, MemberEnrollment } from '@/lib/member-auth/types';

type MemberAuth = {
  user: MemberClientUser | null;
  enrollment: MemberEnrollment | null;
  isLoaded: boolean;
  isSignedIn: boolean;
  otpAvailable: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
  updateAvatar: (file: File) => Promise<void>;
};
const Context = createContext<MemberAuth | null>(null);

export function MemberAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<MemberClientUser | null>(null);
  const [enrollment, setEnrollment] = useState<MemberEnrollment | null>(null);
  const [isLoaded, setLoaded] = useState(false);
  const [otpAvailable, setOtpAvailable] = useState(false);
  const { user: clerkUser, isLoaded: clerkLoaded } = useUser();
  const { signOut: signOutClerk } = useClerk();
  const checkedLegacySession = useRef<string | null>(null);

  useEffect(() => {
    if (!clerkLoaded) return;
    if (!clerkUser) {
      checkedLegacySession.current = null;
      return;
    }
    if (checkedLegacySession.current === clerkUser.id) return;
    checkedLegacySession.current = clerkUser.id;

    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch('/api/staff/session', { cache: 'no-store' });
        if (cancelled || !response.ok) return;
        const data = await response.json();
        if (cancelled || data.isAdmin === true) return;

        // Clerk is now reserved for staff. Legacy member sessions must start
        // over with WhatsApp OTP instead of remaining signed in in the browser.
        await signOutClerk({ redirectUrl: '/sign-in?redirect_url=/my-prime' });
      } catch {
        if (!cancelled) checkedLegacySession.current = null;
      }
    })();

    return () => { cancelled = true; };
  }, [clerkLoaded, clerkUser, signOutClerk]);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/member-auth/session', { cache: 'no-store' });
      if (!response.ok) throw new Error();
      const data = await response.json();
      setUser(data.user);
      setEnrollment(data.enrollment);
      setOtpAvailable(Boolean(data.otpAvailable));
    } catch {
      setUser(null);
      setEnrollment(null);
      setOtpAvailable(false);
    } finally { setLoaded(true); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const signOut = useCallback(async () => {
    const response = await fetch('/api/member-auth/logout', { method: 'POST' });
    if (!response.ok) throw new Error('Belum dapat keluar. Silakan coba lagi.');
    setUser(null);
    setEnrollment(null);
    window.location.assign('/');
  }, []);

  const updateAvatar = useCallback(async (file: File) => {
    const body = new FormData();
    body.set('file', file);
    const response = await fetch('/api/member-auth/avatar', { method: 'POST', body });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Gagal mengunggah foto.');
    await refresh();
  }, [refresh]);

  return <Context.Provider value={{ user, enrollment, isLoaded, isSignedIn: Boolean(user), otpAvailable, refresh, signOut, updateAvatar }}>{children}</Context.Provider>;
}

export function useMemberAuth() {
  const context = useContext(Context);
  if (!context) throw new Error('MemberAuthProvider is required');
  return context;
}
