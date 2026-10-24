import { createClerkClient } from '@clerk/backend';
import { prisma } from '../src/lib/prisma';
import { ADMIN_EMAILS, ADMIN_USER_IDS, isHardcodedAdmin } from '../src/lib/admin';
import { normalizeLoginPhone } from '../src/lib/member-auth/policy';

async function main() {
  const secretKey = process.env.CLERK_SECRET_KEY?.trim();
  if (!secretKey) throw new Error('CLERK_SECRET_KEY is required for the one-time staff import.');
  const clerk = createClerkClient({ secretKey });
  const ids = new Set<string>(ADMIN_USER_IDS);
  const dbAdmins = await prisma.user.findMany({ where: { isAdmin: true, clerkUserId: { not: null } }, select: { clerkUserId: true } });
  for (const user of dbAdmins) if (user.clerkUserId) ids.add(user.clerkUserId);
  for (const email of ADMIN_EMAILS) {
    const matches = await clerk.users.getUserList({ emailAddress: [email], limit: 100 });
    for (const user of matches.data) ids.add(user.id);
  }

  const records = [];
  let missing = 0;
  for (const id of ids) {
    let user;
    try { user = await clerk.users.getUser(id); }
    catch (error) {
      if (error && typeof error === 'object' && 'status' in error && error.status === 404) { missing++; continue; }
      throw error;
    }
    const verifiedEmails = user.emailAddresses.filter((item) => item.verification?.status === 'verified');
    const preferredEmail = verifiedEmails.find((item) => item.id === user.primaryEmailAddressId) || verifiedEmails[0];
    const verifiedPhones = user.phoneNumbers.filter((item) => item.verification?.status === 'verified');
    const preferredPhone = verifiedPhones.find((item) => item.id === user.primaryPhoneNumberId) || verifiedPhones[0];
    let phone: string | null = null;
    if (preferredPhone) {
      try { phone = normalizeLoginPhone(preferredPhone.phoneNumber); } catch { /* Invalid or non-Indonesian numbers require manual setup. */ }
    }
    const email = preferredEmail?.emailAddress.toLowerCase() || null;
    const googleSub = user.externalAccounts.find((account) => account.provider === 'google' && account.verification?.status === 'verified')?.externalId || null;
    if (!email && !phone) throw new Error('A current staff account has no verified email or Indonesian WhatsApp number.');
    records.push({
      legacyClerkId: id, email, phone, googleSub,
      name: [user.firstName, user.lastName].filter(Boolean).join(' ') || email || 'Staf DRW Prime',
      cmsAccess: isHardcodedAdmin(id), active: !user.banned && !user.locked,
    });
  }

  const emails = records.flatMap((record) => record.email ? [record.email] : []);
  const phones = records.flatMap((record) => record.phone ? [record.phone] : []);
  const googleSubjects = records.flatMap((record) => record.googleSub ? [record.googleSub] : []);
  if (new Set(emails).size !== emails.length || new Set(phones).size !== phones.length || new Set(googleSubjects).size !== googleSubjects.length) {
    throw new Error('Duplicate verified staff identity across legacy accounts. Resolve before importing.');
  }
  if (!records.length) throw new Error('No current staff accounts found in the active Clerk instance.');

  const summary = `${records.length} legacy staff accounts (${records.filter((record) => record.email).length} verified email, ${records.filter((record) => record.phone).length} verified WhatsApp); ${missing} deleted Clerk IDs skipped.`;
  if (process.argv.includes('--dry-run')) {
    console.log(`Dry run: ${summary}`);
    return;
  }

  await prisma.$transaction(async (tx) => {
    for (const record of records) {
      await tx.staffAccount.upsert({
        where: { legacyClerkId: record.legacyClerkId },
        create: record,
        update: { email: record.email, phone: record.phone, name: record.name, cmsAccess: record.cmsAccess, active: record.active },
      });
    }
  });
  console.log(`Imported ${summary}`);
}

main().catch(() => {
  console.error('Staff import failed. Check Clerk access, verified identifiers, and unique staff records.');
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
