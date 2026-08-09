'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { SignedIn, SignedOut, UserButton, useUser } from '@clerk/nextjs';
import AnnouncementTicker from './AnnouncementTicker';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAffiliate, setIsAffiliate] = useState(false);
  const { user, isLoaded } = useUser();

  useEffect(() => {
    if (isLoaded && user) {
      checkAdminStatus();
    }
  }, [isLoaded, user]);

  const checkAdminStatus = async () => {
    try {
      const response = await fetch('/api/user');
      const data = await response.json();
      setIsAdmin(data.user?.isAdmin || false);
      setIsAffiliate(data.user?.isTeamLeader || false);
    } catch (error) {
      console.error('Error checking admin status:', error);
    }
  };

  return (
    <nav className="hidden lg:block fixed top-0 w-full bg-black/95 backdrop-blur-md z-50 border-b border-primary/20">
      <AnnouncementTicker />
      <div className="max-w-[1440px] mx-auto px-4 xl:px-6 flex justify-between items-center gap-4 py-4">
        <Link href="/" className="shrink-0 pr-2">
          <Image 
            src="/drwprime-logo.png" 
            alt="DRW Prime Logo" 
            width={150}
            height={40}
            className="h-10 w-auto"
          />
        </Link>

        {/* Desktop Menu */}
        <ul className="hidden md:flex flex-1 justify-end gap-4 xl:gap-6 2xl:gap-8 items-center min-w-0">
          <li>
            <Link 
              href="/treatments" 
              className="text-white hover:text-primary transition-colors duration-300 text-[13px] xl:text-sm font-medium tracking-normal xl:tracking-wide whitespace-nowrap"
            >
              TREATMENT
            </Link>
          </li>
          <li>
            <Link 
              href="/home-treatment" 
              className="text-white hover:text-primary transition-colors duration-300 text-[13px] xl:text-sm font-medium tracking-normal xl:tracking-wide whitespace-nowrap"
            >
              HOME TREATMENT
            </Link>
          </li>
          <li>
            <Link 
              href="/#gallery" 
              className="text-white hover:text-primary transition-colors duration-300 text-[13px] xl:text-sm font-medium tracking-normal xl:tracking-wide whitespace-nowrap"
            >
              GALERI
            </Link>
          </li>
          <li>
            <Link 
              href="/product-gallery" 
              className="text-white hover:text-primary transition-colors duration-300 text-[13px] xl:text-sm font-medium tracking-normal xl:tracking-wide whitespace-nowrap"
            >
              PRODUCT GALLERY
            </Link>
          </li>
          <li>
            <Link 
              href="/best-deal" 
              className="text-white hover:text-primary transition-colors duration-300 text-[13px] xl:text-sm font-medium tracking-normal xl:tracking-wide whitespace-nowrap"
            >
              BEST DEAL
            </Link>
          </li>
          <li>
            <Link
              href="/prime-insight"
              className="text-white hover:text-primary transition-colors duration-300 text-[13px] xl:text-sm font-medium tracking-normal xl:tracking-wide whitespace-nowrap"
            >
              PRIME INSIGHT
            </Link>
          </li>
          <li>
            <Link 
              href="/#contact" 
              className="text-white hover:text-primary transition-colors duration-300 text-[13px] xl:text-sm font-medium tracking-normal xl:tracking-wide whitespace-nowrap"
            >
              KONTAK
            </Link>
          </li>
          
          {/* Member Section - Only visible when signed in */}
          <SignedIn>
            <li>
              <Link 
                href="/my-prime" 
                className="text-primary hover:text-primary/80 transition-colors duration-300 text-[13px] xl:text-sm font-medium tracking-normal xl:tracking-wide whitespace-nowrap"
              >
                MY PRIME
              </Link>
            </li>
            {isAffiliate && (
              <li>
                <Link 
                  href="/affiliate-dashboard" 
                  className="text-primary hover:text-primary/80 transition-colors duration-300 text-[13px] xl:text-sm font-medium tracking-normal xl:tracking-wide whitespace-nowrap"
                >
                  AFFILIATE
                </Link>
              </li>
            )}
            {isAdmin && (
              <li>
                <Link
                  href="/front-office"
                  className="text-primary hover:text-primary/80 transition-colors duration-300 text-[13px] xl:text-sm font-medium tracking-normal xl:tracking-wide whitespace-nowrap"
                >
                  FRONT OFFICE
                </Link>
              </li>
            )}
            {isAdmin && (
              <li>
                <Link
                  href="/admin/seo"
                  className="text-primary hover:text-primary/80 transition-colors duration-300 text-[13px] xl:text-sm font-medium tracking-normal xl:tracking-wide whitespace-nowrap"
                >
                  SEO
                </Link>
              </li>
            )}
            <li>
              <UserButton 
                afterSignOutUrl="/"
                appearance={{
                  elements: {
                    avatarBox: "w-8 h-8"
                  }
                }}
              />
            </li>
          </SignedIn>
            {/* Sign In Button - Only visible when signed out */}
          <SignedOut>
            <li>
              <Link href="/sign-in">
                <button className="bg-primary/20 border border-primary text-primary px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-primary/30 transition-colors whitespace-nowrap">
                  Sign In
                </button>
              </Link>
            </li>
          </SignedOut>
        </ul>

        {/* Hamburger Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="md:hidden text-white focus:outline-none"
          aria-label="Toggle menu"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            {isOpen ? (
              <path d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="md:hidden bg-black/98 border-t border-primary/20">
          <ul className="flex flex-col py-4">
            <li>
              <Link 
                href="/treatments"
                onClick={() => setIsOpen(false)}
                className="block px-5 py-3 text-white hover:text-primary hover:bg-primary/10 transition-colors duration-300 text-sm font-medium tracking-wide"
              >
                TREATMENT
              </Link>
            </li>
            <li>
              <Link 
                href="/home-treatment"
                onClick={() => setIsOpen(false)}
                className="block px-5 py-3 text-white hover:text-primary hover:bg-primary/10 transition-colors duration-300 text-sm font-medium tracking-wide"
              >
                HOME TREATMENT
              </Link>
            </li>
            <li>
              <Link 
                href="/#gallery"
                onClick={() => setIsOpen(false)}
                className="block px-5 py-3 text-white hover:text-primary hover:bg-primary/10 transition-colors duration-300 text-sm font-medium tracking-wide"
              >
                GALERI
              </Link>
            </li>
            <li>
              <Link 
                href="/product-gallery"
                onClick={() => setIsOpen(false)}
                className="block px-5 py-3 text-white hover:text-primary hover:bg-primary/10 transition-colors duration-300 text-sm font-medium tracking-wide"
              >
                PRODUCT GALLERY
              </Link>
            </li>
            <li>
              <Link 
                href="/best-deal"
                onClick={() => setIsOpen(false)}
                className="block px-5 py-3 text-white hover:text-primary hover:bg-primary/10 transition-colors duration-300 text-sm font-medium tracking-wide"
              >
                BEST DEAL
              </Link>
            </li>
            <li>
              <Link
                href="/prime-insight"
                onClick={() => setIsOpen(false)}
                className="block px-5 py-3 text-white hover:text-primary hover:bg-primary/10 transition-colors duration-300 text-sm font-medium tracking-wide"
              >
                PRIME INSIGHT
              </Link>
            </li>
            <li>
              <Link 
                href="/#contact"
                onClick={() => setIsOpen(false)}
                className="block px-5 py-3 text-white hover:text-primary hover:bg-primary/10 transition-colors duration-300 text-sm font-medium tracking-wide"
              >
                KONTAK
              </Link>
            </li>
            
            {/* Mobile Auth Menu */}
            <SignedIn>
              <li>
                <Link 
                  href="/my-prime"
                  onClick={() => setIsOpen(false)}
                  className="block px-5 py-3 text-primary hover:text-primary/80 hover:bg-primary/10 transition-colors duration-300 text-sm font-medium tracking-wide"
                >
                  MY PRIME
                </Link>
              </li>
              {isAffiliate && (
                <li>
                  <Link 
                    href="/affiliate-dashboard"
                    onClick={() => setIsOpen(false)}
                    className="block px-5 py-3 text-primary hover:text-primary/80 hover:bg-primary/10 transition-colors duration-300 text-sm font-medium tracking-wide"
                  >
                    AFFILIATE
                  </Link>
                </li>
              )}
              {isAdmin && (
                <li>
                  <Link
                    href="/front-office"
                    onClick={() => setIsOpen(false)}
                    className="block px-5 py-3 text-primary hover:text-primary/80 hover:bg-primary/10 transition-colors duration-300 text-sm font-medium tracking-wide"
                  >
                    FRONT OFFICE
                  </Link>
                </li>
              )}
              {isAdmin && (
                <li>
                  <Link
                    href="/admin/seo"
                    onClick={() => setIsOpen(false)}
                    className="block px-5 py-3 text-primary hover:text-primary/80 hover:bg-primary/10 transition-colors duration-300 text-sm font-medium tracking-wide"
                  >
                    SEO
                  </Link>
                </li>
              )}
              <li className="px-5 py-3">
                <UserButton 
                  afterSignOutUrl="/"
                  appearance={{
                    elements: {
                      avatarBox: "w-9 h-9"
                    }
                  }}
                />
              </li>
            </SignedIn>
              <SignedOut>
              <li className="px-5 py-3">
                <Link href="/sign-in">
                  <button 
                    onClick={() => setIsOpen(false)}
                    className="w-full bg-primary/20 border border-primary text-primary px-4 py-2 rounded-lg text-sm font-semibold hover:bg-primary/30 transition-colors"
                  >
                    Sign In
                  </button>
                </Link>
              </li>
            </SignedOut>
          </ul>
        </div>
      )}
    </nav>
  );
}
