'use client';

import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import MobileLayout from '@/components/MobileLayout';
import LoadingScreen, { Hourglass } from '@/components/LoadingScreen';
import { getKabupaten } from '@/data/wilayah';

const PROVINCES = [
  'Aceh', 'Sumatera Utara', 'Sumatera Barat', 'Riau', 'Jambi', 'Sumatera Selatan',
  'Bengkulu', 'Lampung', 'Kepulauan Bangka Belitung', 'Kepulauan Riau',
  'DKI Jakarta', 'Jawa Barat', 'Jawa Tengah', 'DI Yogyakarta', 'Jawa Timur', 'Banten',
  'Bali', 'Nusa Tenggara Barat', 'Nusa Tenggara Timur',
  'Kalimantan Barat', 'Kalimantan Tengah', 'Kalimantan Selatan', 'Kalimantan Timur', 'Kalimantan Utara',
  'Sulawesi Utara', 'Sulawesi Tengah', 'Sulawesi Selatan', 'Sulawesi Tenggara', 'Gorontalo', 'Sulawesi Barat',
  'Maluku', 'Maluku Utara',
  'Papua', 'Papua Barat', 'Papua Selatan', 'Papua Tengah', 'Papua Pegunungan', 'Papua Barat Daya',
];

interface ProfileForm {
  phone: string;
  nik: string;
  gender: string;
  dateOfBirth: string;
  address: string;
  city: string;
  province: string;
}

const EMPTY_FORM: ProfileForm = {
  phone: '',
  nik: '',
  gender: '',
  dateOfBirth: '',
  address: '',
  city: '',
  province: '',
};

const inputClass =
  'w-full fo-glass-input px-4 py-2.5 rounded-lg text-sm placeholder:text-white/30 [&>option]:text-black';

type Tier = 'SILVER' | 'GOLD' | 'PLATINUM';

const TIER_RING: Record<Tier, string> = {
  SILVER: 'border-slate-300 shadow-[0_0_12px_rgba(203,213,225,0.5)]',
  GOLD: 'border-primary shadow-[0_0_14px_rgba(212,175,55,0.6)]',
  PLATINUM: 'border-violet-400 shadow-[0_0_14px_rgba(167,139,250,0.6)]',
};

