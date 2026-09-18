import { createHash, randomBytes } from 'node:crypto';
import { posix } from 'node:path';
import { Sandbox, type NetworkPolicy } from '@vercel/sandbox';
import { db } from '@/lib/db';
import { readStudioCheckpoint } from './checkpoint-storage';
import { STUDIO_SCAFFOLD_FILES, studioScaffoldContent } from './scaffold';
import { assertStudioPackageContract } from './package-contract.mjs';
import {
  isEditableStudioFile,
  isReadableStudioFile,
  STUDIO_WORKSPACE_ROOT,
  studioWorkspacePath,
} from './path-policy';

const NETWORK_POLICY: NetworkPolicy = {
  allow: [
    'registry.npmjs.org',
    '*.npmjs.org',
    'fonts.googleapis.com',
    'fonts.gstatic.com',
    '*.public.blob.vercel-storage.com',
    '*.blob.vercel-storage.com',
    'eixu.com.br',
    '*.eixu.com.br',
  ],
  subnets: {
    deny: [
      '0.0.0.0/8',
      '10.0.0.0/8',
      '100.64.0.0/10',
      '127.0.0.0/8',
      '169.254.0.0/16',
      '172.16.0.0/12',
      '192.0.0.0/24',
      '192.168.0.0/16',
      '198.18.0.0/15',
      '224.0.0.0/4',
    ],
  },
};

export type StudioCommand = 'install' | 'typecheck' | 'lint' | 'test' | 'build';

export type StudioCommandResult = {
  command: StudioCommand;
  exitCode: number;
  durationMs: number | null;
  stdout: string;
  stderr: string;
  truncated: boolean;
};

const COMMANDS: Record<
  StudioCommand,
  { command: string; args: string[]; timeoutMs: number }
> = {
  install: {
    command: 'npm',
    args: ['install', '--ignore-scripts', '--no-audit', '--no-fund'],
    timeoutMs: 300_000,
  },
  typecheck: {
    command: 'npm',
    args: ['run', 'typecheck', '--if-present'],
    timeoutMs: 180_000,
  },
  lint: {
    command: 'npm',
    args: ['run', 'lint', '--if-present'],
    timeoutMs: 180_000,
  },
  test: {
    command: 'npm',
    args: ['test', '--if-present'],
    timeoutMs: 180_000,
  },
  build: {
    command: 'npm',
    args: ['run', 'build'],
    timeoutMs: 300_000,
  },
};

const MAX_FILE_BYTES = 300_000;
const MAX_READ_BYTES = 220_000;
const MAX_OUTPUT_CHARS = 40_000;

function cap(text: string): { text: string; truncated: boolean } {
  if (text.length <= MAX_OUTPUT_CHARS) return { text, truncated: false };
  return {
    text: `${text.slice(0, MAX_OUTPUT_CHARS)}\n… saída truncada`,
    truncated: true,
  };
}

async function assertSandboxPath(
  sandbox: Sandbox,
  path: string,
): Promise<void> {
  const [resolved, root] = await Promise.all([
    sandbox.runCommand('realpath', ['-m', '--', path], { timeoutMs: 5_000 }),
    sandbox.runCommand('realpath', ['-m', '--', STUDIO_WORKSPACE_ROOT], {
      timeoutMs: 5_000,
    }),
  ]);
  if (resolved.exitCode !== 0 || root.exitCode !== 0)
    throw new Error('Não foi possível validar o caminho do projeto.');
  const real = (await resolved.stdout()).trim();
  const rootReal = (await root.stdout()).trim();
  const expected = posix.join(
    rootReal,
    posix.relative(STUDIO_WORKSPACE_ROOT, path),
  );
  if (real !== expected)
    throw new Error('Links simbólicos não são aceitos no projeto.');
}

