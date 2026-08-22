import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import {
  AidoClient,
  AidoConfigurationError,
  AidoRequestError,
} from '@/lib/aido/client';
import {
  assertAidoCanonicalSpending,
  isAidoCanonicalSpendingActive,
} from '@/lib/aido/config';
import {
  AidoIncome,
  AidoPatient,
  getAidoReportDateRange,
  mapAidoIncome,
  mapAidoPatient,
} from '@/lib/aido/mapping';
import { prisma } from '@/lib/prisma';

const LOCK_NAME = 'aido-daily-sync';
const INCOME_SOURCE = 'aido-income';
const SYNC_TRANSACTION_OPTIONS = { maxWait: 60_000, timeout: 180_000 };

const syncUserSelect = {
  id: true,
  firstName: true,
  lastName: true,
  phone: true,
  nomorRekamMedis: true,
  nik: true,
  dateOfBirth: true,
  gender: true,
  hasAccount: true,
  points: true,
  totalSpending: true,
  lastTransactionAt: true,
  aidoPatientLinks: { select: { hospitalId: true } },
} satisfies Prisma.UserSelect;

type SyncUser = Prisma.UserGetPayload<{ select: typeof syncUserSelect }>;

export type AidoSyncSummary = {
  date: string;
  dryRun: boolean;
  patientsFetched: number;
  patientsCreated: number;
  patientsUpdated: number;
  patientConflicts: number;
  incomesFetched: number;
  incomesCreated: number;
  incomesUpdated: number;
  incomesRemoved: number;
  incomeLedgerCreated: number;
  incomeLedgerUpdated: number;
  incomeLedgerRemoved: number;
  incomesMatched: number;
  incomesUnmatched: number;
  reviewRequired: boolean;
  invalidRows: number;
};

export class AidoSyncAlreadyRunningError extends Error {
  constructor() {
    super('AIDO sync is already running');
    this.name = 'AidoSyncAlreadyRunningError';
  }
}

export class AidoSyncIncompleteError extends Error {
  constructor(public readonly summary: AidoSyncSummary) {
    super('AIDO sync requires review');
    this.name = 'AidoSyncIncompleteError';
  }
}

class AidoSourceValidationError extends Error {
  constructor() {
    super('AIDO source validation failed');
    this.name = 'AidoSourceValidationError';
  }
}

type PatientSyncResult = {
  created: boolean;
  updated: boolean;
  conflict: boolean;
};

export type AidoMatchIndex = {
  byExternalId: Map<string, string>;
  byNumericId: Map<string, string>;
  byMrNumber: Map<string, string | null>;
};

function addUniqueMatch(map: Map<string, string | null>, key: string | null, userId: string): void {
  if (!key) return;
  const current = map.get(key);
  if (current === undefined || current === userId) map.set(key, userId);
  else map.set(key, null);
}

function dateOnlyEqual(left: Date | null, right: Date | null): boolean {
  if (!left || !right) return left === right;
  return left.toISOString().slice(0, 10) === right.toISOString().slice(0, 10);
}

function requiresDobForPhoneMatch(user: SyncUser): boolean {
  return user.hasAccount
    || Boolean(user.nomorRekamMedis)
    || Boolean(user.nik)
    || Boolean(user.dateOfBirth)
    || user.points !== 0
    || Number(user.totalSpending) !== 0
    || user.aidoPatientLinks.length > 0;
}

function pointsForAmount(amount: number): number {
  return Math.trunc(amount / 10_000);
}

function tierForSpending(totalSpending: number): 'Bronze' | 'Silver' | 'Gold' | 'Platinum' {
  if (totalSpending >= 10_000_000) return 'Platinum';
  if (totalSpending >= 5_000_000) return 'Gold';
  if (totalSpending >= 1_000_000) return 'Silver';
  return 'Bronze';
}

type IncomeMatchStatus = 'MATCHED' | 'UNMATCHED' | 'CONFLICT';

type IncomeLedgerResult = 'created' | 'updated' | 'unchanged';

function deduplicate<T>(rows: T[], getKey: (row: T) => string): T[] {
  const values = new Map<string, T>();
  for (const row of rows) {
    const key = getKey(row);
    if (values.has(key)) throw new AidoSourceValidationError();
    values.set(key, row);
  }
  return [...values.values()];
}

function assertUniquePatientIdentity(patients: AidoPatient[]): void {
  const seen = new Map<string, Set<string>>([
    ['numericId', new Set<string>()],
    ['mrNumber', new Set<string>()],
    ['nik', new Set<string>()],
  ]);
  for (const patient of patients) {
    const keys: Array<[string, string | null]> = [
      ['numericId', patient.externalPatientNumericId],
      ['mrNumber', patient.mrNumber],
      ['nik', patient.nik],
    ];
    for (const [name, value] of keys) {
      if (!value) continue;
      const values = seen.get(name)!;
      if (values.has(value)) throw new AidoSourceValidationError();
      values.add(value);
    }
  }
}

