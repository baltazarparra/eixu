import { createHash, randomBytes } from 'node:crypto';
import { db, transaction } from '@/lib/db';
import { pageFromRow, tenantFromRow } from '@/lib/tenant-queries';
import {
  PREMIUM_CONVERTER_VERSION,
  type PremiumSourceSnapshot,
  type PremiumWorkspaceState,
} from '@/lib/premium/types';
import {
  premiumSourceHash,
  premiumSourceSnapshot,
} from '@/lib/premium/snapshot';
import type { AdminUser } from '@/lib/auth';
import type { Tenant } from '@/lib/types';

type Row = Record<string, unknown>;

export class PremiumConversionError extends Error {
  constructor(
    message: string,
    readonly status = 409,
  ) {
    super(message);
    this.name = 'PremiumConversionError';
  }
}

function string(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return typeof value === 'string' ? value : '';
}

function sourceCommit(): string {
  return (
    process.env.VERCEL_GIT_COMMIT_SHA || process.env.EIXU_RELEASE_SHA || 'local'
  );
}

function bridgeTokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export type RequestedPremiumConversion = {
  id: string;
  status: string;
  projectId: string;
  projectKey: string;
  directory: string;
  canonicalUrl: string;
  sourceHash: string;
};

/**
 * Reserva o site e congela exatamente a apresentacao publicada. O lock do
 * tenant serializa o pedido com outras conversoes; os mutadores do gerador
 * tambem consultam `maintenance_mode` dentro de suas escritas.
 */
export async function requestPremiumConversion(input: {
  tenantId: string;
  requestedBy: AdminUser;
}): Promise<RequestedPremiumConversion> {
  return transaction(async (connection) => {
    const locked = await connection.query(
      'select * from tenants where id = $1 for update',
      [input.tenantId],
    );
    const row = locked.rows[0] as Row | undefined;
    if (!row) throw new PremiumConversionError('Cliente não encontrado.', 404);
    const tenant = tenantFromRow(row);

    if (tenant.status !== 'published')
      throw new PremiumConversionError(
        'Publique o site antes de ativá-lo como Premium.',
      );
    if (tenant.publicRuntime === 'premium')
      throw new PremiumConversionError('Este site já é um projeto Premium.');
    if (tenant.maintenanceMode !== 'generator') {
      const current = await connection.query(
        `select c.id, c.status, p.id as project_id, p.project_key,
                p.directory, p.canonical_host, c.source_hash
         from premium_conversions c
         join premium_projects p on p.id = c.project_id
         where c.tenant_id = $1
           and c.status in ('queued', 'claimed', 'exported', 'deploying')
         order by c.created_at desc limit 1`,
        [tenant.id],
      );
      const existing = current.rows[0] as Row | undefined;
      if (existing)
        return {
          id: string(existing.id),
          status: string(existing.status),
          projectId: string(existing.project_id),
          projectKey: string(existing.project_key),
          directory: string(existing.directory),
          canonicalUrl: `https://${string(existing.canonical_host)}`,
          sourceHash: string(existing.source_hash),
        };
      throw new PremiumConversionError(
        'O modo de manutenção atual não permite iniciar outra conversão.',
      );
    }

    const running = await connection.query(
      `select id from generation_runs
       where tenant_id = $1 and status in ('queued', 'running', 'stopping')
       limit 1`,
      [tenant.id],
    );
    if (running.rows.length)
      throw new PremiumConversionError(
        'Pause e aguarde a etapa atual da geração terminar antes de ativar o Premium.',
      );

    const pageRows = await connection.query(
      `select * from pages
       where tenant_id = $1 and published_blocks is not null
       order by published_nav_order asc nulls last, nav_order asc, created_at asc`,
      [tenant.id],
    );
    const snapshot = premiumSourceSnapshot(
      tenant,
      (pageRows.rows as Row[]).map(pageFromRow),
    );
    const hash = premiumSourceHash(snapshot);
    const key = tenant.slug;
    const directory = `apps/premium/${key}`;
    const canonicalHost = `${tenant.slug}.eixu.com.br`;
    const projectRows = await connection.query(
      `insert into premium_projects (
         tenant_id, project_key, directory, canonical_host,
         vercel_project_name, status, updated_at
       ) values ($1, $2, $3, $4, $5, 'preparing', now())
       on conflict (tenant_id) do update set
         status = 'preparing', updated_at = now()
       returning *`,
      [tenant.id, key, directory, canonicalHost, `eixu-premium-${key}`],
    );
    const project = projectRows.rows[0] as Row;
    const conversionRows = await connection.query(
      `insert into premium_conversions (
         tenant_id, project_id, requested_by, source_snapshot, source_hash,
         source_commit, converter_version
       ) values ($1, $2, $3, $4::jsonb, $5, $6, $7)
       returning *`,
      [
        tenant.id,
        project.id,
        input.requestedBy.id,
        JSON.stringify(snapshot),
        hash,
        sourceCommit(),
        PREMIUM_CONVERTER_VERSION,
      ],
    );
    const conversion = conversionRows.rows[0] as Row;
    await connection.query(
      `update tenants set maintenance_mode = 'converting', updated_at = now()
       where id = $1`,
      [tenant.id],
    );
    return {
      id: string(conversion.id),
      status: string(conversion.status),
      projectId: string(project.id),
      projectKey: string(project.project_key),
      directory: string(project.directory),
      canonicalUrl: `https://${string(project.canonical_host)}`,
      sourceHash: hash,
    };
  });
}

