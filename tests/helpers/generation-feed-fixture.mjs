import assert from 'node:assert/strict';
import { loadModule } from './load-module.mjs';

/** Feed e estado reais; só as leituras persistidas são substituídas. */
export async function generationFeedFixture({
  brief = {},
  messages = [],
  recent = null,
} = {}) {
  const tenant = {
    id: 'fixture-feed',
    slug: 'stream-fixture',
    name: 'Fixture',
    brand: {},
    brief,
    dials: { variance: 5, density: 5, motion: 2 },
    imageGuide: {},
    whatsapp: null,
  };
  const history = await loadModule('lib/ai/history.ts');
  const { GET } = await loadModule(
    'app/api/admin/[tenant]/generation/route.ts',
    {
      '@/lib/auth': { isAuthenticated: async () => true },
      '@/lib/tenant-queries': {
        getTenantBySlug: async () => tenant,
        listPages: async () => [],
      },
      '@/lib/images/queries': { listImages: async () => [] },
      '@/lib/ai/history': {
        ...history,
        hasChatHistory: async (id) => {
          assert.equal(id, tenant.id);
          return messages.length > 0;
        },
        messagesAfter: async (id, after) => {
          assert.equal(id, tenant.id);
          return messages
            .filter((message) => Number(message.id.slice(6)) > after)
            .slice(0, 60);
        },
      },
      '@/lib/generation/runs': {
        latestRun: async () => recent,
        activeRun: async () => null,
        expireStaleRun: async (run) => run,
        listEvents: async () => [],
      },
      '@/lib/generation/start': {
        startGeneration: async () => assert.fail('A leitura não gera'),
      },
    },
  );
  return {
    read: async (after = 0) => {
      const response = await GET(
        new Request(`https://fixture.test/generation?after=${after}`),
        { params: Promise.resolve({ tenant: tenant.slug }) },
      );
      assert.equal(response.status, 200);
      return response.json();
    },
  };
}
