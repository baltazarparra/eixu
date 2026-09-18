import assert from 'node:assert/strict';
import test from 'node:test';
import { loadModuleGraph } from './helpers/load-module.mjs';

void test('prévia usa as revisões lidas sob o lock e recusa run ativo', async () => {
  let active = false;
  let locked = false;
  const previews = [];
  const rows = {
    id: 'project',
    tenant_id: 'tenant',
    slug: 'fixture',
    status: 'ready',
    sandbox_name: 'sandbox',
    draft_code_revision: 'new-code',
    active_content_revision_id: 'new-content',
  };
  const { POST } = loadModuleGraph(
    'app/api/admin/[tenant]/studio/preview/route.ts',
    {
      '@/lib/auth': { currentUser: async () => ({ id: 'operator' }) },
      '@/lib/tenant-queries': {
        getTenantBySlug: async () => ({ id: 'tenant' }),
      },
      '@/lib/sites-maintenance': { sitesWriteGuard: async () => null },
      '@/lib/studio/releases': { hasStudioDraftChanges: async () => true },
      '@/lib/studio/sandbox': {
        ensureStudioPreview: async (input) => {
          assert.equal(locked, true);
          previews.push(input);
          return 'https://fixture.sandbox.example';
        },
      },
      '@/lib/db': {
        db: () => async () => [
          {
            ...rows,
            draft_code_revision: 'old-code',
            active_content_revision_id: 'old-content',
          },
        ],
        transaction: async (run) => {
          locked = true;
          try {
            return await run({
              query: async (query) => ({
                rows: query.includes('studio_runs')
                  ? active
                    ? [{ id: 'run' }]
                    : []
                  : [rows],
              }),
            });
          } finally {
            locked = false;
          }
        },
      },
    },
  );
  const request = () =>
    POST(new Request('https://eixu.com.br/api/preview', { method: 'POST' }), {
      params: Promise.resolve({ tenant: 'fixture' }),
    });
  const response = await request();
  assert.equal(response.status, 200);
  assert.equal(previews[0].codeRevision, 'new-code');
  assert.equal(previews[0].contentRevisionId, 'new-content');
  assert.equal((await response.json()).codeRevision, 'new-code');
  active = true;
  assert.equal((await request()).status, 409);
  assert.equal(previews.length, 1);
});
