'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';

export type GalleryBanner = {
  id: string;
  imageDesktopUrl: string;
  imageMobileUrl: string | null;
  imageAlt: string;
  heading: string | null;
  description: string | null;
  ctaText: string | null;
  ctaLink: string | null;
};

interface BannerSliderProps {
  banners: GalleryBanner[];
  fallbackSrc?: string;
}

export default function ProductGalleryBannerSlider({ banners, fallbackSrc = '/hero-products.webp' }: BannerSliderProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const resetTimer = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  const startTimer = useCallback(() => {
    resetTimer();
    if (prefersReducedMotion || isHovered || banners.length <= 1) return;
    timeoutRef.current = setTimeout(() => {
      setActiveIndex(prev => (prev + 1) % banners.length);
    }, 5000);
  }, [prefersReducedMotion, isHovered, banners.length, resetTimer]);

  useEffect(() => {
    startTimer();
    return resetTimer;
  }, [activeIndex, startTimer, resetTimer]);

  const goTo = (index: number) => {
    resetTimer();
    setActiveIndex(index);
  };

  const goPrev = () => {
    resetTimer();
    setActiveIndex(prev => (prev - 1 + banners.length) % banners.length);
  };

  const goNext = () => {
    resetTimer();
    setActiveIndex(prev => (prev + 1) % banners.length);
  };

  if (banners.length === 0) {
    return (
      <section className="relative w-full">
        <div className="relative w-full aspect-[16/9] max-h-[420px] overflow-hidden">
          <Image
            src={fallbackSrc}
            alt="DRW Prime Products"
            fill
            className="object-cover"
            priority
            sizes="100vw"
          />
        </div>
      </section>
    );
  }

  const banner = banners[activeIndex];
  if (!banner) return null;

  const bannerImages = (
    <>
      <Image
        src={banner.imageDesktopUrl}
        alt={banner.imageAlt}
        fill
        className="object-cover transition-opacity duration-700 hidden sm:block"
        priority={activeIndex === 0}
        sizes="100vw"
      />
      <Image
        src={banner.imageMobileUrl || banner.imageDesktopUrl}
        alt={banner.imageAlt}
        fill
        className="object-cover transition-opacity duration-700 sm:hidden"
        priority={activeIndex === 0}
        sizes="100vw"
      />
    </>
  );

  return (
    <section className="relative w-full">
      <div
        className="relative w-full aspect-[16/9] max-h-[480px] overflow-hidden group"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {banner.ctaLink ? (
          <Link href={banner.ctaLink} className="block w-full h-full relative">
            {bannerImages}
          </Link>
        ) : (
          <div className="w-full h-full relative">
            {bannerImages}
          </div>
        )}

        {banners.length > 1 && (
          <>
            <button onClick={goPrev} className="absolute left-3 lg:left-6 top-1/2 -translate-y-1/2 w-10 h-10 lg:w-12 lg:h-12 rounded-full bg-black/20 backdrop-blur flex items-center justify-center text-white hover:bg-black/40 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100" aria-label="Slide sebelumnya">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <button onClick={goNext} className="absolute right-3 lg:right-6 top-1/2 -translate-y-1/2 w-10 h-10 lg:w-12 lg:h-12 rounded-full bg-black/20 backdrop-blur flex items-center justify-center text-white hover:bg-black/40 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100" aria-label="Slide berikutnya">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            </button>

            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 pointer-events-none">
              {banners.map((_, i) => (
                <button
                  key={i}
                  onClick={(e) => { e.preventDefault(); goTo(i); }}
                  className={`w-2.5 h-2.5 rounded-full transition-all pointer-events-auto shadow-sm ${i === activeIndex ? 'bg-amber-400 w-6' : 'bg-white/80 hover:bg-white'}`}
                  aria-label={`Slide ${i + 1}`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
