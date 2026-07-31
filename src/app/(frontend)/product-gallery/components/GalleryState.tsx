'use client';

export function GallerySkeleton() {
  return (
    <div className="grid grid-cols-1 min-[360px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-stone-200 bg-white overflow-hidden animate-pulse">
          <div className="aspect-[3/4] bg-stone-100" />
          <div className="p-3 space-y-2">
            <div className="h-4 bg-stone-100 rounded w-3/4" />
            <div className="h-3 bg-stone-100 rounded w-1/2" />
            <div className="h-3 bg-stone-100 rounded w-full" />
            <div className="flex justify-between items-end pt-2">
              <div className="h-5 bg-stone-100 rounded w-20" />
              <div className="w-10 h-10 rounded-lg bg-stone-100" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function GalleryError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="text-center py-20">
      <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
        <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
      </div>
      <p className="text-stone-700 font-medium mb-2">Gagal memuat katalog</p>
      <p className="text-stone-400 text-xs mb-4">{message}</p>
      <button onClick={onRetry} className="px-6 py-2.5 rounded-xl bg-stone-800 text-white font-semibold text-sm transition-all active:scale-95 hover:bg-stone-700">
        Coba Lagi
      </button>
    </div>
  );
}
