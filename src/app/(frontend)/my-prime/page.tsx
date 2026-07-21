'use client';

import { useState, useEffect, useCallback } from 'react';
import { useUser, useClerk } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import Navbar from '@/components/Navbar';
import MobileLayout from '@/components/MobileLayout';
import InstallPrompt from '@/components/InstallPrompt';
import MemberQrCard from '@/components/MemberQrCard';
import LoadingScreen, { Hourglass } from '@/components/LoadingScreen';

interface MemberReservation {
  id: string;
  patientName: string;
  treatmentName: string | null;
  status: string;
  reservationDate: string;
  finalPrice: number;
}

interface MembershipData {
  tier: 'SILVER' | 'GOLD' | 'PLATINUM';
  benefits: string[];
  nextTier: 'GOLD' | 'PLATINUM' | null;
  nextTierThreshold: number | null;
  progressPercent: number;
  amountToNextTier: number | null;
  totalSpending: number;
  memberSince: string;
  isTeamLeader: boolean;
  points: number;
  pointHistory: PointHistoryItem[];
  reservations: MemberReservation[];
}

interface PointHistoryItem {
  id: string;
  amount: number;
  treatment: string | null;
  spendingDate: string;
  pointsEarned: number;
}

const TIER_CONFIG = {
  SILVER: {
    label: 'Silver',
    gradient: 'from-white/[0.09] via-white/[0.04] to-primary/[0.04]',
    border: 'border-white/20',
    badge: 'bg-white/[0.07] text-slate-200 border-white/15',
    progress: 'bg-gradient-to-r from-slate-400 to-slate-300',
    marker: 'bg-slate-300',
    emblem: 'border-slate-300/55 bg-gradient-to-br from-slate-100/25 via-slate-500/10 to-black text-slate-200 shadow-[0_0_12px_rgba(203,213,225,0.18)]',
    divider: 'bg-slate-300/25',
  },
  GOLD: {
    label: 'Gold',
    gradient: 'from-primary/20 via-[#17140b] to-black',
    border: 'border-primary/50',
    badge: 'bg-primary/10 text-primary border-primary/30',
    progress: 'bg-gradient-to-r from-amber-500 to-primary',
    marker: 'bg-primary',
    emblem: 'border-primary/60 bg-gradient-to-br from-[#ffe9a4]/30 via-primary/15 to-black text-[#f4d36f] shadow-[0_0_14px_rgba(212,175,55,0.28)]',
    divider: 'bg-primary/30',
  },
  PLATINUM: {
    label: 'Platinum',
    gradient: 'from-[#f8e9bd]/20 via-[#191711] to-black',
    border: 'border-[#f8e9bd]/45',
    badge: 'bg-[#f8e9bd]/10 text-[#f8e9bd] border-[#f8e9bd]/30',
    progress: 'bg-gradient-to-r from-primary to-[#fff0bd]',
    marker: 'bg-[#fff0bd]',
    emblem: 'border-[#fff0bd]/65 bg-gradient-to-br from-white/35 via-[#f8e9bd]/15 to-black text-[#fff5d5] shadow-[0_0_16px_rgba(255,240,189,0.3)]',
    divider: 'bg-[#fff0bd]/35',
  },
};

type MembershipTier = keyof typeof TIER_CONFIG;