export async function premiumWorkspaceState(
  tenant: Pick<Tenant, 'id' | 'slug' | 'maintenanceMode' | 'publicRuntime'>,
): Promise<PremiumWorkspaceState> {
  let project: PremiumWorkspaceState['project'] = null;
  let conversion: PremiumWorkspaceState['conversion'] = null;
  try {
    const rows = (await db()`
      select p.id, p.project_key, p.directory, p.status as project_status,
             p.vercel_project_name, c.id as conversion_id,
             c.status as conversion_status, c.pull_request_url, c.error,
             c.created_at
      from premium_projects p
      left join lateral (
        select * from premium_conversions current
        where current.project_id = p.id
        order by current.created_at desc limit 1
      ) c on true
      where p.tenant_id = ${tenant.id}
      limit 1
    `) as Row[];
    const row = rows[0];
    if (row) {
      project = {
        id: string(row.id),
        key: string(row.project_key),
        directory: string(row.directory),
        status: row.project_status as NonNullable<
          PremiumWorkspaceState['project']
        >['status'],
        vercelProjectName: row.vercel_project_name
          ? string(row.vercel_project_name)
          : null,
      };
      if (row.conversion_id)
        conversion = {
          id: string(row.conversion_id),
          status: row.conversion_status as NonNullable<
            PremiumWorkspaceState['conversion']
          >['status'],
          pullRequestUrl: row.pull_request_url
            ? string(row.pull_request_url)
            : null,
          error: row.error ? string(row.error) : null,
          createdAt: string(row.created_at),
        };
    }
  } catch (error) {
    // Durante o deploy que antecede a migração, o painel antigo continua
    // utilizável. A rota de ativação ainda falha fechada até o schema existir.
    console.warn('[premium] estado indisponivel', {
      tenantId: tenant.id,
      error: error instanceof Error ? error.name : 'unknown',
    });
  }
  return {
    maintenanceMode: tenant.maintenanceMode,
    publicRuntime: tenant.publicRuntime,
    canonicalUrl: `https://${tenant.slug}.eixu.com.br`,
    project,
    conversion,
  };
}

export type ClaimedPremiumConversion = {
  id: string;
  projectId: string;
  projectKey: string;
  directory: string;
  canonicalHost: string;
  vercelProjectName: string;
  sourceHash: string;
  sourceCommit: string;
  converterVersion: string;
  snapshot: PremiumSourceSnapshot;
  bridgeToken: string;
};

