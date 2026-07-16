'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  ASSIGNMENT_STATUSES,
  statusMeta,
  priorityMeta,
  typeLabel,
  type MarketingAssignment,
  type MarketingComment,
} from '@/lib/marketing';

interface Props {
  assignmentId: string | null;
  onClose: () => void;
  onChanged: () => void;
  onEdit: (a: MarketingAssignment) => void;
}

function formatDate(value: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AssignmentDetailModal({
  assignmentId,
  onClose,
  onChanged,
  onEdit,
}: Props) {
  const [assignment, setAssignment] = useState<MarketingAssignment | null>(null);
  const [loading, setLoading] = useState(false);
  const [comment, setComment] = useState('');
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    if (!assignmentId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/marketing/assignments/${assignmentId}`);
      const data = await res.json();
      if (res.ok) setAssignment(data.assignment);
    } finally {
      setLoading(false);
    }
  }, [assignmentId]);

  useEffect(() => {
    if (assignmentId) load();
    else setAssignment(null);
  }, [assignmentId, load]);

  if (!assignmentId) return null;

  const patch = async (body: Record<string, unknown>) => {
    const res = await fetch(`/api/marketing/assignments/${assignmentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      await load();
      onChanged();
    }
  };

  const handleDelete = async () => {
    if (!confirm('Hapus assignment ini?')) return;
    const res = await fetch(`/api/marketing/assignments/${assignmentId}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      onChanged();
      onClose();
    }
  };

  const handleComment = async () => {
    if (!comment.trim()) return;
    setPosting(true);
    try {
      const res = await fetch(`/api/marketing/assignments/${assignmentId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: comment.trim() }),
      });
      if (res.ok) {
        setComment('');
        await load();
      }
    } finally {
      setPosting(false);
    }
  };

  const st = assignment ? statusMeta(assignment.status) : null;
  const pr = assignment ? priorityMeta(assignment.priority) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-primary/20 bg-[#101010] p-6 shadow-2xl">
        {loading || !assignment ? (
          <div className="py-16 text-center text-white/50">Memuat...</div>
        ) : (
          <>
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <span className="text-xs uppercase tracking-wide text-primary">
                  {typeLabel(assignment.type)}
                </span>
                <h2 className="mt-1 text-xl font-semibold text-white">{assignment.title}</h2>
              </div>
              <button onClick={onClose} className="text-white/50 hover:text-white">
                ✕
              </button>
            </div>

            <div className="mb-4 flex flex-wrap gap-2">
              <span
                className="rounded-full px-3 py-1 text-xs font-medium"
                style={{ backgroundColor: `${st!.color}22`, color: st!.color }}
              >
                {st!.label}
              </span>
              <span
                className="rounded-full px-3 py-1 text-xs font-medium"
                style={{ backgroundColor: `${pr!.color}22`, color: pr!.color }}
              >
                Prioritas: {pr!.label}
              </span>
            </div>

            {assignment.description && (
              <p className="mb-4 whitespace-pre-wrap text-sm text-white/80">
                {assignment.description}
              </p>
            )}

            <div className="mb-4">
              <div className="mb-1 flex justify-between text-xs text-white/60">
                <span>Progress</span>
                <span>{assignment.progress}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${assignment.progress}%` }}
                />
              </div>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-white/50">PIC</p>
                <p className="text-white/90">{assignment.assigneeName || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-white/50">Deadline</p>
                <p className="text-white/90">{formatDate(assignment.dueDate)}</p>
              </div>
              <div>
                <p className="text-xs text-white/50">Requester</p>
                <p className="text-white/90">{assignment.requesterName || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-white/50">Dibuat</p>
                <p className="text-white/90">{formatDate(assignment.createdAt)}</p>
              </div>
            </div>

            {assignment.tags.length > 0 && (
              <div className="mb-4 flex flex-wrap gap-2">
                {assignment.tags.map((t) => (
                  <span key={t} className="rounded bg-white/10 px-2 py-0.5 text-xs text-white/70">
                    #{t}
                  </span>
                ))}
              </div>
            )}

            {assignment.attachments.length > 0 && (
              <div className="mb-4">
                <p className="mb-1 text-xs text-white/50">Lampiran</p>
                <ul className="space-y-1">
                  {assignment.attachments.map((a) => (
                    <li key={a}>
                      <a
                        href={a}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary underline break-all hover:text-primary-light"
                      >
                        {a}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mb-5">
              <p className="mb-2 text-xs text-white/50">Ubah status cepat</p>
              <div className="flex flex-wrap gap-2">
                {ASSIGNMENT_STATUSES.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => patch({ status: s.value })}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                      assignment.status === s.value
                        ? 'ring-2 ring-primary'
                        : 'opacity-70 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: `${s.color}22`, color: s.color }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-5 border-t border-white/10 pt-4">
              <p className="mb-3 text-sm font-medium text-white/80">
                Komentar ({assignment.comments?.length ?? 0})
              </p>
              <div className="mb-3 space-y-3">
                {assignment.comments?.map((c: MarketingComment) => (
                  <div key={c.id} className="rounded-lg bg-white/5 p-3">
                    <div className="mb-1 flex justify-between text-xs text-white/50">
                      <span className="font-medium text-white/80">{c.authorName || 'Anonim'}</span>
                      <span>{formatDateTime(c.createdAt)}</span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm text-white/80">{c.body}</p>
                  </div>
                ))}
                {(!assignment.comments || assignment.comments.length === 0) && (
                  <p className="text-sm text-white/40">Belum ada komentar.</p>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  className="flex-1 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/40 focus:border-primary focus:outline-none"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleComment()}
                  placeholder="Tulis komentar / update..."
                />
                <button
                  onClick={handleComment}
                  disabled={posting}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-dark hover:bg-primary/90 disabled:opacity-60"
                >
                  Kirim
                </button>
              </div>
            </div>

            <div className="flex justify-between border-t border-white/10 pt-4">
              <button
                onClick={handleDelete}
                className="rounded-lg border border-red-500/30 px-4 py-2 text-sm text-red-300 hover:bg-red-500/10"
              >
                Hapus
              </button>
              <button
                onClick={() => onEdit(assignment)}
                className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-dark hover:bg-primary/90"
              >
                Edit
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
