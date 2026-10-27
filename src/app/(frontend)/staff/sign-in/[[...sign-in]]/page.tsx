import { Suspense } from 'react';
import StaffLoginForm from '@/components/staff-auth/StaffLoginForm';

export default function StaffSignInPage() {
  return <Suspense fallback={null}><StaffLoginForm /></Suspense>;
}