function TierBadge({ tier }: { tier: MembershipTier }) {
  const config = TIER_CONFIG[tier];

  return (
    <span className={`relative isolate flex flex-shrink-0 items-center overflow-hidden rounded-full border py-1 pl-1 pr-3 ${config.badge}`}>
      <span className={`relative flex h-7 w-7 items-center justify-center rounded-full border ${config.emblem}`}>
        <svg className="h-6 w-6" fill="none" viewBox="0 0 32 32" aria-hidden="true">
          <circle cx="16" cy="16" r="12.25" stroke="currentColor" strokeWidth="0.75" opacity="0.48" />
          <circle cx="16" cy="16" r="10.25" stroke="currentColor" strokeWidth="0.45" opacity="0.28" />

          {tier === 'GOLD' && (
            <path
              d="M16 5v4M16 23v4M5 16h4M23 16h4M8.2 8.2l2.8 2.8M21 21l2.8 2.8M23.8 8.2L21 11M11 21l-2.8 2.8"
              stroke="currentColor"
              strokeWidth="0.55"
              opacity="0.28"
            />
          )}

          {tier === 'PLATINUM' && (
            <g fill="currentColor" opacity="0.09">
              <path d="M6 10l5-3 2.5 5-5.5 4z" />
              <path d="M11 7l5-2 1 7-3.5 0z" />
              <path d="M16 5l6 2-3 6-2-1z" />
              <path d="M22 7l4 4-6 4-1-2z" />
              <path d="M8 16l5.5-4 2.5 5-5 5z" />
              <path d="M16 17l4-2 4 5-8 7z" />
            </g>
          )}

          <path
            d="M18.4 6.2c-2.9 2.3-4.45 5.3-4.05 8.05.17 1.16.83 1.97 1.9 2.48l-1.75 1.42 1.8.83-.72 1.45 1.72.62c-.05 2.08.52 3.62 1.75 4.75"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.15"
          />
          <path
            d="M15.95 16.68c1.2-.02 2.08-.48 2.72-1.42"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="0.8"
            opacity="0.72"
          />
        </svg>
      </span>
      <span aria-hidden="true" className={`mx-2 h-4 w-px ${config.divider}`} />
      <span className="text-[9px] font-semibold uppercase tracking-[0.18em]">{config.label}</span>
      <span aria-hidden="true" className="absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent" />
    </span>
  );
}

