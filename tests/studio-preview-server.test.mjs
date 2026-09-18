import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import test from 'node:test';
import {
  STUDIO_PREVIEW_SERVER,
  STUDIO_PREVIEW_SERVER_PATH,
} from '../lib/studio/preview-server.ts';
import { studioSandboxFixture, workspace } from './helpers/studio-sandbox.mjs';

const require = createRequire(import.meta.url);
const {
  blockCrossSiteDEV,
} = require('next/dist/server/lib/router-utils/block-cross-site-dev.js');

void test('bootstrap reconhece a origem pública no guard real do Next e mantém o bind da VM', async () => {
  let options;
  let listener;
  let bind;
  const server = {
    listen: (...args) => {
      bind = args;
    },
    close() {},
  };
  const response = {};
  const app = {
    prepare: async () => {},
    getRequestHandler: () => (_request, target) => {
      target.handled = true;
    },
    close: async () => {},
  };
  vm.runInNewContext(STUDIO_PREVIEW_SERVER, {
    require: (name) =>
      name === 'node:http'
        ? {
            createServer: (handler) => {
              listener = handler;
              return server;
            },
          }
        : {
            createRequire: () => () => (input) => {
              options = input;
              return app;
            },
          },
    process: {
      cwd: () => workspace,
      env: { EIXU_PREVIEW_HOST: 'preview.sandbox.example' },
      on() {},
      exit: () => {
        throw new Error('Bootstrap terminou antes de servir.');
      },
    },
    console,
  });
  await Promise.resolve();
  assert.deepEqual(bind, [3000, '0.0.0.0']);
  assert.equal(options.httpServer, server);
  listener({}, response);
  assert.equal(response.handled, true);
  for (const path of ['/_next/static/chunks/app.js', '/_next/hmr']) {
    for (const origin of [
      'https://preview.sandbox.example',
      'https://untrusted.example',
    ]) {
      const output = { statusCode: 200, end() {} };
      const blocked = blockCrossSiteDEV(
        { url: path, headers: { origin } },
        output,
        [],
        options.hostname,
      );
      assert.equal(blocked, origin.includes('untrusted'));
      assert.equal(output.statusCode, blocked ? 403 : 200);
    }
  }
});

void test('prévia inicia o bootstrap fora do checkpoint com o hostname exato da VM', async () => {
  const fixture = studioSandboxFixture();
  await fixture.load('lib/studio/sandbox.ts').ensureStudioPreview({
    name: 'fixture',
    projectId: 'project',
    codeRevision: fixture.codeRevision,
    contentRevisionId: 'content-A',
    userId: 'user',
  });
  const launch = fixture.calls.find((call) => call.cmd === 'node');
  assert.deepEqual([...launch.args], [STUDIO_PREVIEW_SERVER_PATH]);
  assert.equal(launch.cwd, workspace);
  assert.equal(launch.env.EIXU_PREVIEW_HOST, 'fixture.sandbox.example');
  assert.equal(launch.env.NODE_ENV, 'development');
  assert.equal(
    fixture.files.get(STUDIO_PREVIEW_SERVER_PATH).toString(),
    STUDIO_PREVIEW_SERVER,
  );
  assert.equal(
    fixture.files.get(`${workspace}/next.config.ts`).toString(),
    fixture.sources['next.config.ts'],
  );
  assert.equal(
    fixture.files.get(`${workspace}/proxy.ts`).toString(),
    fixture.sources['proxy.ts'],
  );
});
