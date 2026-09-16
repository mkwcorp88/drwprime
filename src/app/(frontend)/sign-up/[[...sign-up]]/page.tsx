import { Suspense } from 'react';
import MemberLoginForm from '@/components/member-auth/MemberLoginForm';
import LoadingScreen from '@/components/LoadingScreen';

export default function SignUpPage() {
  return <Suspense fallback={<LoadingScreen />}><MemberLoginForm /></Suspense>;
}
