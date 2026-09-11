import { db } from '@/lib/db';
import type {
  Critique,
  ImageGuide,
  ImageKind,
  ImageStatus,
  TenantImage,
} from '@/lib/types';

type Row = Record<string, unknown>;

const str = (value: unknown, fallback = ''): string => {
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'number') return String(value);
  return fallback;
};

function toImage(row: Row): TenantImage {
  return {
    id: str(row.id),
    seq: Number(row.seq ?? 0),
    kind: ((row.kind as string) ?? 'foto') as ImageKind,
    referenceUrls: (row.reference_urls ?? []) as string[],
    batchId: str(row.batch_id),
    requestText: str(row.request_text),
    targetBlock: (row.target_block as string) ?? null,
    ratio: str(row.ratio),
    model: str(row.model),
    url: str(row.url),
    blobPath: str(row.blob_path),
    status: row.status as ImageStatus,
    score:
      row.score === null || row.score === undefined ? null : Number(row.score),
    critique: (row.critique ?? {}) as Critique,
    alt: (row.alt as string) ?? null,
    description: (row.description as string) ?? null,
    createdAt: str(row.created_at),
  };
}

export async function listImages(
  tenantId: string,
  status?: ImageStatus,
): Promise<TenantImage[]> {
  const rows = (
    status
      ? await db()`
        select * from images where tenant_id = ${tenantId} and status = ${status}
        order by created_at desc, seq desc limit 200
      `
      : await db()`
        select * from images where tenant_id = ${tenantId}
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

/** Consulta direta: o número continua acessível fora das 200 imagens recentes. */
export async function getImageByNumber(
  tenantId: string,
  seq: number,
): Promise<TenantImage | null> {
  const rows = (await db()`
    select * from images where tenant_id = ${tenantId} and seq = ${seq} limit 1
  `) as Row[];
  return rows[0] ? toImage(rows[0]) : null;
}

/** Violação de unicidade do Postgres. Duas cenas simultâneas podem colidir. */
function isUniqueViolation(error: unknown): boolean {
  const code = (error as { code?: unknown })?.code;
  return (
    code === '23505' ||
    /duplicate key|images_tenant_id_seq_key/i.test(String(error))
  );
}

export async function insertImage(input: {
  tenantId: string;
  batchId: string;
  requestText: string;
  targetBlock: string;
  ratio: string;
  model: string;
  promptFinal: string;
  url: string;
  blobPath: string;
  kind?: ImageKind;
  referenceUrls?: string[];
}): Promise<TenantImage> {
  // O número é reservado dentro do próprio insert. Ler o máximo antes e gravar
  // depois só funcionava com geração sequencial: com cenas em paralelo dois
  // inserts pegavam o mesmo seq e a unicidade derrubava a segunda imagem.
  for (let attempt = 0; ; attempt++) {
    try {
      const rows = (await db()`
        insert into images (tenant_id, seq, batch_id, request_text, target_block, ratio, model, prompt_final,
                            url, blob_path, kind, reference_urls, status)
        select ${input.tenantId}, coalesce(max(seq), 0) + 1, ${input.batchId}, ${input.requestText},
               ${input.targetBlock}, ${input.ratio}, ${input.model}, ${input.promptFinal},
               ${input.url}, ${input.blobPath}, ${input.kind ?? 'foto'},
               ${JSON.stringify(input.referenceUrls ?? [])}::jsonb, 'disponivel'
        from images where tenant_id = ${input.tenantId}
        returning *
      `) as Row[];
      return toImage(rows[0]);
    } catch (error) {
      if (attempt >= 3 || !isUniqueViolation(error)) throw error;
    }
  }
}

export async function saveCritique(
  id: string,
  critique: Critique,
): Promise<void> {
  const score = typeof critique.nota === 'number' ? critique.nota : null;
  await db()`
    update images set critique = ${JSON.stringify(critique)}::jsonb, score = ${score},
      alt = coalesce(alt, ${critique.alt_sugerido ?? null}),
      description = coalesce(description, ${critique.descricao ?? null})
    where id = ${id}
  `;
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

/**
 * Imagem em uso não pode ser apagada sem quebrar o site: vale para bloco de
 * página e também para o logo ativo, que vive em tenants.brand. Devolve o
 * motivo, para o aviso dizer onde procurar.
 */
export async function referenceReason(
  tenantId: string,
  url: string,
): Promise<'pagina' | 'logo' | null> {
  const inPages = (await db()`
    select 1 from pages where tenant_id = ${tenantId}
      and (blocks::text like ${'%' + url + '%'} or published_blocks::text like ${'%' + url + '%'}) limit 1
  `) as Row[];
  if (inPages.length) return 'pagina';
  const asLogo = (await db()`
    select 1 from tenants where id = ${tenantId} and brand->>'logoUrl' = ${url} limit 1
  `) as Row[];
  return asLogo.length ? 'logo' : null;
}

/** Texto pronto para o bloqueio de exclusão. */
export function referenceMessage(
  seq: number,
  reason: 'pagina' | 'logo',
): string {
  return reason === 'logo'
    ? `A imagem #${seq} é o logo do site. Defina outro logo antes de apagar.`
    : `A imagem #${seq} está em uso numa página. Troque a imagem do bloco antes de apagar.`;
}

export async function getGuide(tenantId: string): Promise<ImageGuide> {
  const rows =
    (await db()`select image_guide from tenants where id = ${tenantId}`) as Row[];
  return (rows[0]?.image_guide ?? {}) as ImageGuide;
}

export async function setGuide(
  tenantId: string,
  guide: ImageGuide,
): Promise<ImageGuide> {
  const next = { ...guide, definedAt: new Date().toISOString() };
  await db()`
    update tenants set image_guide = ${JSON.stringify(next)}::jsonb, updated_at = now() where id = ${tenantId}
  `;
  return next;
}

export function guideIsEmpty(guide: ImageGuide): boolean {
  return !guide.estilo && !guide.luz && !(guide.paleta ?? []).length;
}
