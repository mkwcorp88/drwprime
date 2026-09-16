"use client";

import { useEffect, useState } from "react";
import { useMemberAuth } from '@/components/member-auth/MemberAuthProvider';
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function AffiliatePopup() {
  const [isOpen, setIsOpen] = useState(false);
  const { isSignedIn } = useMemberAuth();
  const router = useRouter();

  useEffect(() => {
    // Show popup on every page load
    setIsOpen(true);
  }, []);

  const handleClick = () => {
    setIsOpen(false);
    if (isSignedIn) {
      router.push("/affiliate-dashboard");
    } else {
      router.push("/sign-in");
    }
  };

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={handleClick}
    >
      <div className="relative max-w-2xl w-full mx-4 cursor-pointer">
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute -top-4 -right-4 bg-white rounded-full p-2 shadow-lg hover:bg-gray-100 transition-colors z-10"
          aria-label="Close popup"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6 text-gray-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        {/* Popup Image */}
        <div className="relative w-full aspect-[4/3] rounded-lg overflow-hidden shadow-2xl">
          <Image
            src="/pop_up_afilliate.png"
            alt="Affiliate Program"
            fill
            sizes="(min-width: 1024px) 32rem, 90vw"
            className="object-contain"
            priority
          />
        </div>
      </div>
    </div>
  );
}
