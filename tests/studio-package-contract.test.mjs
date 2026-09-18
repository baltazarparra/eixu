import assert from 'node:assert/strict';
import test from 'node:test';
import { assertStudioPackageContract } from '../lib/studio/package-contract.mjs';

function manifest() {
  return {
    scripts: {
      dev: 'next dev',
      build: 'next build',
      start: 'next start',
      typecheck: 'next typegen && tsc --noEmit',
    },
    dependencies: {
      next: '16.3.3',
      react: '19.2.6',
      'react-dom': '19.2.6',
    },
    devDependencies: {
      '@types/node': '22.19.19',
      '@types/react': '19.2.14',
      '@types/react-dom': '19.2.3',
      typescript: '5.9.3',
    },
  };
}

void test('projeto preserva o manifesto controlado pela plataforma', () => {
  assert.equal(
    assertStudioPackageContract(manifest()).scripts.build,
    'next build',
  );
});

void test('projeto não pode substituir build ou executar lifecycle de instalação', () => {
  const bypass = manifest();
  bypass.scripts.build = 'true';
  assert.throws(() => assertStudioPackageContract(bypass), /controlado/);

  const lifecycle = manifest();
  lifecycle.scripts.postinstall = 'node collect-secrets.js';
  assert.throws(
    () => assertStudioPackageContract(lifecycle),
    /não é permitido/,
  );
});

void test('projeto não pode acrescentar dependência ao release', () => {
  const extra = manifest();
  extra.dependencies.widget = '1.2.3';
  assert.throws(() => assertStudioPackageContract(extra), /não autorizadas/);

  const override = manifest();
  override.overrides = { next: '0.0.0-malicious' };
  assert.throws(() => assertStudioPackageContract(override), /overrides/);
});
