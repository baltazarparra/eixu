/** APIs podem devolver texto (401), JSON ou falhar antes de responder. */
export async function adminFetch<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(url, { cache: 'no-store', ...init });
  if (response.status === 401)
    throw new Error('Sua sessão expirou. Entre novamente no painel.');
  const body = (await response.json().catch(() => null)) as
    | (T & { error?: string })
    | null;
  if (!response.ok)
    throw new Error(
      body?.error || 'Não foi possível concluir. Tente novamente.',
    );
  if (body === null)
    throw new Error(
      'O servidor não retornou uma resposta válida. Tente novamente.',
    );
  return body;
}
