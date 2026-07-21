'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import ExcelJS from 'exceljs';
import { Hourglass } from '@/components/LoadingScreen';
import { normalizePhone } from '@/lib/phone';

type PreviewRow = {
  row: number;
  phone: string;
  firstName: string;
  lastName: string;
  status: string;
};

type ImportSummary = {
  total: number;
  created: number;
  skippedDuplicateInFile: number;
  skippedAlreadyExists: number;
  errors: number;
};

type ImportResult = {
  row: number;
  phone: string;
  firstName: string;
  lastName: string | null;
  status: string;
  message: string;
};

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function normalizePhoneForPreview(phone: string): string {
  const normalized = normalizePhone(phone);
  if (!normalized.startsWith('62')) return '';
  return normalized;
}

function normalizeHeader(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = typeof value === 'object' && value && 'text' in value ? String((value as { text: unknown }).text) : String(value);
  return str.toLowerCase().replace(/[\s\-_]+/g, '').replace(/[^a-z0-9]/g, '');
}

function parseCellValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object' && value) {
    if ('text' in value && typeof (value as { text: unknown }).text === 'string') {
      const rt = value as { text: string };
      if (rt.text) return rt.text;
    }
    return String(value);
  }
  return String(value).trim();
}

export default function BulkImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseFile = async (selectedFile: File) => {
    setFile(selectedFile);
    setError(null);
    setResults([]);
    setSummary(null);
    setLoading(true);

    try {
      const isCsv = selectedFile.name.toLowerCase().endsWith('.csv');
      let rows: string[][] = [];

      if (isCsv) {
        const text = await selectedFile.text();
        const lines = text.split(/\r?\n/).filter(line => line.trim());
        rows = lines.map(line => parseCSVLine(line));
      } else {
        const buffer = await selectedFile.arrayBuffer();
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
        const ws = workbook.worksheets[0];
        if (!ws) {
          setError('Sheet tidak ditemukan di file Excel');
          setLoading(false);
          return;
        }
        for (let r = 1; r <= ws.rowCount; r++) {
          const row = ws.getRow(r);
          const cells: string[] = [];
          for (let c = 1; c <= row.cellCount; c++) {
            cells.push(parseCellValue(row.getCell(c).value));
          }
          if (cells.some(c => c)) rows.push(cells);
        }
      }

      if (rows.length < 2) {
        setError('File minimal harus memiliki 1 baris header dan 1 baris data');
        setLoading(false);
        return;
      }

      const headers = rows[0];

      const headerMap = new Map<string, number>();
      headers.forEach((h, i) => {
        const n = normalizeHeader(h);
        if (n) headerMap.set(n, i);
      });

      const getCol = (names: string[]): number | null => {
        for (const name of names) {
          const col = headerMap.get(normalizeHeader(name));
          if (col !== undefined) return col;
        }
        return null;
      };

      const colPhone = getCol(['Phone', 'Nomor HP', 'No HP', 'Telepon', 'Phone Number', 'WhatsApp', 'No WA', 'Nomor WhatsApp', 'HP']);
      const colName = getCol(['Nama', 'Name', 'First Name', 'Nama Depan', 'Nama Pasien', 'Nama Lengkap', 'FirstName']);
      const colLastName = getCol(['Nama Belakang', 'Last Name', 'LastName']);

      if (!colPhone) {
        setError('Kolom "Phone" / "Nomor HP" tidak ditemukan. Pastikan file memiliki header yang benar.');
        setLoading(false);
        return;
      }
      if (!colName) {
        setError('Kolom "Nama" / "First Name" tidak ditemukan. Pastikan file memiliki header yang benar.');
        setLoading(false);
        return;
      }

      const previewRows: PreviewRow[] = [];
      const seen = new Set<string>();

      for (let i = 1; i < rows.length; i++) {
        const rawPhone = rows[i][colPhone]?.trim() || '';
        const rawName = rows[i][colName]?.trim() || '';
        const rawLastName = colLastName !== null ? rows[i][colLastName]?.trim() || '' : '';

        if (!rawPhone && !rawName) continue;

        const phone = normalizePhoneForPreview(rawPhone);
        if (!phone) {
          previewRows.push({ row: i + 1, phone: rawPhone || '-', firstName: rawName, lastName: rawLastName, status: 'Format HP tidak valid' });
          continue;
        }

        if (seen.has(phone)) {
          previewRows.push({ row: i + 1, phone, firstName: rawName, lastName: rawLastName, status: 'Duplikat dalam file' });
          continue;
        }
        seen.add(phone);

        if (!rawName) {
          previewRows.push({ row: i + 1, phone, firstName: '-', lastName: rawLastName, status: 'Nama kosong (akan error)' });
          continue;
        }

        previewRows.push({ row: i + 1, phone, firstName: rawName, lastName: rawLastName, status: 'Siap diimpor' });
      }

      setPreview(previewRows);
    } catch (e) {
      setError('Gagal membaca file: ' + (e instanceof Error ? e.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) parseFile(f);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const f = e.dataTransfer.files?.[0];
    if (f) parseFile(f);
  };

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/front-office/members/bulk-import', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Gagal import');
        return;
      }
      setResults(data.results || []);
      setSummary(data.summary || null);
    } catch (e) {
      setError('Gagal import: ' + (e instanceof Error ? e.message : 'Unknown error'));
    } finally {
      setImporting(false);
    }
  };

  const resetForm = () => {
    setFile(null);
    setPreview([]);
    setResults([]);
    setSummary(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const validCount = preview.filter(r => r.status === 'Siap diimpor').length;
  const warnCount = preview.filter(r => r.status !== 'Siap diimpor').length;

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-4xl mx-auto px-4 py-10">
        <div className="mb-10">
          <h1 className="font-playfair text-3xl sm:text-4xl font-bold text-primary mb-2">
            Bulk Import Members
          </h1>
          <p className="text-white/70 text-base mb-4">
            Import member massal dari file Excel (.xlsx/.xls) atau CSV
          </p>
          <Link href="/front-office" className="fo-nav-chip text-sm inline-block">
            Kembali ke Dashboard
          </Link>
        </div>

        {!summary && (
          <>
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer mb-6 ${
                dragActive
                  ? 'border-primary bg-primary/10'
                  : 'border-white/20 hover:border-primary/50 hover:bg-white/5'
              }`}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <svg className="w-12 h-12 mx-auto mb-3 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-white/70 text-sm mb-1">
                {file ? file.name : 'Drag & drop file di sini, atau klik untuk memilih'}
              </p>
              <p className="text-white/40 text-xs">
                Format: .xlsx, .xls, .csv (maks 10MB)
              </p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-5 mb-6">
              <h3 className="text-sm font-semibold text-primary mb-2">Format File yang Diterima</h3>
              <p className="text-white/60 text-sm mb-3">
                File harus memiliki header kolom di baris pertama. Kolom yang wajib:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                  <span className="text-primary font-medium">Phone / Nomor HP</span>
                  <p className="text-white/50 text-xs mt-1">628123456789 atau 08123456789</p>
                </div>
                <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                  <span className="text-primary font-medium">Nama / First Name</span>
                  <p className="text-white/50 text-xs mt-1">Nama depan member</p>
                </div>
                <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                  <span className="text-primary font-medium">Nama Belakang (opsional)</span>
                  <p className="text-white/50 text-xs mt-1">Last name jika ada</p>
                </div>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            {loading && (
              <div className="flex items-center justify-center py-10">
                <Hourglass />
                <span className="ml-3 text-white/60">Membaca file...</span>
              </div>
            )}

            {preview.length > 0 && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-white/70">
                      <span className="text-white font-medium">{preview.length}</span> baris data
                    </span>
                    <span className="text-green-400">
                      <span className="font-medium">{validCount}</span> siap diimpor
                    </span>
                    {warnCount > 0 && (
                      <span className="text-yellow-400">
                        <span className="font-medium">{warnCount}</span> perlu diperiksa
                      </span>
                    )}
                  </div>
                  <button
                    onClick={resetForm}
                    className="text-white/50 hover:text-white text-sm transition-colors"
                  >
                    Reset
                  </button>
                </div>

                <div className="overflow-x-auto rounded-xl border border-white/10 mb-6">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-white/5">
                        <th className="text-left px-4 py-3 text-white/60 font-medium text-xs uppercase tracking-wider">#</th>
                        <th className="text-left px-4 py-3 text-white/60 font-medium text-xs uppercase tracking-wider">Phone</th>
                        <th className="text-left px-4 py-3 text-white/60 font-medium text-xs uppercase tracking-wider">Nama</th>
                        <th className="text-left px-4 py-3 text-white/60 font-medium text-xs uppercase tracking-wider">Nama Belakang</th>
                        <th className="text-left px-4 py-3 text-white/60 font-medium text-xs uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {preview.slice(0, 50).map((row, i) => (
                        <tr key={i} className="hover:bg-white/5">
                          <td className="px-4 py-2.5 text-white/50">{row.row}</td>
                          <td className="px-4 py-2.5 font-mono text-white/80">{row.phone}</td>
                          <td className="px-4 py-2.5 text-white/80">{row.firstName}</td>
                          <td className="px-4 py-2.5 text-white/60">{row.lastName || '-'}</td>
                          <td className="px-4 py-2.5">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              row.status === 'Siap diimpor'
                                ? 'bg-green-500/10 text-green-400 border border-green-500/30'
                                : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/30'
                            }`}>
                              {row.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {preview.length > 50 && (
                    <div className="text-center py-3 text-white/40 text-xs border-t border-white/5">
                      Menampilkan 50 dari {preview.length} baris
                    </div>
                  )}
                </div>

                <button
                  onClick={handleImport}
                  disabled={importing || validCount === 0}
                  className="w-full sm:w-auto px-8 py-3 bg-primary text-black font-semibold rounded-xl hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                  {importing ? (
                    <>
                      <Hourglass /> Mengimpor...
                    </>
                  ) : (
                    `Import ${validCount} Member`
                  )}
                </button>
              </>
            )}
          </>
        )}

        {summary && (
          <>
            <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-8">
              <h2 className="font-playfair text-2xl font-bold text-primary mb-4">Hasil Import</h2>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="bg-white/5 rounded-lg p-4 border border-white/10 text-center">
                  <div className="text-2xl font-bold text-white">{summary.total}</div>
                  <div className="text-xs text-white/50 mt-1">Total Baris</div>
                </div>
                <div className="bg-green-500/10 rounded-lg p-4 border border-green-500/30 text-center">
                  <div className="text-2xl font-bold text-green-400">{summary.created}</div>
                  <div className="text-xs text-green-400/70 mt-1">Berhasil Dibuat</div>
                </div>
                <div className="bg-yellow-500/10 rounded-lg p-4 border border-yellow-500/30 text-center">
                  <div className="text-2xl font-bold text-yellow-400">{summary.skippedAlreadyExists}</div>
                  <div className="text-xs text-yellow-400/70 mt-1">Sudah Ada</div>
                </div>
                <div className="bg-orange-500/10 rounded-lg p-4 border border-orange-500/30 text-center">
                  <div className="text-2xl font-bold text-orange-400">{summary.skippedDuplicateInFile}</div>
                  <div className="text-xs text-orange-400/70 mt-1">Duplikat File</div>
                </div>
                <div className="bg-red-500/10 rounded-lg p-4 border border-red-500/30 text-center">
                  <div className="text-2xl font-bold text-red-400">{summary.errors}</div>
                  <div className="text-xs text-red-400/70 mt-1">Error</div>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-white/10 mb-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-white/5">
                    <th className="text-left px-4 py-3 text-white/60 font-medium text-xs uppercase tracking-wider">#</th>
                    <th className="text-left px-4 py-3 text-white/60 font-medium text-xs uppercase tracking-wider">Phone</th>
                    <th className="text-left px-4 py-3 text-white/60 font-medium text-xs uppercase tracking-wider">Nama</th>
                    <th className="text-left px-4 py-3 text-white/60 font-medium text-xs uppercase tracking-wider">Status</th>
                    <th className="text-left px-4 py-3 text-white/60 font-medium text-xs uppercase tracking-wider">Keterangan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {results.map((r, i) => (
                    <tr key={i} className="hover:bg-white/5">
                      <td className="px-4 py-2.5 text-white/50">{r.row}</td>
                      <td className="px-4 py-2.5 font-mono text-white/80">{r.phone}</td>
                      <td className="px-4 py-2.5 text-white/80">
                        {[r.firstName, r.lastName].filter(Boolean).join(' ') || '-'}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          r.status === 'created'
                            ? 'bg-green-500/10 text-green-400 border border-green-500/30'
                            : r.status === 'skipped_duplicate_in_file'
                            ? 'bg-orange-500/10 text-orange-400 border border-orange-500/30'
                            : r.status === 'skipped_already_exists'
                            ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/30'
                            : 'bg-red-500/10 text-red-400 border border-red-500/30'
                        }`}>
                          {r.status === 'created' ? 'Berhasil' :
                           r.status === 'skipped_duplicate_in_file' ? 'Duplikat' :
                           r.status === 'skipped_already_exists' ? 'Sudah Ada' : 'Error'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-white/60 text-xs max-w-xs truncate">{r.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button
              onClick={resetForm}
              className="w-full sm:w-auto px-8 py-3 bg-white/10 text-white font-medium rounded-xl hover:bg-white/20 transition-all"
            >
              Import File Lain
            </button>
          </>
        )}
      </div>
    </div>
  );
}