async function assertNoStudioSymlinks(sandbox: Sandbox): Promise<void> {
  const scope = [
    STUDIO_WORKSPACE_ROOT,
    '(',
    '-path',
    `${STUDIO_WORKSPACE_ROOT}/node_modules`,
    '-o',
    '-path',
    `${STUDIO_WORKSPACE_ROOT}/.next`,
    '-o',
    '-path',
    `${STUDIO_WORKSPACE_ROOT}/.git`,
    '-o',
    '-path',
    `${STUDIO_WORKSPACE_ROOT}/.vercel`,
    ')',
    '-prune',
    '-o',
  ];
  const symlink = await sandbox.runCommand(
    'find',
    [...scope, '-type', 'l', '-print', '-quit'],
    { timeoutMs: 10_000 },
  );
  if (symlink.exitCode !== 0)
    throw new Error('Não foi possível validar os arquivos do projeto.');
  if ((await symlink.stdout()).trim())
    throw new Error('O projeto contém um link simbólico não permitido.');
  const special = await sandbox.runCommand(
    'find',
    [...scope, '!', '-type', 'f', '!', '-type', 'd', '-print', '-quit'],
    { timeoutMs: 10_000 },
  );
  if (special.exitCode !== 0 || (await special.stdout()).trim())
    throw new Error('O projeto contém um tipo de arquivo não permitido.');
  const hardlink = await sandbox.runCommand(
    'find',
    [...scope, '-type', 'f', '-links', '+1', '-print', '-quit'],
    { timeoutMs: 10_000 },
  );
  if (hardlink.exitCode !== 0 || (await hardlink.stdout()).trim())
    throw new Error('O projeto contém um hard link não permitido.');
}

async function assertStudioPackage(sandbox: Sandbox): Promise<void> {
  const path = posix.join(STUDIO_WORKSPACE_ROOT, 'package.json');
  await assertSandboxPath(sandbox, path);
  const buffer = await sandbox.readFileToBuffer({ path });
  if (!buffer || buffer.byteLength > MAX_READ_BYTES)
    throw new Error('package.json ausente ou grande demais.');
  let parsed: unknown;
  try {
    parsed = JSON.parse(buffer.toString('utf8'));
  } catch {
    throw new Error('package.json inválido.');
  }
  assertStudioPackageContract(parsed);
}

async function seedOrRestore(sandbox: Sandbox, name: string) {
  await sandbox.mkDir(STUDIO_WORKSPACE_ROOT);
  const rows = (await db()`
    select project.slug, project.draft_code_revision, artifact.storage_key,
           revision.content
    from studio_projects project
    left join studio_content_revisions revision
      on revision.id = project.active_content_revision_id
      and revision.project_id = project.id
    left join lateral (
      select storage_key
      from studio_artifacts
      where project_id = project.id
        and kind = 'code'
        and storage_key is not null
        and content_hash = project.draft_code_revision
      order by version desc limit 1
    ) artifact on true
    where project.sandbox_name = ${name}
    limit 1
  `) as {
    slug: string;
    draft_code_revision: string | null;
    storage_key: string | null;
    content: Record<string, string> | null;
  }[];
  const project = rows[0];
  if (!project) throw new Error('Projeto do Sandbox não encontrado.');
  const storageKey = project.storage_key;
  if (!project.draft_code_revision) {
    await sandbox.writeFiles(
      STUDIO_SCAFFOLD_FILES.map((file) => ({
        path: posix.join(STUDIO_WORKSPACE_ROOT, file.path),
        content: studioScaffoldContent(file.path, project.slug)!,
      })),
    );
    return;
  }
  if (!storageKey || !project.content)
    throw new Error('O checkpoint ou conteúdo ativo do projeto não existe.');
  await restoreStudioCheckpoint(sandbox, {
    storageKey,
    codeRevision: project.draft_code_revision,
    content: project.content,
  });
}

async function stopStudioPreview(sandbox: Sandbox) {
  await sandbox
    .runCommand('pkill', ['-f', 'next dev.*--port 3000'], { timeoutMs: 5_000 })
    .catch(() => undefined);
  await new Promise((resolve) => setTimeout(resolve, 200));
  await sandbox
    .runCommand('pkill', ['-KILL', '-f', 'next dev.*--port 3000'], {
      timeoutMs: 5_000,
    })
    .catch(() => undefined);
}

