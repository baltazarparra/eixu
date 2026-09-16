import { platformFetch } from '@/lib/platform';

export async function POST(request: Request) {
  const form = await request.formData();
  const response = await platformFetch('/api/premium/forms', request, {
    method: 'POST',
    body: form,
  });
  const result = (await response.json().catch(() => null)) as {
    redirect?: string;
    error?: string;
  } | null;
  if (!response.ok || !result?.redirect)
    return Response.json(
      { error: result?.error ?? 'Não foi possível enviar.' },
      { status: 502 },
    );
  return Response.redirect(new URL(result.redirect, request.url), 303);
}
