import { createHash, randomUUID } from 'node:crypto';
import { readStudioCheckpoint } from './checkpoint-storage';
import { db, transaction } from '@/lib/db';
import { studioDeploymentFiles, type StudioDeploymentFile } from './sandbox';
import {
  hasStudioPreviewProtection,
  studioSameOriginRedirect,
  withTemporaryStudioVercelBypass,
  type VercelProjectProtection,
} from './vercel-protection';

const VERCEL_API = 'https://api.vercel.com';

function vercelTeamId(): string {
  const id = process.env.EIXU_VERCEL_TEAM_ID || process.env.VERCEL_ORG_ID;
  if (!id?.startsWith('team_'))
    throw new Error(
      'VERCEL_ORG_ID não está disponível. Fora da Vercel, configure EIXU_VERCEL_TEAM_ID.',
    );
  return id;
}

function rootVercelProjectId(): string {
  const id =
    process.env.EIXU_VERCEL_ROOT_PROJECT_ID || process.env.VERCEL_PROJECT_ID;
  if (!id?.startsWith('prj_'))
    throw new Error(
      'VERCEL_PROJECT_ID não está disponível. Fora da Vercel, configure EIXU_VERCEL_ROOT_PROJECT_ID.',
    );
  return id;
}

export type StudioReleaseStatus =
  | 'preparing'
  | 'validating'
  | 'ready'
  | 'active'
  | 'failed'
  | 'rolled_back';

export type StudioRelease = {
  id: string;
  projectId: string;
  tenantId: string;
  slug: string;
  canonicalHost: string;
  codeRevision: string;
  codeArtifactKey: string;
  contentRevisionId: string;
  contractHash: string;
  deploymentId: string | null;
  deploymentUrl: string | null;
  vercelProjectId: string | null;
  vercelProjectName: string | null;
  workflowRunId: string | null;
  status: StudioReleaseStatus;
  manifest: Record<string, unknown>;
  error: string | null;
  activatedAt: string | null;
};

type Row = Record<string, unknown>;

function text(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number'
    ? `${value}`
    : '';
}

function fromRow(row: Row): StudioRelease {
  return {
    id: text(row.id),
    projectId: text(row.project_id),
    tenantId: text(row.tenant_id),
    slug: text(row.slug),
    canonicalHost: text(row.canonical_host),
    codeRevision: text(row.code_revision),
    codeArtifactKey: text(row.code_artifact_key),
    contentRevisionId: text(row.content_revision_id),
    contractHash: text(row.contract_hash),
    deploymentId: text(row.deployment_id) || null,
    deploymentUrl: text(row.deployment_url) || null,
    vercelProjectId: text(row.vercel_project_id) || null,
    vercelProjectName: text(row.vercel_project_name) || null,
    workflowRunId: text(row.workflow_run_id) || null,
    status: row.status as StudioReleaseStatus,
    manifest:
      row.manifest && typeof row.manifest === 'object'
        ? (row.manifest as Record<string, unknown>)
        : {},
    error: text(row.error) || null,
    activatedAt: text(row.activated_at) || null,
  };
}

function promotionWasRequested(release: StudioRelease): boolean {
  return Boolean(
    release.manifest.promotionRequestedAt || release.manifest.promotedAt,
  );
}

const releaseSelect = `
  select release.*, project.tenant_id, project.slug, project.canonical_host,
         project.vercel_project_id, project.vercel_project_name
  from studio_releases release
  join studio_projects project on project.id = release.project_id
`;

export async function studioReleaseById(
  releaseId: string,
): Promise<StudioRelease | null> {
  const rows = (await db().query(
    `${releaseSelect} where release.id = $1 limit 1`,
    [releaseId],
  )) as Row[];
  return rows[0] ? fromRow(rows[0]) : null;
}

export async function currentStudioRelease(
  projectId: string,
): Promise<StudioRelease | null> {
  await db()`
    update studio_releases set status = 'failed',
      error = 'O workflow de publicação não foi vinculado.',
      updated_at = now()
    where project_id = ${projectId}
      and status = 'preparing' and workflow_run_id is null
      and created_at < now() - interval '10 minutes'
  `;
  const rows = (await db().query(
    `${releaseSelect}
     where release.project_id = $1
       and release.status in ('preparing', 'validating', 'ready')
     order by release.created_at desc limit 1`,
    [projectId],
  )) as Row[];
  return rows[0] ? fromRow(rows[0]) : null;
}

