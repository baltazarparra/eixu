import assert from 'node:assert/strict';
import test from 'node:test';
import { loadModuleGraph } from './helpers/load-module.mjs';

for (const scenario of ['propagates', 'foreign-redirect', 'never-propagates'])
  void test(`smoke protegido com ${scenario} mantém segredo e revoga ao concluir`, async () => {
    const requests = [];
    const bypassUpdates = [];
    const mutations = [];
    const waits = [];
    let markerRequests = 0;
    const sql = async (strings) => {
      const query = strings.join('?');
      if (query.includes('select contract'))
        return [{ contract: { pages: [{ slug: '' }] } }];
      mutations.push(query);
      return [];
    };
    sql.query = async () => [
      {
        id: 'release',
        project_id: 'project',
        tenant_id: 'tenant',
        slug: 'fixture',
        canonical_host: 'fixture.eixu.com.br',
        deployment_id: 'dpl_fixture',
        deployment_url: 'https://fixture.vercel.app',
        vercel_project_id: 'prj_fixture',
        vercel_project_name: 'eixu-site-fixture',
        content_revision_id: 'content',
        status: 'validating',
      },
    ];
    const { verifyStudioDeployment } = loadModuleGraph(
      'lib/studio/releases.ts',
      {
        '@/lib/db': { db: () => sql },
        './checkpoint-storage': {},
        './sandbox': {},
      },
      {
        process: {
          env: {
            EIXU_VERCEL_TOKEN: 'fixture',
            EIXU_VERCEL_TEAM_ID: 'team_fixture',
            EIXU_VERCEL_ROOT_PROJECT_ID: 'prj_root',
          },
        },
        setTimeout: (fn, ms) => {
          waits.push(ms);
          fn();
        },
        fetch: async (url, options) => {
          const target = new URL(url);
          if (target.origin === 'https://api.vercel.com') {
            if (target.pathname.endsWith('/protection-bypass')) {
              const body = JSON.parse(options.body);
              bypassUpdates.push(body);
              return Response.json({
                protectionBypass: body.generate
                  ? { [body.generate.secret]: { scope: 'automation-bypass' } }
                  : {},
              });
            }
            return Response.json({
              id: 'prj_fixture',
              name: 'eixu-site-fixture',
              ssoProtection: { deploymentType: 'preview' },
            });
          }
          requests.push({
            url: target.href,
            headers: new Headers(options.headers),
            redirect: options.redirect,
          });
          assert.equal(
            target.origin,
            'https://fixture.vercel.app',
            'Credenciais não podem sair do deployment.',
          );
          if (target.pathname === '/.well-known/eixu-release.json') {
            markerRequests++;
            if (scenario === 'foreign-redirect')
              return new Response(null, {
                status: 302,
                headers: { location: 'https://untrusted.example/capture' },
              });
            if (scenario === 'never-propagates' || markerRequests <= 2)
              return new Response('Authentication Required', {
                status: 302,
                headers: { location: 'https://vercel.com/sso-api' },
              });
            return Response.json({ releaseId: 'release' });
          }
          return new Response('<html><h1>Fixture</h1></html>', {
            headers: { 'content-type': 'text/html' },
          });
        },
      },
    );
    if (scenario === 'propagates') {
      await verifyStudioDeployment('release');
      assert.equal(markerRequests, 3);
      assert.equal(waits.length, 2);
      assert.ok(mutations.some((query) => query.includes("status = 'ready'")));
      assert.equal(requests.at(-1).url, 'https://fixture.vercel.app/');
    } else {
      await assert.rejects(
        verifyStudioDeployment('release'),
        /redirect para outra origem/,
      );
      assert.equal(markerRequests, scenario === 'never-propagates' ? 10 : 1);
      assert.equal(waits.length, scenario === 'never-propagates' ? 9 : 0);
      assert.equal(mutations.length, 0);
    }
    assert.equal(bypassUpdates.length, 2);
    const secret = bypassUpdates[0].generate.secret;
    assert.equal(bypassUpdates[1].revoke.secret, secret);
    assert.ok(
      requests.every(
        (request) =>
          request.headers.get('x-vercel-protection-bypass') === secret &&
          request.redirect === 'manual',
      ),
    );
  });
