import { timingSafeEqual } from 'node:crypto';

export function hasValidAidoSyncSecret(request: Request): boolean {
  const expected = process.env.AIDO_SYNC_SECRET;
  const authorization = request.headers.get('authorization');
  if (!expected || !authorization?.startsWith('Bearer ')) return false;

  const received = authorization.slice('Bearer '.length);
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);
  return expectedBuffer.length === receivedBuffer.length
    && timingSafeEqual(expectedBuffer, receivedBuffer);
}