export async function latestStudioRelease(
  projectId: string,
): Promise<StudioRelease | null> {
  const rows = (await db().query(
    `${releaseSelect} where release.project_id = $1
     order by release.created_at desc limit 1`,
    [projectId],
  )) as Row[];
  return rows[0] ? fromRow(rows[0]) : null;
}

export async function rollbackCandidateStudioRelease(
  projectId: string,
): Promise<StudioRelease | null> {
  const rows = (await db().query(
    `${releaseSelect}
     where release.project_id = $1
       and release.status = 'rolled_back'
       and release.deployment_id is not null
     order by release.activated_at desc nulls last, release.created_at desc
     limit 1`,
    [projectId],
  )) as Row[];
  return rows[0] ? fromRow(rows[0]) : null;
}

export async function hasStudioDraftChanges(
  projectId: string,
): Promise<boolean> {
  const rows = (await db()`
    select active.id is null
        or active.code_revision is distinct from project.draft_code_revision
        or active.content_revision_id is distinct from project.active_content_revision_id
      as dirty
    from studio_projects project
    left join studio_releases active on active.id = project.active_release_id
    where project.id = ${projectId}
  `) as { dirty: boolean }[];
  return rows[0]?.dirty ?? false;
}

export async function createStudioRelease(input: {
  projectId: string;
  requestedBy: string;
}): Promise<StudioRelease> {
  const releaseId = randomUUID();
  await transaction(async (connection) => {
    const locked = await connection.query(
      `select project.*, active.code_revision as published_code_revision,
              active.content_revision_id as published_content_revision_id,
              revision.contract_hash, artifact.storage_key
       from studio_projects project
       join studio_content_revisions revision
         on revision.id = project.active_content_revision_id
       join studio_artifacts artifact
         on artifact.project_id = project.id
        and artifact.kind = 'code'
        and artifact.content_hash = project.draft_code_revision
       left join studio_releases active on active.id = project.active_release_id
       where project.id = $1
       order by artifact.version desc limit 1
       for update of project`,
      [input.projectId],
    );
    const project = locked.rows[0] as Row | undefined;
    if (!project)
      throw new Error('O projeto ainda não tem um checkpoint publicável.');
    if (!['ready', 'published'].includes(text(project.status)))
      throw new Error('O projeto ainda não concluiu os gates de publicação.');
    if (
      project.published_code_revision === project.draft_code_revision &&
      project.published_content_revision_id ===
        project.active_content_revision_id
    )
      throw new Error('A versão publicada já corresponde ao rascunho atual.');
    const studioRun = await connection.query(
      `select id from studio_runs where project_id = $1
       and status in ('queued', 'running', 'cancel_requested') limit 1`,
      [input.projectId],
    );
    if (studioRun.rows[0])
      throw new Error(
        'O agente está alterando o projeto. Aguarde o turno terminar antes de publicar.',
      );
    const active = await connection.query(
      `select id from studio_releases where project_id = $1
       and status in ('preparing', 'validating', 'ready') limit 1`,
      [input.projectId],
    );
    if (active.rows[0])
      throw new Error(
        'Já existe uma publicação em andamento para este projeto.',
      );
    await connection.query(
      `insert into studio_releases (
         id, project_id, code_revision, code_artifact_key,
         content_revision_id, contract_hash, status, manifest, requested_by
       ) values ($1, $2, $3, $4, $5, $6, 'preparing', $7::jsonb, $8)`,
      [
        releaseId,
        input.projectId,
        project.draft_code_revision,
        project.storage_key,
        project.active_content_revision_id,
        project.contract_hash,
        JSON.stringify({ createdFrom: 'studio', schemaVersion: 1 }),
        input.requestedBy,
      ],
    );
  });
  const release = await studioReleaseById(releaseId);
  if (!release) throw new Error('A publicação não foi registrada.');
  return release;
}

