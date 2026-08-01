'use client';

import { ReactNode } from "react";
import MobileHeader from "./MobileHeader";
import MobileBottomNav from "./MobileBottomNav";

interface MobileLayoutProps {
  children: ReactNode;
  showHeader?: boolean;
  showBottomNav?: boolean;
}

export default function MobileLayout({ 
  children, 
  showHeader = true, 
  showBottomNav = true 
}: MobileLayoutProps) {
  return (
    <>
      {/* Mobile Header - only visible on mobile */}
      {showHeader && <MobileHeader />}

      {/* Main Content with proper padding */}
      <div className={`
        ${showHeader ? 'lg:pt-0 pt-[4.5rem]' : ''} 
        ${showBottomNav ? 'lg:pb-0 pb-20' : ''}
      `}>
        {children}
      </div>

      {/* Mobile Bottom Navigation - only visible on mobile */}
      {showBottomNav && <MobileBottomNav />}
    </>
  );
}
