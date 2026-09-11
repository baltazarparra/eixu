import { Client, neon } from '@neondatabase/serverless';

type Sql = ReturnType<typeof neon>;

let client: Sql | null = null;

function databaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL não configurada.');
  return url;
}

/**
 * Cliente Neon preguiçoso: `neon()` lança se `DATABASE_URL` faltar, e o Next
 * avalia módulos no build. Instanciar sob demanda mantém o build seguro.
 */
export function db(): Sql {
  if (!client) {
    client = neon(databaseUrl());
  }
  return client;
}

/** Uma conexão por operação: mantém locks entre SQL e Blob e fecha no mesmo pedido. */
export async function transaction<T>(
  run: (connection: Client) => Promise<T>,
): Promise<T> {
  const connection = new Client(databaseUrl());
  try {
    await connection.connect();
    await connection.query('BEGIN');
    try {
      const result = await run(connection);
      await connection.query('COMMIT');
      return result;
    } catch (error) {
      await connection.query('ROLLBACK').catch(() => undefined);
      throw error;
    }
  } finally {
    await connection.end();
  }
}