/** Cria um novo release imutável a partir de um snapshot publicado anterior. */
export async function createStudioRollbackRelease(input: {
  projectId: string;
  sourceReleaseId: string;
  requestedBy: string;
}): Promise<StudioRelease> {
  const releaseId = randomUUID();
  await transaction(async (connection) => {
    const projectResult = await connection.query(
      `select id, active_release_id, status from studio_projects
       where id = $1 for update`,
      [input.projectId],
    );
    const project = projectResult.rows[0] as Row | undefined;
    if (!project) throw new Error('Projeto não encontrado.');
    if (project.status !== 'published')
      throw new Error(
        'Reative o cliente e confirme a versão publicada antes de fazer rollback.',
      );
    if (project.active_release_id === input.sourceReleaseId)
      throw new Error('Essa versão já está publicada.');

    const studioRun = await connection.query(
      `select id from studio_runs where project_id = $1
       and status in ('queued', 'running', 'cancel_requested') limit 1`,
      [input.projectId],
    );
    if (studioRun.rows[0])
      throw new Error(
        'O agente está alterando o projeto. Aguarde o turno terminar antes de publicar.',
      );

    const inflight = await connection.query(
      `select id from studio_releases where project_id = $1
       and status in ('preparing', 'validating', 'ready') limit 1`,
      [input.projectId],
    );
    if (inflight.rows[0])
      throw new Error(
        'Já existe uma publicação em andamento para este projeto.',
      );

    const sourceResult = await connection.query(
      `select * from studio_releases
       where id = $1 and project_id = $2
         and status in ('active', 'rolled_back')
       limit 1`,
      [input.sourceReleaseId, input.projectId],
    );
    const source = sourceResult.rows[0] as Row | undefined;
    if (!source)
      throw new Error('A versão escolhida não está disponível para rollback.');

    await connection.query(
      `insert into studio_releases (
         id, project_id, code_revision, code_artifact_key,
         content_revision_id, contract_hash, status, manifest, requested_by
       ) values ($1, $2, $3, $4, $5, $6, 'preparing', $7::jsonb, $8)`,
      [
        releaseId,
        input.projectId,
        source.code_revision,
        source.code_artifact_key,
        source.content_revision_id,
        source.contract_hash,
        JSON.stringify({
          createdFrom: 'rollback',
          sourceReleaseId: input.sourceReleaseId,
          schemaVersion: 1,
        }),
        input.requestedBy,
      ],
    );
  });
  const release = await studioReleaseById(releaseId);
  if (!release) throw new Error('O rollback não foi registrado.');
  return release;
}

export async function attachReleaseWorkflow(
  releaseId: string,
  workflowRunId: string,
): Promise<boolean> {
  const rows = (await db()`
    update studio_releases set workflow_run_id = ${workflowRunId},
      updated_at = now()
    where id = ${releaseId}
      and (workflow_run_id is null or workflow_run_id = ${workflowRunId})
    returning id
  `) as { id: string }[];
  return rows.length === 1;
}

class VercelApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
  }
}

function vercelToken(): string {
  const token = process.env.EIXU_VERCEL_TOKEN;
  if (!token)
    throw new Error(
      'A publicação requer EIXU_VERCEL_TOKEN no ambiente da plataforma.',
    );
  return token;
}

async function vercelRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const url = new URL(path, VERCEL_API);
  url.searchParams.set('teamId', vercelTeamId());
  const headers = new Headers(init.headers);
  headers.set('authorization', `Bearer ${vercelToken()}`);
  if (init.body) headers.set('content-type', 'application/json');
  const response = await fetch(url, {
    ...init,
    headers,
    signal: init.signal ?? AbortSignal.timeout(60_000),
  });
  const payload = (await response.json().catch(() => ({}))) as {
    error?: { code?: string; message?: string };
  } & T;
  if (!response.ok)
    throw new VercelApiError(
      payload.error?.message ?? `A Vercel respondeu ${response.status}.`,
      response.status,
      payload.error?.code ?? 'vercel_api_error',
    );
  return payload;
}

type UploadedDeploymentFile = { file: string; sha: string; size: number };

