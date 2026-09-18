import { createHash } from 'node:crypto';
import {
  STUDIO_SCAFFOLD_FILES,
  studioScaffoldContent,
} from '../../lib/studio/scaffold.ts';
import { loadModuleGraph } from './load-module.mjs';

export const workspace = '/vercel/sandbox/project';
export const fixtureEnv = {
  BLOB_READ_WRITE_TOKEN: 'vercel_blob_rw_public_fixture',
  STUDIO_BLOB_READ_WRITE_TOKEN: 'vercel_blob_rw_private_fixture',
};

/** Só os serviços são simulados: checkpoint, restauração, paths e comandos são reais. */
export function studioSandboxFixture({
  recreate = false,
  installFailure = false,
  corruptArchive = false,
} = {}) {
  const sources = Object.fromEntries(
    STUDIO_SCAFFOLD_FILES.map((file) => [
      file.path,
      studioScaffoldContent(file.path, 'fixture'),
    ]),
  );
  sources['package-lock.json'] = '{"lockfileVersion":3}';
  const archive = Buffer.from(JSON.stringify(sources));
  const codeRevision = createHash('sha256').update(archive).digest('hex');
  const files = new Map(
    Object.entries(recreate ? {} : sources).map(([path, content]) => [
      `${workspace}/${path}`,
      Buffer.from(content),
    ]),
  );
  const calls = [];
  const events = [];
  const mutations = [];
  const blobCalls = [];
  const content = { 'status.title': 'Conteúdo da revisão solicitada' };
  let previewSession;
  let serverRunning = false;
  let created = !recreate;
  const result = (stdout = '', exitCode = 0, stderr = '') => ({
    exitCode,
    stdout: async () => stdout,
    stderr: async () => stderr,
    durationMs: 1,
  });
  const sourcePaths = () =>
    [...files.keys()].filter(
      (path) =>
        path.startsWith(`${workspace}/`) &&
        !/\/(node_modules|\.next|\.git)\//.test(path),
    );
  const sandbox = {
    async mkDir() {},
    async readFileToBuffer({ path }) {
      return files.get(path) ?? null;
    },
    async writeFiles(items) {
      for (const item of items) files.set(item.path, Buffer.from(item.content));
    },
    domain: () => 'https://fixture.sandbox.example',
    async runCommand(command, args) {
      const input =
        typeof command === 'object' ? command : { cmd: command, args };
      calls.push(input);
      if (input.cmd === 'realpath') return result(input.args.at(-1));
      if (input.cmd === 'pkill') {
        serverRunning = false;
        return result();
      }
      if (input.cmd === 'find') {
        if (input.args.includes('-exec')) {
          for (const path of files.keys())
            if (
              path.startsWith(`${workspace}/`) &&
              !path.startsWith(`${workspace}/node_modules/`)
            )
              files.delete(path);
          return result();
        }
        return result(
          input.args.includes('-quit')
            ? ''
            : sourcePaths()
                .map((path) => path.slice(workspace.length + 1))
                .sort()
                .join('\n'),
        );
      }
      if (input.cmd === 'tar') {
        const path = input.args[1];
        if (input.args[0] === '-xzf') {
          const contents = JSON.parse(files.get(path).toString());
          for (const [name, value] of Object.entries(contents))
            files.set(`${workspace}/${name}`, Buffer.from(value));
        } else {
          files.set(
            path,
            Buffer.from(
              JSON.stringify(
                Object.fromEntries(
                  sourcePaths()
                    .sort()
                    .map((name) => [
                      name.slice(workspace.length + 1),
                      files.get(name).toString(),
                    ]),
                ),
              ),
            ),
          );
        }
        return result();
      }
      if (input.cmd === 'test')
        return result('', files.has(input.args.at(-1)) ? 0 : 1);
      if (input.cmd === 'npm') {
        if (['ci', 'install'].includes(input.args[0])) {
          if (installFailure) return result('', 1, 'Instalação indisponível');
          files.set(
            `${workspace}/package-lock.json`,
            Buffer.from(sources['package-lock.json']),
          );
          for (const name of ['next', 'tsc'])
            files.set(
              `${workspace}/node_modules/.bin/${name}`,
              Buffer.from('binary'),
            );
        } else {
          if (!files.has(`${workspace}/node_modules/.bin/next`))
            return result('', 127, 'next: command not found');
          if (input.args.includes('dev')) serverRunning = true;
        }
        return result('ok');
      }
      if (input.cmd === 'curl')
        return serverRunning
          ? result('HTTP/1.1 200 OK\r\nx-eixu-preview-gate: authorized\r\n')
          : result('', 7);
      throw new Error(`Comando inesperado no fixture: ${input.cmd}`);
    },
  };
  const sql = async (parts, ...values) => {
    const query = parts.join('?');
    if (query.includes('select project.draft_code_revision'))
      return [
        {
          kind: 'build',
          mutated: true,
          has_context: true,
          has_art_direction: true,
          draft_code_revision: null,
          checkpoint_code_revision: null,
        },
      ];
    if (query.includes('select slug, canonical_host'))
      return [{ slug: 'fixture', canonical_host: 'fixture.eixu.com.br' }];
    if (query.includes('select project.slug'))
      return [
        {
          slug: 'fixture',
          draft_code_revision: codeRevision,
          storage_key: 'studio/project/code/archive.tar.gz',
          content,
        },
      ];
    if (query.includes('select artifact.storage_key, revision.content'))
      return [{ storage_key: 'studio/project/code/archive.tar.gz', content }];
    if (query.includes('insert into studio_preview_sessions')) {
      previewSession = values;
      return [];
    }
    if (query.includes('select 1 from studio_preview_sessions')) return [];
    throw new Error(`SQL inesperado no fixture: ${query}`);
  };
  const mocks = {
    '@/lib/db': {
      db: () => sql,
      transaction: async (run) =>
        run({
          query: async (query, values) => {
            mutations.push({ query, values });
            if (query.includes('as revision'))
              return { rows: [{ revision: 1 }] };
            if (query.includes('as version')) return { rows: [{ version: 1 }] };
            return {
              rows: [
                {
                  id: query.includes('studio_content_revisions')
                    ? 'content-new'
                    : 'project',
                },
              ],
            };
          },
        }),
    },
    '@vercel/sandbox': {
      Sandbox: {
        getOrCreate: async (options) => {
          if (!created) {
            await options.onCreate(sandbox);
            created = true;
          }
          return sandbox;
        },
      },
    },
    '@vercel/blob': {
      get: async (path, options) => {
        blobCalls.push({ type: 'get', path, options });
        return {
          statusCode: 200,
          stream: new Response(corruptArchive ? 'corrupt' : archive).body,
        };
      },
      put: async (path, data, options) => {
        blobCalls.push({ type: 'put', path, data, options });
        return { pathname: path };
      },
    },
    './tool-lease': { withStudioToolLease: async ({ run }) => run() },
    './runs': {
      nextStudioEvent: async (_id, type, data) => events.push({ type, data }),
    },
  };
  return {
    files,
    calls,
    events,
    mutations,
    blobCalls,
    codeRevision,
    content,
    sources,
    previewSession: () => previewSession,
    load: (path) =>
      loadModuleGraph(path, mocks, {
        process: { env: fixtureEnv },
        setTimeout: (fn) => setTimeout(() => fn(), 0),
      }),
  };
}
