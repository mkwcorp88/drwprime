'use client';

import Image from 'next/image';
import type { Reservation } from '@/types/front-office';

export default function StatusTracker({ reservations }: { reservations: Reservation[] }) {
  return (
    <div className="fo-fade-up fo-stagger-1 rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-2xl p-4 sm:p-6 mb-6">
      <div className="flex items-stretch gap-0">
        <div className="flex flex-col items-center flex-1 relative">
          <Image
            src="/front-office-icons/status-pending.webp"
            alt=""
            width={64}
            height={64}
            className="mb-2 h-14 w-14 object-contain sm:h-16 sm:w-16"
          />
          <span className="text-yellow-400 font-bold text-xl sm:text-2xl">{reservations.filter(r => r.status === 'pending').length}</span>
          <div className="absolute top-7 sm:top-8 left-[calc(50%+2rem)] right-0 h-px bg-gradient-to-r from-yellow-400/25 via-white/5 to-transparent mt-0.5" />
          <span className="text-yellow-400/80 text-[10px] sm:text-xs font-semibold tracking-wider uppercase mt-0.5">Pending</span>
        </div>

        <div className="flex flex-col items-center flex-1 relative">
          <Image
            src="/front-office-icons/status-confirmed.webp"
            alt=""
            width={64}
            height={64}
            className="mb-2 h-14 w-14 object-contain sm:h-16 sm:w-16"
          />
          <span className="text-blue-400 font-bold text-xl sm:text-2xl">{reservations.filter(r => r.status === 'confirmed').length}</span>
          <div className="absolute top-7 sm:top-8 left-[calc(50%+2rem)] right-0 h-px bg-gradient-to-r from-blue-400/25 via-white/5 to-transparent mt-0.5" />
          <span className="text-blue-400/80 text-[10px] sm:text-xs font-semibold tracking-wider uppercase mt-0.5">Confirmed</span>
        </div>

        <div className="flex flex-col items-center flex-1 relative">
          <Image
            src="/front-office-icons/status-completed.webp"
            alt=""
            width={64}
            height={64}
            className="mb-2 h-14 w-14 object-contain sm:h-16 sm:w-16"
          />
          <span className="text-green-400 font-bold text-xl sm:text-2xl">{reservations.filter(r => r.status === 'completed').length}</span>
          <span className="text-green-400/80 text-[10px] sm:text-xs font-semibold tracking-wider uppercase mt-0.5">Selesai</span>
        </div>
      </div>
    </div>
  );
}
