import { SignIn } from '@clerk/nextjs';
import Link from 'next/link';

export default function StaffSignInPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-black px-4 py-10 text-white">
      <h1 className="text-xl font-semibold text-primary">Login Staf DRW Prime</h1>
      <SignIn routing="path" path="/staff/sign-in" fallbackRedirectUrl="/front-office" />
      <Link href="/sign-in" className="text-sm text-primary">Login member dengan WhatsApp</Link>
    </main>
  );
}