/** Descarta inclusive arquivos extras deixados por um turno que não passou nos gates. */
async function restoreStudioCheckpoint(
  sandbox: Sandbox,
  input: {
    storageKey: string;
    codeRevision: string;
    content: Record<string, string>;
  },
) {
  const archive = await readStudioCheckpoint(
    input.storageKey,
    input.codeRevision,
  );
  await stopStudioPreview(sandbox);
  const cleaned = await sandbox.runCommand(
    'find',
    [
      STUDIO_WORKSPACE_ROOT,
      '-mindepth',
      '1',
      '-maxdepth',
      '1',
      '!',
      '-name',
      'node_modules',
      '-exec',
      'rm',
      '-rf',
      '--',
      '{}',
      '+',
    ],
    { timeoutMs: 30_000 },
  );
  if (cleaned.exitCode !== 0)
    throw new Error('Não foi possível limpar o rascunho anterior.');
  const archivePath = '/tmp/eixu-checkpoint-restore.tar.gz';
  await sandbox.writeFiles([{ path: archivePath, content: archive }]);
  const restored = await sandbox.runCommand(
    'tar',
    ['-xzf', archivePath, '-C', STUDIO_WORKSPACE_ROOT],
    { timeoutMs: 90_000 },
  );
  if (restored.exitCode !== 0)
    throw new Error(
      `Não foi possível restaurar o projeto: ${await restored.stderr()}`,
    );
  await sandbox.writeFiles([
    {
      path: posix.join(STUDIO_WORKSPACE_ROOT, 'content/values.json'),
      content: `${JSON.stringify(input.content, null, 2)}\n`,
    },
  ]);
  const installed = await ensureSandboxDependencies(sandbox);
  if (installed && installed.exitCode !== 0)
    throw new Error(
      `A instalação do checkpoint falhou. ${installed.stderr}`.slice(0, 4_000),
    );
}

export async function studioSandbox(name: string): Promise<Sandbox> {
  return Sandbox.getOrCreate({
    name,
    image: 'vercel/sandbox/universal:latest',
    persistent: true,
    timeout: 45 * 60_000,
    ports: [3000],
    resources: { vcpus: 2 },
    networkPolicy: NETWORK_POLICY,
    tags: { product: 'eixu', surface: 'studio' },
    onCreate: (sandbox) => seedOrRestore(sandbox, name),
  });
}

export async function syncStudioContentToSandbox(name: string): Promise<void> {
  const sandbox = await studioSandbox(name);
  const contents = (await db()`
    select revision.content
    from studio_projects project
    join studio_content_revisions revision
      on revision.id = project.active_content_revision_id
    where project.sandbox_name = ${name}
    limit 1
  `) as { content: Record<string, string> }[];
  if (!contents[0]) return;
  await sandbox.writeFiles([
    {
      path: posix.join(STUDIO_WORKSPACE_ROOT, 'content/values.json'),
      content: `${JSON.stringify(contents[0].content, null, 2)}\n`,
    },
  ]);
}

/** Para build e ferramentas nunca dividirem `.next` com o dev server da prévia. */
export async function prepareStudioWorkspaceForRun(
  name: string,
): Promise<void> {
  const sandbox = await studioSandbox(name);
  await stopStudioPreview(sandbox);
  const cleaned = await sandbox.runCommand(
    'rm',
    ['-rf', posix.join(STUDIO_WORKSPACE_ROOT, '.next')],
    { timeoutMs: 10_000 },
  );
  if (cleaned.exitCode !== 0)
    throw new Error('Não foi possível limpar o build da prévia anterior.');
  await syncStudioContentToSandbox(name);
}