/** Reserva um job por 20 minutos e entrega um novo token de projeto uma vez. */
export async function claimPremiumConversion(): Promise<ClaimedPremiumConversion | null> {
  const bridgeToken = randomBytes(32).toString('base64url');
  return transaction(async (connection) => {
    const selected = await connection.query(
      `select c.*, p.project_key, p.directory, p.canonical_host,
              p.vercel_project_name
       from premium_conversions c
       join premium_projects p on p.id = c.project_id
       where c.status = 'queued'
          or (c.status = 'claimed' and c.lease_expires_at < now())
       order by c.created_at asc
       for update of c skip locked
       limit 1`,
    );
    const row = selected.rows[0] as Row | undefined;
    if (!row) return null;
    await connection.query(
      `update premium_conversions set
         status = 'claimed', claimed_at = now(),
         lease_expires_at = now() + interval '45 minutes',
         error = null, updated_at = now()
       where id = $1`,
      [row.id],
    );
    await connection.query(
      `update premium_projects set bridge_token_hash = $2, updated_at = now()
       where id = $1`,
      [row.project_id, bridgeTokenHash(bridgeToken)],
    );
    return {
      id: string(row.id),
      projectId: string(row.project_id),
      projectKey: string(row.project_key),
      directory: string(row.directory),
      canonicalHost: string(row.canonical_host),
      vercelProjectName: string(row.vercel_project_name),
      sourceHash: string(row.source_hash),
      sourceCommit: string(row.source_commit),
      converterVersion: string(row.converter_version),
      snapshot: row.source_snapshot as PremiumSourceSnapshot,
      bridgeToken,
    };
  });
}

export async function markPremiumExported(input: {
  conversionId: string;
  branch: string;
  pullRequestUrl: string;
}): Promise<boolean> {
  const rows = (await db()`
    update premium_conversions set
      status = 'exported', branch = ${input.branch},
      pull_request_url = ${input.pullRequestUrl},
      lease_expires_at = null, updated_at = now()
    where id = ${input.conversionId} and status = 'claimed'
    returning id
  `) as Row[];
  return rows.length === 1;
}

export async function markPremiumDeploying(
  conversionId: string,
): Promise<boolean> {
  const updated = (await db()`
    update premium_conversions set
      status = 'deploying', error = null, updated_at = now()
    where id = ${conversionId} and status = 'exported'
    returning id
  `) as Row[];
  if (updated.length) return true;
  const current = (await db()`
    select status from premium_conversions where id = ${conversionId} limit 1
  `) as Row[];
  // Releases seguintes carregam o recibo da conversão de origem, mas não
  // reabrem seu estado já concluído.
  return current[0]?.status === 'activated';
}

export async function markPremiumReleaseFailed(input: {
  conversionId: string;
  error: string;
}): Promise<boolean> {
  const updated = (await db()`
    update premium_conversions set
      status = 'exported', error = ${input.error.slice(0, 4000)},
      updated_at = now()
    where id = ${input.conversionId} and status = 'deploying'
    returning id
  `) as Row[];
  if (updated.length) return true;
  const current = (await db()`
    select status from premium_conversions
    where id = ${input.conversionId} limit 1
  `) as Row[];
  return current[0]?.status === 'activated';
}

export async function failPremiumConversion(input: {
  conversionId: string;
  error: string;
}): Promise<boolean> {
  return transaction(async (connection) => {
    const rows = await connection.query(
      `update premium_conversions set
         status = 'failed', error = $2, lease_expires_at = null,
         finished_at = now(), updated_at = now()
       where id = $1 and status <> 'activated'
       returning tenant_id, project_id`,
      [input.conversionId, input.error.slice(0, 4000)],
    );
    const row = rows.rows[0] as Row | undefined;
    if (!row) return false;
    await connection.query(
      `update tenants set maintenance_mode = 'generator', updated_at = now()
       where id = $1 and public_runtime = 'generator'`,
      [row.tenant_id],
    );
    await connection.query(
      `update premium_projects set status = 'failed', updated_at = now()
       where id = $1 and status <> 'active'`,
      [row.project_id],
    );
    return true;
  });
}

