import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { createJiti } from 'jiti';
import { loadModule } from './helpers/load-module.mjs';

const plain = (value) => JSON.parse(JSON.stringify(value));
const jiti = createJiti(import.meta.url, { alias: { '@': process.cwd() } });
const { UploadError } = await loadModule('lib/blob/tenant-files.ts');
const { TenantRemovedError } = await loadModule('lib/tenant-lock.ts');
const { IMAGE_UPLOAD_MAX_BYTES } = await loadModule(
  'lib/images/upload-policy.ts',
);

async function photo() {
  return sharp({
    create: { width: 90, height: 60, channels: 4, background: '#4a855c' },
  })
    .png()
    .toBuffer();
}

async function fixture({ failPut = false, failInsert = false } = {}) {
  const calls = { puts: [], inserts: [], deletes: [] };
  const { uploadLibraryImage } = await loadModule('lib/images/upload.ts', {
    '@vercel/blob': { del: async (url) => calls.deletes.push(url) },
    '@/lib/blob/tenant-files': {
      UploadError,
      putTenantBlob: async (tenantId, path, body, options) => {
        calls.puts.push({ tenantId, path, body, options });
        if (failPut) throw new Error('storage failure');
        return {
          url: `https://blob.test/tenants/client-a/${path}`,
          pathname: `tenants/client-a/${path}`,
        };
      },
    },
    '@/lib/images/queries': {
      insertImage: async (input) => {
        calls.inserts.push(input);
        if (failInsert) throw new Error('insert failure');
        return { ...input, id: 'image-id', seq: 9, status: 'disponivel' };
      },
    },
  });
  return { calls, uploadLibraryImage };
}

await test('upload vira foto numerada do mesmo tenant, com pixels válidos, dimensões e origem', async () => {
  const f = await fixture();
  const file = new File([await photo()], 'Minha_foto.png', {
    type: 'image/png',
  });
  const image = await f.uploadLibraryImage('tenant-a', file);
  assert.equal(image.seq, 9);
  assert.equal(image.status, 'disponivel');
  assert.equal(image.model, 'upload');
  assert.equal(image.alt, 'Minha foto');
  assert.equal(image.ratio, '3:2');
  assert.equal(image.width, 90);
  assert.equal(image.height, 60);
  assert.equal(image.tenantId, 'tenant-a');
  assert.equal(f.calls.puts[0].tenantId, 'tenant-a');
  assert.match(
    image.blobPath,
    /^tenants\/client-a\/uploads\/[a-f0-9-]+\.webp$/,
  );
  assert.equal((await sharp(f.calls.puts[0].body).metadata()).format, 'webp');
  assert.equal(f.calls.inserts.length, 1);
  assert.equal(f.calls.deletes.length, 0);
  await f.uploadLibraryImage('tenant-a', file);
  assert.notEqual(
    f.calls.puts[0].path,
    f.calls.puts[1].path,
    'nomes iguais não sobrescrevem arquivos',
  );
});

await test('upload aplica orientação EXIF e remove os metadados do arquivo', async () => {
  const f = await fixture();
  const bytes = await sharp(await photo())
    .jpeg()
    .withMetadata({ orientation: 6 })
    .toBuffer();
  const image = await f.uploadLibraryImage(
    'tenant-a',
    new File([bytes], 'retrato.jpg', { type: 'image/jpeg' }),
  );
  assert.equal(image.width, 60);
  assert.equal(image.height, 90);
  assert.equal(image.ratio, '2:3');
  const metadata = await sharp(f.calls.puts[0].body).metadata();
  assert.equal(metadata.exif, undefined);
  assert.equal(metadata.orientation, undefined);
});

for (const [name, makeFile] of [
  ['arquivo vazio', () => new File([], 'vazia.png', { type: 'image/png' })],
  [
    'tipo não aceito',
    () => new File(['documento'], 'texto.txt', { type: 'text/plain' }),
  ],
  [
    'arquivo acima do limite',
    () =>
      new File([new Uint8Array(IMAGE_UPLOAD_MAX_BYTES + 1)], 'grande.png', {
        type: 'image/png',
      }),
  ],
  [
    'MIME de imagem com bytes inválidos',
    () => new File(['isto não é PNG'], 'falsa.png', { type: 'image/png' }),
  ],
  [
    'SVG disfarçado de PNG',
    () =>
      new File(
        ['<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>'],
        'vetor.png',
        { type: 'image/png' },
      ),
  ],
])
  await test(`upload recusa ${String(name)} antes de escrever`, async () => {
    const f = await fixture();
    await assert.rejects(
      f.uploadLibraryImage('tenant-a', makeFile()),
      UploadError,
    );
    assert.deepEqual(plain(f.calls), { puts: [], inserts: [], deletes: [] });
  });

