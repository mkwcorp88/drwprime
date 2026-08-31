'use client';

import { Download, Smartphone, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function OpsPwaInstall() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.register('/sw.js');
    }

    const isInstalled = window.matchMedia('(display-mode: standalone)').matches
      || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (isInstalled) return;

    if (/iphone|ipad|ipod/i.test(navigator.userAgent)) {
      setShowIosHelp(true);
      return;
    }

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstallPrompt(null);
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const install = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };

  if (!installPrompt && !showIosHelp) return null;

  return (
    <section className="relative mx-auto mb-5 max-w-2xl overflow-hidden rounded-[1.75rem] border border-primary/25 bg-[#111714] shadow-[0_18px_50px_rgba(0,0,0,0.35)]">
      <img src="/treatment-flow-install-card.jpg" alt="" aria-hidden="true" className="absolute inset-0 size-full object-cover opacity-55" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#07100d]/95 via-[#08100d]/85 to-[#07100d]/55" />
      <div className="relative flex items-center gap-4 p-4 sm:p-5">
        <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl border border-primary/50 bg-black/35 text-primary shadow-[0_0_30px_rgba(212,175,55,0.25)] backdrop-blur-sm">
          <Smartphone className="size-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-primary"><Sparkles className="size-3" /> Akses lebih cepat</p>
          <h2 className="mt-1 text-base font-bold text-white sm:text-lg">Pasang Treatment Flow di HP</h2>
          <p className="mt-1 text-xs leading-5 text-white/65">Buka seperti aplikasi, langsung dari layar utama perangkat Anda.</p>
        </div>
        {installPrompt && <button type="button" onClick={() => void install()} className="flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-3 py-2.5 text-xs font-bold text-black shadow-[0_8px_20px_rgba(212,175,55,0.25)] transition hover:bg-primary-light"><Download className="size-4" /> Install</button>}
      </div>
      {showIosHelp && <p className="relative border-t border-white/10 bg-black/20 px-5 py-3 text-xs leading-5 text-white/70">Di Safari, ketuk <strong className="text-primary">Bagikan</strong>, lalu pilih <strong className="text-primary">Tambahkan ke Layar Utama</strong>.</p>}
    </section>
  );
}