async function uploadDeploymentFile(
  file: StudioDeploymentFile,
): Promise<UploadedDeploymentFile> {
  const digest = createHash('sha1').update(file.data).digest('hex');
  const url = new URL('/v2/files', VERCEL_API);
  url.searchParams.set('teamId', vercelTeamId());
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${vercelToken()}`,
      'content-type': 'application/octet-stream',
      'content-length': `${file.data.byteLength}`,
      'x-vercel-digest': digest,
    },
    body: new Blob([Uint8Array.from(file.data)]),
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as {
      error?: { message?: string };
    };
    throw new Error(
      payload.error?.message ??
        `Falha ao enviar ${file.file}: Vercel ${response.status}.`,
    );
  }
  return { file: file.file, sha: digest, size: file.data.byteLength };
}

async function uploadDeploymentFiles(
  files: StudioDeploymentFile[],
): Promise<UploadedDeploymentFile[]> {
  const uploaded: UploadedDeploymentFile[] = [];
  for (let index = 0; index < files.length; index += 8) {
    const batch = await Promise.all(
      files.slice(index, index + 8).map(uploadDeploymentFile),
    );
    uploaded.push(...batch);
  }
  return uploaded;
}

function isVercelNotFound(error: unknown): boolean {
  return error instanceof VercelApiError && error.status === 404;
}

function projectName(slug: string): string {
  return `eixu-site-${slug}`.slice(0, 100);
}

type VercelProjectIdentity = VercelProjectProtection & {
  id: string;
  name: string;
};

function assertVercelProjectIdentity(
  project: VercelProjectIdentity,
  expected: { id?: string; name: string },
): VercelProjectIdentity {
  if (
    !project.id ||
    project.id === rootVercelProjectId() ||
    (expected.id && project.id !== expected.id) ||
    project.name !== expected.name
  )
    throw new Error(
      'A identidade do projeto Vercel não corresponde ao cliente esperado.',
    );
  return project;
}

async function verifiedVercelProject(
  id: string,
  expectedName: string,
): Promise<VercelProjectIdentity> {
  if (id === rootVercelProjectId())
    throw new Error('O projeto institucional da EIXU está protegido.');
  const project = await vercelRequest<VercelProjectIdentity>(
    `/v9/projects/${encodeURIComponent(id)}`,
  );
  return assertVercelProjectIdentity(project, { id, name: expectedName });
}

async function ensureVercelProjectProtection(
  input: VercelProjectIdentity,
): Promise<VercelProjectIdentity> {
  let project = input;

  if (!hasStudioPreviewProtection(project)) {
    project = await vercelRequest<VercelProjectIdentity>(
      `/v9/projects/${encodeURIComponent(project.id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          ssoProtection: { deploymentType: 'preview' },
        }),
      },
    );
    assertVercelProjectIdentity(project, { id: input.id, name: input.name });
    if (!hasStudioPreviewProtection(project))
      throw new Error(
        'A Vercel não confirmou a proteção dos deployments de preview.',
      );
  }

  return project;
}

async function ensureVercelProject(release: StudioRelease) {
  const name = projectName(release.slug);
  if (release.vercelProjectId) {
    const existing = await verifiedVercelProject(release.vercelProjectId, name);
    return ensureVercelProjectProtection(existing);
  }
  let project: VercelProjectIdentity;
  try {
    project = await vercelRequest('/v11/projects', {
      method: 'POST',
      body: JSON.stringify({
        name,
        framework: 'nextjs',
        installCommand: 'npm install --ignore-scripts --no-audit --no-fund',
        buildCommand: 'npm run build',
        ssoProtection: { deploymentType: 'preview' },
      }),
    });
  } catch (error) {
    if (!(error instanceof VercelApiError) || error.status !== 409) throw error;
    project = await vercelRequest(`/v9/projects/${encodeURIComponent(name)}`);
  }
  assertVercelProjectIdentity(project, { name });
  project = await verifiedVercelProject(project.id, name);
  project = await ensureVercelProjectProtection(project);
  const linked = (await db()`
    update studio_projects set vercel_project_id = ${project.id},
      vercel_project_name = ${project.name}, updated_at = now()
    where id = ${release.projectId}
      and (vercel_project_id is null or vercel_project_id = ${project.id})
    returning id
  `) as { id: string }[];
  if (linked.length !== 1)
    throw new Error(
      'O projeto foi associado a outro recurso Vercel durante a publicação.',
    );
  return project;
}

