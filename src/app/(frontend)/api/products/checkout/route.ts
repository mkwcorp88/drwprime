import { NextResponse } from 'next/server';
import { sendProductOrderToAdminWhatsApp } from '@/lib/whatsapp';
import { normalizePhone } from '@/lib/phone';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { items, customerName, customerPhone: rawPhone, customerEmail, notes } = body;
    const customerPhone = normalizePhone(rawPhone);

    if (!customerName || !customerPhone || !items?.length) {
      return NextResponse.json(
        { error: 'Nama, telepon, dan minimal 1 produk wajib diisi' },
        { status: 400 }
      );
    }

    const totalPrice = items.reduce(
      (sum: number, item: { price: number; quantity: number }) =>
        sum + item.price * item.quantity,
      0
    );

    await sendProductOrderToAdminWhatsApp({
      items,
      totalPrice,
      customerName,
      customerPhone,
      customerEmail: customerEmail || undefined,
      notes: notes || undefined,
    });

    return NextResponse.json({ success: true, totalPrice });
  } catch (error) {
    console.error('Error processing product checkout:', error);
    return NextResponse.json(
      { error: 'Gagal memproses pesanan' },
      { status: 500 }
    );
  }
}
