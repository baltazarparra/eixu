import assert from 'node:assert/strict';
import test from 'node:test';
import { loadModuleGraph } from './helpers/load-module.mjs';

function elements(node) {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!node || typeof node !== 'object') return [];
  return [node, ...elements(node.props?.children)];
}

function workspaceFixture({ publicationError } = {}) {
  const state = [];
  let cursor = 0;
  let previewFails = !publicationError;
  const effects = [];
  const timers = [];
  const { StudioWorkspace } = loadModuleGraph(
    'app/(admin)/admin/[tenant]/studio-workspace.tsx',
    {
      react: {
        useCallback: (fn) => fn,
        useMemo: (fn) => fn(),
        useEffect: (fn) => effects.push(fn),
        useRef: (current) => {
          const slot = cursor++;
          state[slot] ??= { current };
          return state[slot];
        },
        useState: (initial) => {
          const slot = cursor++;
          if (!(slot in state))
            state[slot] = typeof initial === 'function' ? initial() : initial;
          return [
            state[slot],
            (value) => {
              state[slot] =
                typeof value === 'function' ? value(state[slot]) : value;
            },
          ];
        },
      },
      '@ai-sdk/react': { useChat: () => ({ messages: [], status: 'ready' }) },
      '@ai-sdk/workflow/client': { WorkflowChatTransport: class {} },
      '@/components/admin/navigation': {
        WorkspaceHeader: () => null,
        useRefreshTenant: () => () => {},
      },
      '@/components/admin/use-compact-layout': {
        useCompactLayout: () => false,
      },
      './chat-parts': {
        ChatActivity: () => null,
        Message: () => null,
        chatErrorMessage: () => assert.fail('Uma operação não é uma geração.'),
      },
      '@/lib/admin/http': {
        AdminHttpError: class extends Error {},
        adminFetch: async (url) => {
          if (url.includes('/studio/preview')) {
            if (previewFails)
              throw new Error('Step "preview" failed after 3 retries');
            return {
              url: 'https://preview.example',
              status: 'ready',
              dirty: true,
            };
          }
          assert.match(url, /\/studio\/publish/);
          return {
            release: {
              id: 'release',
              status: 'failed',
              error: publicationError,
            },
            dirty: true,
            rollbackCandidate: null,
          };
        },
      },
    },
    { window: { setTimeout: (fn) => timers.push(fn), clearTimeout: () => {} } },
  );
  const render = () => {
    cursor = 0;
    effects.length = 0;
    return StudioWorkspace({
      tenant: { slug: 'fixture', name: 'Fixture', status: 'draft' },
      initialMessages: [],
      initialEditor: null,
      initialRun: null,
      initialProject: {
        status: 'ready',
        canonicalHost: 'fixture.example',
        draftCodeRevision: 'code',
        dirty: true,
      },
      initialRelease: publicationError
        ? { id: 'release', status: 'validating', url: null, error: null }
        : null,
      rollbackCandidate: null,
      images: [],
    });
  };
  const notice = () =>
    elements(render()).find(
      (element) => element.props?.className === 'admin-notice',
    )?.props.children[0].props.children;
  const settle = () => new Promise((resolve) => setImmediate(resolve));
  return {
    render,
    notice,
    async mount() {
      render();
      effects.forEach((effect) => effect());
      timers.splice(0).forEach((timer) => timer());
      await settle();
    },
    async recoverPreview() {
      previewFails = false;
      const tree = elements(render());
      tree
        .find(
          (element) => element.props?.['aria-label'] === 'Recarregar prévia',
        )
        .props.onClick();
      await settle();
    },
  };
}

void test('recuperar a prévia remove apenas o aviso de prévia', async () => {
  const workspace = workspaceFixture();
  await workspace.mount();
  assert.match(workspace.notice(), /prévia/);
  assert.doesNotMatch(workspace.notice(), /continuar a geração|Step|retries/);
  await workspace.recoverPreview();
  assert.equal(workspace.notice(), undefined);
  assert.ok(
    elements(workspace.render()).some((element) => element.type === 'iframe'),
  );
});

for (const publicationError of [
  'Step "step//./lib/studio/release-workflow//provisionStep" failed after 3 retries: VERCEL_ORG_ID não está disponível. Fora da Vercel, configure EIXU_VERCEL_TEAM_ID.',
  'Step "verifyCandidateStep" failed after 3 retries: smoke indisponível',
])
  void test(`falha de publicação é preservada ao recuperar a prévia: ${publicationError.includes('VERCEL_ORG_ID') ? 'configuração' : 'smoke'}`, async () => {
    const workspace = workspaceFixture({ publicationError });
    await workspace.mount();
    const notice = workspace.notice();
    assert.match(notice, /publica/);
    assert.match(notice, /rascunho/i);
    assert.doesNotMatch(
      notice,
      /continuar a geração|Step|retries|VERCEL_ORG_ID/,
    );
    if (publicationError.includes('VERCEL_ORG_ID'))
      assert.match(notice, /integração com a Vercel precisa ser configurada/);
    await workspace.recoverPreview();
    assert.equal(workspace.notice(), notice);
  });
