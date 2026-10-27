'use client';

import { useEffect, useRef, useState } from 'react';
import Script from 'next/script';

type GoogleIdentity = {
  accounts: {
    id: {
      initialize: (options: { client_id: string; callback: (response: { credential?: string }) => void; auto_select: boolean }) => void;
      renderButton: (element: HTMLElement, options: { theme: string; size: string; text: string; shape: string; width: number }) => void;
    };
  };
};

declare global {
  interface Window { google?: GoogleIdentity }
}

const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

export default function GoogleLoginButton({ destination, referralCode = null, mode = 'member' }: { destination: string; referralCode?: string | null; mode?: 'member' | 'staff' }) {
  const button = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!ready || !clientId || !button.current) return;
    if (!window.google) { setError('Google belum dapat dimuat. Silakan coba lagi.'); return; }
    const element = button.current;
    try {
      window.google.accounts.id.initialize({
        client_id: clientId,
        auto_select: false,
        callback: ({ credential }) => {
          void (async () => {
            if (!credential) { setError('Login Google dibatalkan. Silakan coba lagi.'); return; }
            setBusy(true); setError('');
            try {
              const response = await fetch(mode === 'staff' ? '/api/staff/auth/google' : '/api/member-auth/google', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(mode === 'staff' ? { credential } : { action: 'exchange', credential, referralCode }),
              });
              const result = await response.json();
              if (!response.ok) throw new Error(result.error || 'Login Google belum berhasil.');
              if (!result.authenticated) throw new Error('Login Google belum berhasil.');
              window.location.assign(mode === 'staff' ? (result.needsPhone ? '/staff/profile' : destination) : result.phoneVerified ? destination : '/my-prime/profile');
            } catch (failure) {
              setError(failure instanceof Error ? failure.message : 'Login Google belum berhasil.');
              setBusy(false);
            }
          })();
        },
      });
      let renderedWidth = 0;
      const renderButton = () => {
        const availableWidth = Math.floor(element.parentElement?.getBoundingClientRect().width || element.clientWidth);
        const width = Math.min(availableWidth, 400);
        if (width < 200 || width === renderedWidth) return;
        renderedWidth = width;
        element.replaceChildren();
        try {
          window.google?.accounts.id.renderButton(element, {
            theme: 'outline', size: 'large', text: 'continue_with', shape: 'pill', width,
          });
        } catch {
          setError('Login Google belum dapat disiapkan. Silakan coba lagi.');
        }
      };
      const observer = new ResizeObserver(renderButton);
      observer.observe(element.parentElement || element);
      renderButton();
      return () => observer.disconnect();
    } catch {
      setError('Login Google belum dapat disiapkan. Silakan coba lagi.');
    }
  }, [ready, destination, referralCode, mode]);

  if (!clientId) return <p role="status" className="text-center text-xs text-white/50">Login Google sedang disiapkan.</p>;

  return <>
    <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onReady={() => setReady(true)} onError={() => setError('Google belum dapat dimuat. Silakan coba lagi.')} />
    <div ref={button} className={`flex min-h-12 w-full min-w-0 max-w-full items-center justify-center overflow-hidden ${busy ? 'pointer-events-none opacity-50' : ''}`} aria-label="Lanjutkan dengan Google" />
    {error && <p role="alert" className="mt-2 text-center text-sm text-red-300">{error}</p>}
  </>;
}