function addBlockedPatientKeys(keys: Set<string>, patient: AidoPatient): void {
  keys.add(`external:${patient.externalPatientId}`);
  if (patient.externalPatientNumericId) keys.add(`numeric:${patient.externalPatientNumericId}`);
  if (patient.mrNumber) keys.add(`mr:${patient.mrNumber}`);
  if (patient.nik) keys.add(`nik:${patient.nik}`);
}

function incomeUsesBlockedPatient(income: AidoIncome, keys: Set<string>): boolean {
  return Boolean(
    (income.externalPatientId && keys.has(`external:${income.externalPatientId}`))
    || (income.externalPatientNumericId && keys.has(`numeric:${income.externalPatientNumericId}`))
    || (income.mrNumber && keys.has(`mr:${income.mrNumber}`))
  );
}

async function acquireLock(owner: string): Promise<boolean> {
  const now = new Date();
  const lockedUntil = new Date(now.getTime() + 20 * 60 * 1000);

  await prisma.aidoSyncLock.upsert({
    where: { name: LOCK_NAME },
    create: { name: LOCK_NAME, owner: null, lockedUntil: now },
    update: {},
  });

  const result = await prisma.aidoSyncLock.updateMany({
    where: {
      name: LOCK_NAME,
      OR: [{ owner: null }, { lockedUntil: { lt: now } }],
    },
    data: { owner, lockedUntil },
  });

  return result.count === 1;
}

async function releaseLock(owner: string): Promise<void> {
  await prisma.aidoSyncLock.updateMany({
    where: { name: LOCK_NAME, owner },
    data: { owner: null, lockedUntil: new Date() },
  });
}

async function renewLock(owner: string): Promise<void> {
  const now = new Date();
  const result = await prisma.aidoSyncLock.updateMany({
    where: { name: LOCK_NAME, owner, lockedUntil: { gt: now } },
    data: { lockedUntil: new Date(now.getTime() + 20 * 60 * 1000) },
  });
  if (result.count !== 1) throw new AidoSyncAlreadyRunningError();
}

async function assertLockOwned(tx: Prisma.TransactionClient, owner: string): Promise<void> {
  const now = new Date();
  const result = await tx.aidoSyncLock.updateMany({
    where: { name: LOCK_NAME, owner, lockedUntil: { gt: now } },
    data: { lockedUntil: new Date(now.getTime() + 20 * 60 * 1000) },
  });
  if (result.count !== 1) throw new AidoSyncAlreadyRunningError();
}

async function getUserChanges(
  user: SyncUser,
  patient: AidoPatient,
): Promise<{ data: Prisma.UserUpdateInput; conflict: boolean; blocked: boolean }> {
  const data: Prisma.UserUpdateInput = {};
  let conflict = false;
  let blocked = false;

  if (!user.hasAccount) {
    if (user.firstName !== patient.firstName) data.firstName = patient.firstName;
    if (patient.lastName && user.lastName !== patient.lastName) data.lastName = patient.lastName;
  }

  if (patient.phone && user.phone !== patient.phone) {
    const phoneOwner = await prisma.user.findUnique({
      where: { phone: patient.phone },
      select: { id: true },
    });
    if (phoneOwner && phoneOwner.id !== user.id) {
      conflict = true;
      blocked = true;
    }
    else if (!user.hasAccount || !user.phone) data.phone = patient.phone;
    else {
      conflict = true;
      blocked = true;
    }
  }

  if (patient.mrNumber && user.nomorRekamMedis !== patient.mrNumber) {
    if (user.nomorRekamMedis) {
      conflict = true;
      blocked = true;
    } else {
      const mrOwner = await prisma.user.findUnique({
        where: { nomorRekamMedis: patient.mrNumber },
        select: { id: true },
      });
      if (mrOwner && mrOwner.id !== user.id) {
        conflict = true;
        blocked = true;
      } else {
        data.nomorRekamMedis = patient.mrNumber;
      }
    }
  }

  if (patient.nik && user.nik !== patient.nik) {
    if (user.nik) {
      conflict = true;
      blocked = true;
    } else {
      const nikOwner = await prisma.user.findUnique({
        where: { nik: patient.nik },
        select: { id: true },
      });
      if (nikOwner && nikOwner.id !== user.id) {
        conflict = true;
        blocked = true;
      } else {
        data.nik = patient.nik;
      }
    }
  }

  if (patient.dateOfBirth && !dateOnlyEqual(user.dateOfBirth, patient.dateOfBirth)) {
    if (user.hasAccount && user.dateOfBirth) {
      conflict = true;
      blocked = true;
    } else {
      data.dateOfBirth = patient.dateOfBirth;
    }
  }
  if (patient.gender && user.gender !== patient.gender) {
    if (user.hasAccount && user.gender) {
      conflict = true;
      blocked = true;
    } else {
      data.gender = patient.gender;
    }
  }

  return { data, conflict, blocked };
}

