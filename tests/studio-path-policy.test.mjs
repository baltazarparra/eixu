import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isEditableStudioFile,
  isReadableStudioFile,
  isRemovableStudioFile,
  studioWorkspacePath,
} from '../lib/studio/path-policy.ts';

void test('caminhos do agente ficam dentro do workspace', () => {
  assert.equal(
    studioWorkspacePath('app/page.tsx'),
    '/vercel/sandbox/project/app/page.tsx',
  );
  assert.throws(() => studioWorkspacePath('../../.env'), /fora do projeto/);
  assert.throws(() => studioWorkspacePath('node_modules/x.js'), /reservado/);
  assert.throws(() => studioWorkspacePath('/etc/passwd'), /fora do projeto/);
});

void test('ferramenta escreve somente formatos textuais enumerados', () => {
  assert.equal(isEditableStudioFile('app/page.tsx'), true);
  assert.equal(isEditableStudioFile('public/marca.svg'), true);
  assert.equal(isEditableStudioFile('public/photo.webp'), false);
  assert.equal(isReadableStudioFile('project.json'), true);
  assert.throws(() => isEditableStudioFile('project.json'), /reservado/);
  assert.throws(() => isEditableStudioFile('package.json'), /reservado/);
  assert.throws(() => isEditableStudioFile('package-lock.json'), /reservado/);
  assert.throws(() => isEditableStudioFile('npm-shrinkwrap.json'), /reservado/);
  assert.throws(() => isEditableStudioFile('.env'), /reservado/);
});

void test('remoção alcança páginas obsoletas, nunca integração ou contrato editorial', () => {
  assert.equal(isRemovableStudioFile('app/servicos/page.tsx'), true);
  assert.equal(isRemovableStudioFile('components/Hero.tsx'), true);
  assert.equal(isRemovableStudioFile('public/foto.webp'), false);
  assert.throws(() => isRemovableStudioFile('package.json'), /reservado/);
  assert.throws(() => isRemovableStudioFile('lib/eixu.ts'), /reservado/);
  assert.throws(
    () => isRemovableStudioFile('content/schema.json'),
    /write_content_contract/,
  );
  assert.throws(
    () => isRemovableStudioFile('content/values.json'),
    /write_content_contract/,
  );
  assert.throws(() => isRemovableStudioFile('../../.env'), /fora do projeto/);
});
