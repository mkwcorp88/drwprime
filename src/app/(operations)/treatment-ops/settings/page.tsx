import { redirect } from 'next/navigation';
import PasswordSettings from '@/components/treatment-ops/PasswordSettings';
import ProfileSettings, { type ProfileStaff } from '@/components/treatment-ops/ProfileSettings';
import { getOpsStaff } from '@/lib/treatment-operations/auth';
import { prisma } from '@/lib/prisma';

export default async function TreatmentOpsSettingsPage() {
  const staff = await getOpsStaff();
  if (!staff) redirect('/treatment-ops/login');

  const branchName = staff.branchId
    ? (await prisma.opsBranch.findUnique({ where: { id: staff.branchId }, select: { name: true } }))?.name ?? null
    : null;

  const profile: ProfileStaff = {
    name: staff.name,
    role: staff.role,
    employeeId: staff.employeeId,
    email: staff.email,
    phone: staff.phone,
    avatarUrl: staff.avatarUrl,
    branchName,
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <ProfileSettings staff={profile} />
      <PasswordSettings staffName={staff.name} email={staff.email} forced={staff.mustChangePassword} />
    </div>
  );
}
