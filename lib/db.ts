import { neon } from '@neondatabase/serverless';

type Sql = ReturnType<typeof neon>;

let client: Sql | null = null;

/**
 * Cliente Neon preguiçoso: `neon()` lança se `DATABASE_URL` faltar, e o Next
 * avalia módulos no build. Instanciar sob demanda mantém o build seguro.
 */
export function db(): Sql {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL não configurada.');
    client = neon(url);
  }
  return client;
}
