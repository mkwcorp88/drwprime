import { NextResponse } from 'next/server';
import { handleOpsError, readJson } from '@/lib/treatment-operations/http';
import { requestOpsLoginOtp } from '@/lib/treatment-operations/otp';
import { OpsError } from '@/lib/treatment-operations/utils';

function requestIp(request: Request): string | undefined {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')?.trim()
    || undefined;
}

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    if (typeof body.phone !== 'string') {
      throw new OpsError(400, 'Nomor WhatsApp wajib diisi.');
    }

    const challenge = await requestOpsLoginOtp(body.phone, requestIp(request));
    return NextResponse.json({
      ...challenge,
      message: 'Jika nomor terdaftar, kode OTP telah dikirim melalui WhatsApp.',
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const response = handleOpsError(error, 'request login OTP');
    response.headers.set('Cache-Control', 'no-store');
    return response;
  }
}