export async function activatePremiumRelease(input: {
  conversionId?: string;
  projectKey: string;
  commitSha: string;
  deploymentId: string;
  deploymentUrl: string;
  vercelProjectId: string;
  manifest: Record<string, unknown>;
}): Promise<boolean> {
  return transaction(async (connection) => {
    const projects = await connection.query(
      `select * from premium_projects where project_key = $1 for update`,
      [input.projectKey],
    );
    const project = projects.rows[0] as Row | undefined;
    if (!project) return false;
    const tenants = await connection.query(
      `select status, maintenance_mode
       from tenants where id = $1 for update`,
      [project.tenant_id],
    );
    const tenant = tenants.rows[0] as Row | undefined;
    if (
      !tenant ||
      tenant.status !== 'published' ||
      !['converting', 'premium'].includes(string(tenant.maintenance_mode))
    )
      return false;
    let releaseConversionId: string | null = null;
    if (project.status !== 'active') {
      if (!input.conversionId) return false;
      const conversions = await connection.query(
        `select id from premium_conversions
         where id = $1 and project_id = $2
           and status in ('claimed', 'exported', 'deploying')
         for update`,
        [input.conversionId, project.id],
      );
      if (!conversions.rows.length) return false;
      releaseConversionId = input.conversionId;
    } else if (input.conversionId) {
      const origin = await connection.query(
        `select id from premium_conversions
         where id = $1 and project_id = $2 and status = 'activated'`,
        [input.conversionId, project.id],
      );
      if (!origin.rows.length) return false;
    }
    const releases = await connection.query(
      `insert into premium_releases (
         project_id, conversion_id, commit_sha, deployment_id,
         deployment_url, status, manifest, activated_at
       ) values ($1, $2, $3, $4, $5, 'active', $6::jsonb, now())
       on conflict (deployment_id) do update set
         status = 'active', activated_at = coalesce(premium_releases.activated_at, now())
       returning id`,
      [
        project.id,
        releaseConversionId,
        input.commitSha,
        input.deploymentId,
        input.deploymentUrl,
        JSON.stringify(input.manifest),
      ],
    );
    const release = releases.rows[0] as Row;
    await connection.query(
      `update premium_releases set status = 'rolled_back'
       where project_id = $1 and id <> $2 and status = 'active'`,
      [project.id, release.id],
    );
    await connection.query(
      `update premium_projects set
         active_release_id = $2, vercel_project_id = $3,
         status = 'active', updated_at = now()
       where id = $1`,
      [project.id, release.id, input.vercelProjectId],
    );
    await connection.query(
      `update tenants set maintenance_mode = 'premium',
         public_runtime = 'premium', updated_at = now()
       where id = $1 and status = 'published'`,
      [project.tenant_id],
    );
    if (releaseConversionId)
      await connection.query(
        `update premium_conversions set status = 'activated',
           finished_at = now(), lease_expires_at = null, updated_at = now()
         where id = $1 and project_id = $2`,
        [releaseConversionId, project.id],
      );
    return true;
  });
}

export async function premiumProjectByToken(
  token: string,
): Promise<{ tenantId: string; slug: string; canonicalHost: string } | null> {
  const hash = bridgeTokenHash(token);
  const rows = (await db()`
    select p.tenant_id, p.canonical_host, t.slug
    from premium_projects p
    join tenants t on t.id = p.tenant_id
    where p.bridge_token_hash = ${hash}
      and t.status = 'published'
      and (
        (p.status = 'active' and t.maintenance_mode = 'premium'
          and t.public_runtime = 'premium')
        or
        (p.status = 'preparing' and t.maintenance_mode = 'converting'
          and t.public_runtime = 'generator')
      )
    limit 1
  `) as Row[];
  const row = rows[0];
  return row
    ? {
        tenantId: string(row.tenant_id),
        slug: string(row.slug),
        canonicalHost: string(row.canonical_host),
      }
    : null;
}
