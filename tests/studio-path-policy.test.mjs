import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isEditableStudioFile,
  isReadableStudioFile,
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
  assert.equal(isEditableStudioFile('public/photo.webp'), false);
  assert.equal(isReadableStudioFile('project.json'), true);
  assert.throws(() => isEditableStudioFile('project.json'), /reservado/);
  assert.throws(() => isEditableStudioFile('package.json'), /reservado/);
  assert.throws(() => isEditableStudioFile('package-lock.json'), /reservado/);
  assert.throws(() => isEditableStudioFile('npm-shrinkwrap.json'), /reservado/);
  assert.throws(() => isEditableStudioFile('.env'), /reservado/);
});