async function releaseSnapshot(release: StudioRelease) {
  const rows = (await db()`
    select revision.content, revision.contract
    from studio_content_revisions revision
    where revision.id = ${release.contentRevisionId}
      and revision.project_id = ${release.projectId}
    limit 1
  `) as {
    content: Record<string, string>;
    contract: {
      pages?: Array<{ slug?: string }>;
    };
  }[];
  if (!rows[0]) throw new Error('O conteúdo congelado do release não existe.');
  const archive = await readStudioCheckpoint(
    release.codeArtifactKey,
    release.codeRevision,
  );
  return { ...rows[0], archive };
}

export async function provisionStudioDeployment(releaseId: string) {
  const release = await studioReleaseById(releaseId);
  if (!release) throw new Error('Release não encontrado.');
  if (release.deploymentId && release.deploymentUrl)
    return { id: release.deploymentId, url: release.deploymentUrl };
  if (release.status !== 'preparing')
    throw new Error('O release não está pronto para criar um deployment.');
  const [project, snapshot] = await Promise.all([
    ensureVercelProject(release),
    releaseSnapshot(release),
  ]);
  const files = await studioDeploymentFiles({
    archive: snapshot.archive,
    content: snapshot.content,
  });
  const marker = {
    releaseId: release.id,
    codeRevision: release.codeRevision,
    contentRevisionId: release.contentRevisionId,
  };
  files.push({
    file: 'public/.well-known/eixu-release.json',
    data: Buffer.from(JSON.stringify(marker)),
  } satisfies StudioDeploymentFile);
  const uploadedFiles = await uploadDeploymentFiles(files);
  const deployment = await vercelRequest<{
    id: string;
    url: string;
    readyState?: string;
    status?: string;
  }>('/v13/deployments?forceNew=1&skipAutoDetectionConfirmation=1', {
    method: 'POST',
    body: JSON.stringify({
      name: project.name,
      project: project.id,
      files: uploadedFiles,
      meta: {
        eixuReleaseId: release.id,
        eixuCodeRevision: release.codeRevision,
        eixuContentRevision: release.contentRevisionId,
      },
      projectSettings: {
        framework: 'nextjs',
        installCommand: 'npm install --ignore-scripts --no-audit --no-fund',
        buildCommand: 'npm run build',
        nodeVersion: '24.x',
      },
    }),
  });
  if (!deployment.id || !deployment.url)
    throw new Error('A Vercel não retornou o deployment candidato.');
  await db()`
    update studio_releases set deployment_id = ${deployment.id},
      deployment_url = ${`https://${deployment.url}`}, status = 'validating',
      manifest = manifest || ${JSON.stringify({
        files: files.length,
        vercelProjectId: project.id,
        deploymentCreatedAt: new Date().toISOString(),
      })}::jsonb,
      updated_at = now()
    where id = ${release.id} and deployment_id is null
  `;
  return { id: deployment.id, url: `https://${deployment.url}` };
}

export async function studioDeploymentStatus(releaseId: string) {
  const release = await studioReleaseById(releaseId);
  if (!release?.deploymentId || !release.vercelProjectId)
    throw new Error('Deployment ou projeto Vercel não encontrado.');
  const deployment = await vercelRequest<{
    id: string;
    url: string;
    projectId?: string;
    project?: { id?: string };
    readyState?: string;
    status?: string;
    state?: string;
  }>(`/v13/deployments/${encodeURIComponent(release.deploymentId)}`);
  const deploymentProjectId = deployment.projectId ?? deployment.project?.id;
  if (
    deployment.id !== release.deploymentId ||
    deploymentProjectId !== release.vercelProjectId
  )
    throw new Error('O deployment não pertence ao projeto Vercel do cliente.');
  const status = deployment.readyState ?? deployment.status ?? deployment.state;
  return { status: status ?? 'UNKNOWN', url: `https://${deployment.url}` };
}

