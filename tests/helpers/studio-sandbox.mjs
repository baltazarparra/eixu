import { createHash } from 'node:crypto';
import { posix } from 'node:path';
import {
  STUDIO_SCAFFOLD_FILES,
  studioScaffoldContent,
} from '../../lib/studio/scaffold.ts';
import { loadModuleGraph } from './load-module.mjs';

export const workspace = '/vercel/sandbox/project';
export const fixtureEnv = {
  BLOB_READ_WRITE_TOKEN: 'vercel_blob_rw_public_fixture',
  STUDIO_BLOB_STORE_ID: 'store_private',
  VERCEL_OIDC_TOKEN: 'oidc_private_fixture',
};

/** Só os serviços são simulados: checkpoint, restauração, paths e comandos são reais. */
export function studioSandboxFixture({
  recreate = false,
  missingWorkspace = false,
  firstBuild = false,
  directoryFailure = false,
  installFailure = false,
  corruptArchive = false,
  checkFailure,
  activeOperation,
  previewStatus = 200,
  previewAuthorized = true,
  previewContentType = 'text/html; charset=utf-8',
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
    Object.entries(recreate || missingWorkspace ? {} : sources).map(
      ([path, content]) => [`${workspace}/${path}`, Buffer.from(content)],
    ),
  );
  // A imagem universal começa em /vercel, sem /vercel/sandbox.
  const directories = new Set(['/', '/vercel', '/tmp']);
  const addDirectories = (path) => {
    for (let current = path; current !== '/'; current = posix.dirname(current))
      directories.add(current);
  };
  for (const path of files.keys()) addDirectories(posix.dirname(path));
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
    async mkDir(path) {
      if (!directories.has(posix.dirname(path)))
        throw new Error('error creating directory: No such file or directory');
      directories.add(path);
    },
    async readFileToBuffer({ path }) {
      return files.get(path) ?? null;
    },
    async writeFiles(items) {
      for (const item of items) {
        addDirectories(posix.dirname(item.path));
        files.set(item.path, Buffer.from(item.content));
      }
    },
    async delete() {},
    domain: () => 'https://fixture.sandbox.example',
    async runCommand(command, args) {
      const input =
        typeof command === 'object' ? command : { cmd: command, args };
      calls.push(input);
      if (input.cmd === 'mkdir') {
        if (directoryFailure) return result('', 1, 'Permission denied');
        addDirectories(input.args.at(-1));
        return result();
      }
      if (input.cmd === 'realpath') return result(input.args.at(-1));
      if (input.cmd === 'pkill') {
        serverRunning = false;
        return result();
      }
      if (input.cmd === 'rm') {
        for (const path of files.keys())
          if (path.startsWith(`${workspace}/.next`)) files.delete(path);
        return result();
      }
      if (input.cmd === 'find') {
        if (!directories.has(input.args[0]))
          return result('', 1, 'No such file or directory');
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
          for (const [name, value] of Object.entries(contents)) {
            addDirectories(posix.dirname(`${workspace}/${name}`));
            files.set(`${workspace}/${name}`, Buffer.from(value));
          }
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
      if (input.cmd === 'test') {
        const paths = input.args.filter((_, index) =>
          ['-f', '-x'].includes(input.args[index - 1]),
        );
        return result('', paths.every((path) => files.has(path)) ? 0 : 1);
      }
      if (input.cmd === 'npm') {
        if (input.args[0] === 'run' && input.args[1] === checkFailure)
          return result(
            '',
            1,
            'Event handlers cannot be passed to Client Component props.',
          );
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
      if (
        input.cmd === 'node' &&
        input.args[0] === '/tmp/eixu-preview-server.cjs'
      ) {
        if (!files.has(`${workspace}/node_modules/.bin/next`))
          return result('', 127, 'next: command not found');
        serverRunning = true;
        return result('ok');
      }
      if (input.cmd === 'curl') {
        if (!serverRunning) return result('', 7);
        // O proxy troca query por cookie antes de renderizar o documento: esse
        // redirect funciona mesmo quando a página real tem erro de execução.
        const status = input.args.at(-1).includes('?__eixu_preview=')
          ? 307
          : previewStatus;
        const authorized =
          input.args.at(-1).includes('?__eixu_preview=') ||
          (previewAuthorized &&
            input.args.some((arg) =>
              arg.startsWith('Cookie: __eixu_preview='),
            ));
        return result(
          `HTTP/1.1 ${status}\r\ncontent-type: ${previewContentType}\r\n${authorized ? 'x-eixu-preview-gate: authorized\r\n' : ''}`,
          status >= 400 ? 22 : 0,
        );
      }
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
          draft_code_revision: firstBuild ? null : codeRevision,
          storage_key: 'studio/project/code/archive.tar.gz',
          content,
        },
      ];
    if (query.includes('select artifact.storage_key, revision.content'))
      return [{ storage_key: 'studio/project/code/archive.tar.gz', content }];
    if (query.includes('select revision.content'))
      return firstBuild ? [] : [{ content }];
    if (query.includes('insert into studio_preview_sessions')) {
      previewSession = values;
      return [];
    }
    if (query.includes('select 1 from studio_preview_sessions')) return [];
    if (query.includes('select operation from studio_tool_leases'))
      return activeOperation ? [{ operation: activeOperation }] : [];
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
            created = true;
            await options.onCreate?.(sandbox);
          }
          return sandbox;
        },
        create: async () => sandbox,
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
    '@vercel/oidc': {
      getVercelOidcToken: async () => fixtureEnv.VERCEL_OIDC_TOKEN,
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
    archive,
    previewSession: () => previewSession,
    load: (path) =>
      loadModuleGraph(path, mocks, {
        process: { env: fixtureEnv },
        setTimeout: (fn) => setTimeout(() => fn(), 0),
      }),
  };
}
