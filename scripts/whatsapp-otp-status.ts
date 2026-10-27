import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  try {
    const counts = await prisma.whatsAppOtpDispatch.groupBy({
      by: ['flow', 'status', 'errorCode'],
      where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      _count: { _all: true },
    });
    for (const row of counts) {
      console.log(`${row.flow}\t${row.status}\t${row.errorCode ?? '-'}\t${row._count._all}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(() => {
  console.error('[OTP] Gagal membaca status pengiriman. Periksa koneksi database dan migrasi.');
  process.exitCode = 1;
});