export async function listStudioFiles(name: string): Promise<string[]> {
  const sandbox = await studioSandbox(name);
  const result = await sandbox.runCommand(
    'find',
    [
      STUDIO_WORKSPACE_ROOT,
      '-type',
      'f',
      '-not',
      '-path',
      '*/node_modules/*',
      '-not',
      '-path',
      '*/.next/*',
      '-not',
      '-path',
      '*/.git/*',
      '-printf',
      '%P\n',
    ],
    { timeoutMs: 20_000 },
  );
  if (result.exitCode !== 0)
    throw new Error(
      `Não foi possível listar o projeto: ${await result.stderr()}`,
    );
  return (await result.stdout())
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .sort();
}

export async function readStudioFile(
  name: string,
  relativePath: string,
): Promise<string> {
  const path = studioWorkspacePath(relativePath);
  if (!isReadableStudioFile(relativePath))
    throw new Error('Este tipo de arquivo não pode ser lido pelo agente.');
  const sandbox = await studioSandbox(name);
  await assertSandboxPath(sandbox, path);
  const buffer = await sandbox.readFileToBuffer({ path });
  if (!buffer) throw new Error('Arquivo não encontrado.');
  if (buffer.byteLength > MAX_READ_BYTES)
    throw new Error('Arquivo grande demais para uma leitura pelo agente.');
  return buffer.toString('utf8');
}

export async function writeStudioFile(
  name: string,
  relativePath: string,
  content: string,
): Promise<{ path: string; bytes: number }> {
  if (!isEditableStudioFile(relativePath))
    throw new Error('Este tipo de arquivo não pode ser alterado pelo agente.');
  const path = studioWorkspacePath(relativePath);
  const bytes = Buffer.byteLength(content);
  if (bytes > MAX_FILE_BYTES)
    throw new Error(`Arquivo excede o limite de ${MAX_FILE_BYTES} bytes.`);
  const sandbox = await studioSandbox(name);
  await assertSandboxPath(sandbox, path);
  await sandbox.mkDir(posix.dirname(path));
  await sandbox.writeFiles([{ path, content }]);
  return { path: posix.relative(STUDIO_WORKSPACE_ROOT, path), bytes };
}

export async function runStudioCommand(
  name: string,
  commandName: StudioCommand,
): Promise<StudioCommandResult> {
  const sandbox = await studioSandbox(name);
  if (commandName === 'install') return installSandboxDependencies(sandbox);
  const installed = await ensureSandboxDependencies(sandbox);
  if (installed && installed.exitCode !== 0) return installed;
  return executeStudioCommand(sandbox, commandName, COMMANDS[commandName]);
}

async function executeStudioCommand(
  sandbox: Sandbox,
  commandName: StudioCommand,
  definition: { command: string; args: string[]; timeoutMs: number },
): Promise<StudioCommandResult> {
  await assertNoStudioSymlinks(sandbox);
  await assertStudioPackage(sandbox);
  const result = await sandbox.runCommand({
    cmd: definition.command,
    args: definition.args,
    cwd: STUDIO_WORKSPACE_ROOT,
    detached: false,
    env: {
      CI: '1',
      NEXT_TELEMETRY_DISABLED: '1',
    },
    signal: AbortSignal.timeout(definition.timeoutMs),
  });
  const [rawStdout, rawStderr] = await Promise.all([
    result.stdout(),
    result.stderr(),
  ]);
  const stdout = cap(rawStdout);
  const stderr = cap(rawStderr);
  return {
    command: commandName,
    exitCode: result.exitCode,
    durationMs: result.durationMs ?? null,
    stdout: stdout.text,
    stderr: stderr.text,
    truncated: stdout.truncated || stderr.truncated,
  };
}

const DEPENDENCIES_DIGEST_PATH = '/tmp/eixu-dependencies-sha256';