export default function ProfilePage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [form, setForm] = useState<ProfileForm>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const [tier, setTier] = useState<Tier>('SILVER');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [alreadyComplete, setAlreadyComplete] = useState(false);

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      let res = await fetch('/api/profile');

      if (res.status === 404) {
        // User not yet synced to DB — sync then retry
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
          setError(data?.error || 'Gagal menyiapkan akun member. Silakan coba lagi.');
          return;
        }
        res = await fetch('/api/profile');
      }

      if (!res.ok) {
        setError('Gagal memuat data profil. Silakan refresh halaman.');
        return;
      }

      const data = await res.json();
      const p = data.profile;
      setForm({
        phone: p.phone ?? '',
        nik: p.nik ?? '',
        gender: p.gender ?? '',
        dateOfBirth: p.dateOfBirth ?? '',
        address: p.address ?? '',
        city: p.city ?? '',
        province: p.province ?? '',
      });
      setAlreadyComplete(Boolean(p.isComplete));

      try {
        const memRes = await fetch('/api/membership');
        if (memRes.ok) {
          const memData = await memRes.json();
          if (memData.membership?.tier) setTier(memData.membership.tier as Tier);
        }
      } catch {
        // abaikan; default SILVER
      }
    } catch (err) {
      console.error('Load profile error:', err);
      setError('Terjadi kesalahan saat memuat profil.');
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
    loadProfile();
  }, [isLoaded, user, loadProfile]);

  const handlePhoneChange = (value: string) => {
    let cleaned = value.replace(/\D/g, '');
    if (cleaned.startsWith('08')) {
      cleaned = '62' + cleaned.substring(1);
    } else if (cleaned.startsWith('8') && !cleaned.startsWith('62')) {
      cleaned = '62' + cleaned;
    }
    setForm((prev) => ({ ...prev, phone: cleaned }));
    setFieldErrors((prev) => {
      if (!prev.phone) return prev;
      const next = { ...prev };
      delete next.phone;
      return next;
    });
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    if (name === 'phone') {
      handlePhoneChange(value);
      return;
    }
    setForm((prev) => ({
      ...prev,
      [name]: value,
      ...(name === 'province' ? { city: '' } : {}),
    }));
    setFieldErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setFieldErrors({});

    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.fields) {
          setFieldErrors(data.fields);
          setError('Periksa kembali data yang Anda isi.');
        } else {
          setError(data.error || 'Gagal menyimpan profil.');
        }
        return;
      }

      setSuccess(true);
      setTimeout(() => router.push('/my-prime'), 1800);
    } catch (err) {
      console.error('Save profile error:', err);
      setError('Terjadi kesalahan saat menyimpan profil.');
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
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
    } catch (err) {
      console.error('Avatar upload error:', err);
      setAvatarError('Gagal mengunggah foto. Coba lagi.');
    } finally {
      setAvatarBusy(false);
    }
  };

  if (!isLoaded || loading) {
    return (
      <MobileLayout>
        <LoadingScreen label="Memuat profil..." />
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

  if (success) {
    return (
      <MobileLayout>
        <div className="min-h-screen bg-black flex items-center justify-center p-4">
          <div className="text-center max-w-sm">
            <div className="w-16 h-16 bg-primary/20 border border-primary/40 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-white font-bold text-lg mb-1">Profil Tersimpan!</h2>
            <p className="text-white/60 text-sm">Selamat, profil member DRW Prime Anda telah lengkap.</p>
          </div>
        </div>
      </MobileLayout>
    );
  }

  const renderError = (name: keyof ProfileForm) =>
    fieldErrors[name] ? (
      <p className="text-red-400 text-[11px] mt-1">{fieldErrors[name]}</p>
    ) : null;

  const cityOptions = getKabupaten(form.province);

  return (
    <MobileLayout>
      <Navbar />
      <div className="min-h-screen fo-glass-page mp-theme-bright">
        <div className="pt-20 relative z-10">
          <div className="max-w-2xl mx-auto px-4 py-6">

            <Link
              href="/my-prime"
              className="inline-flex items-center gap-1.5 text-white/50 hover:text-primary text-xs mb-4 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Kembali ke My Prime
            </Link>

            <div className="mb-5 fo-fade-up">
              <h1 className="font-playfair text-2xl md:text-3xl font-bold text-primary">Lengkapi Profil</h1>
              <p className="text-white/70 text-sm mt-1">
                Lengkapi data pribadi untuk menjadi member DRW Prime
              </p>
            </div>

            {/* Foto Profil */}
            <div className="fo-glass-card fo-fade-up rounded-xl p-6 border-primary/35 mb-4 flex flex-col items-center gap-3">
              <div className="relative">
                <div className={`w-24 h-24 rounded-full overflow-hidden border-2 ${TIER_RING[tier]} bg-white/10 flex items-center justify-center`}>
                  {user.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.imageUrl} alt="Foto profil" className="w-full h-full object-cover" />
                  ) : (
                    <svg className="w-10 h-10 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  )}
                </div>
                {avatarBusy && (
                  <div className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center">
                    <Hourglass size={22} />
                  </div>
                )}
              </div>

              <label className="fo-glass-card-soft border-primary/35 text-primary px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer hover:bg-primary/20 transition-colors inline-flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {avatarBusy ? 'Mengunggah...' : 'Ubah Foto Profil'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarChange}
                  disabled={avatarBusy}
                />
              </label>
              {avatarError && <p className="text-red-400 text-xs">{avatarError}</p>}
            </div>

            {alreadyComplete && (
              <div className="mb-4 p-3 bg-primary/10 backdrop-blur-md border border-primary/25 rounded-xl flex items-center gap-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                <svg className="w-4 h-4 text-primary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <p className="text-white/70 text-xs">Profil Anda sudah lengkap. Anda bisa memperbarui datanya di sini.</p>
              </div>
            )}

            {error && (
              <div className="mb-4 p-3 bg-red-500/10 backdrop-blur-md border border-red-500/30 rounded-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                <p className="text-red-400 text-xs">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="fo-glass-card fo-fade-up rounded-xl p-6 border-primary/35 space-y-4">
                <h3 className="text-white font-semibold text-sm">Data Pribadi</h3>

                <div>
                  <label className="block text-white/70 text-xs mb-1.5">Nomor HP / WhatsApp *</label>
                  <input
                    type="tel"
                    name="phone"
                    inputMode="tel"
                    value={form.phone}
                    onChange={handleChange}
                    placeholder="08123456789"
                    maxLength={15}
                    className={inputClass}
                  />
                  <p className="mt-1 text-white/40 text-[11px]">
                    Ketik 08xxx akan otomatis jadi 62xxx
                  </p>
                  {form.phone && (
                    <p className="mt-0.5 text-primary text-[11px] font-medium">
                      Format tersimpan: {form.phone}
                    </p>
                  )}
                  {renderError('phone')}
                </div>

                <div>
                  <label className="block text-white/70 text-xs mb-1.5">NIK (No. KTP) *</label>
                  <input
                    type="text"
                    name="nik"
                    inputMode="numeric"
                    maxLength={16}
                    value={form.nik}
                    onChange={handleChange}
                    placeholder="16 digit nomor KTP"
                    className={inputClass}
                  />
                  {renderError('nik')}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-white/70 text-xs mb-1.5">Jenis Kelamin *</label>
                    <select
                      name="gender"
                      value={form.gender}
                      onChange={handleChange}
                      className={inputClass}
                    >
                      <option value="" className="bg-white text-black">Pilih jenis kelamin</option>
                      <option value="Pria" className="bg-white text-black">Pria</option>
                      <option value="Wanita" className="bg-white text-black">Wanita</option>
                    </select>
                    {renderError('gender')}
                  </div>

                  <div>
                    <label className="block text-white/70 text-xs mb-1.5">Tanggal Lahir *</label>
                    <input
                      type="date"
                      name="dateOfBirth"
                      value={form.dateOfBirth}
                      onChange={handleChange}
                      max={new Date().toISOString().split('T')[0]}
                      className={`${inputClass} [color-scheme:dark]`}
                    />
                    {renderError('dateOfBirth')}
                  </div>
                </div>
              </div>

              <div className="fo-glass-card fo-fade-up rounded-xl p-6 border-primary/35 space-y-4">
                <h3 className="text-white font-semibold text-sm">Alamat</h3>

                <div>
                  <label className="block text-white/70 text-xs mb-1.5">Alamat Lengkap *</label>
                  <textarea
                    name="address"
                    rows={3}
                    value={form.address}
                    onChange={handleChange}
                    placeholder="Nama jalan, nomor rumah, RT/RW, kelurahan, kecamatan"
                    className={inputClass}
                  />
                  {renderError('address')}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-white/70 text-xs mb-1.5">Provinsi *</label>
                    <select
                      name="province"
                      value={form.province}
                      onChange={handleChange}
                      className={inputClass}
                    >
                      <option value="" className="bg-white text-black">Pilih provinsi</option>
                      {PROVINCES.map((p) => (
                        <option key={p} value={p} className="bg-white text-black">{p}</option>
                      ))}
                    </select>
                    {renderError('province')}
                  </div>

                  <div>
                    <label className="block text-white/70 text-xs mb-1.5">Kota / Kabupaten *</label>
                    <select
                      name="city"
                      value={form.city}
                      onChange={handleChange}
                      disabled={!form.province}
                      className={`${inputClass} disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      <option value="" className="bg-white text-black">
                        {form.province ? 'Pilih kota/kabupaten' : 'Pilih provinsi dulu'}
                      </option>
                      {form.city && !cityOptions.includes(form.city) && (
                        <option value={form.city} className="bg-white text-black">{form.city}</option>
                      )}
                      {cityOptions.map((c) => (
                        <option key={c} value={c} className="bg-white text-black">{c}</option>
                      ))}
                    </select>
                    {renderError('city')}
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full bg-primary text-dark font-semibold text-sm py-3 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Menyimpan...' : 'Simpan Profil'}
              </button>
            </form>

          </div>
        </div>
      </div>
    </MobileLayout>
  );
}
