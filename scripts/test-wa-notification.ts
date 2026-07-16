/**
 * Test script untuk WhatsApp notification.
 * Jalankan dengan: npx tsx scripts/test-wa-notification.ts
 *
 * Pastikan sudah set WHATSAPP_ACCESS_TOKEN di .env
 * Gunakan nomor HP Anda sendiri untuk menerima test message
 */

// Load env
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '../.env') });

import {
  sendSpendingNotification,
  sendTierUpgradeNotification,
  sendManualInvitation,
} from '../src/lib/whatsapp';

// === GANTI NOMOR DI SINI DENGAN NOMOR HP KAMU SENDIRI ===
const TEST_PHONE = '6281138800071'; // Nomor penerima test
const TEST_NAME = 'Test User';

async function main() {
  console.log('=== Test WhatsApp Notification ===\n');

  // 1. Test 1: Walk-in first transaction
  console.log('1. Testing Walk-in First Transaction...');
  await sendSpendingNotification({
    memberName: TEST_NAME,
    memberPhone: TEST_PHONE,
    isWalkIn: true,
    isFirstTransaction: true,
    amount: 500_000,
    pointsEarned: 50,
    totalPoints: 50,
    totalSpending: 500_000,
    tier: 'SILVER',
    treatment: 'Facial Acne',
  });
  console.log('   ✅ Sent (check WA)');

  // Delay antar pesan (supaya tidak kena rate limit)
  await sleep(2000);

  // 2. Test 2: Walk-in repeat transaction
  console.log('2. Testing Walk-in Repeat Transaction...');
  await sendSpendingNotification({
    memberName: TEST_NAME,
    memberPhone: TEST_PHONE,
    isWalkIn: true,
    isFirstTransaction: false,
    amount: 750_000,
    pointsEarned: 75,
    totalPoints: 125,
    totalSpending: 1_250_000,
    tier: 'GOLD',
    treatment: 'Laser Treatment',
    transactionCount: 4,
  });
  console.log('   ✅ Sent (check WA)');

  await sleep(2000);

  // 3. Test 3: Member with account
  console.log('3. Testing Member Spending...');
  await sendSpendingNotification({
    memberName: TEST_NAME,
    memberPhone: TEST_PHONE,
    isWalkIn: false,
    isFirstTransaction: false,
    amount: 300_000,
    pointsEarned: 30,
    totalPoints: 155,
    totalSpending: 1_550_000,
    tier: 'GOLD',
    treatment: 'Facial Silver',
  });
  console.log('   ✅ Sent (check WA)');

  await sleep(2000);

  // 4. Test 4: Tier upgrade (Gold → Platinum)
  console.log('4. Testing Tier Upgrade...');
  await sendTierUpgradeNotification({
    memberName: TEST_NAME,
    memberPhone: TEST_PHONE,
    previousTier: 'GOLD',
    newTier: 'PLATINUM',
    totalPoints: 155,
    totalSpending: 5_000_000,
    benefits: [
      'Konsultan kecantikan pribadi',
      'Diskon 20% semua treatment',
      'Free treatment setiap 3 bulan',
      'Priority queue',
    ],
  });
  console.log('   ✅ Sent (check WA)');

  await sleep(2000);

  // 5. Test 5: Manual invitation
  console.log('5. Testing Manual Invitation...');
  await sendManualInvitation({
    memberName: TEST_NAME,
    memberPhone: TEST_PHONE,
    points: 155,
    totalSpending: 1_550_000,
    tier: 'GOLD',
    transactionCount: 7,
    inviteLink: 'https://drwprime.com/sign-up?phone=6281138800071',
  });
  console.log('   ✅ Sent (check WA)');

  console.log('\n=== Done! Cek WhatsApp kamu. ===');
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((err) => {
  console.error('Test failed:', err.message);
  process.exit(1);
});