async function syncPatient(
  patient: AidoPatient,
  hospitalId: string,
  owner: string,
): Promise<PatientSyncResult> {
  let link = await prisma.aidoPatientLink.findUnique({
    where: {
      hospitalId_externalPatientId: {
        hospitalId,
        externalPatientId: patient.externalPatientId,
      },
    },
    include: { user: { select: syncUserSelect } },
  });

  if (!link && patient.externalPatientNumericId) {
    link = await prisma.aidoPatientLink.findUnique({
      where: {
        hospitalId_externalPatientNumericId: {
          hospitalId,
          externalPatientNumericId: patient.externalPatientNumericId,
        },
      },
      include: { user: { select: syncUserSelect } },
    });
  }

  if (link) {
    const { data, conflict, blocked } = await getUserChanges(link.user, patient);
    const linkChanged = link.externalPatientId !== patient.externalPatientId
      || link.externalPatientNumericId !== patient.externalPatientNumericId
      || (!blocked && link.mrNumber !== patient.mrNumber);

    try {
      await prisma.$transaction(async (tx) => {
        await assertLockOwned(tx, owner);
        if (!blocked && Object.keys(data).length > 0) {
          await tx.user.update({ where: { id: link.userId }, data });
        }
        await tx.aidoPatientLink.update({
          where: { id: link.id },
          data: {
            ...(blocked ? {} : {
              externalPatientId: patient.externalPatientId,
              externalPatientNumericId: patient.externalPatientNumericId,
              mrNumber: patient.mrNumber,
            }),
            lastSyncedAt: new Date(),
          },
        });
      }, SYNC_TRANSACTION_OPTIONS);
      return {
        created: false,
        updated: !blocked && (Object.keys(data).length > 0 || linkChanged),
        conflict,
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return { created: false, updated: false, conflict: true };
      }
      throw error;
    }
  }

  const [mrUser, phoneUser] = await Promise.all([
    patient.mrNumber
      ? prisma.user.findUnique({ where: { nomorRekamMedis: patient.mrNumber }, select: syncUserSelect })
      : null,
    patient.phone
      ? prisma.user.findUnique({ where: { phone: patient.phone }, select: syncUserSelect })
      : null,
  ]);

  if (mrUser && phoneUser && mrUser.id !== phoneUser.id) {
    return { created: false, updated: false, conflict: true };
  }
  if (
    !mrUser
    && phoneUser
    && requiresDobForPhoneMatch(phoneUser)
    && (!patient.dateOfBirth || !dateOnlyEqual(phoneUser.dateOfBirth, patient.dateOfBirth))
  ) {
    return { created: false, updated: false, conflict: true };
  }
  if (
    mrUser
    && mrUser.aidoPatientLinks.some((existingLink) => existingLink.hospitalId !== hospitalId)
  ) {
    return { created: false, updated: false, conflict: true };
  }

  const existingUser = mrUser || phoneUser;
  if (existingUser?.aidoPatientLinks.some((existingLink) => existingLink.hospitalId !== hospitalId)) {
    return { created: false, updated: false, conflict: true };
  }

  try {
    if (existingUser) {
      const { data, conflict, blocked } = await getUserChanges(existingUser, patient);
      if (blocked) return { created: false, updated: false, conflict: true };
      await prisma.$transaction(async (tx) => {
        await assertLockOwned(tx, owner);
        const currentUser = await tx.user.findUnique({
          where: { id: existingUser.id },
          select: syncUserSelect,
        });
        if (
          !currentUser
          || (
            !mrUser
            && requiresDobForPhoneMatch(currentUser)
            && (!patient.dateOfBirth || !dateOnlyEqual(currentUser.dateOfBirth, patient.dateOfBirth))
          )
        ) throw new AidoSourceValidationError();
        if (Object.keys(data).length > 0) {
          await tx.user.update({ where: { id: existingUser.id }, data });
        }
        await tx.aidoPatientLink.create({
          data: {
            userId: existingUser.id,
            hospitalId,
            externalPatientId: patient.externalPatientId,
            externalPatientNumericId: patient.externalPatientNumericId,
            mrNumber: patient.mrNumber,
            lastSyncedAt: new Date(),
          },
        });
      }, SYNC_TRANSACTION_OPTIONS);
      return { created: false, updated: true, conflict };
    }

    await prisma.$transaction(async (tx) => {
      await assertLockOwned(tx, owner);
      const user = await tx.user.create({
        data: {
          firstName: patient.firstName,
          lastName: patient.lastName,
          phone: patient.phone,
          nomorRekamMedis: patient.mrNumber,
          nik: patient.nik,
          dateOfBirth: patient.dateOfBirth,
          gender: patient.gender,
          hasAccount: false,
          qrToken: randomUUID(),
        },
      });
      await tx.aidoPatientLink.create({
        data: {
          userId: user.id,
          hospitalId,
          externalPatientId: patient.externalPatientId,
          externalPatientNumericId: patient.externalPatientNumericId,
          mrNumber: patient.mrNumber,
          lastSyncedAt: new Date(),
        },
      });
    }, SYNC_TRANSACTION_OPTIONS);
    return { created: true, updated: false, conflict: false };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return { created: false, updated: false, conflict: true };
    }
    throw error;
  }
}

