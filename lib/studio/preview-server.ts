// Fica fora do código/checkpoint do cliente. O hostname externo serve à
// proteção de origem do Next; o socket continua escutando a interface da VM.
export const STUDIO_PREVIEW_SERVER_PATH = '/tmp/eixu-preview-server.cjs';

export const STUDIO_PREVIEW_SERVER = `const { createServer } = require('node:http');
const { createRequire } = require('node:module');
const requireProject = createRequire(process.cwd() + '/package.json');
const next = requireProject('next');

const hostname = process.env.EIXU_PREVIEW_HOST;
if (!hostname) throw new Error('A origem da prévia não foi configurada.');
const server = createServer((request, response) => handle(request, response));
const app = next({
  dev: true,
  dir: process.cwd(),
  hostname,
  port: 3000,
  httpServer: server,
});
const handle = app.getRequestHandler();

app.prepare().then(() => server.listen(3000, '0.0.0.0')).catch((error) => {
  console.error(error);
  process.exit(1);
});
process.on('SIGTERM', async () => {
  server.close();
  await app.close();
  process.exit(0);
});
`;
