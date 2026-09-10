import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createJiti } from 'jiti';
const j = createJiti(import.meta.url, { alias: { '@': process.cwd() } });
const { capturePages } = await j.import('../lib/review/capture.ts');

await test(
  'captura autentica a prévia sem enviar sessão a recursos de outro host',
  { skip: !process.env.EIXU_CHROME_PATH },
  async () => {
    const requests = [];
    const server = createServer((req, res) => {
      requests.push({ url: req.url, cookie: req.headers.cookie ?? '' });
      if (req.url === '/pixel') {
        res.writeHead(200, { 'content-type': 'image/gif' });
        res.end(
          Buffer.from(
            'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
            'base64',
          ),
        );
      } else if (req.url.startsWith('/s/fixture/ausente')) {
        res.writeHead(404);
        res.end('Não encontrada');
      } else {
        res.writeHead(200, { 'content-type': 'text/html' });
        res.end(
          `<html><body><main class="site-theme"><h1>Prévia sintética</h1><img alt="" src="http://127.0.0.1:${server.address().port}/pixel"></main></body></html>`,
        );
      }
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    try {
      const origin = `http://localhost:${server.address().port}`;
      const shots = await capturePages(origin, 'fixture', [''], {
        cookie: 'outra=privada; eixu_admin=fixture-only-token',
      });
      assert.equal(shots.length, 2);
      assert.ok(
        shots.every((shot) => !shot.overflow && shot.brokenImages === 0),
      );
      assert.ok(
        requests
          .filter((r) => r.url.startsWith('/s/'))
          .every((r) => r.cookie === 'eixu_admin=fixture-only-token'),
      );
      assert.ok(requests.some((r) => r.url === '/pixel'));
      assert.ok(
        requests
          .filter((r) => r.url === '/pixel')
          .every((r) => r.cookie === ''),
      );
      await assert.rejects(
        () => capturePages(origin, 'fixture', ['ausente']),
        /prévia não pôde ser aberta/,
      );
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  },
);
