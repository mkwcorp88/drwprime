import { Prisma, type User } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireMember } from '@/lib/member-auth/session';
import { normalizeLoginPhone, parseBirthDate, MemberAuthError } from '@/lib/member-auth/policy';
import { assertMemberOrigin, memberError, memberJson, memberResponse } from '@/lib/member-auth/http';

function profile(user: User) {
  return {
    firstName: user.firstName, lastName: user.lastName, email: user.email,
    phone: user.loginPhone, nik: user.nik, gender: user.gender,
    dateOfBirth: user.dateOfBirth?.toISOString().slice(0, 10) || null,
    address: user.address, city: user.city, province: user.province,
    profileCompletedAt: user.profileCompletedAt,
    isComplete: Boolean(user.loginPhone && user.nik && user.gender && user.dateOfBirth && user.address && user.city && user.province),
  };
}

export async function GET() {
  try { return memberResponse({ profile: profile(await requireMember()) }); }
  catch (error) { return memberError(error); }
}

export async function PUT(request: Request) {
  try {
    const member = await requireMember();
    assertMemberOrigin(request);
    const body = await memberJson(request);
    const text = (key: string) => typeof body[key] === 'string' ? body[key].trim() : '';
    const phone = normalizeLoginPhone(body.phone);
    if (phone !== member.loginPhone) throw new MemberAuthError(409, 'Perubahan nomor login memerlukan verifikasi melalui Front Office.', 'PHONE_VERIFICATION_REQUIRED');
    const nik = text('nik');
    const gender = text('gender');
    const dateOfBirth = parseBirthDate(body.dateOfBirth);
    const address = text('address');
    const city = text('city');
    const province = text('province');
    const fields: Record<string, string> = {};
    if (!/^\d{16}$/.test(nik)) fields.nik = 'NIK harus 16 digit angka';
    if (!['Pria', 'Wanita'].includes(gender)) fields.gender = 'Pilih jenis kelamin';
    if (!dateOfBirth) fields.dateOfBirth = 'Tanggal lahir tidak valid';
    if (!address || address.length > 1000) fields.address = 'Isi alamat maksimal 1000 karakter';
    if (!city || city.length > 100) fields.city = 'Isi kota/kabupaten';
    if (!province || province.length > 100) fields.province = 'Isi provinsi';
    if (Object.keys(fields).length) return memberResponse({ error: 'Validasi gagal', fields }, 400);
    // Account activation has already resolved identity. Profile edits never merge
    // patients or transfer balances, and never change the verified login number.
    const user = await prisma.user.update({ where: { id: member.id }, data: {
      nik, gender, dateOfBirth, address, city, province,
      profileCompletedAt: member.profileCompletedAt || new Date(),
    } });
    return memberResponse({ profile: profile(user), merged: false });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return memberResponse({ error: 'NIK sudah terkait dengan data member lain. Hubungi Front Office.' }, 409);
    }
    return memberError(error);
  }
}
