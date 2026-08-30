'use client';

import { useState, useEffect } from 'react';
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import MobileBottomNavFO from "./MobileBottomNavFO";

export default function MobileBottomNav() {
  const pathname = usePathname();
  const { user, isLoaded } = useUser();
  const [isTeamLeader, setIsTeamLeader] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [roleChecked, setRoleChecked] = useState(false);

  useEffect(() => {
    if (isLoaded && user) {
      fetch('/api/user')
        .then((r) => r.json())
        .then((data) => {
          setIsTeamLeader(data.user?.isTeamLeader || false);
          setIsAdmin(data.user?.isAdmin || false);
          setRoleChecked(true);
        })
        .catch(() => setRoleChecked(true));
    } else if (isLoaded && !user) {
      setRoleChecked(true);
    }
  }, [isLoaded, user]);

  if (!roleChecked) return null;
  if (isAdmin) return <MobileBottomNavFO />;

  const navItems = [
    {
      name: "Beranda",
      href: "/",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      name: "Treatment",
      href: "/treatments",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
        </svg>
      ),
    },
    {
      name: "Reservasi",
      href: "/reservation",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      name: "Etalase",
      href: "/product-gallery",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
        </svg>
      ),
    },
    isTeamLeader
      ? {
          name: 'Afiliasi',
          href: '/affiliate-dashboard',
          icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          ),
        }
      : {
          name: 'Insight',
          href: '/prime-insight',
          icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
            </svg>
          ),
        },
  ];

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + '/');
  };

  return (
    <nav className="lg:hidden fixed bottom-2 left-0 right-0 z-[60] px-3 pb-[max(0.35rem,env(safe-area-inset-bottom))]">
      <div className="mobile-tabbar mx-auto max-w-md rounded-[1.75rem]">
        <div className="grid grid-cols-5 gap-1 px-2 pt-2 pb-1.5">
        {navItems.map((item) => {
          const active = isActive(item.href);

          return (
            <Link
              key={item.name}
              href={item.href}
              aria-current={active ? "page" : undefined}
                className={`group flex min-h-12 flex-col items-center justify-start gap-1 rounded-2xl py-1 transition-colors ${
                active ? "text-primary" : "text-white/70"
              }`}
            >
              <div
                  className={`flex h-9 w-9 items-center justify-center rounded-[1.15rem] border transition-all duration-300 group-active:scale-95 ${
                  active
                    ? "border-primary/40 bg-primary/15 shadow-[0_6px_18px_rgba(212,175,55,0.25),inset_0_1px_0_rgba(255,255,255,0.25)]"
                    : "border-transparent bg-white/0 group-hover:bg-white/10"
                }`}
              >
                {item.icon}
              </div>
              <span className={`text-[10.5px] leading-none font-medium tracking-tight ${active ? "text-primary" : "text-white/65"}`}>
                {item.name}
              </span>
            </Link>
          );
        })}
        </div>
      </div>
    </nav>
  );
}
