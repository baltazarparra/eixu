import { db } from '@/lib/db';
import type {
  Critique,
  ImageKind,
  ImageStatus,
  TenantImage,
} from '@/lib/types';

type Row = Record<string, unknown>;

function text(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'number') return String(value);
  return fallback;
}

function toImage(row: Row): TenantImage {
  return {
    id: text(row.id),
    seq: Number(row.seq ?? 0),
    kind: ((row.kind as string) ?? 'foto') as ImageKind,
    referenceUrls: (row.reference_urls ?? []) as string[],
    batchId: text(row.batch_id),
    requestText: text(row.request_text),
    targetBlock: (row.target_block as string) ?? null,
    ratio: text(row.ratio),
    model: text(row.model),
    url: text(row.url),
    blobPath: text(row.blob_path),
    status: row.status as ImageStatus,
    score:
      row.score === null || row.score === undefined ? null : Number(row.score),
    critique: (row.critique ?? {}) as Critique,
    alt: (row.alt as string) ?? null,
    description: (row.description as string) ?? null,
    createdAt: text(row.created_at),
    ...(row.width && row.height
      ? { width: Number(row.width), height: Number(row.height) }
      : {}),
  };
}

export async function listImages(
  tenantId: string,
  status?: ImageStatus,
): Promise<TenantImage[]> {
  const rows = (
    status
      ? await db()`
        select * from images
        where tenant_id = ${tenantId} and status = ${status}
        order by created_at desc, seq desc limit 200
      `
      : await db()`
        select * from images
        where tenant_id = ${tenantId}
        order by created_at desc, seq desc limit 200
      `
  ) as Row[];
  return rows.map(toImage);
}

export async function getImage(
  tenantId: string,
  id: string,
): Promise<TenantImage | null> {
  const rows = (await db()`
    select * from images where tenant_id = ${tenantId} and id = ${id} limit 1
  `) as Row[];
  return rows[0] ? toImage(rows[0]) : null;
}

export async function getImageByNumber(
  tenantId: string,
  seq: number,
): Promise<TenantImage | null> {
  const rows = (await db()`
    select * from images where tenant_id = ${tenantId} and seq = ${seq} limit 1
  `) as Row[];
  return rows[0] ? toImage(rows[0]) : null;
}

export async function getImageByStudioRequest(
  tenantId: string,
  requestKey: string,
): Promise<TenantImage | null> {
  const rows = (await db()`
    select * from images
    where tenant_id = ${tenantId} and studio_request_key = ${requestKey}
    limit 1
  `) as Row[];
  return rows[0] ? toImage(rows[0]) : null;
}

function isUniqueViolation(error: unknown): boolean {
  const code = (error as { code?: unknown })?.code;
  return code === '23505' || /images_tenant_id_seq_key/i.test(String(error));
}

export async function insertImage(input: {
  tenantId: string;
  batchId: string;
  studioRequestKey?: string;
  requestText: string;
  targetBlock: string;
  ratio: string;
  model: string;
  promptFinal: string;
  url: string;
  blobPath: string;
  kind?: ImageKind;
  referenceUrls?: string[];
  alt?: string;
  width?: number;
  height?: number;
}): Promise<TenantImage> {
  if (input.studioRequestKey) {
    const existing = await getImageByStudioRequest(
      input.tenantId,
      input.studioRequestKey,
    );
    if (existing) return existing;
  }
  for (let attempt = 0; ; attempt += 1) {
    try {
      const rows = (await db()`
        insert into images (
          tenant_id, seq, batch_id, studio_request_key, request_text,
          target_block, ratio, model,
          prompt_final, url, blob_path, kind, reference_urls, status, alt,
          width, height
        )
        select ${input.tenantId}, coalesce(max(seq), 0) + 1,
          ${input.batchId}, ${input.studioRequestKey ?? null},
          ${input.requestText}, ${input.targetBlock},
          ${input.ratio}, ${input.model}, ${input.promptFinal}, ${input.url},
          ${input.blobPath}, ${input.kind ?? 'foto'},
          ${JSON.stringify(input.referenceUrls ?? [])}::jsonb, 'disponivel',
          ${input.alt ?? null}, ${input.width ?? null}, ${input.height ?? null}
        from images where tenant_id = ${input.tenantId}
        returning *
      `) as Row[];
      return toImage(rows[0]);
    } catch (error) {
      if (attempt >= 3 || !isUniqueViolation(error)) throw error;
      if (input.studioRequestKey) {
        const replay = await getImageByStudioRequest(
          input.tenantId,
          input.studioRequestKey,
        );
        if (replay) return replay;
      }
    }
  }
}

export async function updateImageMetadata(
  tenantId: string,
  id: string,
  alt: string,
): Promise<TenantImage | null> {
  const rows = (await db()`
    update images set alt = ${alt}
    where tenant_id = ${tenantId} and id = ${id}
    returning *
  `) as Row[];
  return rows[0] ? toImage(rows[0]) : null;
}

export async function deleteImage(tenantId: string, id: string): Promise<void> {
  await db()`delete from images where tenant_id = ${tenantId} and id = ${id}`;
}

export async function referenceReason(
  tenantId: string,
  url: string,
): Promise<'conteudo' | 'logo' | null> {
  const content = (await db()`
    select 1
    from studio_projects project
    join studio_content_revisions revision
      on revision.project_id = project.id
    where project.tenant_id = ${tenantId}
      and (
        revision.id = project.active_content_revision_id
        or revision.id in (
          select release.content_revision_id
          from studio_releases release
          where release.project_id = project.id
            and release.status in ('active', 'ready')
        )
      )
      and revision.content::text like ${'%' + url + '%'}
    limit 1
  `) as Row[];
  if (content.length) return 'conteudo';
  const logo = (await db()`
    select 1 from tenants
    where id = ${tenantId} and brand->>'logoUrl' = ${url}
    limit 1
  `) as Row[];
  return logo.length ? 'logo' : null;
}

export function referenceMessage(
  seq: number,
  reason: 'conteudo' | 'logo',
): string {
  return reason === 'logo'
    ? `A imagem #${seq} é o logo. Escolha outro logo antes de apagá-la.`
    : `A imagem #${seq} está em uso no conteúdo atual ou publicado.`;
}
