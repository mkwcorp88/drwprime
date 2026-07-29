import type { ProductPromotion } from '@prisma/client';

export interface EffectivePricing {
  listPrice: number;
  effectivePrice: number;
  discountAmount: number;
  promotion: {
    id: string;
    title: string;
    badgeText: string | null;
    endsAt: string;
  } | null;
}

export function resolveEffectivePrice(
  listPrice: number,
  promotions: ProductPromotion[],
  now: Date = new Date(),
): EffectivePricing {
  const activePromo = promotions.find(
    (p) =>
      p.isActive &&
      new Date(p.startsAt) <= now &&
      new Date(p.endsAt) > now,
  );

  if (activePromo && Number(activePromo.finalPrice) < listPrice) {
    const finalPrice = Number(activePromo.finalPrice);
    return {
      listPrice,
      effectivePrice: finalPrice,
      discountAmount: listPrice - finalPrice,
      promotion: {
        id: activePromo.id,
        title: activePromo.title,
        badgeText: activePromo.badgeText,
        endsAt: activePromo.endsAt.toISOString(),
      },
    };
  }

  return {
    listPrice,
    effectivePrice: listPrice,
    discountAmount: 0,
    promotion: null,
  };
}

export function resolveEffectivePriceForProduct(
  listPrice: number,
  promotions: ProductPromotion[],
  now: Date,
): EffectivePricing & { promotionId: string | null } {
  const active = promotions.find(
    (p) =>
      p.isActive &&
      new Date(p.startsAt) <= now &&
      new Date(p.endsAt) > now,
  );

  if (active && Number(active.finalPrice) < listPrice) {
    const finalPrice = Number(active.finalPrice);
    return {
      listPrice,
      effectivePrice: finalPrice,
      discountAmount: listPrice - finalPrice,
      promotionId: active.id,
      promotion: {
        id: active.id,
        title: active.title,
        badgeText: active.badgeText,
        endsAt: active.endsAt.toISOString(),
      },
    };
  }

  return {
    listPrice,
    effectivePrice: listPrice,
    discountAmount: 0,
    promotionId: null,
    promotion: null,
  };
}
