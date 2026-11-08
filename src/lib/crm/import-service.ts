import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { CrmError } from './auth';
import { MAX_FILES, MAX_FILE_BYTES, MAX_ROWS, readImportFile, type ImportRow } from './imports';
import { contextValue, leadValue } from './service';
import { phoneNumber, text } from './validation';

const maxRequest = MAX_FILES * MAX_FILE_BYTES + 512_000;

export async function prepareImport(request: Request, actorId: string) {
  const length = Number(request.headers.get('content-length'));
  if (!Number.isFinite(length) || length <= 0 || length > maxRequest) throw new CrmError('Ukuran upload maksimal 3 file, masing-masing 5 MB.', 413);
  let form: FormData;
  try { form = await request.formData(); } catch { throw new CrmError('Formulir upload tidak valid.'); }
  const input = Object.fromEntries(['source','eventId','campaignId','assignedTo'].map((key) => [key, form.get(key)]));
  const context = await contextValue(prisma, input);
  const files = form.getAll('documents');
  if (!files.length || files.length > MAX_FILES || files.some((f) => typeof f === 'string')) throw new CrmError('Pilih 1–3 file untuk setiap batch.');
  const rows: ImportRow[] = [];
  const originals: { name: string; mime: string; data: Buffer }[] = [];
  const hashes = new Set<string>();
  for (const file of files as File[]) {
    if (!file.size || file.size > MAX_FILE_BYTES) throw new CrmError('Ukuran tiap file maksimal 5 MB.');
    const hash = createHash('sha256').update(Buffer.from(await file.arrayBuffer())).digest('hex');
    if (hashes.has(hash)) throw new CrmError('Ada file yang sama dalam batch ini.');
    hashes.add(hash);
    const parsed = await readImportFile(file);
    rows.push(...parsed.rows);
    if (parsed.original) originals.push(parsed.original);
    if (rows.length > MAX_ROWS) throw new CrmError('Maksimal 100 kontak per batch. Bagi dokumen menjadi beberapa bagian.');
  }
  if (!rows.length) throw new CrmError('Tidak ada kontak yang terbaca. Periksa dokumen dan coba lagi.');
  await prisma.crmImportBatch.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  const batch = await prisma.crmImportBatch.create({ data: {
    actorId, context, rows: rows as Prisma.InputJsonValue, expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    files: { create: originals.map((f) => ({ name: f.name, mime: f.mime, data: f.data })) },
  }, select: { id: true } });
  return importPreview(batch.id, actorId);
}

export async function importPreview(id: string, actorId: string) {
  const batch = await prisma.crmImportBatch.findFirst({ where: { id, actorId, state: 'READY', expiresAt: { gt: new Date() } }, include: { files: { select: { id: true, name: true, mime: true } } } });
  if (!batch || !Array.isArray(batch.rows)) throw new CrmError('Pratinjau sudah berakhir. Upload ulang dokumen.', 404);
  const rows = batch.rows as ImportRow[];
  const numbers = rows.map((row) => { try { return phoneNumber(row.phone); } catch { return ''; } }).filter(Boolean);
  const existing = await prisma.crmLead.findMany({ where: { phoneNormalized: { in: numbers } }, select: { id: true, name: true, phoneNormalized: true } });
  const duplicates = new Map(existing.map((lead) => [lead.phoneNormalized, { id: lead.id, name: lead.name }]));
  const seen = new Set<string>();
  return { id, context: batch.context, files: batch.files, rows: rows.map((row) => {
    let phone = ''; try { phone = phoneNumber(row.phone); } catch { /* shown for review */ }
    const repeated = Boolean(phone && seen.has(phone)); if (phone) seen.add(phone);
    return { ...row, selected: true, duplicate: duplicates.get(phone) || null, repeated, invalidPhone: !phone };
  }) };
}

export async function importFile(batchId: string, fileId: string, actorId: string) {
  const file = await prisma.crmImportFile.findFirst({ where: { id: fileId, batchId, batch: { actorId, state: 'READY', expiresAt: { gt: new Date() } } } });
  if (!file || !['image/jpeg','image/png','application/pdf'].includes(file.mime)) throw new CrmError('Dokumen tidak ditemukan.', 404);
  return file;
}

export async function discardImport(id: string, actorId: string) {
  await prisma.crmImportBatch.deleteMany({ where: { id, actorId, state: 'READY' } });
  return { ok: true };
}

export async function saveImport(input: Record<string, unknown>, actorId: string) {
  const id = text(input.id, 'Pratinjau', 100, true);
  const original = await prisma.crmImportBatch.findFirst({ where: { id, actorId } });
  if (!original) throw new CrmError('Pratinjau tidak ditemukan.', 404);
  if (original.state === 'SAVED') return original.result;
  if (original.state !== 'READY' || original.expiresAt <= new Date() || !Array.isArray(original.rows) || !Array.isArray(input.rows) || input.rows.length !== original.rows.length || input.rows.length > MAX_ROWS) throw new CrmError('Pratinjau sudah berakhir. Upload ulang dokumen.', 409);
  const context = await contextValue(prisma, original.context as Record<string, unknown>);
  const selected = input.rows.filter((row) => row && typeof row === 'object' && !Array.isArray(row) && (row as Record<string, unknown>).selected === true);
  if (!selected.length) throw new CrmError('Pilih minimal satu kontak.');
  const validated = selected.map((row, index) => {
    try { return leadValue(row as Record<string, unknown>); }
    catch (error) { throw new CrmError(`Kontak terpilih ${index + 1}: ${error instanceof Error ? error.message : 'Data tidak valid.'}`); }
  });
  try {
    return await prisma.$transaction(async (tx) => {
      const claim = await tx.crmImportBatch.updateMany({ where: { id, actorId, state: 'READY', expiresAt: { gt: new Date() } }, data: { state: 'PROCESSING' } });
      if (claim.count !== 1) {
        const previous = await tx.crmImportBatch.findUnique({ where: { id } });
        if (previous?.actorId === actorId && previous.state === 'SAVED') return previous.result;
        throw new CrmError('Batch sedang diproses atau sudah berakhir.', 409);
      }
      let created = 0, duplicates = 0, linked = 0;
      for (const row of validated) {
        const existing = await tx.crmLead.findUnique({ where: { phoneNormalized: row.phoneNormalized } });
        if (existing) {
          duplicates++;
          if (context.eventId) {
            const prior = await tx.crmLeadEvent.findUnique({ where: { leadId_eventId: { leadId: existing.id, eventId: context.eventId } } });
            if (!prior) { await tx.crmLeadEvent.create({ data: { leadId: existing.id, eventId: context.eventId } }); linked++; }
          }
          continue;
        }
        const lead = await tx.crmLead.create({ data: { ...row, ...context, createdBy: actorId, updatedBy: actorId } });
        if (context.eventId) await tx.crmLeadEvent.create({ data: { leadId: lead.id, eventId: context.eventId } });
        created++;
      }
      const result = { created, duplicates, linked };
      await tx.crmImportFile.deleteMany({ where: { batchId: id } });
      await tx.crmImportBatch.update({ where: { id }, data: { state: 'SAVED', rows: [], result } });
      return result;
    }, { timeout: 30_000 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2002','P2034'].includes(error.code)) throw new CrmError('Ada kontak yang baru diproses petugas lain. Periksa dan coba simpan kembali.', 409);
    throw error;
  }
}
