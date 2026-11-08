import ExcelJS from 'exceljs';
import { CrmError } from './auth';

export const MAX_FILES = 3;
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_ROWS = 100;
export type ImportRow = { name: string; phone: string; interest: string; notes: string; file: string };

const aliases: Record<string, string[]> = {
  name: ['nama','namalengkap','namapasien','namakontak','name'],
  phone: ['whatsapp','nomorwhatsapp','nowhatsapp','nowa','nomorwa','wa','nohp','nomorhp','nomortelepon','notelepon','telepon','nohandphone','handphone','hp','phone','mobile'],
  interest: ['layanan','minat','layananminat','layanandiminati','minatlayanan','service'],
  notes: ['catatan','keterangan','note','notes'],
};
const header = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]/g, '');

export function tableRows(table: string[][], file: string): ImportRow[] {
  const lines = table.filter((row) => row.some((v) => String(v || '').trim()));
  if (!lines.length) throw new CrmError(`File ${file} kosong.`);
  const indexes: Record<string, number> = {};
  lines[0].forEach((value, index) => {
    for (const [key, names] of Object.entries(aliases)) if (names.includes(header(value)) && indexes[key] === undefined) indexes[key] = index;
  });
  if (indexes.name === undefined || indexes.phone === undefined) throw new CrmError(`File ${file} harus memiliki kolom Nama dan WhatsApp / No HP.`);
  const rows = lines.slice(1).map((row) => ({
    name: (row[indexes.name] || '').trim(), phone: (row[indexes.phone] || '').trim(),
    interest: (row[indexes.interest] || '').trim(), notes: (row[indexes.notes] || '').trim(), file,
  })).filter((row) => row.name || row.phone || row.interest || row.notes);
  if (rows.length > MAX_ROWS) throw new CrmError('Maksimal 100 kontak per batch. Bagi dokumen menjadi beberapa bagian.');
  return rows;
}

export function csvTable(content: string): string[][] {
  const input = content.replace(/^\uFEFF/, '');
  let quoted = false, commas = 0, semicolons = 0, tabs = 0;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (c === '"' && quoted && input[i + 1] === '"') { i++; continue; }
    if (c === '"') quoted = !quoted;
    if (!quoted && (c === '\n' || c === '\r')) break;
    if (!quoted && c === ',') commas++;
    if (!quoted && c === ';') semicolons++;
    if (!quoted && c === '\t') tabs++;
  }
  const delimiter = semicolons > commas && semicolons >= tabs ? ';' : tabs > commas && tabs > semicolons ? '\t' : ',';
  const rows: string[][] = []; let row: string[] = [], cell = ''; quoted = false;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (c === '"') {
      if (quoted && input[i + 1] === '"') { cell += '"'; i++; }
      else if (quoted || !cell) quoted = !quoted;
      else throw new CrmError('Format CSV tidak valid.');
    } else if (!quoted && c === delimiter) { row.push(cell); cell = ''; }
    else if (!quoted && (c === '\n' || c === '\r')) {
      if (c === '\r' && input[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
      if (rows.length > MAX_ROWS + 20) throw new CrmError('Maksimal 100 kontak per batch.');
    } else cell += c;
    if (cell.length > 10_000 || row.length > 100) throw new CrmError('Kolom CSV terlalu besar.');
  }
  if (quoted) throw new CrmError('Tanda kutip pada CSV tidak lengkap.');
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

// Reject ZIP64, encryption and oversized expanded archives before ExcelJS loads them.
export function validateXlsxArchive(bytes: Buffer): void {
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (bytes.readUInt32LE(i) === 0x06054b50 && i + 22 + bytes.readUInt16LE(i + 20) === bytes.length) { end = i; break; }
  }
  if (end < 0) throw new CrmError('File Excel tidak valid.');
  const count = bytes.readUInt16LE(end + 10), centralSize = bytes.readUInt32LE(end + 12), centralOffset = bytes.readUInt32LE(end + 16);
  if (count > 1000 || count === 0xffff || centralOffset + centralSize > end) throw new CrmError('File Excel terlalu besar atau tidak didukung.');
  let pos = centralOffset, expanded = 0;
  for (let i = 0; i < count; i++) {
    if (pos + 46 > end || bytes.readUInt32LE(pos) !== 0x02014b50) throw new CrmError('Struktur file Excel tidak valid.');
    const flags = bytes.readUInt16LE(pos + 8), size = bytes.readUInt32LE(pos + 24);
    const nameLen = bytes.readUInt16LE(pos + 28), extraLen = bytes.readUInt16LE(pos + 30), commentLen = bytes.readUInt16LE(pos + 32);
    if ((flags & 1) || size === 0xffffffff || pos + 46 + nameLen + extraLen + commentLen > end) throw new CrmError('File Excel terenkripsi atau tidak didukung.');
    expanded += size;
    if (size > 8 * 1024 * 1024 || expanded > 25 * 1024 * 1024) throw new CrmError('Isi file Excel terlalu besar.');
    pos += 46 + nameLen + extraLen + commentLen;
  }
  if (pos !== centralOffset + centralSize) throw new CrmError('Struktur file Excel tidak valid.');
}

