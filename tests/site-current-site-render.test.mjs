import test from 'node:test';
import assert from 'node:assert/strict';
import { createJiti } from 'jiti';
import { loadModule } from './helpers/load-module.mjs';

const j = createJiti(import.meta.url, { alias: { '@': process.cwd() } });
const { renderCurrentSitePages } = await j.import(
  '../lib/current-site/render.ts',
);

await test(
  'renderização isolada devolve o DOM pós-JavaScript sem encaminhar POST ou rede privada',
  { skip: !process.env.EIXU_CHROME_PATH },
  async () => {
    const requested = [];
    const request = async (url) => {
      requested.push(url);
      if (url.startsWith('http://127.0.0.1')) throw new Error('rede privada');
      return {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
        body: Buffer.from(`<!doctype html><html><body><main><h1>Casca</h1></main><script>
          document.querySelector('h1').textContent = 'Conteúdo renderizado';
          const link = document.createElement('a'); link.href = '/servicos'; link.textContent = 'Serviços'; document.querySelector('main').append(link);
          const frame = document.createElement('iframe'); frame.src = 'https://outside.test/contaminar'; document.body.append(frame);
          fetch('/nao-enviar', {method: 'POST', body: 'segredo'}).catch(()=>{});
          fetch('http://127.0.0.1/privado').catch(()=>{});
        </script></body></html>`),
      };
    };
    const [page] = await renderCurrentSitePages(
      ['https://current.test/'],
      request,
    );
    assert.match(page.html, /Conteúdo renderizado/);
    assert.match(page.html, /href="\/servicos"/);
    assert.equal(
      requested.some((url) => url.includes('nao-enviar')),
      false,
    );
    assert.equal(
      requested.some((url) => url.includes('outside.test')),
      false,
    );
    assert.ok(requested.some((url) => url.includes('127.0.0.1')));
  },
);

await test('abertura atrasada não prende coleta e encerra Chromium que termina depois do prazo', async () => {
  const controller = new AbortController();
  let finishLaunch;
  let killed = 0;
  const { renderCurrentSitePages: render } = await loadModule(
    'lib/current-site/render.ts',
    {
      '@/lib/review/capture': {
        launchBrowser: () =>
          new Promise((resolve) => {
            finishLaunch = resolve;
          }),
      },
    },
  );
  const pending = render(
    ['https://current.test/'],
    async () => assert.fail('Sem browser'),
    controller.signal,
  );
  controller.abort(new Error('Prazo esgotado'));
  await assert.rejects(pending, /Prazo esgotado/);
  finishLaunch({
    process: () => ({
      kill: () => {
        killed++;
      },
    }),
  });
  await Promise.resolve();
  assert.equal(killed, 1);
});

await test('fechamento do navegador sem resposta tem limite e mata somente seu processo', async () => {
  let killed = 0;
  const timeout = (ms) => {
    const controller = new AbortController();
    if (ms === 2000)
      setTimeout(() => controller.abort(new Error('Fechamento travado')), 1);
    return controller.signal;
  };
  const { renderCurrentSitePages: render } = await loadModule(
    'lib/current-site/render.ts',
    {
      '@/lib/review/capture': {
        launchBrowser: async () => ({
          process: () => ({
            kill: () => {
              killed++;
            },
          }),
          newPage: async () => ({
            setViewport: async () => {
              throw new Error('Página indisponível');
            },
            close: async () => new Promise(() => {}),
          }),
          close: async () => new Promise(() => {}),
        }),
      },
    },
    { AbortSignal: { any: AbortSignal.any.bind(AbortSignal), timeout } },
  );
  const result = await render(['https://current.test/']);
  assert.equal(result.length, 0);
  assert.equal(killed, 2);
});
