import assert from 'node:assert/strict';
import test from 'node:test';
import { isTenantBlobUrl, isVercelBlobUrl } from '../lib/blob/tenant-url.mjs';
import {
  boundedPublicSource,
  parseBoundedPublicSource,
  parseBoundedPublicJson,
  PublicInputTooLargeError,
  readBoundedPublicBody,
} from '../lib/public-input.mjs';

void test('anexo do chat precisa pertencer ao prefixo Blob do tenant', () => {
  const own =
    'https://store.public.blob.vercel-storage.com/tenants/acme/media/logo.webp';
  assert.equal(isVercelBlobUrl(own), true);
  assert.equal(isTenantBlobUrl(own, 'acme'), true);
  assert.equal(isTenantBlobUrl(own, 'outro'), false);
  assert.equal(
    isTenantBlobUrl('https://example.com/tenants/acme/logo.webp', 'acme'),
    false,
  );
  assert.equal(
    isTenantBlobUrl(
      'http://store.public.blob.vercel-storage.com/tenants/acme/logo.webp',
      'acme',
    ),
    false,
  );
});

void test('atribuição pública aceita somente objeto JSON pequeno', () => {
  assert.deepEqual(parseBoundedPublicSource('{"utm_source":"busca"}'), {
    utm_source: 'busca',
  });
  assert.deepEqual(parseBoundedPublicSource('[1,2]'), {});
  assert.deepEqual(boundedPublicSource({ value: 'x'.repeat(9_000) }), {});
});

void test('corpo público respeita o limite mesmo sem Content-Length', async () => {
  const request = new Request('https://acme.eixu.com.br/api/e', {
    method: 'POST',
    body: 'x'.repeat(64),
  });
  await assert.rejects(
    () => readBoundedPublicBody(request, 32),
    PublicInputTooLargeError,
  );
});

void test('JSON público é lido dentro do orçamento', async () => {
  const request = new Request('https://acme.eixu.com.br/api/e', {
    method: 'POST',
    body: JSON.stringify({ tenant: 'acme', type: 'page_view' }),
  });
  assert.deepEqual(await parseBoundedPublicJson(request, 1_000), {
    tenant: 'acme',
    type: 'page_view',
  });
});
