import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const PIN_PATTERN = /^\d{4}$/;
const KEY_LENGTH = 32;
const SCRYPT_N = 32768;
const SCRYPT_R = 8;
const SCRYPT_P = 1;

export function normalizeAdminLogin(login: string): string {
  return login.trim().toLocaleLowerCase('pt-BR');
}

export function validAdminPin(pin: string): boolean {
  return PIN_PATTERN.test(pin);
}

function derive(pin: string, pepper: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      `${pin}\0${pepper}`,
      salt,
      KEY_LENGTH,
      { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, maxmem: 64 * 1024 * 1024 },
      (error, key) => (error ? reject(error) : resolve(key as Buffer)),
    );
  });
}

export async function hashAdminPin(
  pin: string,
  pepper: string,
): Promise<string> {
  if (!validAdminPin(pin)) throw new Error('O PIN deve ter quatro dígitos.');
  const salt = randomBytes(16);
  const key = await derive(pin, pepper, salt);
  return [
    'scrypt',
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString('base64url'),
    key.toString('base64url'),
  ].join('$');
}

export async function verifyAdminPin(
  pin: string,
  encoded: string | null,
  pepper: string,
): Promise<boolean> {
  const parts = encoded?.split('$') ?? [];
  const usable =
    parts.length === 6 &&
    parts[0] === 'scrypt' &&
    Number(parts[1]) === SCRYPT_N &&
    Number(parts[2]) === SCRYPT_R &&
    Number(parts[3]) === SCRYPT_P;
  const salt = usable
    ? Buffer.from(parts[4], 'base64url')
    : Buffer.from('eixu-admin-invalid', 'utf8');
  const expected = usable
    ? Buffer.from(parts[5], 'base64url')
    : Buffer.alloc(KEY_LENGTH);
  const actual = await derive(pin, pepper, salt);
  return (
    usable &&
    expected.length === actual.length &&
    timingSafeEqual(expected, actual)
  );
}

export function newSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

export function sessionTokenHash(token: string): string {
  return createHash('sha256').update(token).digest('base64url');
}
