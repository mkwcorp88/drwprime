import type { Reservation } from '@/types/front-office';

export const getAffiliateFullName = (referrer?: Reservation['referrer']) => {
  if (!referrer) return '';
  return `${referrer.firstName} ${referrer.lastName}`.trim();
};

export const getStatusColor = (status: string) => {
  switch (status) {
    case 'pending': return 'bg-yellow-500/16 text-yellow-300 border-yellow-400/35';
    case 'confirmed': return 'bg-blue-500/16 text-blue-300 border-blue-400/35';
    case 'completed': return 'bg-green-500/16 text-green-300 border-green-400/35';
    case 'cancelled': return 'bg-red-500/16 text-red-300 border-red-400/35';
    default: return 'bg-gray-500/16 text-gray-300 border-gray-400/35';
  }
};

export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(amount);
};

export const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};
