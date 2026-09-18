import assert from 'node:assert/strict';
import test from 'node:test';
import { loadModuleGraph } from './helpers/load-module.mjs';

for (const outcome of ['isError', 'isAbort'])
  void test(`prévia atrasada não volta ao iframe depois de ${outcome}`, async () => {
    const state = [];
    let cursor = 0;
    let finish;
    let resolvePreview;
    const pendingPreview = new Promise((resolve) => {
      resolvePreview = resolve;
    });
    const { StudioWorkspace } = loadModuleGraph(
      'app/(admin)/admin/[tenant]/studio-workspace.tsx',
      {
        react: {
          useCallback: (fn) => fn,
          useMemo: (fn) => fn(),
          useEffect: () => {},
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
        '@ai-sdk/react': {
          useChat: (options) => {
            finish = options.onFinish;
            return { messages: [], status: 'ready' };
          },
        },
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
          chatErrorMessage: (value) => value,
        },
        '@/lib/admin/http': {
          AdminHttpError: class extends Error {},
          adminFetch: () => pendingPreview,
        },
      },
    );
    const render = () => {
      cursor = 0;
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
        initialRelease: null,
        rollbackCandidate: null,
        images: [],
      });
    };
    function elements(node) {
      if (Array.isArray(node)) return node.flatMap(elements);
      if (!node || typeof node !== 'object') return [];
      return [node, ...elements(node.props?.children)];
    }
    const before = elements(render());
    before
      .find((element) => element.props?.['aria-label'] === 'Recarregar prévia')
      .props.onClick();
    finish({
      isAbort: false,
      isDisconnect: false,
      isError: false,
      [outcome]: true,
    });
    resolvePreview({
      url: 'https://closed.sandbox.example',
      status: 'building',
      dirty: true,
    });
    await new Promise((resolve) => setImmediate(resolve));
    const after = elements(render());
    assert.equal(
      after.some((element) => element.type === 'iframe'),
      false,
    );
    assert.equal(
      after.some(
        (element) =>
          element.type === 'a' &&
          element.props?.href === 'https://closed.sandbox.example',
      ),
      false,
    );
    assert.ok(
      after.some(
        (element) =>
          element.type === 'strong' &&
          element.props.children === 'Prévia indisponível',
      ),
    );
  });

for (const outcome of ['isError', 'isAbort', 'isDisconnect', 'success'])
  void test(`conclusão ${outcome} só solicita prévia depois de sucesso`, async () => {
    let finish;
    let refreshed = 0;
    const requests = [];
    const { StudioWorkspace } = loadModuleGraph(
      'app/(admin)/admin/[tenant]/studio-workspace.tsx',
      {
        react: {
          useCallback: (fn) => fn,
          useMemo: (fn) => fn(),
          useEffect: () => {},
          useRef: (current) => ({ current }),
          useState: (value) => [value, () => {}],
        },
        '@ai-sdk/react': {
          useChat: (options) => {
            finish = options.onFinish;
            return { messages: [], status: 'ready' };
          },
        },
        '@ai-sdk/workflow/client': { WorkflowChatTransport: class {} },
        '@/components/admin/navigation': {
          WorkspaceHeader: () => null,
          useRefreshTenant: () => () => {
            refreshed++;
          },
        },
        '@/components/admin/use-compact-layout': {
          useCompactLayout: () => false,
        },
        './chat-parts': {
          ChatActivity: () => null,
          Message: () => null,
          chatErrorMessage: (value) => value,
        },
        '@/lib/admin/http': {
          AdminHttpError: class extends Error {},
          adminFetch: async (url) => {
            requests.push(url);
            return {
              images: [],
              editor: null,
              status: 'ready',
              url: 'https://preview.example',
            };
          },
        },
      },
    );
    StudioWorkspace({
      tenant: { slug: 'fixture', name: 'Fixture', status: 'draft' },
      initialMessages: [],
      initialEditor: null,
      initialRun: null,
      initialProject: null,
      initialRelease: null,
      rollbackCandidate: null,
      images: [],
    });
    finish({
      isError: false,
      isAbort: false,
      isDisconnect: false,
      [outcome]: true,
    });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(
      requests.some((url) => url.endsWith('/studio/preview')),
      outcome === 'success',
    );
    assert.equal(refreshed, 1);
  });