async function buildMatchIndex(hospitalId: string): Promise<AidoMatchIndex> {
  const links = await prisma.aidoPatientLink.findMany({
    where: { hospitalId },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          nomorRekamMedis: true,
        },
      },
    },
  });

  const index: AidoMatchIndex = {
    byExternalId: new Map(),
    byNumericId: new Map(),
    byMrNumber: new Map(),
  };

  for (const link of links) {
    index.byExternalId.set(link.externalPatientId, link.userId);
    if (link.externalPatientNumericId) index.byNumericId.set(link.externalPatientNumericId, link.userId);
    if (!link.mrNumber || !link.user.nomorRekamMedis || link.mrNumber === link.user.nomorRekamMedis) {
      addUniqueMatch(index.byMrNumber, link.mrNumber, link.userId);
    }
    addUniqueMatch(index.byMrNumber, link.user.nomorRekamMedis, link.userId);
  }

  return index;
}

export function matchIncomeUser(income: AidoIncome, index: AidoMatchIndex): string | null {
  const stableMatches: Array<string | null | undefined> = [];
  if (income.externalPatientId) {
    stableMatches.push(index.byExternalId.get(income.externalPatientId));
  }
  if (income.externalPatientNumericId) {
    stableMatches.push(index.byNumericId.get(income.externalPatientNumericId));
  }
  if (income.mrNumber) {
    stableMatches.push(index.byMrNumber.get(income.mrNumber));
  }
  if (stableMatches.length > 0) {
    if (stableMatches.some((userId) => !userId)) return null;
    const userIds = new Set(stableMatches as string[]);
    return userIds.size === 1 ? [...userIds][0] : null;
  }
  return null;
}

async function planPatientSync(
  patients: AidoPatient[],
  hospitalId: string,
  owner: string,
): Promise<{
  index: AidoMatchIndex;
  created: number;
  updated: number;
  conflicts: number;
}> {
  const links = await prisma.aidoPatientLink.findMany({
    where: { hospitalId },
    include: { user: { select: syncUserSelect } },
  });
  const linksByExternalId = new Map(links.map((link) => [link.externalPatientId, link]));
  const linksByNumericId = new Map(
    links
      .filter((link) => link.externalPatientNumericId)
      .map((link) => [link.externalPatientNumericId!, link]),
  );
  const index = await buildMatchIndex(hospitalId);
  let created = 0;
  let updated = 0;
  let conflicts = 0;

  for (const [patientIndex, patient] of patients.entries()) {
    if (patientIndex > 0 && patientIndex % 25 === 0) await renewLock(owner);
    const externalLink = linksByExternalId.get(patient.externalPatientId);
    const numericLink = patient.externalPatientNumericId
      ? linksByNumericId.get(patient.externalPatientNumericId)
      : null;
    if (externalLink && numericLink && externalLink.id !== numericLink.id) {
      conflicts += 1;
      continue;
    }

    const link = externalLink || numericLink;
    if (link) {
      const changes = await getUserChanges(link.user, patient);
      if (changes.conflict) conflicts += 1;
      if (Object.keys(changes.data).length > 0 || link.externalPatientId !== patient.externalPatientId) {
        updated += 1;
      }
      index.byExternalId.set(patient.externalPatientId, link.userId);
      if (patient.externalPatientNumericId) {
        index.byNumericId.set(patient.externalPatientNumericId, link.userId);
      }
      if (!changes.blocked) addUniqueMatch(index.byMrNumber, patient.mrNumber, link.userId);
      continue;
    }

    const [mrUser, phoneUser] = await Promise.all([
      patient.mrNumber
        ? prisma.user.findUnique({ where: { nomorRekamMedis: patient.mrNumber }, select: syncUserSelect })
        : null,
      patient.phone
        ? prisma.user.findUnique({ where: { phone: patient.phone }, select: syncUserSelect })
        : null,
    ]);
    const existingUser = mrUser || phoneUser;
    const hasIdentityConflict = Boolean(
      (mrUser && phoneUser && mrUser.id !== phoneUser.id)
      || (
        !mrUser
        && phoneUser
        && requiresDobForPhoneMatch(phoneUser)
        && (!patient.dateOfBirth || !dateOnlyEqual(phoneUser.dateOfBirth, patient.dateOfBirth))
      )
      || existingUser?.aidoPatientLinks.some((item) => item.hospitalId !== hospitalId)
    );
    if (hasIdentityConflict) {
      conflicts += 1;
      continue;
    }

    const plannedUserId = existingUser?.id || `dry-run:${patient.externalPatientId}`;
    if (existingUser) {
      const changes = await getUserChanges(existingUser, patient);
      if (changes.conflict) conflicts += 1;
      if (changes.blocked) continue;
      updated += 1;
    } else {
      created += 1;
    }
    index.byExternalId.set(patient.externalPatientId, plannedUserId);
    if (patient.externalPatientNumericId) {
      index.byNumericId.set(patient.externalPatientNumericId, plannedUserId);
    }
    addUniqueMatch(index.byMrNumber, patient.mrNumber, plannedUserId);
  }

  return { index, created, updated, conflicts };
}

