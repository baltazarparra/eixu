import { createRequire } from 'node:module';
import { connect } from 'node:net';
import { loadModule } from './load-module.mjs';

const require = createRequire(import.meta.url);

/** Driver Neon real sobre proxy WebSocket local; nunca aceita um banco remoto. */
export async function localPostgres(connectionString) {
  const url = new URL(connectionString);
  if (
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
    url.pathname !== '/eixu_pr2_test'
  )
    throw new Error('Use somente o banco local descartável eixu_pr2_test.');
  const { WebSocketServer } = require('ws');
  const { Client, neonConfig } = require('@neondatabase/serverless');
  const server = new WebSocketServer({ host: '127.0.0.1', port: 0 });
  await new Promise((resolve) => server.once('listening', resolve));
  server.on('connection', (ws) => {
    const socket = connect({
      host: url.hostname,
      port: Number(url.port || 5432),
    });
    ws.on('message', (data) => socket.write(data));
    socket.on('data', (data) => {
      if (ws.readyState === 1) ws.send(data);
    });
    socket.on('error', () => ws.close());
    socket.on('close', () => ws.close());
    ws.on('close', () => socket.destroy());
    ws.on('error', () => socket.destroy());
  });
  neonConfig.wsProxy = () => `127.0.0.1:${server.address().port}`;
  neonConfig.useSecureWebSocket = false;
  neonConfig.pipelineConnect = false;
  neonConfig.forceDisablePgSSL = true;
  process.env.DATABASE_URL = connectionString;
  const dbModule = await loadModule('lib/db.ts');
  const client = new Client(connectionString);
  await client.connect();
  const query = (text, values) => client.query(text, values);
  // Mantém os SQLs/valores do produto; só troca HTTP por WebSocket no teste local.
  const db =
    () =>
    async (parts, ...values) => {
      const text = parts.reduce(
        (all, part, i) => all + (i ? `$${i}` : '') + part,
        '',
      );
      return (await query(text, values)).rows;
    };
  return {
    db,
    transaction: dbModule.transaction,
    query,
    close: async () => {
      await client.end();
      for (const ws of server.clients) ws.terminate();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}
