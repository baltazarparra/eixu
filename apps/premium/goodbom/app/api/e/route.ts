import { platformFetch } from '@/lib/platform';

export async function POST(request: Request) {
  const body = await request.text();
  await platformFetch('/api/premium/events', request, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  }).catch(() => undefined);
  return new Response(null, { status: 204 });
}
