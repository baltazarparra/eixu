import { db } from '@/lib/db';
import { studioDirectionOf, type StudioDirection } from './directions';
import { EIXU_STUDIO_WORKSPACE_ID } from './workspaces';

type Row = Record<string, unknown>;

const text = (value: unknown): string =>
  typeof value === 'string' || typeof value === 'number' ? `${value}` : '';

export type StudioDashboardProject = {
  id: string;
  slug: string;
  name: string;
  tenantStatus: 'draft' | 'published' | 'archived';
  projectStatus:
    | 'draft'
    | 'building'
    | 'ready'
    | 'published'
    | 'archived'
    | 'failed';
  direction: StudioDirection;
  canonicalHost: string;
  updatedAt: string;
  run: { kind: string; status: string } | null;
  release: { status: string; error: string | null } | null;
};

export async function studioDashboardProjects(): Promise<
  StudioDashboardProject[]
> {
  const rows = (await db()`
    select tenant.id, tenant.slug, tenant.name,
           tenant.status as tenant_status, tenant.brand, tenant.updated_at,
           project.status as project_status,
           project.canonical_host,
           active_run.kind as run_kind, active_run.status as run_status,
           latest_release.status as release_status,
           latest_release.error as release_error
    from tenants tenant
    left join studio_projects project on project.tenant_id = tenant.id
    left join lateral (
      select run.kind, run.status
      from studio_runs run
      where run.project_id = project.id
        and run.status in ('queued', 'running', 'cancel_requested')
      order by run.created_at desc limit 1
    ) active_run on true
    left join lateral (
      select release.status, release.error
      from studio_releases release
      where release.project_id = project.id
      order by release.created_at desc limit 1
    ) latest_release on true
    where tenant.workspace_id = ${EIXU_STUDIO_WORKSPACE_ID}
    order by tenant.updated_at desc, tenant.created_at desc
  `) as Row[];
  return rows.map((row) => ({
    id: text(row.id),
    slug: text(row.slug),
    name: text(row.name),
    tenantStatus: row.tenant_status as StudioDashboardProject['tenantStatus'],
    projectStatus: (row.project_status ||
      (row.tenant_status === 'archived'
        ? 'archived'
        : 'draft')) as StudioDashboardProject['projectStatus'],
    direction: studioDirectionOf((row.brand ?? {}) as Record<string, unknown>),
    canonicalHost: text(row.canonical_host) || `${text(row.slug)}.eixu.com.br`,
    updatedAt: new Date(row.updated_at as string | Date).toISOString(),
    run: row.run_status
      ? { kind: text(row.run_kind), status: text(row.run_status) }
      : null,
    release: row.release_status
      ? {
          status: text(row.release_status),
          error: text(row.release_error) || null,
        }
      : null,
  }));
}
