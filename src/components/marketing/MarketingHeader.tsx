'use client';

import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/nextjs';
import Link from 'next/link';

export default function MarketingHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-primary/20 bg-black/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/marketing" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-dark font-bold">
            DR
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold text-primary">Derma Rich Wellness</p>
            <p className="text-[11px] text-white/60">Digital Marketing Dashboard</p>
          </div>
        </Link>

        <div className="flex items-center gap-4">
          <SignedOut>
            <SignInButton mode="modal">
              <button className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-dark transition-colors hover:bg-primary/90">
                Sign In
              </button>
            </SignInButton>
          </SignedOut>
          <SignedIn>
            <UserButton
              afterSignOutUrl="/marketing"
              appearance={{ elements: { avatarBox: 'w-9 h-9' } }}
            />
          </SignedIn>
        </div>
      </div>
    </header>
  );
}
