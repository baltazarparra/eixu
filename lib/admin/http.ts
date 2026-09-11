/** Preserva o status para quem precisa distinguir recusa de falha. */
export class AdminHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** APIs podem devolver texto (401), JSON ou falhar antes de responder. */
export async function adminFetch<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(url, { cache: 'no-store', ...init });
  if (response.status === 401)
    throw new AdminHttpError(
      'Sua sessão expirou. Entre novamente no painel.',
      401,
    );
  const body = (await response.json().catch(() => null)) as
    | (T & { error?: string })
    | null;
  if (!response.ok)
    throw new AdminHttpError(
      body?.error || 'Não foi possível concluir. Tente novamente.',
      response.status,
    );
  if (body === null)
    throw new Error(
      'O servidor não retornou uma resposta válida. Tente novamente.',
    );
  return body;
}
