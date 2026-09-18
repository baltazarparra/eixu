import { db, transaction } from '@/lib/db';
import type { StudioProject } from './types';

type Row = Record<string, unknown>;

const textValue = (input: unknown): string =>
  typeof input === 'string' || typeof input === 'number' ? `${input}` : '';
const nullableTextValue = (input: unknown): string | null => {
  const value = textValue(input);
  return value || null;
};

export function studioProjectFromRow(row: Row): StudioProject {
  return {
    id: textValue(row.id),
    tenantId: textValue(row.tenant_id),
    slug: textValue(row.slug),
    status: row.status as StudioProject['status'],
    sandboxName: textValue(row.sandbox_name),
    repositoryPath: nullableTextValue(row.repository_path),
    vercelProjectId: nullableTextValue(row.vercel_project_id),
    vercelProjectName: nullableTextValue(row.vercel_project_name),
    canonicalHost: textValue(row.canonical_host),
    baseCodeRevision: nullableTextValue(row.base_code_revision),
    draftCodeRevision: nullableTextValue(row.draft_code_revision),
    activeReleaseId: nullableTextValue(row.active_release_id),
    activeContentRevisionId: nullableTextValue(row.active_content_revision_id),
  };
}

function sandboxName(tenantId: string): string {
  return `eixu-${tenantId.replaceAll('-', '').slice(0, 24)}`;
}

export async function ensureStudioProject(input: {
  tenantId: string;
  slug: string;
}): Promise<StudioProject> {
  const rows = (await db()`
    insert into studio_projects (
      tenant_id, slug, sandbox_name, canonical_host
    ) values (
      ${input.tenantId}, ${input.slug}, ${sandboxName(input.tenantId)},
      ${`${input.slug}.eixu.com.br`}
    )
    on conflict (tenant_id) do update set
      slug = excluded.slug,
      canonical_host = excluded.canonical_host,
      updated_at = now()
    returning *
  `) as Row[];
  return studioProjectFromRow(rows[0]);
}

export async function studioProjectByTenant(
  tenantId: string,
): Promise<StudioProject | null> {
  const rows = (await db()`
    select * from studio_projects where tenant_id = ${tenantId} limit 1
  `) as Row[];
  return rows[0] ? studioProjectFromRow(rows[0]) : null;
}

export async function studioProjectById(
  id: string,
): Promise<StudioProject | null> {
  const rows = (await db()`
    select * from studio_projects where id = ${id} limit 1
  `) as Row[];
  return rows[0] ? studioProjectFromRow(rows[0]) : null;
}

export async function studioProjectBySlug(
  slug: string,
): Promise<StudioProject | null> {
  const rows = (await db()`
    select * from studio_projects where slug = ${slug} limit 1
  `) as Row[];
  return rows[0] ? studioProjectFromRow(rows[0]) : null;
}

export class StudioProjectBusyError extends Error {
  constructor() {
    super('O agente está alterando o projeto. Aguarde o turno terminar.');
    this.name = 'StudioProjectBusyError';
  }
}

/**
 * Usa o mesmo lock de linha que cria runs, salva o CMS e congela releases.
 * A operação externa permanece dentro da seção crítica para que uma prévia não
 * sincronize arquivos no intervalo entre conferir o estado e iniciar um run.
 */
export function withIdleStudioProject<T>(
  projectId: string,
  run: (project: StudioProject) => Promise<T>,
): Promise<T> {
  return transaction(async (connection) => {
    const project = await connection.query(
      'select * from studio_projects where id = $1 for no key update',
      [projectId],
    );
    if (!project.rows[0]) throw new Error('Projeto não encontrado.');
    const active = await connection.query(
      `select 1 from studio_runs
       where project_id = $1
         and status in ('queued', 'running', 'cancel_requested')
       limit 1`,
      [projectId],
    );
    if (active.rows[0]) throw new StudioProjectBusyError();
    return run(studioProjectFromRow(project.rows[0]));
  });
}