async function dependencyDigest(sandbox: Sandbox): Promise<string | null> {
  const [manifest, lockfile] = await Promise.all([
    sandbox.readFileToBuffer({
      path: posix.join(STUDIO_WORKSPACE_ROOT, 'package.json'),
    }),
    sandbox.readFileToBuffer({
      path: posix.join(STUDIO_WORKSPACE_ROOT, 'package-lock.json'),
    }),
  ]);
  if (!manifest || !lockfile) return null;
  return createHash('sha256')
    .update(manifest)
    .update('\0')
    .update(lockfile)
    .digest('hex');
}

async function installSandboxDependencies(
  sandbox: Sandbox,
): Promise<StudioCommandResult> {
  const hasLockfile = await sandbox.readFileToBuffer({
    path: posix.join(STUDIO_WORKSPACE_ROOT, 'package-lock.json'),
  });
  const result = await executeStudioCommand(sandbox, 'install', {
    ...COMMANDS.install,
    args: [
      hasLockfile ? 'ci' : 'install',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
    ],
  });
  const digest = result.exitCode === 0 ? await dependencyDigest(sandbox) : null;
  if (digest)
    await sandbox.writeFiles([
      { path: DEPENDENCIES_DIGEST_PATH, content: digest },
    ]);
  return result;
}

async function ensureSandboxDependencies(
  sandbox: Sandbox,
): Promise<StudioCommandResult | null> {
  await assertNoStudioSymlinks(sandbox);
  await assertStudioPackage(sandbox);
  const digest = await dependencyDigest(sandbox);
  const installed = await sandbox.readFileToBuffer({
    path: DEPENDENCIES_DIGEST_PATH,
  });
  if (digest && installed?.toString('utf8') === digest) {
    const checks = await Promise.all(
      ['next', 'tsc'].map((binary) =>
        sandbox.runCommand(
          'test',
          [
            '-x',
            posix.join(STUDIO_WORKSPACE_ROOT, 'node_modules/.bin', binary),
          ],
          { timeoutMs: 5_000 },
        ),
      ),
    );
    if (checks.every((check) => check.exitCode === 0)) return null;
  }
  return installSandboxDependencies(sandbox);
}

export async function ensureStudioDependencies(
  name: string,
): Promise<StudioCommandResult | null> {
  return ensureSandboxDependencies(await studioSandbox(name));
}

export async function studioProjectDigest(name: string): Promise<string> {
  const sandbox = await studioSandbox(name);
  await assertNoStudioSymlinks(sandbox);
  await assertStudioPackage(sandbox);
  const files = (await listStudioFiles(name)).filter(
    (file) =>
      !file.endsWith('.tsbuildinfo') &&
      file !== 'next-env.d.ts' &&
      !file.startsWith('.vercel/') &&
      !file.startsWith('.env'),
  );
  if (!files.length || files.length > 600)
    throw new Error('O projeto tem uma quantidade inválida de arquivos.');
  const digest = createHash('sha256');
  let total = 0;
  for (const file of files) {
    const content = await sandbox.readFileToBuffer({
      path: posix.join(STUDIO_WORKSPACE_ROOT, file),
    });
    if (!content) throw new Error(`Arquivo ausente no projeto: ${file}`);
    total += content.byteLength;
    if (total > 50 * 1024 * 1024)
      throw new Error('O projeto excede o limite de 50 MiB.');
    digest.update(file).update('\0').update(content).update('\0');
  }
  return digest.digest('hex');
}

async function previewResponds(
  sandbox: Sandbox,
  token: string,
): Promise<boolean> {
  const result = await sandbox.runCommand(
    'curl',
    [
      '--fail',
      '--silent',
      '--show-error',
      '--max-time',
      '3',
      '--dump-header',
      '-',
      '--output',
      '/dev/null',
      `http://127.0.0.1:3000/?__eixu_preview=${token}`,
    ],
    { timeoutMs: 5_000 },
  );
  return (
    result.exitCode === 0 &&
    (await result.stdout())
      .toLowerCase()
      .includes('x-eixu-preview-gate: authorized')
  );
}

const PREVIEW_TOKEN_PATH = '/tmp/eixu-preview-token';

