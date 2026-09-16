'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { UserButton, useUser } from '@clerk/nextjs';
import { useMemberAuth } from '@/components/member-auth/MemberAuthProvider';
import AnnouncementTicker from './AnnouncementTicker';

const PUBLIC_LINKS = [
  { href: '/treatments', label: 'TREATMENT' },
  { href: '/home-treatment', label: 'HOME TREATMENT' },
  { href: '/#gallery', label: 'GALERI' },
  { href: '/product-gallery', label: 'PRODUCT GALLERY' },
  { href: '/best-deal', label: 'BEST DEAL' },
  { href: '/prime-insight', label: 'PRIME INSIGHT' },
  { href: '/#contact', label: 'KONTAK' },
];

const linkClass =
  'text-white hover:text-primary transition-colors duration-300 text-[13px] font-medium tracking-wide whitespace-nowrap';
const memberLinkClass =
  'text-primary hover:text-primary/80 transition-colors duration-300 text-[13px] font-medium tracking-wide whitespace-nowrap';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const { user } = useMemberAuth();
  const { user: staffUser, isLoaded } = useUser();
  const isAffiliate = Boolean(user?.isTeamLeader);
  const hasAccount = Boolean(user || isAdmin);
  const adminMenuRef = useRef<HTMLLIElement>(null);

  const hasWorkspaceMenu = isAffiliate || isAdmin;

  useEffect(() => {
    if (isLoaded && staffUser) {
      checkAdminStatus();
    } else if (isLoaded) {
      setIsAdmin(false);
    }
  }, [isLoaded, staffUser]);

  useEffect(() => {
    if (!adminMenuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!adminMenuRef.current?.contains(event.target as Node)) {
        setAdminMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setAdminMenuOpen(false);
        setIsOpen(false);
      }
    };

    document.addEventListener('click', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('click', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [adminMenuOpen]);

  const checkAdminStatus = async () => {
    try {
      const response = await fetch('/api/staff/session', { cache: 'no-store' });
      const data = await response.json();
      setIsAdmin(Boolean(data.isAdmin));
    } catch (error) {
      console.error('Error checking admin status:', error);
    }
  };

  const closeMenus = () => {
    setIsOpen(false);
    setAdminMenuOpen(false);
  };

  const accountButton = user ? (
    <Link href="/my-prime" aria-label="Akun My Prime" className="flex h-8 w-8 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-sm font-semibold text-primary">
      {user.firstName.slice(0, 1).toUpperCase()}
    </Link>
  ) : <UserButton afterSignOutUrl="/" appearance={{ elements: { avatarBox: 'w-8 h-8' } }} />;

  return (
    <nav className="hidden lg:block fixed top-0 w-full bg-black/95 backdrop-blur-md z-50 border-b border-primary/20">
      <AnnouncementTicker />
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 py-4 xl:px-6">
        <Link href="/" className="relative z-10 shrink-0 pr-3">
          <Image
            src="/drwprime-logo.png"
            alt="DRW Prime Logo"
            width={150}
            height={40}
            className="h-10 w-auto"
          />
        </Link>

        <ul className="hidden min-w-0 flex-1 items-center justify-end gap-3 overflow-visible xl:flex 2xl:gap-4">
          {PUBLIC_LINKS.map((item) => (
            <li key={item.href}>
              <Link href={item.href} className={linkClass}>
                {item.label}
              </Link>
            </li>
          ))}

          {hasAccount && <>
            <li>
              <Link href="/my-prime" className={memberLinkClass}>
                MY PRIME
              </Link>
            </li>
            {hasWorkspaceMenu && (
              <li ref={adminMenuRef} className="relative z-30">
                <button
                  type="button"
                  onClick={() => setAdminMenuOpen((open) => !open)}
                  aria-expanded={adminMenuOpen}
                  aria-haspopup="menu"
                  className={`${memberLinkClass} inline-flex items-center gap-1`}
                >
                  ADMIN
                  <svg className={`h-3.5 w-3.5 transition-transform ${adminMenuOpen ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" clipRule="evenodd" />
                  </svg>
                </button>
                {adminMenuOpen && (
                  <div
                    role="menu"
                    onClick={(event) => event.stopPropagation()}
                    className="absolute right-0 top-full z-[80] mt-2 min-w-[200px] rounded-lg border border-primary/20 bg-black py-2 shadow-xl"
                  >
                    {isAffiliate && (
                      <Link
                        href="/affiliate-dashboard"
                        role="menuitem"
                        onClick={closeMenus}
                        className="block px-4 py-2 text-sm text-primary hover:bg-primary/10"
                      >
                        AFFILIATE
                      </Link>
                    )}
                    {isAdmin && (
                      <>
                        <Link
                          href="/front-office"
                          role="menuitem"
                          onClick={closeMenus}
                          className="block px-4 py-2 text-sm text-primary hover:bg-primary/10"
                        >
                          FRONT OFFICE
                        </Link>
                        <Link
                          href="/admin/seo"
                          role="menuitem"
                          onClick={closeMenus}
                          className="block px-4 py-2 text-sm text-primary hover:bg-primary/10"
                        >
                          SEO
                        </Link>
                      </>
                    )}
                  </div>
                )}
              </li>
            )}
            <li className="shrink-0">
              {accountButton}
            </li>
          </>}
          {!hasAccount && <>
            <li>
              <Link href="/sign-in">
                <button className="whitespace-nowrap rounded-lg border border-primary bg-primary/20 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/30">
                  Sign In
                </button>
              </Link>
            </li>
          </>}
        </ul>

        <div className="flex items-center gap-3 xl:hidden">
          {hasAccount && accountButton}
          <button
            type="button"
            onClick={() => setIsOpen((open) => !open)}
            className="text-white focus:outline-none"
            aria-label="Toggle menu"
            aria-expanded={isOpen}
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="border-t border-primary/20 bg-black/98 xl:hidden">
          <ul className="flex flex-col py-4">
            {PUBLIC_LINKS.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={closeMenus}
                  className="block px-5 py-3 text-sm font-medium tracking-wide text-white transition-colors duration-300 hover:bg-primary/10 hover:text-primary"
                >
                  {item.label}
                </Link>
              </li>
            ))}
            {hasAccount && <>
              <li>
                <Link
                  href="/my-prime"
                  onClick={closeMenus}
                  className="block px-5 py-3 text-sm font-medium tracking-wide text-primary transition-colors duration-300 hover:bg-primary/10 hover:text-primary/80"
                >
                  MY PRIME
                </Link>
              </li>
              {isAffiliate && (
                <li>
                  <Link
                    href="/affiliate-dashboard"
                    onClick={closeMenus}
                    className="block px-5 py-3 text-sm font-medium tracking-wide text-primary transition-colors duration-300 hover:bg-primary/10 hover:text-primary/80"
                  >
                    AFFILIATE
                  </Link>
                </li>
              )}
              {isAdmin && (
                <>
                  <li>
                    <Link
                      href="/front-office"
                      onClick={closeMenus}
                      className="block px-5 py-3 text-sm font-medium tracking-wide text-primary transition-colors duration-300 hover:bg-primary/10 hover:text-primary/80"
                    >
                      FRONT OFFICE
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/admin/seo"
                      onClick={closeMenus}
                      className="block px-5 py-3 text-sm font-medium tracking-wide text-primary transition-colors duration-300 hover:bg-primary/10 hover:text-primary/80"
                    >
                      SEO
                    </Link>
                  </li>
                </>
              )}
            </>}
            {!hasAccount && <>
              <li className="px-5 py-3">
                <Link href="/sign-in">
                  <button
                    onClick={closeMenus}
                    className="w-full rounded-lg border border-primary bg-primary/20 px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/30"
                  >
                    Sign In
                  </button>
                </Link>
              </li>
            </>}
          </ul>
        </div>
      )}
    </nav>
  );
}
