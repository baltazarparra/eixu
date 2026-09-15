import { createJiti } from 'jiti';
import { neon } from '@neondatabase/serverless';

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
const pin = process.env.ADMIN_INITIAL_PIN;
const pepper = process.env.ADMIN_PIN_PEPPER;
if (!url || !pin || !pepper) {
  console.error(
    'DATABASE_URL, ADMIN_INITIAL_PIN e ADMIN_PIN_PEPPER são obrigatórios.',
  );
  process.exit(1);
}

const jiti = createJiti(import.meta.url);
const { hashAdminPin } = await jiti.import('../lib/auth-crypto.ts');
const sql = neon(url);
const users = [
  ['david@eixu', 'David'],
  ['baltz@eixu', 'Baltz'],
  ['nando@eixu', 'Nando'],
];

for (const [login, name] of users) {
  const pinHash = await hashAdminPin(pin, pepper);
  const rows = await sql`
    insert into admin_users (login, name, pin_hash)
    values (${login}, ${name}, ${pinHash})
    on conflict (login) do nothing
    returning login
  `;
  console.log(rows.length ? `criado ${login}` : `preservado ${login}`);
}
