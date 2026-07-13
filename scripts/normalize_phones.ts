import { PrismaClient } from '@prisma/client';
import { normalizePhone } from '../src/lib/phone';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting phone number normalization...');

  // 1. Normalize Users
  const users = await prisma.user.findMany({
    where: {
      phone: { not: null }
    }
  });

  let usersUpdated = 0;
  for (const user of users) {
    if (!user.phone) continue;
    
    const normalized = normalizePhone(user.phone);
    if (normalized !== user.phone) {
      await prisma.user.update({
        where: { id: user.id },
        data: { phone: normalized }
      });
      console.log(`User ${user.email}: ${user.phone} -> ${normalized}`);
      usersUpdated++;
    }
  }

  // 2. Normalize Reservations
  const reservations = await prisma.reservation.findMany();
  let reservationsUpdated = 0;
  
  for (const res of reservations) {
    if (!res.patientPhone) continue;

    const normalized = normalizePhone(res.patientPhone);
    if (normalized !== res.patientPhone) {
      await prisma.reservation.update({
        where: { id: res.id },
        data: { patientPhone: normalized }
      });
      console.log(`Reservation ${res.id}: ${res.patientPhone} -> ${normalized}`);
      reservationsUpdated++;
    }
  }

  console.log('--- Summary ---');
  console.log(`Updated ${usersUpdated} users`);
  console.log(`Updated ${reservationsUpdated} reservations`);
  console.log('Done!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
