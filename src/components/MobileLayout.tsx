'use client';

import { ReactNode } from "react";
import MobileHeader from "./MobileHeader";
import MobileBottomNav from "./MobileBottomNav";
import AnnouncementTicker from "./AnnouncementTicker";

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
      {/* Global Announcement Ticker at the very top on mobile */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50">
        <AnnouncementTicker />
      </div>

      {/* Mobile Header - only visible on mobile, positioned below ticker */}
      {showHeader && (
        <div className="lg:hidden fixed top-[27px] left-0 right-0 z-40">
          <MobileHeader embedded={true} />
        </div>
      )}

      {/* Main Content with proper padding */}
      <div className={`
        ${showHeader ? 'lg:pt-0 pt-[4.5rem]' : 'lg:pt-0 pt-7'} 
        ${showBottomNav ? 'lg:pb-0 pb-20' : ''}
      `}>
        {children}
      </div>

      {/* Mobile Bottom Navigation - only visible on mobile */}
      {showBottomNav && <MobileBottomNav />}
    </>
  );
}