async function smokeUrl(
  url: string,
  options: { expectedReleaseId?: string; headers?: HeadersInit } = {},
) {
  const origin = new URL(url).origin;
  let current = url;
  let response: Response | null = null;

  for (let redirects = 0; redirects <= 5; redirects += 1) {
    response = await fetch(current, {
      redirect: 'manual',
      headers: options.headers,
      signal: AbortSignal.timeout(30_000),
      cache: 'no-store',
    });
    if (![301, 302, 303, 307, 308].includes(response.status)) break;
    current = studioSameOriginRedirect(
      current,
      response.headers.get('location'),
      origin,
    );
    response = null;
  }

  if (!response) throw new Error('O smoke excedeu o limite de redirects.');
  if (!response.ok)
    throw new Error(
      `Smoke falhou em ${new URL(url).pathname}: HTTP ${response.status}.`,
    );
  if (options.expectedReleaseId) {
    const marker = (await response.json().catch(() => null)) as {
      releaseId?: unknown;
    } | null;
    if (marker?.releaseId !== options.expectedReleaseId)
      throw new Error('O host não está servindo o release esperado.');
  }
  return response;
}

export async function verifyStudioDeployment(releaseId: string) {
  const release = await studioReleaseById(releaseId);
  if (!release?.deploymentUrl || !release.vercelProjectId)
    throw new Error('Deployment ou projeto Vercel não encontrado.');
  const rows = (await db()`
    select contract from studio_content_revisions
    where id = ${release.contentRevisionId} limit 1
  `) as { contract: { pages?: Array<{ slug?: string }> } }[];
  const project = await verifiedVercelProject(
    release.vercelProjectId,
    projectName(release.slug),
  );
  if (!hasStudioPreviewProtection(project))
    throw new Error(
      'O deployment candidato não tem a proteção de preview esperada.',
    );
  const base = release.deploymentUrl.replace(/\/$/, '');
  const paths = [
    ...new Set(
      (rows[0]?.contract.pages ?? [])
        .map((page) => `/${page.slug ?? ''}`)
        .slice(0, 30),
    ),
  ];
  await withTemporaryStudioVercelBypass(
    (body) =>
      vercelRequest<VercelProjectProtection>(
        `/v1/projects/${encodeURIComponent(project.id)}/protection-bypass`,
        { method: 'PATCH', body: JSON.stringify(body) },
      ),
    async (headers) => {
      await smokeUrl(`${base}/.well-known/eixu-release.json`, {
        expectedReleaseId: release.id,
        headers,
      });
      for (const path of paths.length ? paths : ['/']) {
        const response = await smokeUrl(`${base}${path}`, { headers });
        const type = response.headers.get('content-type') ?? '';
        if (!type.includes('text/html'))
          throw new Error(`A rota ${path} não retornou HTML.`);
      }
    },
  );
  await db()`
    update studio_releases set status = 'ready',
      manifest = manifest || ${JSON.stringify({
        candidateSmoke: {
          ok: true,
          paths,
          checkedAt: new Date().toISOString(),
        },
      })}::jsonb,
      updated_at = now()
    where id = ${release.id} and status = 'validating'
  `;
  return { paths };
}

async function ensureProjectDomain(projectId: string, host: string) {
  const domains = await vercelRequest<{
    domains?: Array<{ name?: string; verified?: boolean }>;
  }>(`/v9/projects/${encodeURIComponent(projectId)}/domains?limit=100`);
  const existing = domains.domains?.find((domain) => domain.name === host);
  if (existing) {
    if (existing.verified === false)
      throw new Error('O domínio canônico ainda não foi verificado na Vercel.');
    return;
  }
  const domain = await vercelRequest<{ verified?: boolean }>(
    `/v10/projects/${encodeURIComponent(projectId)}/domains`,
    { method: 'POST', body: JSON.stringify({ name: host }) },
  );
  if (domain.verified === false)
    throw new Error('O domínio canônico ainda não foi verificado na Vercel.');
}

