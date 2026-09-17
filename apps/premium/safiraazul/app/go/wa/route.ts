import { platformFetch } from '@/lib/platform';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const source = Object.fromEntries(url.searchParams);
  const response = await platformFetch('/api/premium/whatsapp', request, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      campaign: url.searchParams.get('utm_campaign'),
      from: url.searchParams.get('from'),
      session: url.searchParams.get('sid'),
      index: url.searchParams.get('n'),
      source,
    }),
  });
  const result = (await response.json().catch(() => null)) as {
    redirect?: string;
  } | null;
  return Response.redirect(result?.redirect || '/', 302);
}
