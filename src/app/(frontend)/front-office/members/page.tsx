'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import MemberDetailModal from '@/components/front-office/MemberDetailModal';

interface Member {
  id: string;
  firstName: string;
  lastName: string | null;
  phone: string;
  email: string | null;
  points: number;
  totalSpending: number;
  lastTransactionAt: string | null;
  hasAccount: boolean;
  memberSince: string;
  tier: string;
  fullName: string;
}

export default function MembersPage() {
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  const loadMembers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (filter !== 'all') params.set('filter', filter);

      const res = await fetch(`/api/front-office/members?${params}`);
      const data = await res.json();
      
      if (res.ok) {
        setMembers(data.members);
      }
    } catch (error) {
      console.error('Error loading members:', error);
    } finally {
      setLoading(false);
    }
  }, [search, filter]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Daftar Member</h1>
        <button
          onClick={() => router.push('/front-office')}
          className="text-sm text-gray-600 hover:text-gray-900"
        >
          ← Kembali
        </button>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Cari nama / nomor HP..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] rounded-lg border px-3 py-2 focus:border-primary focus:outline-none"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="rounded-lg border px-3 py-2 focus:border-primary focus:outline-none"
        >
          <option value="all">Semua Member</option>
          <option value="with_account">Punya Akun</option>
          <option value="walk_in">Walk-in Only</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="py-16 text-center text-gray-400">Memuat...</div>
      ) : members.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed py-16 text-center text-gray-400">
          Tidak ada member ditemukan
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-white">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold">Nama</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Terakhir Transaksi</th>
                <th className="px-4 py-3 text-center text-sm font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {members.map((m) => (
                <tr
                  key={m.id}
                  onClick={() => setSelectedMemberId(m.id)}
                  className="cursor-pointer transition hover:bg-gray-50"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium">{m.fullName}</div>
                    <div className="text-xs text-gray-500">{m.phone}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {m.lastTransactionAt
                      ? new Date(m.lastTransactionAt).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })
                      : '-'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {m.hasAccount ? (
                      <span className="inline-block rounded-full bg-green-100 px-2 py-1 text-xs text-green-700">
                        ✓ Punya Akun
                      </span>
                    ) : (
                      <span className="inline-block rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600">
                        Walk-in
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="border-t bg-gray-50 px-4 py-3 text-sm text-gray-600">
            Total: {members.length} member
          </div>
        </div>
      )}

      {/* Modal */}
      {selectedMemberId && (
        <MemberDetailModal
          memberId={selectedMemberId}
          onClose={() => setSelectedMemberId(null)}
        />
      )}
    </div>
  );
}
