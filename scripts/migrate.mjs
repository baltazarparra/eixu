import { readFileSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL ausente. Rode: vercel env pull .env.local --yes');
  process.exit(1);
}

const sql = neon(url);
const file = readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8');

// Divide em statements respeitando o `$$` de eventuais funções.
const statements = file
  .split(/;\s*$/m)
  .map((s) =>
    s
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n')
      .trim(),
  )
  .filter(Boolean);

for (const statement of statements) {
  const label = statement.split('\n')[0].slice(0, 70);
  try {
    await sql.query(statement);
    console.log('ok   ', label);
  } catch (error) {
    console.error('falha', label, '\n     ', error.message);
    process.exit(1);
  }
}

console.log(`\n${statements.length} statements aplicados.`);
