import { auth, currentUser } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { normalizePhone } from '@/lib/phone';
import { Prisma } from '@prisma/client';

const GENDERS = ['Pria', 'Wanita'];

class IdentityVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IdentityVerificationError';
  }
}

function sameDate(left: Date | null, right: Date | null): boolean {
  if (!left || !right) return false;
  return left.toISOString().slice(0, 10) === right.toISOString().slice(0, 10);
}

function tierForSpending(totalSpending: number): 'Bronze' | 'Silver' | 'Gold' | 'Platinum' {
  if (totalSpending >= 10_000_000) return 'Platinum';
  if (totalSpending >= 5_000_000) return 'Gold';
  if (totalSpending >= 1_000_000) return 'Silver';
  return 'Bronze';
}

type ProfileUser = {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  nik: string | null;
  gender: string | null;
  dateOfBirth: Date | null;
  address: string | null;
  city: string | null;
  province: string | null;
  profileCompletedAt: Date | null;
};

function isProfileComplete(user: ProfileUser): boolean {
  return (
    !!user.phone &&
    !!user.nik &&
    !!user.gender &&
    !!user.dateOfBirth &&
    !!user.address &&
    !!user.city &&
    !!user.province
  );
}

function serializeProfile(user: ProfileUser) {
  return {
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone,
    nik: user.nik,
    gender: user.gender,
    dateOfBirth: user.dateOfBirth
      ? user.dateOfBirth.toISOString().split('T')[0]
      : null,
    address: user.address,
    city: user.city,
    province: user.province,
    profileCompletedAt: user.profileCompletedAt,
    isComplete: isProfileComplete(user),
  };
}

