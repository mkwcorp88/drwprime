import type { CheckoutForm } from './types';

export type FieldErrors = Partial<Record<keyof CheckoutForm | 'form', string>>;

export function validateCheckout(form: CheckoutForm, cartCount: number): FieldErrors {
  const errors: FieldErrors = {};

  if (cartCount === 0) errors.form = 'Keranjang masih kosong';
  if (!form.customerName.trim()) errors.customerName = 'Nama wajib diisi';
  if (!form.customerPhone.trim()) errors.customerPhone = 'Nomor WhatsApp wajib diisi';
  else if (!/^(\+62|62|0)8[1-9][0-9]{6,10}$/.test(form.customerPhone.replace(/[-\s]/g, '')))
    errors.customerPhone = 'Format nomor WhatsApp tidak valid';
  if (form.customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.customerEmail))
    errors.customerEmail = 'Format email tidak valid';
  if (!form.shippingAddress.trim()) errors.shippingAddress = 'Alamat wajib diisi';
  if (!form.shippingCity.trim()) errors.shippingCity = 'Kota wajib diisi';
  if (!form.shippingProvince.trim()) errors.shippingProvince = 'Provinsi wajib diisi';

  return errors;
}
