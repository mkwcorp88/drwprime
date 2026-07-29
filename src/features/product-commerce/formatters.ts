export function formatPrice(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('id-ID', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function cartTotal(items: { product: { effectivePrice: number }; quantity: number }[]): number {
  return items.reduce((sum, i) => sum + i.product.effectivePrice * i.quantity, 0);
}

export function cartCount(items: { quantity: number }[]): number {
  return items.reduce((sum, i) => sum + i.quantity, 0);
}
