export type Classification = 'acne' | 'brightening' | 'antiaging';

export const CLASSIFICATION_LABELS: Record<Classification, string> = {
  acne: 'Acne',
  brightening: 'Brightening',
  antiaging: 'Anti Aging',
};

export const CLASSIFICATION_LIST: Classification[] = ['acne', 'brightening', 'antiaging'];

export type CatalogProduct = {
  id: string;
  slug: string;
  name: string;
  headline: string | null;
  description: string;
  size: string | null;
  image: string | null;
  category: string;
  categoryId: string;
  categoryName: string;
  classification: string | null;
  benefits: string[];
  caraPakai: string | null;
  cta: string | null;
  price: number;
  listPrice: number;
  effectivePrice: number;
  discountAmount: number;
  promotion: { id: string; title: string; badgeText: string | null; endsAt: string } | null;
  sortOrder: number;
  isActive: boolean;
};

export type CatalogCategory = { id: string; name: string };

export type CartItem = { product: CatalogProduct; quantity: number };

export type CheckoutForm = {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  shippingAddress: string;
  shippingCity: string;
  shippingProvince: string;
  shippingPostal: string;
  notes: string;
};

export type PendingOrder = {
  paymentUrl: string;
  publicToken: string;
  orderTotal: number;
  timestamp: number;
};
