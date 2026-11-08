import { afterEach, describe, expect, it, vi } from 'vitest';
import ExcelJS from 'exceljs';
import { csvTable, spreadsheetRows, tableRows, validateXlsxArchive, visionRows } from './imports';
import { phoneNumber } from './validation';

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('CRM contact imports', () => {
  it('parses quoted CSV fields, semicolon separators and leading zeros', () => {
    const table = csvTable('\uFEFFNama;No WA;Layanan;Catatan\r\n"Rina Contoh";081234567890;Facial;"Tanya; lagi"\r\n');
    expect(tableRows(table, 'event.csv')).toEqual([{ name:'Rina Contoh', phone:'081234567890', interest:'Facial', notes:'Tanya; lagi', file:'event.csv' }]);
    expect(phoneNumber('081234567890')).toBe(phoneNumber('+62 812-3456-7890'));
  });

  it('rejects invalid phone, missing headers and incomplete CSV quotes', () => {
    expect(() => phoneNumber('0812?3456')).toThrow();
    expect(() => tableRows([['Nama','Email'],['Rina','x@example.test']], 'x.csv')).toThrow('WhatsApp');
    expect(() => csvTable('Nama,WhatsApp\n"Tidak selesai,081234567890')).toThrow();
  });

  it('reads a real XLSX first sheet and refuses malformed archives', async () => {
    const book = new ExcelJS.Workbook();
    const sheet = book.addWorksheet('Event');
    sheet.addRow(['Nama', 'No WA', 'Layanan']);
    sheet.addRow(['Dina Contoh', '081233334444', 'Facial']);
    const bytes = Buffer.from(await book.xlsx.writeBuffer());
    expect(await spreadsheetRows(bytes, 'event.xlsx')).toEqual([{ name:'Dina Contoh', phone:'081233334444', interest:'Facial', notes:'', file:'event.xlsx' }]);
    expect(() => validateXlsxArchive(Buffer.from('bad file'))).toThrow();
  });

  it('sends only the supplied synthetic image to Gemini and checks incomplete output', async () => {
    vi.stubEnv('CRM_GEMINI_API_KEY','test-only-key');
    vi.stubEnv('CRM_GEMINI_MODEL','gemini-test');
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ candidates: [{ finishReason:'STOP', content:{ parts:[{ text:JSON.stringify({ rows:[{ name:'Rina Contoh', phone:'081234567890', interest:'Facial', notes:'' }], more_than_limit:false }) }] } }] }), { status:200 }));
    vi.stubGlobal('fetch',fetchMock);
    const rows = await visionRows(Buffer.from('synthetic'),'image/png','sample.png');
    expect(rows[0]).toMatchObject({ name:'Rina Contoh', phone:'081234567890' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).not.toContain('test-only-key');
    expect((init.headers as Record<string,string>)['x-goog-api-key']).toBe('test-only-key');
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ candidates:[{finishReason:'MAX_TOKENS'}] }),{status:200}));
    await expect(visionRows(Buffer.from('synthetic'),'application/pdf','sample.pdf')).rejects.toThrow('belum lengkap');
  });
});
