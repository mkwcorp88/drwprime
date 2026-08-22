'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { useRunningText } from '@/components/RunningTextProvider';

type Banner = {
  id: string;
  title: string;
  imageDesktopUrl: string;
  imageDesktopKey: string;
  imageMobileUrl: string | null;
  imageMobileKey: string | null;
  imageAlt: string;
  heading: string | null;
  description: string | null;
  ctaText: string | null;
  ctaLink: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

const initialForm = {
  title: '',
  imageDesktopUrl: '',
  imageDesktopKey: '',
  imageMobileUrl: '',
  imageMobileKey: '',
  imageAlt: '',
  heading: '',
  description: '',
  ctaText: '',
  ctaLink: '',
  sortOrder: '0',
  isActive: true,
};

export default function ProductBannerManager() {
  const { runningText, setRunningText } = useRunningText();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningTextDraft, setRunningTextDraft] = useState(runningText);
  const [runningTextSaving, setRunningTextSaving] = useState(false);
  const [runningTextError, setRunningTextError] = useState('');
  const [runningTextSuccess, setRunningTextSuccess] = useState('');

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [uploadingDesktop, setUploadingDesktop] = useState(false);
  const [uploadingMobile, setUploadingMobile] = useState(false);

  const fetchBanners = useCallback(async () => {
    try {
      const res = await fetch('/api/front-office/product-banners');
      const data = await res.json();
      if (res.ok) setBanners(data.banners || []);
    } catch { /* non-critical */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchBanners(); }, [fetchBanners]);

  useEffect(() => {
    setRunningTextDraft(runningText);
  }, [runningText]);

  const handleRunningTextSave = async () => {
    const text = runningTextDraft.trim();
    if (!text) {
      setRunningTextError('Running text wajib diisi');
      setRunningTextSuccess('');
      return;
    }

    setRunningTextSaving(true);
    setRunningTextError('');
    setRunningTextSuccess('');

    try {
      const res = await fetch('/api/front-office/running-text', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();

      if (!res.ok) {
        setRunningTextError(data.error || 'Gagal menyimpan running text');
        return;
      }

      setRunningText(data.text);
      setRunningTextDraft(data.text);
      setRunningTextSuccess(data.message || 'Running text berhasil disimpan');
    } catch {
      setRunningTextError('Gagal menyimpan running text');
    } finally {
      setRunningTextSaving(false);
    }
  };

  const openCreate = () => {
    setForm(initialForm);
    setEditingId(null);
    setFormError('');
    setFormSuccess('');
    setEditorOpen(true);
  };

  const openEdit = (b: Banner) => {
    setForm({
      title: b.title,
      imageDesktopUrl: b.imageDesktopUrl,
      imageDesktopKey: b.imageDesktopKey,
      imageMobileUrl: b.imageMobileUrl || '',
      imageMobileKey: b.imageMobileKey || '',
      imageAlt: b.imageAlt,
      heading: b.heading || '',
      description: b.description || '',
      ctaText: b.ctaText || '',
      ctaLink: b.ctaLink || '',
      sortOrder: String(b.sortOrder),
      isActive: b.isActive,
    });
    setEditingId(b.id);
    setFormError('');
    setFormSuccess('');
    setEditorOpen(true);
  };

  const uploadImage = async (file: File): Promise<{ url: string; pathname: string } | null> => {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/front-office/product-banners/upload', { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok) { setFormError(data.error || 'Upload gagal'); return null; }
    return data;
  };

  const handleDesktopUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingDesktop(true);
    const result = await uploadImage(file);
    if (result) setForm(f => ({ ...f, imageDesktopUrl: result.url, imageDesktopKey: result.pathname }));
    setUploadingDesktop(false);
    e.target.value = '';
  };

  const handleMobileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingMobile(true);
    const result = await uploadImage(file);
    if (result) setForm(f => ({ ...f, imageMobileUrl: result.url, imageMobileKey: result.pathname }));
    setUploadingMobile(false);
    e.target.value = '';
  };

  const handleSave = async () => {
    if (!form.title.trim()) { setFormError('Judul wajib diisi'); return; }
    if (!form.imageDesktopUrl) { setFormError('Gambar desktop wajib diupload'); return; }
    if (!form.imageAlt.trim()) { setFormError('Alt text wajib diisi'); return; }

    setSaving(true);
    setFormError('');
    setFormSuccess('');

    const payload = {
      id: editingId,
      title: form.title,
      imageDesktopUrl: form.imageDesktopUrl,
      imageDesktopKey: form.imageDesktopKey,
      imageMobileUrl: form.imageMobileUrl || null,
      imageMobileKey: form.imageMobileKey || null,
      imageAlt: form.imageAlt,
      heading: form.heading || null,
      description: form.description || null,
      ctaText: form.ctaText || null,
      ctaLink: form.ctaLink || null,
      sortOrder: Number(form.sortOrder) || 0,
      isActive: form.isActive,
    };

    const url = '/api/front-office/product-banners';
    const method = editingId ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await res.json();

    if (!res.ok) { setFormError(data.error || 'Gagal menyimpan'); setSaving(false); return; }

    setFormSuccess(data.message || 'Berhasil');
    setSaving(false);
    setEditorOpen(false);
    fetchBanners();
  };

  const handleToggle = async (b: Banner) => {
    await fetch('/api/front-office/product-banners', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: b.id, isActive: !b.isActive }),
    });
    fetchBanners();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus banner ini? Gambar juga akan dihapus dari storage.')) return;
    await fetch(`/api/front-office/product-banners?id=${id}`, { method: 'DELETE' });
    fetchBanners();
  };

  if (loading) return <div className="text-center py-20 text-white/30">Memuat data banner...</div>;

  const sorted = [...banners].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <>
      <section className="fo-glass-card-soft rounded-2xl p-5 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
          <div>
            <h2 className="font-semibold text-white/85">Running Text</h2>
            <p className="text-xs text-white/40 mt-1">Teks ini tampil di bagian paling atas website pada desktop dan mobile.</p>
          </div>
          <span className="text-[10px] text-white/30 shrink-0">{runningTextDraft.length}/500 karakter</span>
        </div>

        <textarea
          value={runningTextDraft}
          onChange={e => {
            setRunningTextDraft(e.target.value);
            setRunningTextError('');
            setRunningTextSuccess('');
          }}
          maxLength={500}
          rows={3}
          className="fo-glass-input rounded-xl px-3 py-2.5 text-sm w-full resize-y"
          placeholder="Masukkan running text..."
        />

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-3">
          <div>
            {runningTextError && <p className="text-red-400 text-xs">{runningTextError}</p>}
            {runningTextSuccess && <p className="text-emerald-400 text-xs">{runningTextSuccess}</p>}
          </div>
          <button
            onClick={handleRunningTextSave}
            disabled={runningTextSaving || !runningTextDraft.trim() || runningTextDraft.trim() === runningText}
            className="fo-ios-btn fo-ios-btn-primary text-sm disabled:opacity-50"
          >
            {runningTextSaving ? 'Menyimpan...' : 'Simpan Running Text'}
          </button>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <p className="text-white/40 text-xs">{banners.length} banner — {banners.filter(b => b.isActive).length} aktif</p>
        <button onClick={openCreate} className="fo-ios-btn fo-ios-btn-primary text-sm">+ Banner Baru</button>
      </div>

      {sorted.length === 0 ? (
        <div className="text-center py-20 text-white/30">Belum ada banner</div>
      ) : (
        <div className="space-y-3">
          {sorted.map(b => (
            <div key={b.id} className={`fo-glass-card-soft rounded-xl p-4 flex flex-col sm:flex-row gap-4 items-start ${!b.isActive ? 'opacity-50' : ''}`}>
              <div className="w-24 h-14 rounded-lg flex items-center justify-center shrink-0 overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                {b.imageDesktopUrl ? (
                  <Image src={b.imageDesktopUrl} alt={b.imageAlt} width={96} height={56} className="object-cover w-full h-full" />
                ) : (
                  <span className="text-white/10 text-lg">🖼</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-white/85 text-sm">{b.title}</h3>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${b.isActive ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                    {b.isActive ? 'Aktif' : 'Nonaktif'}
                  </span>
                </div>
                <p className="text-xs text-white/35 mt-1">Urutan: {b.sortOrder}{b.imageMobileUrl ? ' — Desktop + Mobile' : ' — Desktop saja'}</p>
              </div>
              <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                <button onClick={() => openEdit(b)} className="fo-ios-btn fo-ios-btn-neutral text-xs">Edit</button>
                <button onClick={() => handleToggle(b)} className={`fo-ios-btn text-xs ${b.isActive ? 'fo-ios-btn-warn' : 'fo-ios-btn-success'}`}>
                  {b.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                </button>
                <button onClick={() => handleDelete(b.id)} className="fo-ios-btn fo-ios-btn-danger text-xs">Hapus</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Editor Modal */}
      {editorOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" onClick={() => setEditorOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto fo-glass-card-soft rounded-2xl p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-white/80">{editingId ? 'Edit Banner' : 'Banner Baru'}</h2>
              <button onClick={() => setEditorOpen(false)} className="text-white/30 hover:text-white/60 text-xl">&times;</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-white/50 mb-1">Judul Banner * (Hanya untuk Admin)</label>
                <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className="fo-glass-input rounded-xl px-3 py-2.5 text-sm w-full" placeholder="Nama internal (tidak tampil di depan)" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-white/50 mb-1">Gambar Desktop * (1920x1080)</label>
                {form.imageDesktopUrl && <Image src={form.imageDesktopUrl} alt="Preview desktop" width={192} height={108} className="rounded-lg mb-2 w-full object-cover" style={{ aspectRatio: '16/9' }} />}
                <label className={`fo-ios-btn fo-ios-btn-neutral text-xs inline-block cursor-pointer ${uploadingDesktop ? 'opacity-50' : ''}`}>
                  {uploadingDesktop ? 'Uploading...' : form.imageDesktopUrl ? 'Ganti Gambar Desktop' : 'Upload Gambar Desktop'}
                  <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleDesktopUpload} className="hidden" disabled={uploadingDesktop} />
                </label>
              </div>

              <div>
                <label className="block text-xs font-semibold text-white/50 mb-1">Gambar Mobile (opsional, 1080x1350)</label>
                {form.imageMobileUrl && <Image src={form.imageMobileUrl} alt="Preview mobile" width={108} height={135} className="rounded-lg mb-2 w-24 object-cover" />}
                <label className={`fo-ios-btn fo-ios-btn-neutral text-xs inline-block cursor-pointer ${uploadingMobile ? 'opacity-50' : ''}`}>
                  {uploadingMobile ? 'Uploading...' : form.imageMobileUrl ? 'Ganti Gambar Mobile' : 'Upload Gambar Mobile'}
                  <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleMobileUpload} className="hidden" disabled={uploadingMobile} />
                </label>
              </div>

              <div>
                <label className="block text-xs font-semibold text-white/50 mb-1">Alt Text *</label>
                <input type="text" value={form.imageAlt} onChange={e => setForm(f => ({ ...f, imageAlt: e.target.value }))}
                  className="fo-glass-input rounded-xl px-3 py-2.5 text-sm w-full" placeholder="Deskripsi gambar untuk SEO & aksesibilitas" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-white/50 mb-1">Link Tujuan saat diklik (Opsional)</label>
                <input type="text" value={form.ctaLink} onChange={e => setForm(f => ({ ...f, ctaLink: e.target.value }))}
                  className="fo-glass-input rounded-xl px-3 py-2.5 text-sm w-full" placeholder="Misal: /product-gallery atau https://wa.me/..." />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-white/50 mb-1">Urutan</label>
                  <input type="number" value={form.sortOrder} onChange={e => setForm(f => ({ ...f, sortOrder: e.target.value }))}
                    className="fo-glass-input rounded-xl px-3 py-2.5 text-sm w-full" />
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} className="w-4 h-4 rounded accent-primary" />
                    <span className="text-xs text-white/70">Aktif</span>
                  </label>
                </div>
              </div>

              {formError && <p className="text-red-400 text-xs">{formError}</p>}
              {formSuccess && <p className="text-emerald-400 text-xs">{formSuccess}</p>}

              <div className="flex gap-3 pt-2">
                <button onClick={() => setEditorOpen(false)} className="fo-ios-btn fo-ios-btn-neutral text-sm flex-1">Batal</button>
                <button onClick={handleSave} disabled={saving} className="fo-ios-btn fo-ios-btn-primary text-sm flex-1 disabled:opacity-50">
                  {saving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