async function previewToken(
  sandbox: Sandbox,
  projectId: string,
): Promise<string> {
  const stored = await sandbox.readFileToBuffer({ path: PREVIEW_TOKEN_PATH });
  const existing = stored?.toString('utf8').trim();
  if (existing && /^[a-f0-9]{64}$/.test(existing)) {
    const hash = createHash('sha256').update(existing).digest('hex');
    const sessions = (await db()`
      select 1 from studio_preview_sessions
      where project_id = ${projectId} and token_hash = ${hash}
        and expires_at > now()
      limit 1
    `) as { '?column?': number }[];
    if (sessions.length) return existing;
  }
  const token = randomBytes(32).toString('hex');
  await sandbox.writeFiles([
    { path: PREVIEW_TOKEN_PATH, content: token, mode: 0o600 },
  ]);
  return token;
}

export async function ensureStudioPreview(input: {
  name: string;
  projectId: string;
  codeRevision: string;
  contentRevisionId: string;
  userId: string;
}): Promise<string> {
  const { name } = input;
  const rows = (await db()`
    select artifact.storage_key, revision.content
    from studio_projects project
    join studio_artifacts artifact on artifact.project_id = project.id
      and artifact.kind = 'code' and artifact.content_hash = ${input.codeRevision}
    join studio_content_revisions revision on revision.project_id = project.id
      and revision.id = ${input.contentRevisionId}
    where project.id = ${input.projectId} and project.sandbox_name = ${name}
    order by artifact.version desc limit 1
  `) as { storage_key: string; content: Record<string, string> }[];
  const snapshot = rows[0];
  if (!snapshot?.storage_key)
    throw new Error('O checkpoint solicitado para a prévia não existe.');
  const sandbox = await studioSandbox(name);
  await restoreStudioCheckpoint(sandbox, {
    storageKey: snapshot.storage_key,
    codeRevision: input.codeRevision,
    content: snapshot.content,
  });
  const token = await previewToken(sandbox, input.projectId);
  if (!(await previewResponds(sandbox, token))) {
    await sandbox
      .runCommand('pkill', ['-f', 'next dev.*--port 3000'], {
        timeoutMs: 5_000,
      })
      .catch(() => undefined);
    await sandbox.runCommand({
      cmd: 'npm',
      args: ['run', 'dev', '--', '--hostname', '0.0.0.0', '--port', '3000'],
      cwd: STUDIO_WORKSPACE_ROOT,
      detached: true,
      env: {
        NEXT_TELEMETRY_DISABLED: '1',
        EIXU_PREVIEW_TOKEN: token,
      },
    });
    for (let attempt = 0; attempt < 30; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      if (await previewResponds(sandbox, token)) break;
      if (attempt === 29)
        throw new Error('A prévia não iniciou dentro do tempo esperado.');
    }
  }
  const url = new URL(sandbox.domain(3000));
  url.searchParams.set('__eixu_preview', token);
  const tokenHash = createHash('sha256').update(token).digest('hex');
  await db()`
    insert into studio_preview_sessions (
      project_id, token_hash, code_revision, content_revision_id,
      preview_url, created_by, expires_at
    ) values (
      ${input.projectId}, ${tokenHash}, ${input.codeRevision},
      ${input.contentRevisionId}, ${sandbox.domain(3000)}, ${input.userId},
      now() + interval '45 minutes'
    )
    on conflict (token_hash) do update set
      code_revision = excluded.code_revision,
      content_revision_id = excluded.content_revision_id,
      preview_url = excluded.preview_url,
      created_by = excluded.created_by,
      expires_at = excluded.expires_at
  `;
  return url.toString();
}