await test('falha de registro remove somente o novo blob; falha de upload não insere imagem', async () => {
  for (const failPut of [false, true]) {
    const f = await fixture({ failPut, failInsert: true });
    await assert.rejects(
      f.uploadLibraryImage(
        'tenant-a',
        new File([await photo()], 'foto.png', { type: 'image/png' }),
      ),
    );
    assert.equal(f.calls.inserts.length, failPut ? 0 : 1);
    assert.deepEqual(
      f.calls.deletes,
      failPut
        ? []
        : [`https://blob.test/tenants/client-a/${f.calls.puts[0].path}`],
    );
  }
});

async function route({
  authenticated = true,
  tenant = { id: 'tenant-a' },
  failure,
} = {}) {
  const calls = [];
  const api = await loadModule('app/api/admin/[tenant]/images/route.ts', {
    '@/lib/auth': { isAuthenticated: async () => authenticated },
    '@/lib/tenant-queries': {
      getTenantBySlug: async (slug) => {
        calls.push(['resolve', slug]);
        return tenant;
      },
    },
    '@/lib/images/upload': {
      uploadLibraryImage: async (id, file) => {
        calls.push(['upload', id, file.name]);
        if (failure) throw failure;
        return {
          id: 'image-id',
          seq: 9,
          model: 'upload',
          status: 'disponivel',
        };
      },
    },
    '@/lib/blob/tenant-files': { UploadError },
    '@/lib/tenant-lock': { TenantRemovedError },
  });
  return { ...api, calls };
}

const context = { params: Promise.resolve({ tenant: 'client-a' }) };
function request(body = new FormData()) {
  return new Request('http://localhost/api/admin/client-a/images', {
    method: 'POST',
    body,
  });
}
await test('POST exige sessão e resolve tenant antes de ler o upload', async () => {
  for (const [options, status] of [
    [{ authenticated: false }, 401],
    [{ tenant: null }, 404],
  ]) {
    const api = await route(options);
    const response = await api.POST(request(), context);
    assert.equal(response.status, status);
    assert.ok(!api.calls.some(([name]) => name === 'upload'));
    if (status === 401) assert.deepEqual(api.calls, []);
  }
});

await test('POST usa tenant resolvido no servidor e devolve a imagem pronta para o acervo', async () => {
  const api = await route();
  const form = new FormData();
  form.set(
    'file',
    new File([await photo()], 'foto.png', { type: 'image/png' }),
  );
  form.set('tenantId', 'tenant-b');
  const response = await api.POST(request(form), context);
  assert.equal(response.status, 201);
  assert.equal((await response.json()).image.seq, 9);
  assert.deepEqual(api.calls, [
    ['resolve', 'client-a'],
    ['upload', 'tenant-a', 'foto.png'],
  ]);
});

await test('POST recusa multipart inválido, ausente ou com mais de um arquivo', async () => {
  const api = await route();
  const multiple = new FormData();
  multiple.append('file', new File(['x'], '1.png', { type: 'image/png' }));
  multiple.append('file', new File(['x'], '2.png', { type: 'image/png' }));
  for (const body of ['inválido', new FormData(), multiple])
    assert.equal((await api.POST(request(body), context)).status, 400);
  assert.ok(!api.calls.some(([name]) => name === 'upload'));
});

await test('POST preserva erro de validação, tenant excluído e falha de persistência sem expor detalhes', async () => {
  for (const [failure, status] of [
    [new UploadError('A imagem deve ter até 4 MB.', 413), 413],
    [new TenantRemovedError(), 404],
    [new Error('detalhes internos'), 502],
  ]) {
    const api = await route({ failure });
    const form = new FormData();
    form.set('file', new File(['x'], 'foto.png', { type: 'image/png' }));
    const response = await api.POST(request(form), context);
    assert.equal(response.status, status);
    assert.doesNotMatch(await response.text(), /detalhes internos/);
  }
});

await test('proporção real do upload governa recorte e cobertura do plano sem fingir outra medida', async () => {
  const { ratioFits, closestGenerationRatio } = await loadModule(
    'lib/images/ratios.ts',
  );
  const { availablePhotos, generatedPhotos } = await jiti.import(
    '../lib/taste/metrics.ts',
  );
  const { sceneCoverage } = await loadModule('lib/images/scene-plan.ts');
  const library = [
    {
      id: '1',
      kind: 'foto',
      model: 'upload',
      blobPath: 'tenants/client-a/uploads/photo.webp',
      status: 'disponivel',
      ratio: '3:2',
      targetBlock: 'livre',
    },
  ];
  assert.equal(availablePhotos(library).length, 1);
  assert.equal(generatedPhotos(library).length, 0);
  assert.equal(ratioFits('3:2', '4:3'), true);
  assert.equal(ratioFits('2:3', '16:9'), false);
  assert.equal(closestGenerationRatio('3:2'), '4:3');
  assert.equal(closestGenerationRatio('2:3'), '4:5');
  assert.equal(closestGenerationRatio('0:0'), null);
  const coverage = sceneCoverage(
    [
      { targetBlock: 'media.gallery', ratio: '4:3' },
      { targetBlock: 'hero.cover', ratio: '16:9' },
    ],
    availablePhotos(library),
  );
  assert.equal(coverage.covered.length, 1);
  assert.equal(coverage.missing.length, 1);
});
