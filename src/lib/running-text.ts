import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/prisma';

export const RUNNING_TEXT_ID = 'global';
export const RUNNING_TEXT_CACHE_TAG = 'running-text';
export const MAX_RUNNING_TEXT_LENGTH = 500;
export const DEFAULT_RUNNING_TEXT =
  '\u2728 Promo Spesial Hari Ini: Gratis Ongkir Seluruh Indonesia! \u2022 Gunakan Kode Voucher: DRWPRIME \u2022 Diskon s/d 20% Untuk Pembelian Pertama \u2728';

const getCachedRunningText = unstable_cache(
  async () => {
    const setting = await prisma.runningTextSetting.findUnique({
      where: { id: RUNNING_TEXT_ID },
      select: { text: true },
    });

    return setting?.text || DEFAULT_RUNNING_TEXT;
  },
  [RUNNING_TEXT_ID],
  { tags: [RUNNING_TEXT_CACHE_TAG], revalidate: 3600 },
);

export async function getRunningText() {
  try {
    return await getCachedRunningText();
  } catch (error) {
    console.error('[RUNNING TEXT] Failed to load setting:', error);
    return DEFAULT_RUNNING_TEXT;
  }
}
