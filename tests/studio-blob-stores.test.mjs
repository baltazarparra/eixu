import assert from 'node:assert/strict';
import test from 'node:test';
import {
  blobStoreId,
  privateBlobOptions,
  publicBlobOptions,
} from '../lib/blob/stores.mjs';
import { loadModuleGraph } from './helpers/load-module.mjs';

const env = {
  BLOB_READ_WRITE_TOKEN: 'vercel_blob_rw_public_fixture',
  STUDIO_BLOB_READ_WRITE_TOKEN: 'vercel_blob_rw_private_fixture',
  BLOB_STORE_ID: 'store_default_ignored',
};

void test('Blob exige stores distintos e nunca cai no token público para checkpoint', () => {
  assert.equal(publicBlobOptions(env).token, env.BLOB_READ_WRITE_TOKEN);
  assert.equal(privateBlobOptions(env).token, env.STUDIO_BLOB_READ_WRITE_TOKEN);
  assert.equal(blobStoreId('private', env), 'private');
  assert.throws(
    () => privateBlobOptions({ ...env, STUDIO_BLOB_READ_WRITE_TOKEN: '' }),
    /STUDIO_BLOB_READ_WRITE_TOKEN/,
  );
  assert.throws(
    () =>
      privateBlobOptions({
        ...env,
        STUDIO_BLOB_READ_WRITE_TOKEN: 'vercel_blob_rw_public_rotated',
      }),
    /distintos/,
  );
});

void test('uploads e limpezas usam o store correspondente ao tipo de arquivo', async () => {
  const calls = [];
  const remaining = new Set([
    'tenants/fixture/',
    'studio/11111111-1111-4111-8111-111111111111/',
  ]);
  const subject = loadModuleGraph(
    'lib/blob/tenant-files.ts',
    {
      '@/lib/tenant-lock': {
        withTenantLock: async (_id, _operation, run) =>
          run({ slug: 'fixture' }),
      },
      '@vercel/blob': {
        put: async (path, _body, options) => {
          calls.push({ type: 'put', path, options });
          return { url: path };
        },
        list: async (options) => {
          calls.push({ type: 'list', options });
          const present = remaining.delete(options.prefix);
          return { blobs: present ? [{ url: `${options.prefix}file` }] : [] };
        },
        del: async (paths, options) => {
          calls.push({ type: 'del', paths, options });
        },
      },
    },
    { process: { env } },
  );
  await subject.putNewTenantBlob(
    'fixture',
    new File(['image'], 'logo.png', { type: 'image/png' }),
  );
  await subject.putTenantBlob('tenant', 'image.webp', Buffer.from('image'), {
    access: 'public',
  });
  await subject.putTenantBlobs('tenant', [
    {
      path: 'other.webp',
      body: Buffer.from('image'),
      options: { access: 'public' },
    },
  ]);
  await subject.deleteTenantBlobs('fixture');
  await subject.deleteStudioProjectBlobs(
    '11111111-1111-4111-8111-111111111111',
  );
  for (const call of calls) {
    const path = call.path ?? call.options.prefix ?? call.paths[0];
    assert.equal(
      call.options.token,
      path.startsWith('studio/')
        ? env.STUDIO_BLOB_READ_WRITE_TOKEN
        : env.BLOB_READ_WRITE_TOKEN,
    );
    if (call.type === 'put') assert.equal(call.options.access, 'public');
  }
  assert.equal(calls.filter((call) => call.type === 'del').length, 2);
});
