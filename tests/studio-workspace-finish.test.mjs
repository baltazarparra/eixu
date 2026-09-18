import assert from 'node:assert/strict';
import test from 'node:test';
import { loadModuleGraph } from './helpers/load-module.mjs';

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