export async function activateStudioDeployment(releaseId: string) {
  const release = await studioReleaseById(releaseId);
  if (!release?.deploymentId || !release.vercelProjectId)
    throw new Error('Deployment ou projeto Vercel não encontrado.');
  if (release.status === 'active') return;
  if (release.status !== 'ready')
    throw new Error('Somente um deployment validado pode ser ativado.');
  if (release.vercelProjectId === rootVercelProjectId())
    throw new Error(
      'O projeto raiz da EIXU não pode ser promovido por este fluxo.',
    );
  if (release.canonicalHost !== `${release.slug}.eixu.com.br`)
    throw new Error('O domínio canônico do projeto é inválido.');
  await verifiedVercelProject(
    release.vercelProjectId,
    projectName(release.slug),
  );
  await ensureProjectDomain(release.vercelProjectId, release.canonicalHost);
  const promotionRequestedAt = new Date().toISOString();
  const prepared = (await db()`
    update studio_releases set
      manifest = manifest || ${JSON.stringify({ promotionRequestedAt })}::jsonb,
      updated_at = now()
    where id = ${release.id} and status = 'ready'
    returning id
  `) as { id: string }[];
  if (prepared.length !== 1)
    throw new Error('O release mudou de estado antes da promoção.');
  await vercelRequest(
    `/v10/projects/${encodeURIComponent(release.vercelProjectId)}/promote/${encodeURIComponent(release.deploymentId)}`,
    { method: 'POST', body: '{}' },
  );
  await db()`
    update studio_releases set
      manifest = manifest || ${JSON.stringify({
        promotedAt: new Date().toISOString(),
        canonicalHost: release.canonicalHost,
      })}::jsonb,
      updated_at = now()
    where id = ${release.id}
  `;
}

export async function verifyAndCommitStudioRelease(releaseId: string) {
  const release = await studioReleaseById(releaseId);
  if (!release) throw new Error('Release não encontrado.');
  if (release.status === 'active')
    return { url: `https://${release.canonicalHost}` };
  if (
    release.status !== 'ready' &&
    !(release.status === 'failed' && promotionWasRequested(release))
  )
    throw new Error('O release não está pronto para confirmar a publicação.');
  const markerUrl = `https://${release.canonicalHost}/.well-known/eixu-release.json`;
  await smokeUrl(markerUrl, { expectedReleaseId: release.id });
  await transaction(async (connection) => {
    const locked = await connection.query(
      `select id
       from studio_projects where id = $1 for update`,
      [release.projectId],
    );
    const project = locked.rows[0] as Row | undefined;
    if (!project)
      throw new Error('Projeto não encontrado ao ativar o release.');
    const releaseResult = await connection.query(
      `select status, manifest from studio_releases
       where id = $1 and project_id = $2 for update`,
      [release.id, release.projectId],
    );
    const current = releaseResult.rows[0] as Row | undefined;
    if (!current)
      throw new Error('Release não encontrado ao confirmar a publicação.');
    if (current.status === 'active') return;
    const manifest =
      current.manifest && typeof current.manifest === 'object'
        ? (current.manifest as Record<string, unknown>)
        : {};
    if (
      current.status !== 'ready' &&
      !(
        current.status === 'failed' &&
        (manifest.promotionRequestedAt || manifest.promotedAt)
      )
    )
      throw new Error('O release mudou de estado antes da confirmação.');
    const activated = await connection.query(
      `update studio_releases set status = 'active', activated_at = now(),
         manifest = manifest || $2::jsonb, updated_at = now()
       where id = $1 and status in ('ready', 'failed')
       returning id`,
      [
        release.id,
        JSON.stringify({
          canonicalSmoke: { ok: true, checkedAt: new Date().toISOString() },
        }),
      ],
    );
    if (!activated.rows[0])
      throw new Error('O release não pôde ser confirmado como ativo.');
    await connection.query(
      `update studio_releases set status = 'rolled_back', updated_at = now()
       where project_id = $1 and status = 'active' and id <> $2`,
      [release.projectId, release.id],
    );
    await connection.query(
      `update studio_projects set active_release_id = $2,
         base_code_revision = $3,
         status = 'published', updated_at = now()
       where id = $1`,
      [release.projectId, release.id, release.codeRevision],
    );
    await connection.query(
      `update tenants set status = 'published', updated_at = now()
       where id = $1`,
      [release.tenantId],
    );
  });
  return { url: `https://${release.canonicalHost}` };
}

/**
 * Repara a janela entre promover na Vercel e confirmar o release no banco.
 * O marcador servido pelo host canônico é a prova externa da versão ativa.
 */
export async function reconcileStudioRelease(
  releaseId: string,
): Promise<boolean> {
  const release = await studioReleaseById(releaseId);
  if (!release) return false;
  if (release.status === 'active') return true;
  if (
    release.status !== 'ready' &&
    !(release.status === 'failed' && promotionWasRequested(release))
  )
    return false;
  try {
    await verifyAndCommitStudioRelease(release.id);
    return true;
  } catch {
    return false;
  }
}

