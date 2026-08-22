'use client';

import { useRunningText } from './RunningTextProvider';

export default function AnnouncementTicker() {
  const { runningText } = useRunningText();

  return (
    <div className="w-full bg-gradient-to-r from-black via-primary/25 to-black border-b border-primary/20 overflow-hidden">
      <div className="py-1.5">
        <div className="animate-marquee whitespace-nowrap inline-block">
          <span className="text-primary text-[11px] sm:text-xs font-semibold tracking-wide px-8">
            {runningText}
          </span>
          <span aria-hidden="true" className="text-primary text-[11px] sm:text-xs font-semibold tracking-wide px-8">
            {runningText}
          </span>
        </div>
      </div>
    </div>
  );
}