export async function archiveStudioProject(name: string): Promise<Buffer> {
  const sandbox = await studioSandbox(name);
  await assertNoStudioSymlinks(sandbox);
  const archive = `/tmp/${name}-project.tar.gz`;
  const result = await sandbox.runCommand(
    'tar',
    [
      '-czf',
      archive,
      '--exclude=./node_modules',
      '--exclude=./.next',
      '--exclude=./.git',
      '--exclude=./.vercel',
      '--exclude=./.env*',
      '--exclude=./next-env.d.ts',
      '--exclude=*.tsbuildinfo',
      '-C',
      STUDIO_WORKSPACE_ROOT,
      '.',
    ],
    { timeoutMs: 90_000 },
  );
  if (result.exitCode !== 0)
    throw new Error(`Falha ao criar checkpoint: ${await result.stderr()}`);
  const buffer = await sandbox.readFileToBuffer({ path: archive });
  if (!buffer) throw new Error('Checkpoint do projeto não foi encontrado.');
  if (buffer.byteLength > 50 * 1024 * 1024)
    throw new Error('Checkpoint excede o limite de 50 MiB.');
  return buffer;
}

export type StudioDeploymentFile = {
  file: string;
  data: Buffer;
};

/**
 * Reconstrói um release em uma VM efêmera a partir do checkpoint imutável.
 * O conteúdo ativo é sobreposto sem confiar no estado vivo da prévia.
 */
export async function studioDeploymentFiles(input: {
  archive: Buffer;
  content: Record<string, string>;
}): Promise<StudioDeploymentFile[]> {
  const sandbox = await Sandbox.create({
    image: 'vercel/sandbox/universal:latest',
    timeout: 5 * 60_000,
    resources: { vcpus: 1 },
    networkPolicy: NETWORK_POLICY,
    tags: { product: 'eixu', surface: 'release' },
  });
  try {
    await sandbox.mkDir(STUDIO_WORKSPACE_ROOT);
    const archivePath = '/tmp/eixu-release.tar.gz';
    await sandbox.writeFiles([{ path: archivePath, content: input.archive }]);
    const extracted = await sandbox.runCommand(
      'tar',
      ['-xzf', archivePath, '-C', STUDIO_WORKSPACE_ROOT],
      { timeoutMs: 60_000 },
    );
    if (extracted.exitCode !== 0)
      throw new Error(
        `Falha ao abrir o checkpoint: ${await extracted.stderr()}`,
      );
    await sandbox.writeFiles([
      {
        path: posix.join(STUDIO_WORKSPACE_ROOT, 'content/values.json'),
        content: `${JSON.stringify(input.content, null, 2)}\n`,
      },
    ]);
    const listed = await sandbox.runCommand(
      'find',
      [
        STUDIO_WORKSPACE_ROOT,
        '-type',
        'f',
        '-not',
        '-path',
        '*/node_modules/*',
        '-not',
        '-path',
        '*/.next/*',
        '-not',
        '-path',
        '*/.git/*',
        '-not',
        '-path',
        '*/.vercel/*',
        '-not',
        '-name',
        '.env*',
        '-printf',
        '%P\n',
      ],
      { timeoutMs: 20_000 },
    );
    if (listed.exitCode !== 0)
      throw new Error(`Falha ao listar o release: ${await listed.stderr()}`);
    const paths = (await listed.stdout())
      .split('\n')
      .map((path) => path.trim())
      .filter(Boolean)
      .sort();
    if (!paths.length || paths.length > 600)
      throw new Error('O release tem uma quantidade inválida de arquivos.');
    const files: StudioDeploymentFile[] = [];
    let total = 0;
    for (const file of paths) {
      const content = await sandbox.readFileToBuffer({
        path: posix.join(STUDIO_WORKSPACE_ROOT, file),
      });
      if (!content) throw new Error(`Arquivo ausente no release: ${file}`);
      if (content.byteLength > 1_500_000)
        throw new Error(`Arquivo grande demais para publicação: ${file}`);
      total += content.byteLength;
      if (total > 4_000_000)
        throw new Error('O release excede o limite de 4 MB de fontes.');
      files.push({ file, data: content });
    }
    return files;
  } finally {
    await sandbox
      .delete({ deleteOrphanSnapshots: true })
      .catch(() => undefined);
  }
}
