'use client';

export default function AnnouncementTicker() {
  const promoText =
    '\u2728 Promo Spesial Hari Ini: Gratis Ongkir Seluruh Indonesia! \u2022 Gunakan Kode Voucher: DRWPRIME \u2022 Diskon s/d 20% Untuk Pembelian Pertama \u2728';

  return (
    <div className="w-full bg-gradient-to-r from-black via-primary/25 to-black border-b border-primary/20 overflow-hidden">
      <div className="py-1.5">
        <div className="animate-marquee whitespace-nowrap inline-block">
          <span className="text-primary text-[11px] sm:text-xs font-semibold tracking-wide px-8">
            {promoText}
          </span>
          <span className="text-primary text-[11px] sm:text-xs font-semibold tracking-wide px-8">
            {promoText}
          </span>
        </div>
      </div>
    </div>
  );
}
