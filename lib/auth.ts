import { cookies } from 'next/headers';
import {
  newSessionToken,
  normalizeAdminLogin,
  sessionTokenHash,
  validAdminPin,
  verifyAdminPin,
} from '@/lib/auth-crypto';
import { db } from '@/lib/db';

const COOKIE = 'eixu_admin';
const PREVIEW_COOKIE = 'eixu_preview';
const MAX_AGE = 60 * 60 * 12;
const LOGIN_WINDOW_MINUTES = 15;
const LOGIN_FAILURE_LIMIT = 5;

export type AdminUser = { id: string; login: string; name: string };
type UserRow = AdminUser & { pin_hash?: string };

function pinPepper(): string {
  const configured = process.env.ADMIN_PIN_PEPPER;
  if (configured) return configured;
  if (process.env.NODE_ENV === 'production')
    throw new Error('Segredo dos PINs administrativos não configurado.');
  return 'eixu-dev-pin-pepper';
}

function internalSecret(): string {
  const configured =
    process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD;
  if (configured) return configured;
  if (process.env.NODE_ENV === 'production')
    throw new Error('Sessão administrativa não configurada.');
  return 'eixu-dev-secret';
}

async function hmac(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(internalSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(payload),
  );
  return Buffer.from(new Uint8Array(sig)).toString('base64url');
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1)
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return diff === 0;
}

export async function currentUser(): Promise<AdminUser | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const rows = (await db()`
      select u.id, u.login, u.name
      from admin_sessions s
      join admin_users u on u.id = s.user_id
      where s.token_hash = ${sessionTokenHash(token)}
        and s.revoked_at is null
        and s.expires_at > now()
        and u.active = true
      limit 1
    `) as UserRow[];
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

export async function isAuthenticated(): Promise<boolean> {
  return (await currentUser()) !== null;
}

async function loginBlocked(login: string): Promise<boolean> {
  const rows = (await db()`
    select blocked_until
    from admin_login_attempts
    where login = ${login} and blocked_until > now()
  `) as { blocked_until: string }[];
  return rows.length > 0;
}

async function recordLoginFailure(login: string): Promise<void> {
  await db()`
    insert into admin_login_attempts
      (login, failures, window_started_at, blocked_until, updated_at)
    values (${login}, 1, now(), null, now())
    on conflict (login) do update set
      failures = case
        when admin_login_attempts.window_started_at < now() - (${LOGIN_WINDOW_MINUTES} * interval '1 minute') then 1
        else admin_login_attempts.failures + 1
      end,
      window_started_at = case
        when admin_login_attempts.window_started_at < now() - (${LOGIN_WINDOW_MINUTES} * interval '1 minute') then now()
        else admin_login_attempts.window_started_at
      end,
      blocked_until = case
        when admin_login_attempts.window_started_at >= now() - (${LOGIN_WINDOW_MINUTES} * interval '1 minute')
          and admin_login_attempts.failures + 1 >= ${LOGIN_FAILURE_LIMIT}
        then now() + (${LOGIN_WINDOW_MINUTES} * interval '1 minute')
        else null
      end,
      updated_at = now()
  `;
}

export type SignInResult =
  | { ok: true; user: AdminUser }
  | { ok: false; blocked: boolean };

export async function signIn(
  loginInput: string,
  pin: string,
): Promise<SignInResult> {
  const login = normalizeAdminLogin(loginInput);
  if (!login || !validAdminPin(pin)) return { ok: false, blocked: false };
  try {
    if (await loginBlocked(login)) return { ok: false, blocked: true };
    const rows = (await db()`
      select id, login, name, pin_hash
      from admin_users
      where login = ${login} and active = true
      limit 1
    `) as UserRow[];
    const row = rows[0];
    const valid = await verifyAdminPin(pin, row?.pin_hash ?? null, pinPepper());
    if (!row || !valid) {
      await recordLoginFailure(login);
      return { ok: false, blocked: false };
    }
    await db()`delete from admin_login_attempts where login = ${login}`;
    const token = newSessionToken();
    await db()`
      insert into admin_sessions (token_hash, user_id, expires_at)
      values (${sessionTokenHash(token)}, ${row.id}, now() + (${MAX_AGE} * interval '1 second'))
    `;
    (await cookies()).set(COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: MAX_AGE,
    });
    return {
      ok: true,
      user: { id: row.id, login: row.login, name: row.name },
    };
  } catch {
    return { ok: false, blocked: false };
  }
}

export async function signOut(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) {
    try {
      await db()`
        update admin_sessions set revoked_at = now()
        where token_hash = ${sessionTokenHash(token)} and revoked_at is null
      `;
    } catch {
      // O cookie local ainda precisa ser removido se o banco estiver fora do ar.
    }
  }
  jar.delete(COOKIE);
}

export async function createPreviewToken(tenantId: string): Promise<string> {
  const expires = Date.now() + 10 * 60 * 1000;
  const payload = `${tenantId}.${expires}`;
  return `${payload}.${await hmac(payload)}`;
}

export async function verifyPreviewToken(
  token: string | undefined,
  tenantId: string,
): Promise<boolean> {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [tokenTenant, expires, signature] = parts;
  if (
    tokenTenant !== tenantId ||
    !/^\d+$/.test(expires) ||
    Number(expires) <= Date.now()
  )
    return false;
  return safeEqual(signature, await hmac(`${tokenTenant}.${expires}`));
}

export async function isPreviewAuthorized(tenantId: string): Promise<boolean> {
  if (await isAuthenticated()) return true;
  const token = (await cookies()).get(PREVIEW_COOKIE)?.value;
  return verifyPreviewToken(token, tenantId);
}

export const SESSION_COOKIE = COOKIE;
export const PREVIEW_SESSION_COOKIE = PREVIEW_COOKIE;
