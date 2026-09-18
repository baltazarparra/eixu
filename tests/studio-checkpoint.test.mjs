import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import {
  studioSandboxFixture,
  workspace,
  fixtureEnv,
} from './helpers/studio-sandbox.mjs';

const input = {
  runId: 'run',
  projectId: 'project',
  sandboxName: 'fixture',
  userId: 'user',
  workflowRunId: 'workflow',
};

for (const command of ['typecheck', 'build'])
  void test(`checkpoint devolve falha de ${command} sem salvar ou repetir código inválido`, async () => {
    const fixture = studioSandboxFixture({ checkFailure: command });
    const outcome = await fixture
      .load('lib/studio/checkpoint.ts')
      .checkpointStudioProject(input);
    assert.equal(outcome.ok, false);
    assert.equal(outcome.command, command);
    assert.match(outcome.error, /Event handlers cannot be passed/);
    assert.equal(fixture.blobCalls.length, 0);
    assert.equal(fixture.mutations.length, 0);
    assert.equal(
      fixture.calls.filter(
        (call) => call.cmd === 'npm' && call.args[1] === command,
      ).length,
      1,
    );
  });

for (const operation of ['command:build', 'checkpoint'])
  void test(`prévia de trabalho não reinicia o servidor durante ${operation}`, async () => {
    const fixture = studioSandboxFixture({ activeOperation: operation });
    await assert.rejects(
      fixture.load('lib/studio/sandbox.ts').ensureStudioWorkingPreview({
        name: 'fixture',
        projectId: 'project',
        runId: 'run',
        contentRevisionId: null,
        userId: 'user',
      }),
      /pausada enquanto/,
    );
    assert.equal(fixture.calls.length, 0);
    assert.equal(fixture.previewSession(), undefined);
  });

void test('checkpoint completo aceita .gitignore original, valida e persiste artefato privado', async () => {
  const fixture = studioSandboxFixture();
  const { checkpointStudioProject } = fixture.load('lib/studio/checkpoint.ts');
  const saved = await checkpointStudioProject(input);
  const blob = fixture.blobCalls.find((call) => call.type === 'put');
  assert.ok(blob);
  assert.equal(blob.options.token, undefined);
  assert.equal(blob.options.storeId, 'private');
  assert.equal(blob.options.oidcToken, fixtureEnv.VERCEL_OIDC_TOKEN);
  assert.equal(blob.options.access, 'private');
  assert.equal(
    saved.codeRevision,
    createHash('sha256').update(blob.data).digest('hex'),
  );
  assert.deepEqual(
    fixture.events.map((event) => event.type),
    [
      'command.finished',
      'command.finished',
      'command.finished',
      'checkpoint.saved',
    ],
  );
  assert.equal(
    fixture.calls.filter((call) => call.cmd === 'npm' && call.args[0] === 'ci')
      .length,
    1,
  );
  assert.ok(
    fixture.mutations.some(({ query }) =>
      query.includes('draft_code_revision = $2'),
    ),
  );
});

void test('checkpoint ainda recusa alteração do .gitignore reservado', async () => {
  const fixture = studioSandboxFixture();
  fixture.files.set(`${workspace}/.gitignore`, Buffer.from('alterado'));
  await assert.rejects(
    fixture.load('lib/studio/checkpoint.ts').checkpointStudioProject(input),
    /arquivo reservado \.gitignore/,
  );
  assert.equal(fixture.blobCalls.length, 0);
  assert.equal(fixture.mutations.length, 0);
  await assert.rejects(
    fixture
      .load('lib/studio/sandbox.ts')
      .writeStudioFile('fixture', '.gitignore', 'alterado'),
    /reservado/,
  );
});

void test('restauração de checkpoint com lockfile prepara dependências antes do build', async () => {
  const fixture = studioSandboxFixture({ recreate: true });
  const subject = fixture.load('lib/studio/sandbox.ts');
  await subject.studioSandbox('fixture');
  const result = await subject.runStudioCommand('fixture', 'build');
  assert.equal(result.exitCode, 0);
  assert.deepEqual(
    fixture.calls
      .filter((call) => call.cmd === 'npm')
      .map((call) => call.args.slice(0, 2)),
    [
      ['ci', '--ignore-scripts'],
      ['run', 'build'],
    ],
  );
  assert.equal(
    JSON.parse(
      fixture.files.get(`${workspace}/content/values.json`).toString(),
    )['status.title'],
    fixture.content['status.title'],
  );
});

void test('prévia elimina código de turno falho e serve o checkpoint e conteúdo pedidos', async () => {
  const fixture = studioSandboxFixture();
  fixture.files.set(
    `${workspace}/app/page.tsx`,
    Buffer.from('edição sem validação'),
  );
  fixture.files.set(
    `${workspace}/app/rota-falha/page.tsx`,
    Buffer.from('arquivo extra'),
  );
  const url = await fixture.load('lib/studio/sandbox.ts').ensureStudioPreview({
    name: 'fixture',
    projectId: 'project',
    codeRevision: fixture.codeRevision,
    contentRevisionId: 'content-A',
    userId: 'user',
  });
  assert.equal(
    fixture.files.get(`${workspace}/app/page.tsx`).toString(),
    fixture.sources['app/page.tsx'],
  );
  assert.equal(
    fixture.files.has(`${workspace}/app/rota-falha/page.tsx`),
    false,
  );
  assert.equal(fixture.previewSession()[2], fixture.codeRevision);
  assert.equal(fixture.previewSession()[3], 'content-A');
  assert.equal(
    JSON.parse(
      fixture.files.get(`${workspace}/content/values.json`).toString(),
    )['status.title'],
    fixture.content['status.title'],
  );
  assert.match(url, /__eixu_preview=/);
  assert.equal(new URL(fixture.previewSession()[4]).search, '');
});

for (const [options, expected] of [
  [{ corruptArchive: true }, /checkpoint não corresponde/],
  [{ installFailure: true }, /instalação do checkpoint falhou/],
])
  void test(`prévia não anuncia sessão quando ${Object.keys(options)[0]}`, async () => {
    const fixture = studioSandboxFixture(options);
    await assert.rejects(
      fixture.load('lib/studio/sandbox.ts').ensureStudioPreview({
        name: 'fixture',
        projectId: 'project',
        codeRevision: fixture.codeRevision,
        contentRevisionId: 'content-A',
        userId: 'user',
      }),
      expected,
    );
    assert.equal(fixture.previewSession(), undefined);
    assert.equal(
      fixture.calls.some(
        (call) => call.cmd === 'npm' && call.args.includes('dev'),
      ),
      false,
    );
  });