async function studioVercelTarget(tenantId: string) {
  const rows = (await db()`
    select project.id, project.slug, project.vercel_project_id,
           project.vercel_project_name, project.canonical_host,
           release.deployment_id, release.id as release_id
    from studio_projects project
    left join studio_releases release on release.id = project.active_release_id
    where project.tenant_id = ${tenantId}
    limit 1
  `) as {
    id: string;
    slug: string;
    vercel_project_id: string | null;
    vercel_project_name: string | null;
    canonical_host: string;
    deployment_id: string | null;
    release_id: string | null;
  }[];
  const target = rows[0];
  if (!target?.vercel_project_id) return null;
  const vercelProjectId = target.vercel_project_id;
  if (vercelProjectId === rootVercelProjectId())
    throw new Error('O projeto institucional da EIXU está protegido.');
  if (target.canonical_host !== `${target.slug}.eixu.com.br`)
    throw new Error('O domínio canônico do cliente é inválido.');
  return { ...target, vercel_project_id: vercelProjectId };
}

async function verifyStudioVercelTarget(
  target: NonNullable<Awaited<ReturnType<typeof studioVercelTarget>>>,
) {
  const expectedName = projectName(target.slug);
  if (target.vercel_project_name && target.vercel_project_name !== expectedName)
    throw new Error('O vínculo Vercel salvo não corresponde ao cliente.');
  return verifiedVercelProject(target.vercel_project_id, expectedName);
}

/** Retira somente o domínio canônico; projeto, deployments e preview permanecem. */
export async function archiveStudioVercelProject(
  tenantId: string,
): Promise<void> {
  const target = await studioVercelTarget(tenantId);
  if (!target) return;
  await verifyStudioVercelTarget(target);
  try {
    await vercelRequest(
      `/v9/projects/${encodeURIComponent(target.vercel_project_id)}/domains/${encodeURIComponent(target.canonical_host)}`,
      { method: 'DELETE' },
    );
  } catch (error) {
    if (!isVercelNotFound(error)) throw error;
  }
}

/** Reassocia o domínio ao último release ativo e comprova o marcador canônico. */
export async function restoreStudioVercelProject(
  tenantId: string,
): Promise<void> {
  const target = await studioVercelTarget(tenantId);
  if (!target) return;
  if (!target.deployment_id || !target.release_id) return;
  await verifyStudioVercelTarget(target);
  const deployment = await vercelRequest<{
    id: string;
    projectId?: string;
    project?: { id?: string };
  }>(`/v13/deployments/${encodeURIComponent(target.deployment_id)}`);
  if (
    deployment.id !== target.deployment_id ||
    (deployment.projectId ?? deployment.project?.id) !==
      target.vercel_project_id
  )
    throw new Error('O deployment salvo não pertence ao projeto do cliente.');
  await ensureProjectDomain(target.vercel_project_id, target.canonical_host);
  await vercelRequest(
    `/v10/projects/${encodeURIComponent(target.vercel_project_id)}/promote/${encodeURIComponent(target.deployment_id)}`,
    { method: 'POST', body: '{}' },
  );
  await smokeUrl(
    `https://${target.canonical_host}/.well-known/eixu-release.json`,
    { expectedReleaseId: target.release_id },
  );
}

/** Remove o projeto Vercel dedicado durante uma exclusão já confirmada. */
export async function deleteStudioVercelProject(
  tenantId: string,
): Promise<void> {
  const target = await studioVercelTarget(tenantId);
  if (!target) return;
  try {
    await verifyStudioVercelTarget(target);
    await vercelRequest(
      `/v9/projects/${encodeURIComponent(target.vercel_project_id)}`,
      { method: 'DELETE' },
    );
  } catch (error) {
    if (!isVercelNotFound(error)) throw error;
  }
}

export async function failStudioRelease(
  releaseId: string,
  error: string,
): Promise<void> {
  await db()`
    update studio_releases set status = 'failed', error = ${error.slice(0, 2_000)},
      updated_at = now()
    where id = ${releaseId} and status <> 'active'
  `;
}
