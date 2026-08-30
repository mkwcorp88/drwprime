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
      <div className="mobile-shell-announcement lg:hidden fixed top-0 left-0 right-0 z-50">
        <AnnouncementTicker />
      </div>

      {/* Mobile Header - only visible on mobile, positioned below ticker */}
      {showHeader && (
        <div className="mobile-shell-header lg:hidden fixed left-0 right-0 z-40">
          <MobileHeader embedded={true} />
        </div>
      )}

      {/* Main Content with proper padding */}
      <div
        className={`mobile-shell-content lg:pt-0 ${showHeader ? 'mobile-shell-content-header' : 'mobile-shell-content-no-header'} ${showBottomNav ? 'mobile-shell-content-bottom-nav lg:pb-0' : ''}`}
      >
        {children}
      </div>

      {/* Mobile Bottom Navigation - only visible on mobile */}
      {showBottomNav && <MobileBottomNav />}
    </>
  );
}
