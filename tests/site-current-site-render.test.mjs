import test from 'node:test';
import assert from 'node:assert/strict';
import { createJiti } from 'jiti';

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
