import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createJiti } from 'jiti';
import sharp from 'sharp';
const j = createJiti(import.meta.url, { alias: { '@': process.cwd() } });
const { captureReference } = await j.import('../lib/references/capture.ts');
const { publicResource } = await j.import('../lib/references/network.ts');

await test('prazo inclui a abertura do Chromium e mata um processo que chega atrasado', async () => {
  let release;
  let killed = 0;
  const lateBrowser = new Promise((resolve) => {
    release = resolve;
  });
  await assert.rejects(
    captureReference('https://reference.test/', publicResource, {
      timeoutMs: 10,
      launch: async () => lateBrowser,
    }),
  );
  release({
    process: () => ({
      kill: () => {
        killed++;
      },
    }),
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(killed, 1);
});

await test(
  'captura referência com CSS e JavaScript em desktop/mobile, restringe rede e explicita corte',
  { skip: !process.env.EIXU_CHROME_PATH },
  async () => {
    const requested = [];
    const request = async (url) => {
      requested.push(url);
      const parsed = new URL(url);
      if (parsed.hostname !== 'reference.test') return publicResource(url);
      if (parsed.pathname.startsWith('/prefetch-fixture/'))
        return {
          status: 200,
          headers: { 'content-type': 'text/plain' },
          body: Buffer.from('ok'),
        };
      if (parsed.pathname === '/redirect')
        return {
          status: 302,
          headers: { location: 'http://127.0.0.1/' },
          body: Buffer.alloc(0),
        };
      return {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
        body: Buffer.from(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>
body{margin:0;background:#f4f0e8;color:#292620;font-family:Arial}header{padding:30px}main{padding:40px}section{display:grid;grid-template-columns:1fr 1fr;gap:40px}h1{font-family:Georgia;font-size:68px;font-weight:400}figure{margin:0;background:#637d65;min-height:400px}article{height:9300px}h2{font-size:36px}@media(max-width:600px){section{display:block}h1{font-size:42px}main{padding:20px}}</style></head><body><header>MATÉRIA — REFERÊNCIA SINTÉTICA</header><main><section><h1>Abertura inicial</h1><figure aria-label="Área de imagem sintética"></figure></section><article><h2>Capítulos com respiro</h2></article></main><script>
document.querySelector('h1').textContent='A matéria orienta a forma';
fetch('/nao-enviar',{method:'POST',body:'fixture'}).catch(()=>{});
fetch('http://127.0.0.1/privado').catch(()=>{});
if(innerWidth>600) for(let i=0;i<405;i++) fetch('/prefetch-fixture/'+i).catch(()=>{});
</script></body></html>`),
      };
    };
    const shots = await captureReference('https://reference.test/', request);
    assert.equal(shots.length, 2);
    assert.ok(
      shots[0].unavailableResources > shots[1].unavailableResources,
      'O desktop pesado esgota seu limite sem impedir a captura mobile',
    );
    assert.equal(
      requested.some((url) => url.includes('nao-enviar')),
      false,
      'POST não deve alcançar o transporte',
    );
    assert.ok(
      requested.some((url) => url.includes('/privado')),
      'GET privado deve passar pelo guard',
    );
    await mkdir('outputs/references', { recursive: true });
    for (const shot of shots) {
      const heading = shot.styles.find((style) => style.tag === 'H1');
      assert.equal(heading.text, 'A matéria orienta a forma');
      assert.match(heading.font, /Georgia/);
      assert.equal(heading.size, shot.viewport === 'mobile' ? '42px' : '68px');
      assert.equal(shot.truncated, true);
      assert.equal(shot.height, 9000);
      const metadata = await sharp(shot.jpeg).metadata();
      assert.equal(metadata.width, shot.width);
      await writeFile(
        `outputs/references/source-${shot.viewport}.jpg`,
        shot.jpeg,
      );
      await sharp(shot.jpeg)
        .extract({ left: 0, top: 0, width: shot.width, height: 1200 })
        .toFile(`outputs/references/source-${shot.viewport}-top.jpg`);
    }
    await assert.rejects(() =>
      captureReference('https://reference.test/redirect', request),
    );
  },
);
