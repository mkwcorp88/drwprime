'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import MarketingHeader from '@/components/marketing/MarketingHeader';
import AssignmentFormModal from '@/components/marketing/AssignmentFormModal';
import AssignmentDetailModal from '@/components/marketing/AssignmentDetailModal';
import {
  ASSIGNMENT_TYPES,
  ASSIGNMENT_STATUSES,
  ASSIGNMENT_PRIORITIES,
  priorityMeta,
  typeLabel,
  type MarketingAssignment,
} from '@/lib/marketing';

interface Stats {
  total: number;
  statusCounts: Record<string, number>;
  typeCounts: Record<string, number>;
  priorityCounts: Record<string, number>;
  overdue: number;
  avgProgress: number;
}

type AssignmentRow = MarketingAssignment & { _count?: { comments: number } };

function formatDate(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
  });
}

function isOverdue(a: AssignmentRow) {
  return (
    a.dueDate &&
    new Date(a.dueDate) < new Date() &&
    a.status !== 'done' &&
    a.status !== 'cancelled'
  );
}

export default function MarketingDashboardPage() {
  const { isLoaded, isSignedIn } = useUser();
  const router = useRouter();

  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [search, setSearch] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<MarketingAssignment | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    const res = await fetch('/api/marketing/stats');
    if (res.ok) {
      const data = await res.json();
      setStats(data.stats);
    }
  }, []);

  const loadAssignments = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterStatus !== 'all') params.set('status', filterStatus);
    if (filterType !== 'all') params.set('type', filterType);
    if (filterPriority !== 'all') params.set('priority', filterPriority);
    if (search.trim()) params.set('q', search.trim());
    const res = await fetch(`/api/marketing/assignments?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      setAssignments(data.assignments);
    }
    setLoading(false);
  }, [filterStatus, filterType, filterPriority, search]);

  useEffect(() => {
    if (isLoaded && !isSignedIn) router.push('/sign-in');
  }, [isLoaded, isSignedIn, router]);

  useEffect(() => {
    if (isSignedIn) loadStats();
  }, [isSignedIn, loadStats]);

  useEffect(() => {
    if (isSignedIn) loadAssignments();
  }, [isSignedIn, loadAssignments]);

  const refresh = () => {
    loadAssignments();
    loadStats();
  };

  const grouped = useMemo(() => {
    const map: Record<string, AssignmentRow[]> = {};
    ASSIGNMENT_STATUSES.forEach((s) => (map[s.value] = []));
    assignments.forEach((a) => {
      (map[a.status] ??= []).push(a);
    });
    return map;
  }, [assignments]);

  if (!isLoaded || (!isSignedIn && isLoaded)) {
    return (
      <div className="flex min-h-screen items-center justify-center text-white/60">
        Memuat...
      </div>
    );
  }

  const doneCount = stats?.statusCounts?.done ?? 0;
  const inProgressCount = stats?.statusCounts?.in_progress ?? 0;

  return (
    <>
      <MarketingHeader />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white">Progres Digital Marketing</h1>
            <p className="text-sm text-white/60">
              Kelola request desain, project rebranding, konten & campaign.
            </p>
          </div>
          <button
            onClick={() => {
              setEditing(null);
              setShowForm(true);
            }}
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-dark hover:bg-primary/90"
          >
            + Assignment Baru
          </button>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard label="Total" value={stats?.total ?? 0} />
          <StatCard label="Dikerjakan" value={inProgressCount} accent="#3b82f6" />
          <StatCard label="Selesai" value={doneCount} accent="#22c55e" />
          <StatCard label="Overdue" value={stats?.overdue ?? 0} accent="#ef4444" />
          <StatCard label="Rata Progress" value={`${stats?.avgProgress ?? 0}%`} accent="#d4af37" />
        </div>

        <div className="mb-5 flex flex-wrap gap-2">
          <input
            className="min-w-[180px] flex-1 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/40 focus:border-primary focus:outline-none"
            placeholder="Cari judul / deskripsi..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select value={filterStatus} onChange={setFilterStatus} label="Status">
            <option value="all">Semua Status</option>
            {ASSIGNMENT_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
          <Select value={filterType} onChange={setFilterType} label="Tipe">
            <option value="all">Semua Tipe</option>
            {ASSIGNMENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
          <Select value={filterPriority} onChange={setFilterPriority} label="Prioritas">
            <option value="all">Semua Prioritas</option>
            {ASSIGNMENT_PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </Select>
        </div>

        {loading ? (
          <div className="py-16 text-center text-white/50">Memuat assignment...</div>
        ) : assignments.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 py-16 text-center text-white/50">
            Belum ada assignment. Klik “Assignment Baru” untuk mulai.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {ASSIGNMENT_STATUSES.filter((s) => s.value !== 'cancelled' || grouped[s.value]?.length).map(
              (col) => (
                <div key={col.value} className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
                  <div className="mb-3 flex items-center justify-between px-1">
                    <span className="flex items-center gap-2 text-sm font-semibold text-white/90">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: col.color }}
                      />
                      {col.label}
                    </span>
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/60">
                      {grouped[col.value]?.length ?? 0}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {grouped[col.value]?.map((a) => (
                      <AssignmentCard
                        key={a.id}
                        assignment={a}
                        onClick={() => setDetailId(a.id)}
                      />
                    ))}
                    {(!grouped[col.value] || grouped[col.value].length === 0) && (
                      <p className="px-1 py-4 text-center text-xs text-white/30">Kosong</p>
                    )}
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </main>

      <AssignmentFormModal
        open={showForm}
        initial={editing}
        onClose={() => setShowForm(false)}
        onSaved={refresh}
      />

      <AssignmentDetailModal
        assignmentId={detailId}
        onClose={() => setDetailId(null)}
        onChanged={refresh}
        onEdit={(a) => {
          setDetailId(null);
          setEditing(a);
          setShowForm(true);
        }}
      />
    </>
  );
}

function StatCard({
  label,
  value,
  accent = '#ffffff',
}: {
  label: string;
  value: number | string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-xs text-white/50">{label}</p>
      <p className="mt-1 text-2xl font-bold" style={{ color: accent }}>
        {value}
      </p>
    </div>
  );
}

function Select({
  value,
  onChange,
  label,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white focus:border-primary focus:outline-none [&>option]:bg-[#101010]"
    >
      {children}
    </select>
  );
}

function AssignmentCard({
  assignment,
  onClick,
}: {
  assignment: AssignmentRow;
  onClick: () => void;
}) {
  const pr = priorityMeta(assignment.priority);
  const overdue = isOverdue(assignment);
  const due = formatDate(assignment.dueDate);

  return (
    <button
      onClick={onClick}
      className="w-full rounded-xl border border-white/10 bg-[#141414] p-3 text-left transition hover:border-primary/40"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-wide text-primary">
          {typeLabel(assignment.type)}
        </span>
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-medium"
          style={{ backgroundColor: `${pr.color}22`, color: pr.color }}
        >
          {pr.label}
        </span>
      </div>

      <p className="mb-2 text-sm font-medium text-white line-clamp-2">{assignment.title}</p>

      <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${assignment.progress}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-[11px] text-white/50">
        <span className="truncate">{assignment.assigneeName || 'Belum ada PIC'}</span>
        <div className="flex items-center gap-2">
          {assignment._count?.comments ? <span>💬 {assignment._count.comments}</span> : null}
          {due && (
            <span className={overdue ? 'font-medium text-red-400' : ''}>
              {overdue ? '⚠ ' : ''}
              {due}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
