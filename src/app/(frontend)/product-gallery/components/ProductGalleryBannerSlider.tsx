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

  return (
    <section className="relative w-full">
      <div
        className="relative w-full aspect-[16/9] max-h-[480px] overflow-hidden group"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
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

        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

        {(banner.heading || banner.description || banner.ctaText) && (
          <div className="absolute inset-0 flex items-end lg:items-center p-6 lg:p-12">
            <div className="max-w-7xl mx-auto w-full">
              <div className="max-w-lg text-white">
                {banner.heading && (
                  <h2 className="text-2xl lg:text-4xl font-bold mb-2 lg:mb-3 leading-tight drop-shadow-lg">
                    {banner.heading}
                  </h2>
                )}
                {banner.description && (
                  <p className="text-sm lg:text-base text-white/90 mb-4 lg:mb-6 max-w-md drop-shadow">
                    {banner.description}
                  </p>
                )}
                {banner.ctaText && banner.ctaLink && (
                  <Link
                    href={banner.ctaLink}
                    className="inline-flex items-center gap-2 px-5 py-2.5 lg:px-6 lg:py-3 rounded-xl font-semibold text-sm bg-amber-500 text-white hover:bg-amber-400 transition-colors shadow-lg"
                  >
                    {banner.ctaText}
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}

        {banners.length > 1 && (
          <>
            <button onClick={goPrev} className="absolute left-3 lg:left-6 top-1/2 -translate-y-1/2 w-10 h-10 lg:w-12 lg:h-12 rounded-full bg-white/20 backdrop-blur flex items-center justify-center text-white hover:bg-white/30 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100" aria-label="Slide sebelumnya">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <button onClick={goNext} className="absolute right-3 lg:right-6 top-1/2 -translate-y-1/2 w-10 h-10 lg:w-12 lg:h-12 rounded-full bg-white/20 backdrop-blur flex items-center justify-center text-white hover:bg-white/30 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100" aria-label="Slide berikutnya">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            </button>

            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
              {banners.map((_, i) => (
                <button
                  key={i}
                  onClick={() => goTo(i)}
                  className={`w-2.5 h-2.5 rounded-full transition-all ${i === activeIndex ? 'bg-amber-400 w-6' : 'bg-white/50 hover:bg-white/70'}`}
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
