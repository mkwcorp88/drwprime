'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStaffAuth } from '@/components/staff-auth/StaffAuthProvider';

export default function AdminDashboard() {
  const { isLoaded } = useStaffAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoaded) {
      router.push('/front-office');
    }
  }, [isLoaded, router]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-primary text-xl">Membuka Front Office...</div>
    </div>
  );
}
