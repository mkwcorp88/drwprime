import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { normalizePhone } from '@/lib/phone';

const GENDERS = ['Pria', 'Wanita'];

type ProfileUser = {
  firstName: string | null;
  lastName: string | null;
  email: string;
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
      select: { profileCompletedAt: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'User not found', needsSync: true }, { status: 404 });
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

    return NextResponse.json({ profile: serializeProfile(user) });
  } catch (error) {
    console.error('Error updating profile:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
