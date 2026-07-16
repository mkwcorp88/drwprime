'use client';

import { useEffect, useState } from 'react';
import {
  ASSIGNMENT_TYPES,
  ASSIGNMENT_STATUSES,
  ASSIGNMENT_PRIORITIES,
  type MarketingAssignment,
} from '@/lib/marketing';

interface Props {
  open: boolean;
  initial?: MarketingAssignment | null;
  onClose: () => void;
  onSaved: () => void;
}

const empty = {
  title: '',
  type: 'design_request',
  description: '',
  status: 'todo',
  priority: 'medium',
  progress: 0,
  assigneeName: '',
  assigneeEmail: '',
  dueDate: '',
  tags: '',
  attachments: '',
};

export default function AssignmentFormModal({ open, initial, onClose, onSaved }: Props) {
  const [form, setForm] = useState({ ...empty });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (initial) {
      setForm({
        title: initial.title,
        type: initial.type,
        description: initial.description ?? '',
        status: initial.status,
        priority: initial.priority,
        progress: initial.progress,
        assigneeName: initial.assigneeName ?? '',
        assigneeEmail: initial.assigneeEmail ?? '',
        dueDate: initial.dueDate ? initial.dueDate.slice(0, 10) : '',
        tags: initial.tags.join(', '),
        attachments: initial.attachments.join('\n'),
      });
    } else {
      setForm({ ...empty });
    }
    setError('');
  }, [initial, open]);

  if (!open) return null;

  const update = (key: keyof typeof form, value: string | number) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async () => {
    if (!form.title.trim()) {
      setError('Judul wajib diisi');
      return;
    }
    setSaving(true);
    setError('');

    const payload = {
      title: form.title.trim(),
      type: form.type,
      description: form.description.trim() || null,
      status: form.status,
      priority: form.priority,
      progress: Number(form.progress) || 0,
      assigneeName: form.assigneeName.trim() || null,
      assigneeEmail: form.assigneeEmail.trim() || null,
      dueDate: form.dueDate || null,
      tags: form.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      attachments: form.attachments
        .split('\n')
        .map((a) => a.trim())
        .filter(Boolean),
    };

    try {
      const url = initial
        ? `/api/marketing/assignments/${initial.id}`
        : '/api/marketing/assignments';
      const method = initial ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan');
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan');
    } finally {
      setSaving(false);
    }
  };

  const field =
    'w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/40 focus:border-primary focus:outline-none';
  const label = 'mb-1 block text-xs font-medium text-white/70';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-primary/20 bg-[#101010] p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-primary">
            {initial ? 'Edit Assignment' : 'Assignment Baru'}
          </h2>
          <button onClick={onClose} className="text-white/50 hover:text-white">
            ✕
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className={label}>Judul *</label>
            <input
              className={field}
              value={form.title}
              onChange={(e) => update('title', e.target.value)}
              placeholder="mis. Request desain feed Instagram promo Juli"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={label}>Tipe</label>
              <select
                className={field}
                value={form.type}
                onChange={(e) => update('type', e.target.value)}
              >
                {ASSIGNMENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value} className="bg-[#101010]">
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={label}>Prioritas</label>
              <select
                className={field}
                value={form.priority}
                onChange={(e) => update('priority', e.target.value)}
              >
                {ASSIGNMENT_PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value} className="bg-[#101010]">
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={label}>Deskripsi</label>
            <textarea
              className={field}
              rows={3}
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
              placeholder="Detail brief, referensi, kebutuhan..."
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={label}>PIC / Assignee</label>
              <input
                className={field}
                value={form.assigneeName}
                onChange={(e) => update('assigneeName', e.target.value)}
                placeholder="Nama penanggung jawab"
              />
            </div>
            <div>
              <label className={label}>Email PIC</label>
              <input
                className={field}
                value={form.assigneeEmail}
                onChange={(e) => update('assigneeEmail', e.target.value)}
                placeholder="email@dermarich.id"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className={label}>Status</label>
              <select
                className={field}
                value={form.status}
                onChange={(e) => update('status', e.target.value)}
              >
                {ASSIGNMENT_STATUSES.map((s) => (
                  <option key={s.value} value={s.value} className="bg-[#101010]">
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={label}>Deadline</label>
              <input
                type="date"
                className={field}
                value={form.dueDate}
                onChange={(e) => update('dueDate', e.target.value)}
              />
            </div>
            <div>
              <label className={label}>Progress ({form.progress}%)</label>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                className="mt-3 w-full accent-[#d4af37]"
                value={form.progress}
                onChange={(e) => update('progress', Number(e.target.value))}
              />
            </div>
          </div>

          <div>
            <label className={label}>Tags (pisahkan dengan koma)</label>
            <input
              className={field}
              value={form.tags}
              onChange={(e) => update('tags', e.target.value)}
              placeholder="instagram, promo, video"
            />
          </div>

          <div>
            <label className={label}>Lampiran / Link (satu per baris)</label>
            <textarea
              className={field}
              rows={2}
              value={form.attachments}
              onChange={(e) => update('attachments', e.target.value)}
              placeholder="https://drive.google.com/..."
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-lg border border-white/15 px-4 py-2 text-sm text-white/80 hover:bg-white/5"
          >
            Batal
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-dark hover:bg-primary/90 disabled:opacity-60"
          >
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  );
}
