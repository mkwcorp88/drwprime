'use client';

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";
import AnnouncementTicker from "./AnnouncementTicker";

export default function MobileHeader() {
  const { user } = useUser();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const profileHref = isMounted && user ? "/my-prime" : "/sign-in";
  const profileImageUrl = isMounted ? user?.imageUrl : null;
  const profileAlt = user?.firstName || "User";

  return (
    <header className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-black border-b border-primary/10">
      <AnnouncementTicker />
      <div className="px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Logo & Brand */}
          <Link href="/" className="flex items-center">
            <Image 
              src="/drwprime-logo.png" 
              alt="DRW Prime Logo" 
              width={154} 
              height={40}
              className="h-8 w-auto object-contain"
              priority
            />
          </Link>

          {/* User Profile Only */}
          <Link href={profileHref}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center overflow-hidden border border-primary/30">
              {profileImageUrl ? (
                <Image 
                  src={profileImageUrl} 
                  alt={profileAlt} 
                  width={32} 
                  height={32}
                  className="w-full h-full object-cover"
                  unoptimized
                />
              ) : (
                <div className="w-full h-full bg-primary/10 flex items-center justify-center">
                  <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              )}
            </div>
          </Link>
        </div>
      </div>
    </header>
  );
}
