import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { normalizePhone } from '@/lib/phone';
import { Prisma } from '@prisma/client';

const GENDERS = ['Pria', 'Wanita'];

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
    } else if (!/^[0-9]{8,13}$/.test(phone)) {
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
      dob = new Date(dateOfBirth);
      if (Number.isNaN(dob.getTime())) {
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
        profileCompletedAt: true 
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'User not found', needsSync: true }, { status: 404 });
    }

    // IMPORTANT: Check if there's a walk-in member with this phone that we should merge
    const isPhoneChanged = existing.phone !== phone;
    let walkInMember: {
      id: string;
      clerkUserId: string | null;
      hasAccount: boolean;
      points: number;
      totalSpending: Prisma.Decimal;
      memberSince: Date;
    } | null = null;

    if (isPhoneChanged && phone) {
      walkInMember = await prisma.user.findUnique({
        where: { phone },
        select: {
          id: true,
          clerkUserId: true,
          hasAccount: true,
          points: true,
          totalSpending: true,
          memberSince: true,
        },
      });

      // Only merge if it's a walk-in member (no Clerk account)
      if (walkInMember && !walkInMember.clerkUserId && walkInMember.id !== existing.id) {
        console.log(`[PROFILE-MERGE] Found walk-in member ${walkInMember.id} with phone ${phone}, merging to user ${existing.id}`);
        
        const walkInId = walkInMember.id;
        const walkInPoints = walkInMember.points;
        const walkInSpending = Number(walkInMember.totalSpending);
        const walkInMemberSince = walkInMember.memberSince;
        
        // Merge walk-in member data into current user account
        await prisma.$transaction(async (tx) => {
          // 1. Transfer all spending records from walk-in to current user
          await tx.spendingRecord.updateMany({
            where: { userId: walkInId },
            data: { userId: existing.id },
          });

          // 2. Transfer all reservations from walk-in to current user
          await tx.reservation.updateMany({
            where: { userId: walkInId },
            data: { userId: existing.id },
          });

          // 3. Transfer referrals (if walk-in was a referrer)
          await tx.reservation.updateMany({
            where: { referrerId: walkInId },
            data: { referrerId: existing.id },
          });

          // 4. Transfer transactions
          await tx.transaction.updateMany({
            where: { userId: walkInId },
            data: { userId: existing.id },
          });

          // 5. Transfer voucher redemptions
          await tx.voucherRedemption.updateMany({
            where: { userId: walkInId },
            data: { userId: existing.id },
          });

          // 6. Transfer event registrations
          await tx.eventRegistration.updateMany({
            where: { userId: walkInId },
            data: { userId: existing.id },
          });

          // 7. Transfer bank accounts
          await tx.bankAccount.updateMany({
            where: { userId: walkInId },
            data: { userId: existing.id },
          });

          // 8. Transfer withdrawals
          await tx.withdrawal.updateMany({
            where: { userId: walkInId },
            data: { userId: existing.id },
          });

          // 9. Update current user with merged data
          await tx.user.update({
            where: { id: existing.id },
            data: {
              points: { increment: walkInPoints },
              totalSpending: { increment: walkInSpending },
              // Keep the earlier memberSince date
              memberSince: walkInMemberSince < new Date(existing.id) 
                ? walkInMemberSince 
                : undefined,
            },
          });

          // 10. Delete the old walk-in member record
          await tx.user.delete({
            where: { id: walkInId },
          });

          console.log(`[PROFILE-MERGE] Successfully merged walk-in member ${walkInId} into ${existing.id}`);
        });
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
      merged: !!walkInMember, // Tell frontend if merge happened
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