export async function spreadsheetRows(bytes: Buffer, file: string): Promise<ImportRow[]> {
  validateXlsxArchive(bytes);
  const book = new ExcelJS.Workbook();
  try { await book.xlsx.load(bytes as unknown as ExcelJS.Buffer); }
  catch { throw new CrmError(`File Excel ${file} tidak dapat dibaca.`); }
  const sheet = book.worksheets[0];
  if (!sheet) throw new CrmError('File Excel tidak memiliki lembar kerja.');
  if (sheet.rowCount > MAX_ROWS + 20 || sheet.columnCount > 100) throw new CrmError('Maksimal 100 kontak dan 100 kolom per batch.');
  const table: string[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const cells: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell, index) => { if (index <= 100) cells[index - 1] = cell.text; });
    table.push(cells);
  });
  return tableRows(table, file);
}

export async function visionRows(bytes: Buffer, mime: 'image/jpeg' | 'image/png' | 'application/pdf', file: string): Promise<ImportRow[]> {
  // CRM documents contain contact data; use its explicitly configured Google
  // key instead of silently sharing a different service's API credential.
  const key = process.env.CRM_GEMINI_API_KEY;
  if (!key) throw new CrmError('Pembaca foto/PDF belum diaktifkan. Hubungi admin CRM.', 503);
  const model = process.env.CRM_GEMINI_MODEL || 'gemini-flash-latest';
  if (!/^[A-Za-z0-9._-]{1,80}$/.test(model)) throw new CrmError('Konfigurasi pembaca foto tidak valid.', 503);
  const prompt = 'Baca daftar kontak pada semua halaman. Kembalikan JSON saja: {"rows":[{"name":"","phone":"","interest":"","notes":""}],"more_than_limit":false}. Satu objek untuk tiap orang. Salin hanya teks yang terlihat, pertahankan nol awal nomor WhatsApp, kosongkan bagian yang tidak terbaca dan jangan menebak. Abaikan judul. Jika lebih dari 100 orang set more_than_limit=true.';
  let response: Response;
  try {
    response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mime, data: bytes.toString('base64') } }] }], generationConfig: { responseMimeType: 'application/json' } }),
      signal: AbortSignal.timeout(90_000),
    });
  } catch { throw new CrmError('Pembacaan foto/PDF belum berhasil. Coba lagi.', 502); }
  if (!response.ok) { console.error('[CRM OCR] Provider error', response.status); throw new CrmError('Pembacaan foto/PDF belum berhasil. Periksa konfigurasi layanan atau coba lagi.', 502); }
  const result = await response.json();
  const candidate = result?.candidates?.[0];
  if (candidate?.finishReason && candidate.finishReason !== 'STOP') throw new CrmError('Hasil pembacaan belum lengkap. Bagi dokumen menjadi beberapa bagian.');
  const content = (candidate?.content?.parts || []).map((p: { text?: string }) => p.text || '').join('');
  let parsed: { rows?: unknown; more_than_limit?: unknown };
  try { parsed = JSON.parse(content); } catch { throw new CrmError('Data pada foto/PDF belum dapat dibaca. Coba foto yang lebih jelas.'); }
  if (parsed.more_than_limit === true || !Array.isArray(parsed.rows) || parsed.rows.length > MAX_ROWS) throw new CrmError('Dokumen terlalu panjang atau hasil belum lengkap. Maksimal 100 kontak per batch.');
  return parsed.rows.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object' && !Array.isArray(row)).map((row) => ({
    name: typeof row.name === 'string' ? row.name.trim() : '', phone: typeof row.phone === 'string' ? row.phone.trim() : '',
    interest: typeof row.interest === 'string' ? row.interest.trim() : '', notes: typeof row.notes === 'string' ? row.notes.trim() : '', file,
  })).filter((row) => row.name || row.phone || row.interest || row.notes);
}

export async function readImportFile(file: File): Promise<{ rows: ImportRow[]; original?: { name: string; mime: string; data: Buffer } }> {
  if (!file.size || file.size > MAX_FILE_BYTES) throw new CrmError('Ukuran tiap file maksimal 5 MB.');
  const name = file.name.replace(/[\x00-\x1f/\\]/g, '_').slice(0, 120) || 'dokumen';
  const extension = name.split('.').pop()?.toLowerCase();
  const data = Buffer.from(await file.arrayBuffer());
  if (extension === 'csv') {
    if (data.includes(0)) throw new CrmError('File CSV tidak valid.');
    let content: string;
    try { content = new TextDecoder('utf-8', { fatal: true }).decode(data); }
    catch { throw new CrmError('Simpan file CSV sebagai UTF-8, lalu coba lagi.'); }
    return { rows: tableRows(csvTable(content), name) };
  }
  if (extension === 'xlsx') return { rows: await spreadsheetRows(data, name) };
  let mime: 'image/jpeg' | 'image/png' | 'application/pdf';
  if (extension === 'pdf' && data.subarray(0, 5).toString() === '%PDF-') mime = 'application/pdf';
  else if (['jpg','jpeg'].includes(extension || '') && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) mime = 'image/jpeg';
  else if (extension === 'png' && data.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) mime = 'image/png';
  else throw new CrmError('Gunakan file JPG, PNG, PDF, XLSX, atau CSV yang valid.');
  return { rows: await visionRows(data, mime, name), original: { name, mime, data } };
}
