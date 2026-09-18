import { db } from '@/lib/db';

type Row = Record<string, unknown>;

function text(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return `${value}`;
  return fallback;
}

export type StudioClientContext = {
  project: { id: string; slug: string; canonicalHost: string };
  client: {
    name: string;
    locale: string;
    brief: Record<string, unknown>;
    contacts: Record<string, unknown>;
    brand: Record<string, unknown>;
    contactEmail: string | null;
    whatsapp: string | null;
  };
  assets: Array<{
    seq: number;
    kind: string;
    url: string;
    alt: string | null;
    description: string | null;
  }>;
  artifacts: Array<{
    kind: 'context' | 'art_direction';
    version: number;
    payload: Record<string, unknown>;
    createdAt: string;
  }>;
  evidence: Array<{
    role: 'official' | 'visual_reference' | 'operator' | 'logo';
    url: string | null;
    title: string | null;
    excerpt: string | null;
    status: string;
    capturedAt: string;
  }>;
};

export async function studioClientContext(
  projectId: string,
): Promise<StudioClientContext> {
  const projects = (await db()`
    select project.id, project.slug, project.canonical_host,
           tenant.name, tenant.locale, tenant.brief, tenant.contacts,
           tenant.brand, tenant.contact_email, tenant.whatsapp
    from studio_projects project
    join tenants tenant on tenant.id = project.tenant_id
    where project.id = ${projectId}
    limit 1
  `) as Row[];
  const row = projects[0];
  if (!row) throw new Error('Projeto não encontrado.');
  const assets = (await db()`
    select image.seq, image.kind, image.url, image.alt, image.description
    from images image
    join studio_projects project on project.tenant_id = image.tenant_id
    where project.id = ${projectId}
      and image.status in ('disponivel', 'aprovada')
    order by image.seq
  `) as Row[];
  const artifacts = (await db()`
    select distinct on (artifact.kind)
      artifact.kind, artifact.version, artifact.payload, artifact.created_at
    from studio_artifacts artifact
    where artifact.project_id = ${projectId}
      and artifact.kind in ('context', 'art_direction')
    order by artifact.kind, artifact.version desc
  `) as Row[];
  const evidence = (await db()`
    select source.role, source.url, source.title, source.excerpt,
           source.status, source.captured_at
    from studio_source_evidence source
    where source.project_id = ${projectId}
    order by source.captured_at desc
    limit 30
  `) as Row[];
  return {
    project: {
      id: text(row.id),
      slug: text(row.slug),
      canonicalHost: text(row.canonical_host),
    },
    client: {
      name: text(row.name),
      locale: text(row.locale, 'pt-BR'),
      brief: (row.brief ?? {}) as Record<string, unknown>,
      contacts: (row.contacts ?? {}) as Record<string, unknown>,
      brand: (row.brand ?? {}) as Record<string, unknown>,
      contactEmail: text(row.contact_email) || null,
      whatsapp: text(row.whatsapp) || null,
    },
    assets: assets.map((asset) => ({
      seq: Number(asset.seq),
      kind: text(asset.kind),
      url: text(asset.url),
      alt: text(asset.alt) || null,
      description: text(asset.description) || null,
    })),
    artifacts: artifacts.map((artifact) => ({
      kind: artifact.kind as 'context' | 'art_direction',
      version: Number(artifact.version),
      payload: (artifact.payload ?? {}) as Record<string, unknown>,
      createdAt: text(artifact.created_at),
    })),
    evidence: evidence.map((source) => ({
      role: source.role as
        | 'official'
        | 'visual_reference'
        | 'operator'
        | 'logo',
      url: text(source.url) || null,
      title: text(source.title) || null,
      excerpt: text(source.excerpt) || null,
      status: text(source.status),
      capturedAt: text(source.captured_at),
    })),
  };
}
