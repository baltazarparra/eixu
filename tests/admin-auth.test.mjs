import assert from 'node:assert/strict';
import test from 'node:test';
import { createJiti } from 'jiti';
import { loadModule } from './helpers/load-module.mjs';

const jiti = createJiti(import.meta.url, { alias: { '@': process.cwd() } });
const { hashAdminPin } = await jiti.import('../lib/auth-crypto.ts');
const plain = (value) => JSON.parse(JSON.stringify(value));

function cookieJar() {
  const values = new Map();
  const writes = [];
  return {
    values,
    writes,
    get: (name) =>
      values.has(name) ? { name, value: values.get(name) } : undefined,
    set: (name, value, options) => {
      values.set(name, value);
      writes.push({ name, value, options });
    },
    delete: (name) => values.delete(name),
  };
}

async function fixture() {
  const pepper = 'fixture-auth-pepper';
  const user = {
    id: '0dc054a8-6697-45f1-b772-972e7b0513d0',
    login: 'baltz@eixu',
    name: 'Baltz',
    pin_hash: await hashAdminPin('0000', pepper),
  };
  const jar = cookieJar();
  const attempts = new Map();
  const sessions = new Map();
  const query = async (parts, ...values) => {
    const sql = parts.join('?');
    if (sql.includes('from admin_login_attempts'))
      return (attempts.get(values[0])?.blocked ?? false)
        ? [{ blocked_until: new Date(Date.now() + 60_000) }]
        : [];
    if (sql.includes('from admin_users'))
      return values[0] === user.login ? [user] : [];
    if (sql.includes('insert into admin_login_attempts')) {
      const current = attempts.get(values[0]) ?? { failures: 0 };
      current.failures += 1;
      if (current.failures >= 5) current.blocked = true;
      attempts.set(values[0], current);
      return [];
    }
    if (sql.includes('delete from admin_login_attempts')) {
      attempts.delete(values[0]);
      return [];
    }
    if (sql.includes('insert into admin_sessions')) {
      sessions.set(values[0], { userId: values[1], revoked: false });
      return [];
    }
    if (sql.includes('join admin_users')) {
      const session = sessions.get(values[0]);
      return session?.userId === user.id && !session.revoked
        ? [{ id: user.id, login: user.login, name: user.name }]
        : [];
    }
    if (sql.includes('update admin_sessions')) {
      const session = sessions.get(values[0]);
      if (session) session.revoked = true;
      return [];
    }
    throw new Error(`SQL inesperado no teste: ${sql}`);
  };
  const auth = await loadModule('lib/auth.ts', {
    '@/lib/db': { db: () => query },
    'next/headers': { cookies: async () => jar },
  });
  return { auth, attempts, jar, pepper, sessions, user };
}

await test('login cria sessão opaca, resolve o usuário e revoga no logout', async () => {
  const previous = process.env.ADMIN_PIN_PEPPER;
  process.env.ADMIN_PIN_PEPPER = 'fixture-auth-pepper';
  try {
    const f = await fixture();
    assert.deepEqual(plain(await f.auth.signIn(' BALTZ@EIXU ', '9999')), {
      ok: false,
      blocked: false,
    });
    const signed = await f.auth.signIn(' BALTZ@EIXU ', '0000');
    assert.equal(signed.ok, true);
    assert.deepEqual(plain(signed.user), {
      id: f.user.id,
      login: f.user.login,
      name: f.user.name,
    });
    const cookie = f.jar.writes[0];
    assert.equal(cookie.name, 'eixu_admin');
    assert.equal(cookie.options.httpOnly, true);
    assert.equal(cookie.options.sameSite, 'lax');
    assert.equal(cookie.value.includes('0000'), false);
    assert.notEqual([...f.sessions.keys()][0], cookie.value);
    assert.deepEqual(plain(await f.auth.currentUser()), plain(signed.user));
    await f.auth.signOut();
    assert.equal(f.jar.values.has('eixu_admin'), false);
    f.jar.values.set('eixu_admin', cookie.value);
    assert.equal(await f.auth.currentUser(), null);
  } finally {
    if (previous === undefined) delete process.env.ADMIN_PIN_PEPPER;
    else process.env.ADMIN_PIN_PEPPER = previous;
  }
});

await test('cinco falhas bloqueiam novas tentativas da mesma conta', async () => {
  const previous = process.env.ADMIN_PIN_PEPPER;
  process.env.ADMIN_PIN_PEPPER = 'fixture-auth-pepper';
  try {
    const f = await fixture();
    for (let attempt = 0; attempt < 5; attempt += 1)
      assert.equal((await f.auth.signIn('baltz@eixu', '9999')).ok, false);
    assert.deepEqual(plain(await f.auth.signIn('baltz@eixu', '0000')), {
      ok: false,
      blocked: true,
    });
    assert.equal(f.jar.writes.length, 0);
  } finally {
    if (previous === undefined) delete process.env.ADMIN_PIN_PEPPER;
    else process.env.ADMIN_PIN_PEPPER = previous;
  }
});