export default function MyPrimePage() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();
  const [membership, setMembership] = useState<MembershipData | null>(null);
  const [profileComplete, setProfileComplete] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState('');

  const fetchMembership = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError('');

      // POST is idempotent: it returns an existing account or creates its profile stub.
      const syncRes = await fetch('/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user?.emailAddresses[0]?.emailAddress,
          firstName: user?.firstName,
          lastName: user?.lastName,
          phone: user?.phoneNumbers[0]?.phoneNumber,
        }),
      });
      if (!syncRes.ok) {
        const data = await syncRes.json().catch(() => null);
        throw new Error(data?.error || 'Gagal menyiapkan akun member');
      }

      const res = await fetch('/api/membership');
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'Gagal memuat data membership');
      }
      const data = await res.json();
      setMembership(data.membership);

      try {
        const profileRes = await fetch('/api/profile');
        if (profileRes.ok) {
          const profileData = await profileRes.json();
          setProfileComplete(Boolean(profileData.profile?.isComplete));
        } else if (profileRes.status === 404) {
          setProfileComplete(false);
        }
      } catch {
        // ignore profile fetch errors, banner just won't show
      }
    } catch (err) {
      console.error('Membership fetch error:', err);
      setMembership(null);
      setLoadError('Kami belum dapat memuat My Prime. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!user) {
      setLoading(false);
      return;
    }
    fetchMembership();
  }, [isLoaded, user, fetchMembership]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

  const formatShortDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !user) return;

    if (!file.type.startsWith('image/')) {
      setAvatarError('File harus berupa gambar.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setAvatarError('Ukuran foto maksimal 5MB.');
      return;
    }

    setAvatarBusy(true);
    setAvatarError('');
    try {
      await user.setProfileImage({ file });
      await user.reload();
    } catch (error) {
      console.error('Avatar upload error:', error);
      setAvatarError('Gagal mengunggah foto. Silakan coba lagi.');
    } finally {
      setAvatarBusy(false);
    }
  };

  if (!isLoaded || loading) {
    return (
      <MobileLayout>
        <LoadingScreen label="Loading My Prime..." />
      </MobileLayout>
    );
  }

  if (!user) {
    return (
      <MobileLayout>
        <div className="min-h-screen bg-black flex items-center justify-center p-4">
          <div className="text-center">
            <p className="text-white/60 mb-4 text-sm">Silakan login untuk mengakses halaman ini.</p>
            <Link href="/sign-in" className="bg-primary text-dark px-6 py-3 rounded-lg font-semibold text-sm">
              Sign In
            </Link>
          </div>
        </div>
      </MobileLayout>
    );
  }

  if (!membership) {
    return (
      <MobileLayout>
        <div className="min-h-screen bg-black flex items-center justify-center">
          <div className="text-center">
            <p className="text-white/60 text-sm">
              {loadError || 'Gagal memuat data. Silakan refresh halaman.'}
            </p>
            <button
              onClick={fetchMembership}
              className="mt-4 rounded-lg border border-primary/40 px-4 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
            >
              Coba Lagi
            </button>
          </div>
        </div>
      </MobileLayout>
    );
  }

  // Gate: dashboard terkunci sampai profil dilengkapi
  if (profileComplete === false) {
    return (
      <MobileLayout>
        <Navbar />
        <div className="min-h-screen fo-glass-page mp-theme-bright">
          <div className="pt-20 relative z-10">
            <div className="max-w-md mx-auto px-4 py-10">
              <div className="fo-glass-card fo-fade-up rounded-2xl p-8 text-center border-primary/35">
                <div className="relative w-20 h-20 mx-auto mb-5">
                  <div className="absolute inset-0 bg-primary/15 backdrop-blur-md rounded-full border border-primary/20"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <svg className="w-9 h-9 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                </div>

                <h1 className="font-playfair text-2xl font-bold text-primary mb-2">Dashboard Terkunci</h1>
                <p className="text-white/60 text-sm mb-6 leading-relaxed">
                  Lengkapi data pribadi Anda terlebih dahulu untuk membuka dashboard membership DRW Prime.
                </p>

                <Link
                  href="/my-prime/profile"
                  className="inline-flex items-center justify-center gap-2 w-full bg-primary text-dark font-semibold text-sm py-3 rounded-lg hover:bg-primary/90 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Lengkapi Profil Sekarang
                </Link>

                <p className="text-white/30 text-[11px] mt-4">
                  Data Anda aman & hanya digunakan untuk keperluan membership.
                </p>
              </div>
            </div>
          </div>
        </div>
      </MobileLayout>
    );
  }

  const tier = TIER_CONFIG[membership.tier];
  const displayName = [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Member';
  const phone = user.phoneNumbers?.[0]?.phoneNumber || '-';
  const initials = [user.firstName, user.lastName]
    .filter(Boolean)
    .map((name) => name?.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'MP';

  return (
    <MobileLayout>
      <Navbar />
      <div className="min-h-screen fo-glass-page mp-theme-bright">
        <div className="pt-20 relative z-10">
          <div className="max-w-7xl mx-auto px-4 py-6">

            {/* Page Title */}
            <div className="mb-5 fo-fade-up">
              <h1 className="font-playfair text-3xl md:text-4xl font-bold text-primary">My Prime</h1>
              <p className="text-white/70 text-sm mt-1">Membership Dashboard</p>
            </div>

            {/* Membership Card */}
            <div className="mb-5">
              <div className={`prime-membership-card relative overflow-hidden rounded-[22px] border ${tier.border} bg-[#0d0d0e] shadow-[0_24px_70px_rgba(0,0,0,0.42)]`}>
                <div className={`absolute inset-0 bg-gradient-to-br ${tier.gradient}`} />
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/75 to-transparent" />
                <div className="absolute -right-16 -bottom-20 h-64 w-64 opacity-[0.045]">
                  <Image
                    src="/apple-touch-icon.png"
                    alt=""
                    fill
                    className="object-contain mix-blend-screen"
                    aria-hidden="true"
                  />
                </div>
                <div className="absolute right-5 top-[5.25rem] h-24 w-24 rounded-full border border-primary/[0.06]" />
                <div className="absolute right-9 top-[6.25rem] h-16 w-16 rounded-full border border-primary/[0.05]" />
                <div className="prime-card-sheen absolute inset-y-0 -left-1/2 w-1/3" aria-hidden="true" />
                <span className="prime-card-sparkle absolute right-[19%] top-8" aria-hidden="true" />
                <span className="prime-card-sparkle absolute right-8 top-[48%] [animation-delay:1.6s]" aria-hidden="true" />
                <span className="prime-card-sparkle prime-card-sparkle-small absolute left-[42%] bottom-7 [animation-delay:3.1s]" aria-hidden="true" />

                <div className="relative z-10 p-5 sm:p-6">
                  <div className="mb-6 flex items-start justify-between gap-4">
                    <div>
                      <div className="mb-1.5 flex items-center gap-2">
                        <span className="h-px w-5 bg-primary" />
                        <p className="text-[9px] font-semibold uppercase tracking-[0.24em] text-primary">DRW Prime</p>
                      </div>
                      <p className="text-xs font-medium tracking-wide text-white/65">Beauty & Wellness Membership</p>
                    </div>
                    <TierBadge tier={membership.tier} />
                  </div>

                  <div className="mb-7 flex items-center gap-4">
                    <div className="relative h-[62px] w-[62px] flex-shrink-0 rounded-full border border-primary/55 bg-black p-[3px] shadow-[0_0_0_4px_rgba(212,175,55,0.07),0_12px_30px_rgba(0,0,0,0.55)]">
                      <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-full border border-primary/20 bg-[#151515]">
                        {user.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={user.imageUrl}
                            alt={`Foto profil ${displayName}`}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="text-sm font-semibold tracking-[0.08em] text-primary">{initials}</span>
                        )}
                        {avatarBusy && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/70">
                            <Hourglass size={20} />
                          </div>
                        )}
                      </div>
                      <label
                        title="Ganti foto profil"
                        aria-label="Ganti foto profil"
                        className="absolute -bottom-1 -right-1 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-primary/50 bg-[#15130d] text-primary shadow-[0_4px_12px_rgba(0,0,0,0.55)] transition-colors hover:bg-primary hover:text-black"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleAvatarChange}
                          disabled={avatarBusy}
                        />
                      </label>
                    </div>
                    <div className="min-w-0">
                      <p className="mb-1 text-[9px] font-medium uppercase tracking-[0.2em] text-white/35">Member</p>
                      <p className="truncate text-lg font-bold tracking-[0.01em] text-white">{displayName}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="h-px w-7 bg-primary/65" />
                        <p className="truncate text-[10px] tracking-wide text-white/40">{phone}</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 border-t border-white/[0.08] pt-4">
                    <div>
                      <p className="mb-1 text-[8px] font-medium uppercase tracking-[0.17em] text-white/35">Member Since</p>
                      <p className="text-xs font-semibold text-white/80">{formatDate(membership.memberSince)}</p>
                    </div>
                    <div className="border-l border-white/[0.08] pl-4 text-right">
                      <p className="mb-1 text-[8px] font-medium uppercase tracking-[0.17em] text-white/35">Total Spending</p>
                      <p className="text-xs font-semibold text-primary">{formatCurrency(membership.totalSpending)}</p>
                    </div>
                  </div>
                </div>
              </div>
              {avatarError && (
                <p role="alert" className="mt-2 text-[11px] text-red-400">{avatarError}</p>
              )}
            </div>

            {/* Poin Saya */}
            <div className="mb-5">
              <div className="fo-glass-card rounded-xl p-4 border-primary/35">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                    <h3 className="text-white font-bold text-sm">Poin Saya</h3>
                  </div>
                  <span className="text-primary font-bold text-lg">
                    {membership.points.toLocaleString('id-ID')}
                    <span className="text-xs font-normal text-white/50"> poin</span>
                  </span>
                </div>
                {membership.pointHistory.length === 0 ? (
                  <p className="text-white/40 text-xs">
                    Belum ada perolehan poin. Poin didapat dari setiap transaksi treatment Anda.
                  </p>
                ) : (
                  <div className="space-y-2">
                    <p className="text-white/40 text-[10px] uppercase tracking-wider">Riwayat Perolehan</p>
                    {membership.pointHistory.map((p) => (
                      <div key={p.id} className="flex items-center justify-between bg-black/30 border border-white/10 rounded-lg px-3 py-2">
                        <div className="min-w-0">
                          <p className="text-white/80 text-xs truncate">{p.treatment || 'Transaksi treatment'}</p>
                          <p className="text-white/40 text-[10px]">{formatShortDate(p.spendingDate)} · {formatCurrency(p.amount)}</p>
                        </div>
                        <span className="text-primary text-xs font-semibold whitespace-nowrap ml-2">+{p.pointsEarned}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* QR Member */}
            <MemberQrCard />

            {/* Tier Progress */}
            {membership.nextTier && (
              <div className="mb-5">
                <div className="fo-glass-card rounded-xl p-4 border-primary/35">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-white/70 text-xs font-semibold">Progress ke {TIER_CONFIG[membership.nextTier].label}</p>
                    <p className="text-white/50 text-[10px]">{membership.progressPercent}%</p>
                  </div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${tier.progress}`}
                      style={{ width: `${membership.progressPercent}%` }}
                    ></div>
                  </div>
                  <p className="text-white/40 text-[10px] mt-1.5">
                    Tambah {formatCurrency(membership.amountToNextTier!)} untuk naik ke {TIER_CONFIG[membership.nextTier].label}
                  </p>
                </div>
              </div>
            )}

            {/* Benefits */}
            <div className="mb-5">
              <div className={`bg-gradient-to-br ${tier.gradient} border ${tier.border} rounded-xl p-4`}>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-white">
                  <span className={`h-1.5 w-1.5 rounded-full ${tier.marker}`} />
                  <span>Benefit Member {tier.label}</span>
                </h3>
                <ul className="space-y-2">
                  {membership.benefits.map((benefit, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <svg className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-white/80 text-xs">{benefit}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Affiliate Dashboard Card (if team leader) */}
            {membership.isTeamLeader && (
              <div className="mb-5">
                <Link href="/affiliate-dashboard">
                  <div className="bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/40 rounded-xl p-4 flex items-center justify-between hover:border-primary/70 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary/20 border border-primary/30 rounded-lg flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-white font-semibold text-sm">Dashboard Afiliator</p>
                        <p className="text-white/50 text-xs">Kelola komisi & referral Anda</p>
                      </div>
                    </div>
                    <svg className="w-5 h-5 text-primary/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
              </div>
            )}

            {/* Install App (mobile, di bawah Dashboard Afiliator) */}
            <InstallPrompt />

            {/* Transaction History */}
            <div>
              <div className="fo-glass-card rounded-xl p-4 border-primary/35">
                <h3 className="font-bold text-sm text-white mb-3">Riwayat Kunjungan</h3>
                {membership.reservations.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-3">
                      <svg className="w-6 h-6 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <p className="text-white/50 text-sm">Belum ada riwayat kunjungan</p>
                    <Link href="/reservation" className="inline-block mt-3 text-primary text-xs hover:underline">
                      Buat reservasi pertama Anda →
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {membership.reservations.map((r) => (
                      <div key={r.id} className="bg-black/30 border border-white/10 rounded-lg p-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-semibold text-sm truncate">{r.treatmentName ?? 'Treatment'}</p>
                            <p className="text-white/60 text-xs mt-0.5">{r.patientName}</p>
                            <p className="text-white/40 text-[10px] mt-0.5">{formatShortDate(r.reservationDate)}</p>
                          </div>
                          <div className="text-right ml-3 flex-shrink-0">
                            <p className="text-white/80 text-xs font-semibold">{formatCurrency(r.finalPrice)}</p>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium mt-1 inline-block ${
                              r.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                              r.status === 'confirmed' ? 'bg-blue-500/20 text-blue-400' :
                              r.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                              'bg-red-500/20 text-red-400'
                            }`}>
                              {r.status === 'completed' ? 'Selesai' :
                               r.status === 'confirmed' ? 'Dikonfirmasi' :
                               r.status === 'pending' ? 'Pending' : 'Dibatalkan'}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Logout */}
            <div className="mt-8 mb-4 fo-fade-up">
              <button
                onClick={() => signOut(() => router.push('/'))}
                className="w-full fo-glass-card-soft border-red-500/20 text-red-400 hover:text-red-300 hover:bg-red-500/10 hover:border-red-500/35 font-semibold py-3.5 rounded-xl transition-all duration-300 text-sm flex items-center justify-center gap-2 group"
              >
                <svg className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Keluar
              </button>
            </div>

          </div>
        </div>
      </div>
    </MobileLayout>
  );
}
