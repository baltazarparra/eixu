import assert from 'node:assert/strict';
import test from 'node:test';
import { studioSandboxFixture, workspace } from './helpers/studio-sandbox.mjs';

void test('Sandbox existente sem workspace retoma o primeiro bootstrap antes das ferramentas', async () => {
  const fixture = studioSandboxFixture({
    missingWorkspace: true,
    firstBuild: true,
  });
  const subject = fixture.load('lib/studio/sandbox.ts');
  await subject.prepareStudioWorkspaceForRun('fixture');
  const files = await subject.listStudioFiles('fixture');
  assert.ok(files.includes('app/page.tsx'));
  assert.ok(files.includes('lib/eixu.ts'));
  assert.equal(
    fixture.files.get(`${workspace}/package.json`).toString(),
    fixture.sources['package.json'],
  );
  assert.equal(fixture.blobCalls.length, 0);
});

void test('bootstrap parcial repõe integração ausente sem sobrescrever código existente', async () => {
  const fixture = studioSandboxFixture({ firstBuild: true });
  fixture.files.delete(`${workspace}/lib/eixu.ts`);
  fixture.files.set(
    `${workspace}/app/page.tsx`,
    Buffer.from('página já editada'),
  );
  const subject = fixture.load('lib/studio/sandbox.ts');
  await subject.studioSandbox('fixture');
  assert.equal(
    fixture.files.get(`${workspace}/lib/eixu.ts`).toString(),
    fixture.sources['lib/eixu.ts'],
  );
  assert.equal(
    fixture.files.get(`${workspace}/app/page.tsx`).toString(),
    'página já editada',
  );
});

void test('Sandbox existente vazio recupera checkpoint uma vez e preserva edições subsequentes', async () => {
  const fixture = studioSandboxFixture({ missingWorkspace: true });
  const subject = fixture.load('lib/studio/sandbox.ts');
  await subject.studioSandbox('fixture');
  await subject.writeStudioFile('fixture', 'app/page.tsx', 'nova edição');
  assert.equal(
    await subject.readStudioFile('fixture', 'app/page.tsx'),
    'nova edição',
  );
  assert.equal(
    fixture.blobCalls.filter((call) => call.type === 'get').length,
    1,
  );
  assert.equal(
    JSON.parse(
      fixture.files.get(`${workspace}/content/values.json`).toString(),
    )['status.title'],
    fixture.content['status.title'],
  );
});

void test('escrita cria todos os diretórios de um novo componente aninhado', async () => {
  const fixture = studioSandboxFixture();
  const subject = fixture.load('lib/studio/sandbox.ts');
  await subject.writeStudioFile(
    'fixture',
    'app/components/marketing/Hero.tsx',
    'export default function Hero() { return null; }',
  );
  assert.match(
    await subject.readStudioFile(
      'fixture',
      'app/components/marketing/Hero.tsx',
    ),
    /function Hero/,
  );
});

void test('falha na criação da raiz impede bootstrap e comandos de projeto', async () => {
  const fixture = studioSandboxFixture({
    missingWorkspace: true,
    firstBuild: true,
    directoryFailure: true,
  });
  await assert.rejects(
    fixture.load('lib/studio/sandbox.ts').runStudioCommand('fixture', 'build'),
    /criar a pasta do projeto/,
  );
  assert.equal(fixture.files.size, 0);
  assert.equal(
    fixture.calls.some((call) => call.cmd === 'npm'),
    false,
  );
});

void test('materialização da release cria a raiz na imagem universal antes de extrair o checkpoint', async () => {
  const fixture = studioSandboxFixture({ recreate: true });
  const files = await fixture
    .load('lib/studio/sandbox.ts')
    .studioDeploymentFiles({
      archive: fixture.archive,
      content: fixture.content,
    });
  assert.equal(
    files.find((file) => file.file === 'app/page.tsx').data.toString(),
    fixture.sources['app/page.tsx'],
  );
  assert.deepEqual(
    JSON.parse(
      files.find((file) => file.file === 'content/values.json').data.toString(),
    ),
    fixture.content,
  );
});
