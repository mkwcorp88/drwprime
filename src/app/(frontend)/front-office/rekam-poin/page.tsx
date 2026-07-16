'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface MemberResult {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  points: number;
  totalSpending: number;
  hasAccount: boolean;
  tier: string;
}

export default function RekamPoinPage() {
  const [mode, setMode] = useState<'scan' | 'manual'>('manual');
  const router = useRouter();

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Rekam Poin Member</h1>
        <button
          onClick={() => router.push('/front-office')}
          className="text-sm text-gray-600 hover:text-gray-900"
        >
          ← Kembali
        </button>
      </div>

      {/* Tab Switch */}
      <div className="mb-6 flex gap-2 rounded-lg bg-gray-100 p-1">
        <button
          onClick={() => setMode('scan')}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition ${
            mode === 'scan'
              ? 'bg-white text-primary shadow'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          📷 Scan QR Member
        </button>
        <button
          onClick={() => setMode('manual')}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition ${
            mode === 'manual'
              ? 'bg-white text-primary shadow'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          ✍️ Input Manual (WA/Nama)
        </button>
      </div>

      {/* Content berdasarkan mode */}
      {mode === 'scan' ? <ScanQRMode /> : <ManualInputMode />}
    </div>
  );
}

function ScanQRMode() {
  const [qrToken, setQrToken] = useState('');
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<MemberResult | null>(null);

  const handleSearch = async () => {
    if (!qrToken.trim()) return;
    
    setSearching(true);
    try {
      const res = await fetch(`/api/front-office/member-lookup?token=${qrToken.trim()}`);
      const data = await res.json();
      
      if (res.ok) {
        setResult(data.member);
      } else {
        alert(`❌ ${data.error}`);
      }
    } catch {
      alert('❌ Gagal mencari member');
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="rounded-lg border bg-white p-6">
      <h2 className="mb-4 text-lg font-semibold">Scan QR Code Member</h2>
      
      {!result && (
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Masukkan QR Token
            </label>
            <input
              type="text"
              placeholder="UUID dari QR code"
              value={qrToken}
              onChange={(e) => setQrToken(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 focus:border-primary focus:outline-none"
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <p className="mt-1 text-xs text-gray-500">
              Atau gunakan QR scanner hardware yang terhubung ke komputer
            </p>
          </div>

          <button
            onClick={handleSearch}
            disabled={!qrToken.trim() || searching}
            className="w-full rounded-lg bg-primary py-3 font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {searching ? 'Mencari...' : '🔍 Cari Member'}
          </button>
        </div>
      )}

      {result && (
        <MemberFoundCard member={result} onReset={() => setResult(null)} />
      )}
    </div>
  );
}

function ManualInputMode() {
  const [phone, setPhone] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [amount, setAmount] = useState('');
  const [treatment, setTreatment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [memberInfo, setMemberInfo] = useState<MemberResult | null>(null);

  // Auto-format phone number: 08xxx → 62xxx
  const handlePhoneChange = (value: string) => {
    let cleaned = value.replace(/\D/g, ''); // Remove non-digits
    
    // Auto-convert 08xxx to 62xxx
    if (cleaned.startsWith('08')) {
      cleaned = '62' + cleaned.substring(1);
    }
    
    setPhone(cleaned);
  };

  // Check if member exists when phone is complete (blur event)
  const handlePhoneBlur = async () => {
    if (!phone || phone.length < 10) return;
    
    try {
      const res = await fetch(`/api/front-office/member-lookup?phone=${phone}`);
      if (res.ok) {
        const data = await res.json();
        setMemberInfo(data.member);
        setFirstName(data.member.name.split(' ')[0] || '');
        setLastName(data.member.name.split(' ').slice(1).join(' ') || '');
      } else {
        // Member not found - clear info
        setMemberInfo(null);
      }
    } catch {
      console.log('Failed to lookup member');
    }
  };

  const handleSubmit = async () => {
    // Validations
    if (!phone || phone.length < 10) {
      alert('❌ Nomor WhatsApp wajib diisi (min 10 digit)');
      return;
    }

    if (!firstName.trim()) {
      alert('❌ Nama customer wajib diisi');
      return;
    }

    const amountNum = Number(amount);
    if (!amount || amountNum <= 0) {
      alert('❌ Nominal spending wajib diisi');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/front-office/add-points-by-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone,
          firstName: firstName.trim(),
          lastName: lastName.trim() || undefined,
          amount: amountNum,
          treatment: treatment.trim() || undefined,
        }),
      });

      const data = await res.json();
      
      if (res.ok) {
        const tierMessage = data.tierUpgrade 
          ? `\n🎉 Naik tier: ${data.tierUpgrade.oldTier} → ${data.tierUpgrade.newTier}!`
          : '';
        
        alert(
          `✅ ${data.message}!\n\n` +
          `Customer: ${data.member.firstName} ${data.member.lastName || ''}\n` +
          `Poin ditambahkan: +${data.pointsEarned}\n` +
          `Total poin: ${data.member.points}\n` +
          `Total spending: Rp ${Number(data.member.totalSpending).toLocaleString('id-ID')}\n` +
          `Tier: ${data.member.tier}` +
          tierMessage
        );
        
        // Reset form
        setPhone('');
        setFirstName('');
        setLastName('');
        setAmount('');
        setTreatment('');
        setMemberInfo(null);
      } else {
        alert(`❌ Gagal: ${data.error}`);
      }
    } catch (err) {
      console.error(err);
      alert('❌ Gagal mencatat spending');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-lg border bg-white p-6">
      <h2 className="mb-4 text-lg font-semibold">Tambah Poin Member</h2>
      
      <div className="space-y-4">
        {/* Info member existing (if found) */}
        {memberInfo && (
          <div className="rounded-lg bg-blue-50 p-3 text-sm">
            <p className="font-semibold text-blue-900">✅ Member ditemukan:</p>
            <p className="text-blue-700">
              {memberInfo.name} • Poin: {memberInfo.points} • Tier: {memberInfo.tier}
            </p>
          </div>
        )}

        {/* Phone Number */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Nomor WhatsApp *
          </label>
          <input
            type="tel"
            placeholder="08123456789 atau 628123456789"
            value={phone}
            onChange={(e) => handlePhoneChange(e.target.value)}
            onBlur={handlePhoneBlur}
            className="w-full rounded-lg border px-3 py-2 focus:border-primary focus:outline-none"
            maxLength={15}
          />
          <p className="mt-1 text-xs text-gray-500">
            Ketik 08xxx akan otomatis jadi 62xxx
          </p>
          {phone && (
            <p className="mt-1 text-xs font-medium text-primary">
              Format tersimpan: {phone}
            </p>
          )}
        </div>

        {/* First Name */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Nama Depan *
          </label>
          <input
            type="text"
            placeholder="Jane"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 focus:border-primary focus:outline-none"
          />
          {memberInfo && (
            <p className="mt-1 text-xs text-gray-500">
              💡 Isi otomatis dari data member
            </p>
          )}
        </div>

        {/* Last Name */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Nama Belakang (opsional)
          </label>
          <input
            type="text"
            placeholder="Doe"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 focus:border-primary focus:outline-none"
          />
        </div>

        {/* Amount */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Nominal Spending *
          </label>
          <input
            type="number"
            placeholder="500000"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 focus:border-primary focus:outline-none"
          />
          <p className="mt-1 text-xs text-gray-500">
            1 poin = Rp 10.000 
            {amount && Number(amount) > 0 && (
              <span className="ml-2 font-semibold text-primary">
                → {Math.floor(Number(amount) / 10000)} poin
              </span>
            )}
          </p>
        </div>

        {/* Treatment */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Treatment (opsional)
          </label>
          <input
            type="text"
            placeholder="Facial Acne, Laser, dll"
            value={treatment}
            onChange={(e) => setTreatment(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 focus:border-primary focus:outline-none"
          />
        </div>

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={submitting || !phone || !firstName || !amount}
          className="w-full rounded-lg bg-primary py-3 font-semibold text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? 'Menyimpan...' : '✨ Rekam Poin'}
        </button>

        {/* Info helper */}
        <div className="rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
          <p className="font-semibold">ℹ️ Cara penggunaan:</p>
          <ul className="ml-4 mt-1 list-disc space-y-1">
            <li>Input nomor WA (08xxx akan otomatis jadi 62xxx)</li>
            <li>Jika member sudah terdaftar, nama akan otomatis terisi</li>
            <li>Jika member baru, sistem akan otomatis mendaftarkan</li>
            <li>Poin akan langsung ditambahkan ke akun member</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function MemberFoundCard({ member, onReset }: { member: MemberResult; onReset: () => void }) {
  const [amount, setAmount] = useState('');
  const [treatment, setTreatment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [firstName, setFirstName] = useState(member.name || '');

  const handleSubmit = async () => {
    const amountNum = Number(amount);
    if (!amount || amountNum <= 0) {
      alert('Nominal spending harus diisi');
      return;
    }

    // Jika member baru (id kosong), nama harus diisi
    if (!member.id && !firstName.trim()) {
      alert('Nama customer wajib diisi untuk member baru');
      return;
    }

    setSubmitting(true);
    try {
      // Gunakan API baru yang lebih efisien (auto create member jika belum ada)
      const res = await fetch('/api/front-office/add-points-by-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: member.phone,
          firstName: firstName.trim() || member.name,
          amount: amountNum,
          treatment: treatment.trim() || null,
        }),
      });

      const data = await res.json();
      
      if (res.ok) {
        const tierMessage = data.tierUpgrade 
          ? `\n🎉 Naik tier: ${data.tierUpgrade.oldTier} → ${data.tierUpgrade.newTier}!`
          : '';
        
        alert(
          `✅ ${data.message}!\n\n` +
          `Poin ditambahkan: +${data.pointsEarned}\n` +
          `Total poin: ${data.member.points}\n` +
          `Total spending: Rp ${Number(data.member.totalSpending).toLocaleString('id-ID')}` +
          tierMessage
        );
        onReset();
      } else {
        alert(`❌ Gagal: ${data.error}`);
      }
    } catch (err) {
      console.error(err);
      alert('❌ Gagal mencatat spending');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Member Info Card */}
      <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-4">
        <div className="mb-2 flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold">
              {member.name || '(Member Baru)'}
            </h3>
            <p className="text-sm text-gray-600">{member.phone}</p>
            {member.email && <p className="text-xs text-gray-500">{member.email}</p>}
          </div>
          <span className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white">
            {member.tier}
          </span>
        </div>
        
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-gray-500">Poin Saat Ini</p>
            <p className="text-xl font-bold text-primary">{member.points || 0}</p>
          </div>
          <div>
            <p className="text-gray-500">Total Spending</p>
            <p className="font-semibold">
              Rp {Number(member.totalSpending || 0).toLocaleString('id-ID')}
            </p>
          </div>
        </div>

        {!member.hasAccount && (
          <div className="mt-3 rounded bg-yellow-50 px-3 py-2 text-xs text-yellow-700">
            {member.id 
              ? '⚠️ Member ini belum punya akun DRW Prime. Poin akan otomatis ter-sync saat mereka daftar.' 
              : '✨ Member baru akan didaftarkan otomatis saat Anda rekam poin ini.'}
          </div>
        )}
      </div>

      {/* Spending Input */}
      <div className="space-y-3">
        {/* Nama field - show only for new members */}
        {!member.id && (
          <div>
            <label className="mb-1 block text-sm font-medium">Nama Customer *</label>
            <input
              type="text"
              placeholder="Nama lengkap customer"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 focus:border-primary focus:outline-none"
            />
          </div>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium">Nominal Spending *</label>
          <input
            type="number"
            placeholder="500000"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 focus:border-primary focus:outline-none"
          />
          <p className="mt-1 text-xs text-gray-500">
            1 poin = Rp 10.000 (misal: Rp 500.000 = 50 poin)
          </p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Treatment (opsional)</label>
          <input
            type="text"
            placeholder="Facial Acne, Laser, dll"
            value={treatment}
            onChange={(e) => setTreatment(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 focus:border-primary focus:outline-none"
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={onReset}
            className="flex-1 rounded-lg border py-2 text-sm hover:bg-gray-50"
          >
            Batal
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 rounded-lg bg-primary py-2 font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {submitting ? 'Menyimpan...' : member.id ? '✨ Rekam Poin' : '✨ Daftar & Rekam Poin'}
          </button>
        </div>
      </div>
    </div>
  );
}