const PROFILE_SELECT = {
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  nik: true,
  gender: true,
  dateOfBirth: true,
  address: true,
  city: true,
  province: true,
  profileCompletedAt: true,
} as const;

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      select: PROFILE_SELECT,
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found', needsSync: true }, { status: 404 });
    }

    return NextResponse.json({ profile: serializeProfile(user) });
  } catch (error) {
    console.error('Error fetching profile:', error);
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();

    const phone = typeof body.phone === 'string' ? normalizePhone(body.phone.trim()) : '';
    const nik = typeof body.nik === 'string' ? body.nik.trim() : '';
    const gender = typeof body.gender === 'string' ? body.gender.trim() : '';
    const dateOfBirth = typeof body.dateOfBirth === 'string' ? body.dateOfBirth.trim() : '';
    const address = typeof body.address === 'string' ? body.address.trim() : '';
    const city = typeof body.city === 'string' ? body.city.trim() : '';
    const province = typeof body.province === 'string' ? body.province.trim() : '';

    const errors: Record<string, string> = {};

    if (!phone) {
      errors.phone = 'Nomor HP wajib diisi';
    } else if (!/^62\d{8,13}$/.test(phone)) {
      errors.phone = 'Format nomor HP tidak valid';
    }

    if (!nik) {
      errors.nik = 'NIK wajib diisi';
    } else if (!/^[0-9]{16}$/.test(nik)) {
      errors.nik = 'NIK harus 16 digit angka';
    }

    if (!gender) {
      errors.gender = 'Jenis kelamin wajib diisi';
    } else if (!GENDERS.includes(gender)) {
      errors.gender = 'Jenis kelamin tidak valid';
    }

    let dob: Date | null = null;
    if (!dateOfBirth) {
      errors.dateOfBirth = 'Tanggal lahir wajib diisi';
    } else {
      dob = /^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)
        ? new Date(`${dateOfBirth}T00:00:00Z`)
        : null;
      if (!dob || Number.isNaN(dob.getTime()) || dob.toISOString().slice(0, 10) !== dateOfBirth) {
        errors.dateOfBirth = 'Tanggal lahir tidak valid';
      } else if (dob > new Date()) {
        errors.dateOfBirth = 'Tanggal lahir tidak boleh di masa depan';
      }
    }

    if (!address) errors.address = 'Alamat wajib diisi';
    if (!city) errors.city = 'Kota/Kabupaten wajib diisi';
    if (!province) errors.province = 'Provinsi wajib diisi';

    if (Object.keys(errors).length > 0) {
      return NextResponse.json({ error: 'Validasi gagal', fields: errors }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      select: { 
        id: true,
        phone: true,
        profileCompletedAt: true,
        memberSince: true,
        nomorRekamMedis: true,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'User not found', needsSync: true }, { status: 404 });
    }

    const isPhoneChanged = existing.phone !== phone;
    let walkInMember: {
      id: string;
      clerkUserId: string | null;
    } | null = null;

    if (isPhoneChanged && phone) {
      const clerkUser = await currentUser();
      const hasVerifiedPhone = clerkUser?.phoneNumbers.some((clerkPhone) => (
        clerkPhone.verification?.status === 'verified'
        && normalizePhone(clerkPhone.phoneNumber) === phone
      ));
      if (!hasVerifiedPhone) {
        return NextResponse.json(
          { error: 'Verifikasi nomor HP di akun terlebih dahulu.' },
          { status: 409 }
        );
      }

      walkInMember = await prisma.user.findUnique({
        where: { phone },
        select: {
          id: true,
          clerkUserId: true,
        },
      });

      if (walkInMember && !walkInMember.clerkUserId && walkInMember.id !== existing.id) {
        const walkInId = walkInMember.id;
        const user = await prisma.$transaction(async (tx) => {
          await tx.$queryRaw`
            SELECT "id"
            FROM "users"
            WHERE "id" IN (${Prisma.join([existing.id, walkInId])})
            ORDER BY "id"
            FOR UPDATE
          `;

          const [current, walkIn] = await Promise.all([
            tx.user.findUnique({
              where: { id: existing.id },
              select: {
                id: true,
                nomorRekamMedis: true,
                memberSince: true,
                totalSpending: true,
                loyaltyPoints: true,
                totalReferrals: true,
                totalEarnings: true,
                qrToken: true,
                lastTransactionAt: true,
              },
            }),
            tx.user.findUnique({
              where: { id: walkInId },
              select: {
                id: true,
                clerkUserId: true,
                points: true,
                totalSpending: true,
                loyaltyPoints: true,
                totalReferrals: true,
                totalEarnings: true,
                memberSince: true,
                nomorRekamMedis: true,
                nik: true,
                dateOfBirth: true,
                qrToken: true,
                lastTransactionAt: true,
                _count: {
                  select: {
                    spendingRecords: true,
                    riwayatTindakan: true,
                    aidoPatientLinks: true,
                    reservations: true,
                    transactions: true,
                    voucherRedemptions: true,
                    eventRegistrations: true,
                    bankAccounts: true,
                    withdrawals: true,
                  },
                },
              },
            }),
          ]);

          if (!current || !walkIn || walkIn.clerkUserId) {
            throw new IdentityVerificationError('Nomor HP telah diklaim akun lain.');
          }

          const hasSensitiveData = Boolean(
            walkIn.nomorRekamMedis
            || walkIn.nik
            || walkIn.dateOfBirth
            || walkIn.points !== 0
            || Number(walkIn.totalSpending) !== 0
            || Object.values(walkIn._count).some((count) => count > 0)
          );
          if (hasSensitiveData && !sameDate(walkIn.dateOfBirth, dob)) {
            throw new IdentityVerificationError(
              'Tanggal lahir tidak cocok. Hubungi admin untuk verifikasi data pasien.'
            );
          }
          if (walkIn.nik && walkIn.nik !== nik) {
            throw new IdentityVerificationError(
              'NIK tidak cocok. Hubungi admin untuk verifikasi data pasien.'
            );
          }
          if (
            current.nomorRekamMedis
            && walkIn.nomorRekamMedis
            && current.nomorRekamMedis !== walkIn.nomorRekamMedis
          ) {
            throw new IdentityVerificationError(
              'Data rekam medis berbeda. Hubungi admin untuk verifikasi.'
            );
          }

          await tx.spendingRecord.updateMany({
            where: { userId: walkInId },
            data: { userId: existing.id },
          });
          await tx.aidoPatientLink.updateMany({
            where: { userId: walkInId },
            data: { userId: existing.id },
          });
          await tx.riwayatTindakan.updateMany({
            where: { userId: walkInId },
            data: { userId: existing.id },
          });

          if (walkIn.nomorRekamMedis) {
            await tx.user.update({
              where: { id: walkInId },
              data: { nomorRekamMedis: null },
            });
          }

          await tx.reservation.updateMany({
            where: { userId: walkInId },
            data: { userId: existing.id },
          });
          await tx.reservation.updateMany({
            where: { referrerId: walkInId },
            data: { referrerId: existing.id },
          });
          await tx.transaction.updateMany({
            where: { userId: walkInId },
            data: { userId: existing.id },
          });
          await tx.voucherRedemption.updateMany({
            where: { userId: walkInId },
            data: { userId: existing.id },
          });
          await tx.eventRegistration.updateMany({
            where: { userId: walkInId },
            data: { userId: existing.id },
          });
          await tx.bankAccount.updateMany({
            where: { userId: walkInId },
            data: { userId: existing.id },
          });
          await tx.withdrawal.updateMany({
            where: { userId: walkInId },
            data: { userId: existing.id },
          });
          await tx.user.delete({
            where: { id: walkInId },
          });

          const mergedTotalSpending = Number(current.totalSpending) + Number(walkIn.totalSpending);
          const lastTransactionAt = [current.lastTransactionAt, walkIn.lastTransactionAt]
            .filter((date): date is Date => Boolean(date))
            .sort((left, right) => right.getTime() - left.getTime())[0];
          return tx.user.update({
            where: { id: existing.id },
            data: {
              phone,
              nik,
              gender,
              dateOfBirth: dob,
              address,
              city,
              province,
              profileCompletedAt: existing.profileCompletedAt ?? new Date(),
              points: { increment: walkIn.points },
              totalSpending: { increment: Number(walkIn.totalSpending) },
              loyaltyPoints: { increment: walkIn.loyaltyPoints },
              totalReferrals: { increment: walkIn.totalReferrals },
              totalEarnings: { increment: Number(walkIn.totalEarnings) },
              loyaltyLevel: tierForSpending(mergedTotalSpending),
              nomorRekamMedis: current.nomorRekamMedis ?? walkIn.nomorRekamMedis,
              qrToken: walkIn.qrToken ?? current.qrToken,
              lastTransactionAt,
              memberSince: walkIn.memberSince < current.memberSince
                ? walkIn.memberSince
                : undefined,
            },
            select: PROFILE_SELECT,
          });
        }, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 5_000,
          timeout: 30_000,
        });

        console.log('[PROFILE-MERGE] Verified walk-in member merge completed');
        return NextResponse.json({ profile: serializeProfile(user), merged: true });
      } else if (walkInMember && walkInMember.clerkUserId) {
        // Phone already belongs to another account with Clerk
        return NextResponse.json(
          { error: 'Nomor HP ini sudah terdaftar di akun lain', fields: { phone: 'Nomor HP sudah digunakan' } },
          { status: 409 }
        );
      }
    }

    const user = await prisma.user.update({
      where: { clerkUserId: userId },
      data: {
        phone,
        nik,
        gender,
        dateOfBirth: dob,
        address,
        city,
        province,
        profileCompletedAt: existing.profileCompletedAt ?? new Date(),
      },
      select: PROFILE_SELECT,
    });

    return NextResponse.json({ 
      profile: serializeProfile(user),
      merged: false,
    });
  } catch (error) {
    if (error instanceof IdentityVerificationError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Nomor HP atau NIK sudah terdaftar di akun lain.' },
        { status: 409 },
      );
    }
    console.error('Error updating profile:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