async function recomputeLastTransactionAt(tx: Prisma.TransactionClient, userId: string): Promise<void> {
  const [spending, reservation] = await Promise.all([
    tx.spendingRecord.findFirst({
      where: { userId },
      orderBy: { spendingDate: 'desc' },
      select: { spendingDate: true },
    }),
    tx.reservation.findFirst({
      where: { userId, status: 'completed', completedAt: { not: null } },
      orderBy: { completedAt: 'desc' },
      select: { completedAt: true },
    }),
  ]);

  const dates = [spending?.spendingDate, reservation?.completedAt]
    .filter((date): date is Date => Boolean(date));
  const lastTransactionAt = dates.length > 0
    ? new Date(Math.max(...dates.map((date) => date.getTime())))
    : null;
  await tx.user.update({ where: { id: userId }, data: { lastTransactionAt } });
}

async function updateUserTotals(
  tx: Prisma.TransactionClient,
  userId: string,
  amountDelta: number,
  pointsDelta: number,
): Promise<void> {
  const current = await tx.user.findUniqueOrThrow({
    where: { id: userId },
    select: { totalSpending: true },
  });
  const nextTotalSpending = Number(current.totalSpending) + amountDelta;
  if (!Number.isFinite(nextTotalSpending) || nextTotalSpending < 0) {
    throw new AidoSourceValidationError();
  }

  await tx.user.update({
    where: { id: userId },
    data: {
      totalSpending: { increment: amountDelta },
      points: { increment: pointsDelta },
      loyaltyLevel: tierForSpending(nextTotalSpending),
    },
  });
}

