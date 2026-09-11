/**
 * Fora da Vercel, cada fase chama a próxima pela rota HTTP. Esse token
 * autentica a chamada local sem carregar a sessão do operador, vale poucos
 * minutos e só serve para um salto daquele run. Na Vercel, a fila é privada.
 */
const TTL_MS = 5 * 60 * 1000;

function secret(): string {
  const configured =
    process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD;
  if (configured) return configured;
  if (process.env.NODE_ENV === 'production')
    throw new Error('Sessão administrativa não configurada.');
  return 'eixu-dev-secret';
}

async function sign(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(payload),
  );
  return Buffer.from(new Uint8Array(signature)).toString('base64url');
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1)
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createStepToken(
  runId: string,
  hop: number,
): Promise<string> {
  const payload = `${runId}.${hop}.${Date.now() + TTL_MS}`;
  return `${payload}.${await sign(payload)}`;
}

/** A assinatura vincula também o salto: uma repetição não assume a etapa seguinte. */
export async function verifyStepToken(
  token: string | null | undefined,
): Promise<{ runId: string; hop: number } | null> {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 4) return null;
  const [runId, hop, expires, signature] = parts;
  if (!/^[0-9a-f-]{36}$/i.test(runId)) return null;
  if (!/^\d+$/.test(hop) || !Number.isSafeInteger(Number(hop))) return null;
  if (!/^\d+$/.test(expires) || Number(expires) <= Date.now()) return null;
  return safeEqual(signature, await sign(`${runId}.${hop}.${expires}`))
    ? { runId, hop: Number(hop) }
    : null;
}
