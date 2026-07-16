'use client';

import { useEffect, useState } from 'react';

interface MemberDetail {
  id: string;
  firstName: string;
  lastName: string | null;
  phone: string;
  email: string | null;
  nik: string | null;
  gender: string | null;
  dateOfBirth: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  points: number;
  totalSpending: number;
  lastTransactionAt: string | null;
  memberSince: string;
  hasAccount: boolean;
  tier: string;
  fullName: string;
  spendingRecords: Array<{
    id: string;
    amount: number;
    treatment: string | null;
    spendingDate: string;
    pointsEarned: number;
    source: string;
  }>;
  reservations: Array<{
    id: string;
    patientName: string;
    reservationDate: string;
    status: string;
    finalPrice: number;
    treatment: { name: string } | null;
  }>;
}

export default function MemberDetailModal({
  memberId,
  onClose,
}: {
  memberId: string;
  onClose: () => void;
}) {
  const [member, setMember] = useState<MemberDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMember();
  }, [memberId]);

  const loadMember = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/front-office/members/${memberId}`);
      const data = await res.json();
      if (res.ok) {
        setMember(data.member);
      }
    } catch (error) {
      console.error('Error loading member:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !member) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="rounded-lg bg-white p-8">Memuat...</div>
      </div>
    );
  }

  const tierColor = {
    SILVER: 'bg-gray-100 text-gray-700',
    GOLD: 'bg-yellow-100 text-yellow-700',
    PLATINUM: 'bg-purple-100 text-purple-700',
  }[member.tier] || 'bg-gray-100 text-gray-700';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div 
        className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-lg bg-white p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold">{member.fullName}</h2>
            <p className="text-sm text-gray-500">{member.phone}</p>
          </div>
          <button onClick={onClose} className="text-2xl text-gray-400 hover:text-gray-600">
            ×
          </button>
        </div>

        {/* Status & Tier */}
        <div className="mb-6 flex gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${tierColor}`}>
            {member.tier} Member
          </span>
          {member.hasAccount ? (
            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
              ✓ Punya Akun DRW Prime
            </span>
          ) : (
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
              Walk-in (Belum Daftar)
            </span>
          )}
        </div>

        {/* Stats Cards */}
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-lg border p-3">
            <p className="text-xs text-gray-500">Total Poin</p>
            <p className="text-2xl font-bold text-primary">{member.points.toLocaleString()}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-gray-500">Total Spending</p>
            <p className="text-lg font-bold">
              Rp {Number(member.totalSpending).toLocaleString('id-ID')}
            </p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-gray-500">Member Sejak</p>
            <p className="text-sm font-semibold">
              {new Date(member.memberSince).toLocaleDateString('id-ID', { 
                day: 'numeric', 
                month: 'short', 
                year: 'numeric' 
              })}
            </p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-gray-500">Transaksi Terakhir</p>
            <p className="text-sm font-semibold">
              {member.lastTransactionAt
                ? new Date(member.lastTransactionAt).toLocaleDateString('id-ID', { 
                    day: 'numeric', 
                    month: 'short' 
                  })
                : '-'}
            </p>
          </div>
        </div>

        {/* Profile Details */}
        <div className="mb-6 rounded-lg border p-4">
          <h3 className="mb-3 font-semibold">Profil Lengkap</h3>
          <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
            <div>
              <p className="text-gray-500">Email</p>
              <p className="font-medium">{member.email || '-'}</p>
            </div>
            <div>
              <p className="text-gray-500">NIK</p>
              <p className="font-medium">{member.nik || '-'}</p>
            </div>
            <div>
              <p className="text-gray-500">Jenis Kelamin</p>
              <p className="font-medium">{member.gender || '-'}</p>
            </div>
            <div>
              <p className="text-gray-500">Tanggal Lahir</p>
              <p className="font-medium">
                {member.dateOfBirth
                  ? new Date(member.dateOfBirth).toLocaleDateString('id-ID')
                  : '-'}
              </p>
            </div>
            <div className="col-span-1 md:col-span-2">
              <p className="text-gray-500">Alamat</p>
              <p className="font-medium">
                {[member.address, member.city, member.province].filter(Boolean).join(', ') || '-'}
              </p>
            </div>
          </div>
        </div>

        {/* Transaction History */}
        <div className="mb-4">
          <h3 className="mb-3 font-semibold">Riwayat Transaksi ({member.spendingRecords.length})</h3>
          <div className="max-h-64 overflow-y-auto rounded-lg border">
            {member.spendingRecords.length > 0 ? (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left">Tanggal</th>
                    <th className="px-3 py-2 text-left">Treatment</th>
                    <th className="px-3 py-2 text-right">Nominal</th>
                    <th className="px-3 py-2 text-right">Poin</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {member.spendingRecords.map((tx) => (
                    <tr key={tx.id}>
                      <td className="px-3 py-2">
                        {new Date(tx.spendingDate).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-3 py-2">{tx.treatment || '-'}</td>
                      <td className="px-3 py-2 text-right">
                        Rp {Number(tx.amount).toLocaleString('id-ID')}
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-primary">
                        +{tx.pointsEarned}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="py-8 text-center text-gray-400">
                Belum ada transaksi
              </div>
            )}
          </div>
        </div>

        {/* Reservations */}
        {member.reservations.length > 0 && (
          <div className="mb-4">
            <h3 className="mb-3 font-semibold">Reservasi ({member.reservations.length})</h3>
            <div className="max-h-48 overflow-y-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left">Tanggal</th>
                    <th className="px-3 py-2 text-left">Treatment</th>
                    <th className="px-3 py-2 text-center">Status</th>
                    <th className="px-3 py-2 text-right">Harga</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {member.reservations.map((res) => (
                    <tr key={res.id}>
                      <td className="px-3 py-2">
                        {new Date(res.reservationDate).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </td>
                      <td className="px-3 py-2">{res.treatment?.name || '-'}</td>
                      <td className="px-3 py-2 text-center">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-xs ${
                            res.status === 'completed'
                              ? 'bg-green-100 text-green-700'
                              : res.status === 'confirmed'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {res.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        Rp {Number(res.finalPrice).toLocaleString('id-ID')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 flex justify-end gap-3">
          {!member.hasAccount && (
            <SendInvitationButton memberId={member.id} memberPhone={member.phone} memberName={member.fullName} />
          )}
          <button
            onClick={onClose}
            className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}

// Tombol "Kirim Undangan Daftar" untuk walk-in member
function SendInvitationButton({
  memberId,
}: {
  memberId: string;
  memberPhone: string;
  memberName: string;
}) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSend = async () => {
    setSending(true);
    try {
      const res = await fetch('/api/front-office/send-invitation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId }),
      });
      if (res.ok) {
        setSent(true);
      } else {
        const data = await res.json();
        alert('Gagal mengirim undangan: ' + (data.error || 'Silakan coba lagi.'));
      }
    } catch {
      alert('Gagal mengirim undangan. Cek koneksi internet.');
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <button disabled className="rounded-lg bg-green-100 px-4 py-2 text-sm font-medium text-green-700">
        Terkirim
      </button>
    );
  }

  return (
    <button
      onClick={handleSend}
      disabled={sending}
      className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
    >
      {sending ? 'Mengirim...' : 'Kirim Undangan Daftar'}
    </button>
  );
}
