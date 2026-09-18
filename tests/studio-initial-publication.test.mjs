import assert from 'node:assert/strict';
import test from 'node:test';
import { loadModuleGraph } from './helpers/load-module.mjs';

const { shouldAutoPublishInitialProject } = loadModuleGraph(
  'lib/studio/initial-publication.ts',
);

void test('publicação automática só vale para o primeiro build canônico', () => {
  const firstBuild = {
    requested: true,
    role: 'build',
    draftCodeRevision: null,
    historyLength: 0,
  };
  assert.equal(shouldAutoPublishInitialProject(firstBuild), true);

  for (const change of [
    { requested: false },
    { role: 'edit' },
    { draftCodeRevision: 'sha256:rascunho' },
    { historyLength: 1 },
  ])
    assert.equal(
      shouldAutoPublishInitialProject({ ...firstBuild, ...change }),
      false,
    );
});
