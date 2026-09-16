import { createHash, timingSafeEqual } from 'node:crypto';

function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

export function premiumWorkerAuthorized(request: Request): boolean {
  const expected = process.env.PREMIUM_WORKER_TOKEN;
  const header = request.headers.get('authorization') ?? '';
  const received = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!expected || !received) return false;
  return timingSafeEqual(digest(expected), digest(received));
}
