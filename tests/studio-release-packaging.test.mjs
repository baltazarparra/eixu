import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import {
  STUDIO_LEGACY_NEXT_CONFIG,
  studioScaffoldContent,
} from '../lib/studio/scaffold.ts';
import { studioSandboxFixture, workspace } from './helpers/studio-sandbox.mjs';
import { loadModuleGraph } from './helpers/load-module.mjs';

for (const legacy of [false, true])
  void test(`release adapta o config ${legacy ? 'histórico' : 'atual'} sem reescrever o checkpoint`, async () => {
    const fixture = studioSandboxFixture({ recreate: true });
    const sources = { ...fixture.sources };
    if (legacy) sources['next.config.ts'] = STUDIO_LEGACY_NEXT_CONFIG;
    const archive = Buffer.from(JSON.stringify(sources));
    const files = await fixture
      .load('lib/studio/sandbox.ts')
      .studioDeploymentFiles({
        archive,
        content: fixture.content,
        slug: 'fixture',
      });
    const config = files
      .find((file) => file.file === 'next.config.ts')
      .data.toString();
    assert.doesNotMatch(config, /standalone/);
    if (!legacy) assert.match(config, /\/tenants\/fixture\/\*\*/);
    assert.equal(
      fixture.files.get(`${workspace}/next.config.ts`).toString(),
      sources['next.config.ts'],
    );
    assert.equal(
      JSON.parse(archive.toString())['next.config.ts'],
      sources['next.config.ts'],
    );
  });

void test('release recusa configuração adulterada antes do upload', async () => {
  const fixture = studioSandboxFixture({ recreate: true });
  const sources = {
    ...fixture.sources,
    'next.config.ts': "export default { output: 'export' };",
  };
  await assert.rejects(
    fixture.load('lib/studio/sandbox.ts').studioDeploymentFiles({
      archive: Buffer.from(JSON.stringify(sources)),
      content: fixture.content,
      slug: 'fixture',
    }),
    /checkpoint autorizado/,
  );
});

void test(
  'cópia materializada compila no Next real com adaptador',
  { timeout: 90_000 },
  async () => {
    const fixture = studioSandboxFixture({ recreate: true });
    const files = await fixture
      .load('lib/studio/sandbox.ts')
      .studioDeploymentFiles({
        archive: fixture.archive,
        content: fixture.content,
        slug: 'fixture',
      });
    const dir = await mkdtemp(join(process.cwd(), '.tmp-studio-release-'));
    try {
      for (const file of files) {
        if (file.file === 'package-lock.json') continue;
        const path = join(dir, file.file);
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, file.data);
      }
      const adapter = join(dir, 'adapter.cjs');
      await writeFile(
        adapter,
        `module.exports = { name: 'release-regression', async onBuildComplete() {} };`,
      );
      const result = await new Promise((resolve, reject) => {
        const child = spawn(
          process.execPath,
          [
            join(process.cwd(), 'node_modules/next/dist/bin/next'),
            'build',
            dir,
          ],
          {
            env: {
              ...process.env,
              NEXT_ADAPTER_PATH: adapter,
              NEXT_TELEMETRY_DISABLED: '1',
            },
            stdio: ['ignore', 'pipe', 'pipe'],
          },
        );
        let output = '';
        child.stdout.on('data', (chunk) => (output += chunk));
        child.stderr.on('data', (chunk) => (output += chunk));
        child.once('error', reject);
        child.once('exit', (code) => resolve({ code, output }));
      });
      assert.equal(result.code, 0, result.output.slice(-4_000));
      assert.match(
        result.output,
        /Running onBuildComplete from release-regression/,
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  },
);

void test('provisionamento pede staging explicitamente e deixa promoção para depois do smoke', async () => {
  const requests = [];
  let materialized;
  const release = {
    id: 'release',
    project_id: 'project',
    tenant_id: 'tenant',
    slug: 'fixture',
    canonical_host: 'fixture.eixu.com.br',
    code_revision: 'code',
    code_artifact_key: 'artifact',
    content_revision_id: 'content',
    contract_hash: 'contract',
    status: 'preparing',
  };
  const sql = async (strings) => {
    const query = strings.join('?');
    if (query.includes('revision.content'))
      return [
        { content: { title: 'Fixture' }, contract: { pages: [{ slug: '' }] } },
      ];
    return [{ id: 'project' }];
  };
  sql.query = async () => [release];
  const { provisionStudioDeployment } = loadModuleGraph(
    'lib/studio/releases.ts',
    {
      '@/lib/db': { db: () => sql },
      './checkpoint-storage': {
        readStudioCheckpoint: async () => Buffer.from('verified'),
      },
      './sandbox': {
        studioDeploymentFiles: async (input) => {
          materialized = input;
          return [
            {
              file: 'next.config.ts',
              data: Buffer.from(
                studioScaffoldContent('next.config.ts', 'fixture'),
              ),
            },
          ];
        },
      },
    },
    {
      process: {
        env: {
          EIXU_VERCEL_TOKEN: 'fixture',
          EIXU_VERCEL_TEAM_ID: 'team_fixture',
          EIXU_VERCEL_ROOT_PROJECT_ID: 'prj_root',
        },
      },
      fetch: async (url, init) => {
        const path = new URL(url).pathname;
        requests.push({
          path,
          method: init.method ?? 'GET',
          body: typeof init.body === 'string' ? JSON.parse(init.body) : null,
        });
        if (path === '/v2/files') return Response.json({});
        if (path === '/v13/deployments')
          return Response.json({
            id: 'dpl_fixture',
            url: 'fixture.vercel.app',
            target: 'staging',
          });
        assert.match(path, /^\/v(?:9|11)\/projects(?:\/prj_fixture)?$/);
        return Response.json({
          id: 'prj_fixture',
          name: 'eixu-site-fixture',
          ssoProtection: { deploymentType: 'preview' },
        });
      },
    },
  );
  await provisionStudioDeployment('release');
  assert.equal(materialized.slug, 'fixture');
  const deployment = requests.find(
    (request) => request.path === '/v13/deployments',
  );
  assert.equal(deployment.body.target, 'staging');
  assert.equal(deployment.body.project, 'prj_fixture');
  assert.ok(
    deployment.body.files.some(
      (file) => file.file === 'public/.well-known/eixu-release.json',
    ),
  );
  assert.ok(requests.every((request) => !request.path.includes('/promote')));
});