async function syncIncomeLedger(
  income: AidoIncome,
  hospitalId: string,
  syncDate: string,
  matchedUserId: string | null,
  matchStatus: IncomeMatchStatus,
  owner: string,
): Promise<IncomeLedgerResult> {
  return prisma.$transaction(async (tx) => {
    await assertLockOwned(tx, owner);
    const existing = await tx.aidoIncomeRecord.findUnique({
      where: {
        hospitalId_externalId: {
          hospitalId,
          externalId: income.externalId,
        },
      },
    });
    const data = {
      externalPatientId: income.externalPatientId,
      externalPatientNumericId: income.externalPatientNumericId,
      mrNumber: income.mrNumber,
      patientName: income.patientName,
      registrationNumber: income.registrationNumber,
      receiptNumber: income.receiptNumber,
      transactionDate: income.transactionDate,
      amount: income.amount,
      treatment: income.treatment,
      syncDate,
      matchStatus,
      matchedUserId,
      lastSeenAt: new Date(),
    };

    if (!existing) {
      await tx.aidoIncomeRecord.create({
        data: {
          hospitalId,
          externalId: income.externalId,
          ...data,
        },
      });
      return 'created';
    }

    const changed = existing.externalPatientId !== data.externalPatientId
      || existing.externalPatientNumericId !== data.externalPatientNumericId
      || existing.mrNumber !== data.mrNumber
      || existing.patientName !== data.patientName
      || existing.registrationNumber !== data.registrationNumber
      || existing.receiptNumber !== data.receiptNumber
      || existing.transactionDate.getTime() !== data.transactionDate.getTime()
      || Number(existing.amount) !== data.amount
      || existing.treatment !== data.treatment
      || existing.syncDate !== data.syncDate
      || existing.matchStatus !== data.matchStatus
      || existing.matchedUserId !== data.matchedUserId;

    if (!changed) return 'unchanged';
    await tx.aidoIncomeRecord.update({ where: { id: existing.id }, data });
    return 'updated';
  }, { ...SYNC_TRANSACTION_OPTIONS, isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

async function syncIncome(
  income: AidoIncome,
  hospitalId: string,
  userId: string,
  owner: string,
): Promise<'created' | 'updated' | 'unchanged'> {
  const externalId = `${hospitalId}:${income.externalId}`;
  const pointsEarned = pointsForAmount(income.amount);
  const treatment = income.treatment || 'Transaksi AIDO';

  return prisma.$transaction(async (tx) => {
    await assertLockOwned(tx, owner);
    const existing = await tx.spendingRecord.findUnique({
      where: { source_externalId: { source: INCOME_SOURCE, externalId } },
    });

    if (!existing) {
      const user = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: { lastTransactionAt: true },
      });
      await tx.spendingRecord.create({
        data: {
          userId,
          amount: income.amount,
          treatment,
          pointsEarned,
          spendingDate: income.transactionDate,
          source: INCOME_SOURCE,
          externalId,
          registrationNumber: income.registrationNumber,
        },
      });
      await updateUserTotals(tx, userId, income.amount, pointsEarned);
      await tx.user.update({
        where: { id: userId },
        data: {
          lastTransactionAt: !user.lastTransactionAt || income.transactionDate > user.lastTransactionAt
            ? income.transactionDate
            : undefined,
        },
      });
      return 'created';
    }

    const amountDelta = income.amount - Number(existing.amount);
    const pointsDelta = pointsEarned - existing.pointsEarned;
    const hasRecordChanges = amountDelta !== 0
      || pointsDelta !== 0
      || existing.userId !== userId
      || existing.treatment !== treatment
      || existing.registrationNumber !== income.registrationNumber
      || existing.spendingDate.getTime() !== income.transactionDate.getTime();

    if (!hasRecordChanges) return 'unchanged';

    await tx.spendingRecord.update({
      where: { id: existing.id },
      data: {
        userId,
        amount: income.amount,
        treatment,
        pointsEarned,
        spendingDate: income.transactionDate,
        registrationNumber: income.registrationNumber,
      },
    });

    if (existing.userId === userId) {
      if (amountDelta !== 0 || pointsDelta !== 0) {
        await updateUserTotals(tx, userId, amountDelta, pointsDelta);
      }
      await recomputeLastTransactionAt(tx, userId);
      return 'updated';
    }

    await updateUserTotals(tx, existing.userId, -Number(existing.amount), -existing.pointsEarned);
    await updateUserTotals(tx, userId, income.amount, pointsEarned);
    await recomputeLastTransactionAt(tx, existing.userId);
    await recomputeLastTransactionAt(tx, userId);
    return 'updated';
  }, { ...SYNC_TRANSACTION_OPTIONS, isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

async function removeMissingIncomeRecords(
  date: string,
  hospitalId: string,
  seenExternalIds: Set<string>,
  owner: string,
): Promise<number> {
  const range = getAidoReportDateRange(date);
  const existingRecords = await prisma.spendingRecord.findMany({
    where: {
      source: INCOME_SOURCE,
      externalId: { startsWith: `${hospitalId}:` },
      spendingDate: { gte: range.start, lt: range.end },
    },
    select: { id: true, externalId: true },
  });
  const staleIds = existingRecords
    .filter((record) => record.externalId && !seenExternalIds.has(record.externalId))
    .map((record) => record.id);

  let removed = 0;
  for (const staleId of staleIds) {
    const didRemove = await prisma.$transaction(async (tx) => {
      await assertLockOwned(tx, owner);
      const record = await tx.spendingRecord.findUnique({ where: { id: staleId } });
      if (
        !record
        || record.source !== INCOME_SOURCE
        || !record.externalId?.startsWith(`${hospitalId}:`)
        || record.spendingDate < range.start
        || record.spendingDate >= range.end
        || seenExternalIds.has(record.externalId)
      ) return false;

      await tx.spendingRecord.delete({ where: { id: record.id } });
      await updateUserTotals(tx, record.userId, -Number(record.amount), -record.pointsEarned);
      await recomputeLastTransactionAt(tx, record.userId);
      return true;
    }, { ...SYNC_TRANSACTION_OPTIONS, isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if (didRemove) removed += 1;
  }

  return removed;
}

async function removeMissingIncomeLedgerRecords(
  date: string,
  hospitalId: string,
  seenExternalIds: Set<string>,
  owner: string,
): Promise<number> {
  const range = getAidoReportDateRange(date);
  const existingRecords = await prisma.aidoIncomeRecord.findMany({
    where: {
      hospitalId,
      transactionDate: { gte: range.start, lt: range.end },
    },
    select: { id: true, externalId: true },
  });
  const staleIds = existingRecords
    .filter((record) => !seenExternalIds.has(`${hospitalId}:${record.externalId}`))
    .map((record) => record.id);

  let removed = 0;
  for (const staleId of staleIds) {
    const didRemove = await prisma.$transaction(async (tx) => {
      await assertLockOwned(tx, owner);
      const record = await tx.aidoIncomeRecord.findUnique({ where: { id: staleId } });
      if (
        !record
        || record.hospitalId !== hospitalId
        || record.transactionDate < range.start
        || record.transactionDate >= range.end
        || seenExternalIds.has(`${hospitalId}:${record.externalId}`)
      ) return false;

      await tx.aidoIncomeRecord.delete({ where: { id: record.id } });
      return true;
    }, { ...SYNC_TRANSACTION_OPTIONS, isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if (didRemove) removed += 1;
  }

  return removed;
}

function safeErrorMessage(error: unknown): string {
  if (error instanceof AidoConfigurationError) return 'AIDO_CONFIGURATION_ERROR';
  if (error instanceof AidoRequestError) return 'AIDO_REQUEST_ERROR';
  if (error instanceof AidoSourceValidationError) return 'AIDO_SOURCE_VALIDATION_ERROR';
  if (error instanceof AidoSyncIncompleteError) return 'AIDO_SYNC_REQUIRES_REVIEW';
  if (error instanceof AidoSyncAlreadyRunningError) return 'AIDO_SYNC_LOCK_ERROR';
  if (error instanceof Prisma.PrismaClientKnownRequestError) return `DATABASE_${error.code}`;
  return 'UNEXPECTED_SYNC_ERROR';
}

export async function runAidoSync(options: {
  date: string;
  dryRun?: boolean;
  mode?: string;
}): Promise<AidoSyncSummary> {
  const owner = randomUUID();
  if (!(await acquireLock(owner))) throw new AidoSyncAlreadyRunningError();

  const dryRun = options.dryRun === true;
  const canonicalSpending = isAidoCanonicalSpendingActive(options.date);
  const summary: AidoSyncSummary = {
    date: options.date,
    dryRun,
    patientsFetched: 0,
    patientsCreated: 0,
    patientsUpdated: 0,
    patientConflicts: 0,
    incomesFetched: 0,
    incomesCreated: 0,
    incomesUpdated: 0,
    incomesRemoved: 0,
    incomeLedgerCreated: 0,
    incomeLedgerUpdated: 0,
    incomeLedgerRemoved: 0,
    incomesMatched: 0,
    incomesUnmatched: 0,
    reviewRequired: false,
    invalidRows: 0,
  };
  let runId: string | null = null;

  try {
    if (!dryRun && process.env.AIDO_SYNC_CANONICAL_SPENDING === 'true') {
      assertAidoCanonicalSpending(options.date);
    }
    const run = await prisma.aidoSyncRun.create({
      data: {
        syncDate: options.date,
        mode: dryRun ? 'dry-run' : options.mode || 'scheduled',
        status: 'RUNNING',
      },
    });
    runId = run.id;

    const client = AidoClient.fromEnv();
    const session = await client.login();
    await prisma.aidoSyncRun.update({
      where: { id: runId },
      data: { hospitalId: session.hospitalId },
    });
    await renewLock(owner);
    const [rawPatients, rawIncome] = await Promise.all([
      client.getAllPatients(session, () => renewLock(owner)),
      client.getIncome(session, options.date, () => renewLock(owner)),
    ]);

    const mappedPatients = rawPatients.map(mapAidoPatient);
    // AIDO report dates are UTC calendar dates even though the schedule is Jakarta-based.
    const incomeRange = getAidoReportDateRange(options.date);
    const mappedIncome = rawIncome.map((row) => {
      const income = mapAidoIncome(row);
      if (
        !income
        || income.transactionDate < incomeRange.start
        || income.transactionDate >= incomeRange.end
      ) return null;
      return income;
    });
    const patients = deduplicate(
      mappedPatients.filter((row): row is AidoPatient => row !== null),
      (row) => row.externalPatientId,
    );
    assertUniquePatientIdentity(patients);
    const incomes = deduplicate(
      mappedIncome.filter((row): row is AidoIncome => row !== null),
      (row) => row.externalId,
    );

    summary.patientsFetched = rawPatients.length;
    summary.incomesFetched = rawIncome.length;
    summary.invalidRows = mappedPatients.filter((row) => row === null).length
      + mappedIncome.filter((row) => row === null).length;
    if (summary.invalidRows > 0) throw new AidoSyncIncompleteError(summary);

    if (dryRun) {
      const plan = await planPatientSync(patients, session.hospitalId, owner);
      summary.patientsCreated = plan.created;
      summary.patientsUpdated = plan.updated;
      summary.patientConflicts = plan.conflicts;
      for (const income of incomes) {
        if (matchIncomeUser(income, plan.index)) summary.incomesMatched += 1;
        else summary.incomesUnmatched += 1;
      }
    } else {
      const blockedPatientKeys = new Set<string>();
      for (const [index, patient] of patients.entries()) {
        const result = await syncPatient(patient, session.hospitalId, owner);
        if (result.created) summary.patientsCreated += 1;
        if (result.updated) summary.patientsUpdated += 1;
        if (result.conflict) {
          summary.patientConflicts += 1;
          addBlockedPatientKeys(blockedPatientKeys, patient);
        }
        if ((index + 1) % 25 === 0) await renewLock(owner);
      }

      const matchIndex = await buildMatchIndex(session.hospitalId);
      const seenExternalIds = new Set<string>();
      for (const [index, income] of incomes.entries()) {
        seenExternalIds.add(`${session.hospitalId}:${income.externalId}`);
        const blocked = incomeUsesBlockedPatient(income, blockedPatientKeys);
        const userId = blocked ? null : matchIncomeUser(income, matchIndex);
        const matchStatus: IncomeMatchStatus = blocked
          ? 'CONFLICT'
          : userId
            ? 'MATCHED'
            : 'UNMATCHED';
        const ledgerResult = await syncIncomeLedger(
          income,
          session.hospitalId,
          options.date,
          userId,
          matchStatus,
          owner,
        );
        if (ledgerResult === 'created') summary.incomeLedgerCreated += 1;
        if (ledgerResult === 'updated') summary.incomeLedgerUpdated += 1;
        if (userId) summary.incomesMatched += 1;
        else summary.incomesUnmatched += 1;

        if (!userId) {
          if ((index + 1) % 25 === 0) await renewLock(owner);
          continue;
        }
        if (!canonicalSpending) {
          if ((index + 1) % 25 === 0) await renewLock(owner);
          continue;
        }

        const result = await syncIncome(income, session.hospitalId, userId, owner);
        if (result === 'created') summary.incomesCreated += 1;
        if (result === 'updated') summary.incomesUpdated += 1;
        if ((index + 1) % 25 === 0) await renewLock(owner);
      }

      if (
        process.env.AIDO_SYNC_RECONCILE_MISSING === 'true'
        && summary.patientConflicts === 0
        && summary.incomesUnmatched === 0
      ) {
        summary.incomesRemoved = canonicalSpending
          ? await removeMissingIncomeRecords(
            options.date,
            session.hospitalId,
            seenExternalIds,
            owner,
          )
          : 0;
        summary.incomeLedgerRemoved = await removeMissingIncomeLedgerRecords(
          options.date,
          session.hospitalId,
          seenExternalIds,
          owner,
        );
      }
    }

    if (summary.patientConflicts > 0 || (summary.incomesUnmatched > 0 && canonicalSpending)) {
      throw new AidoSyncIncompleteError(summary);
    }
    summary.reviewRequired = summary.incomesUnmatched > 0;

    await prisma.aidoSyncRun.update({
      where: { id: runId },
      data: {
        status: summary.reviewRequired ? 'COMPLETED_REVIEW' : 'COMPLETED',
        patientsFetched: summary.patientsFetched,
        patientsCreated: summary.patientsCreated,
        patientsUpdated: summary.patientsUpdated,
        patientConflicts: summary.patientConflicts,
        incomesFetched: summary.incomesFetched,
        incomesCreated: summary.incomesCreated,
        incomesUpdated: summary.incomesUpdated,
        incomesRemoved: summary.incomesRemoved,
        incomeLedgerCreated: summary.incomeLedgerCreated,
        incomeLedgerUpdated: summary.incomeLedgerUpdated,
        incomeLedgerRemoved: summary.incomeLedgerRemoved,
        incomesMatched: summary.incomesMatched,
        incomesUnmatched: summary.incomesUnmatched,
        invalidRows: summary.invalidRows,
        finishedAt: new Date(),
      },
    });

    console.info('[AIDO SYNC] Completed', summary);
    return summary;
  } catch (error) {
    if (runId) {
      await prisma.aidoSyncRun.update({
        where: { id: runId },
        data: {
          status: error instanceof AidoSyncIncompleteError ? 'PARTIAL' : 'FAILED',
          patientsFetched: summary.patientsFetched,
          patientsCreated: summary.patientsCreated,
          patientsUpdated: summary.patientsUpdated,
          patientConflicts: summary.patientConflicts,
          incomesFetched: summary.incomesFetched,
          incomesCreated: summary.incomesCreated,
          incomesUpdated: summary.incomesUpdated,
          incomesRemoved: summary.incomesRemoved,
          incomeLedgerCreated: summary.incomeLedgerCreated,
          incomeLedgerUpdated: summary.incomeLedgerUpdated,
          incomeLedgerRemoved: summary.incomeLedgerRemoved,
          incomesMatched: summary.incomesMatched,
          incomesUnmatched: summary.incomesUnmatched,
          invalidRows: summary.invalidRows,
          errorMessage: safeErrorMessage(error),
          finishedAt: new Date(),
        },
      }).catch(() => undefined);
    }
    console.error('[AIDO SYNC] Failed', safeErrorMessage(error));
    throw error;
  } finally {
    await releaseLock(owner).catch(() => undefined);
  }
}
