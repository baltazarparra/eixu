import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import {
  clientProjects,
  manifestScopeDigest,
  parseResetArgs,
  resetConfirmation,
  resourceDigest,
} from '../scripts/reset-sites-lib.mjs';

const ROOT_PROJECT_ID = 'prj_root_protegido';

void test('reset exige ambiente e confirmação específica', () => {
  assert.deepEqual(parseResetArgs(['--environment=preview', '--manifest']), {
    environment: 'preview',
    execute: false,
  });
  assert.throws(
    () =>
      parseResetArgs([
        '--environment=production',
        '--execute',
        '--confirm=RESET-EIXU-SITES-PREVIEW',
      ]),
    /Execução recusada/,
  );
  const manifestCreatedAt = new Date().toISOString();
  assert.deepEqual(
    parseResetArgs([
      '--environment=production',
      '--execute',
      '--confirm=RESET-EIXU-SITES-PRODUCTION',
      `--scope-digest=${'a'.repeat(64)}`,
      `--database-fingerprint=${'b'.repeat(16)}`,
      `--manifest-created-at=${manifestCreatedAt}`,
    ]),
    {
      environment: 'production',
      execute: true,
      scopeDigest: 'a'.repeat(64),
      databaseFingerprint: 'b'.repeat(16),
      manifestCreatedAt,
    },
  );
  assert.throws(
    () =>
      parseResetArgs([
        '--environment=production',
        '--execute',
        '--confirm=RESET-EIXU-SITES-PRODUCTION',
        `--scope-digest=${'a'.repeat(64)}`,
        `--database-fingerprint=${'b'.repeat(16)}`,
        '--manifest-created-at=2020-01-01T00:00:00.000Z',
      ]),
    /últimos 30 minutos/,
  );
  assert.equal(resetConfirmation('production'), 'RESET-EIXU-SITES-PRODUCTION');
});

void test('reset exige identidade remota exata para vínculos do banco', () => {
  assert.deepEqual(
    clientProjects({
      databaseProjects: [
        {
          id: 'prj_cliente',
          expectedName: 'eixu-premium-cliente',
          storedName: 'eixu-premium-cliente',
          source: 'premium_projects',
        },
      ],
      vercelProjects: [{ id: 'prj_cliente', name: 'eixu-premium-cliente' }],
      rootProjectId: ROOT_PROJECT_ID,
    }),
    [
      {
        id: 'prj_cliente',
        name: 'eixu-premium-cliente',
        source: 'premium_projects',
      },
    ],
  );
  assert.throws(
    () =>
      clientProjects({
        databaseProjects: [
          {
            id: 'prj_cliente',
            expectedName: 'eixu-site-cliente',
            storedName: 'eixu-site-cliente',
            source: 'studio_projects',
          },
        ],
        vercelProjects: [{ id: 'prj_cliente', name: 'produto-interno' }],
        rootProjectId: ROOT_PROJECT_ID,
      }),
    /divergente/,
  );
});

void test('manifesto protege o projeto raiz e inclui apenas órfãos com prefixo', () => {
  assert.deepEqual(
    clientProjects({
      databaseProjects: [
        {
          id: 'prj_db',
          expectedName: 'eixu-site-db',
          storedName: 'eixu-site-db',
          source: 'studio_projects',
        },
        {
          id: ROOT_PROJECT_ID,
          expectedName: 'eixu-site-root',
          storedName: 'eixu-site-root',
          source: 'studio_projects',
        },
      ],
      vercelProjects: [
        { id: 'prj_db', name: 'eixu-site-db' },
        { id: 'prj_orphan', name: 'eixu-site-cliente' },
        { id: 'prj_unrelated', name: 'produto-interno' },
        { id: ROOT_PROJECT_ID, name: 'eixu-site-root' },
      ],
      rootProjectId: ROOT_PROJECT_ID,
    }),
    [
      {
        id: 'prj_db',
        name: 'eixu-site-db',
        source: 'studio_projects',
      },
      {
        id: 'prj_orphan',
        name: 'eixu-site-cliente',
        source: 'prefix',
      },
    ],
  );
});

void test('digest do manifesto independe da ordem e muda com o escopo', () => {
  const first = resourceDigest(['b', 'a'], createHash);
  assert.equal(first, resourceDigest(['a', 'b'], createHash));
  assert.notEqual(first, resourceDigest(['a', 'c'], createHash));
});

void test('digest vincula timestamp, banco e identidades do manifesto', () => {
  const manifest = {
    schemaVersion: 2,
    environment: 'preview',
    createdAt: '2026-09-18T12:00:00.000Z',
    database: {
      fingerprint: 'a'.repeat(16),
      resetCounts: { tenants: 1 },
      preservedCounts: { admin_users: 2 },
      inventories: [{ table: 'tenants', count: 1, digest: 'b'.repeat(64) }],
    },
    vercel: {
      teamId: 'team_eixu',
      protectedProjectId: ROOT_PROJECT_ID,
      clientProjectPrefixes: ['eixu-site-'],
      deleteProjects: [{ id: 'prj_client', name: 'eixu-site-client' }],
    },
    blob: {
      inventories: [
        {
          access: 'private',
          storeId: 'store_fixture',
          prefix: 'studio/',
          count: 1,
          bytes: 20,
          digest: 'c'.repeat(64),
        },
      ],
    },
  };
  const accepted = manifestScopeDigest(manifest, createHash);
  assert.notEqual(
    accepted,
    manifestScopeDigest(
      {
        ...manifest,
        blob: {
          inventories: manifest.blob.inventories.map((item) => ({
            ...item,
            storeId: 'store_outro',
          })),
        },
      },
      createHash,
    ),
  );
  assert.notEqual(
    accepted,
    manifestScopeDigest(
      { ...manifest, createdAt: '2026-09-18T12:01:00.000Z' },
      createHash,
    ),
  );
  assert.notEqual(
    accepted,
    manifestScopeDigest(
      {
        ...manifest,
        database: {
          ...manifest.database,
          inventories: [{ table: 'tenants', count: 1, digest: 'd'.repeat(64) }],
        },
      },
      createHash,
    ),
  );
});
