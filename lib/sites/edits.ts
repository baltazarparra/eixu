import { db } from '@/lib/db';
import { PageEditError, pageRevision } from '@/lib/ai/page-edits';
import {
  dropPageRevision,
  lastPageRevision,
  recordPageRevision,
  type RevisionOrigin,
} from '@/lib/sites/revisions';
import { lintPage, formatFindings } from '@/lib/taste/lint';
import { lintTextStyles } from '@/lib/blocks/text-style-lint';
import type { BlockInstance, Brand, Page, Tenant } from '@/lib/types';

/** Chat e edição direta compartilham validação e comparação atômica do rascunho. */
export async function savePageEdit({
  tenant,
  page,
  blocks,
  brand,
  origin = 'chat',
  summary,
}: {
  tenant: Pick<Tenant, 'id'>;
  page: Page;
  blocks: BlockInstance[];
  brand: Brand;
  /** De onde veio a escrita; fica no histórico do rascunho. */
  origin?: RevisionOrigin;
  /** O que este lote mudou, para o operador reconhecer o que o desfazer alcança. */
  summary?: string;
}) {
  const check = (draft: Page) => [
    ...lintPage(draft, brand.design),
    ...lintTextStyles(draft, brand),
  ];
  const before = check(page);
  const findings = check({ ...page, blocks });
  const signature = (f: (typeof findings)[number]) =>
    JSON.stringify([f.rule, f.blockId, f.message]);
  const previous = new Set(
    before.filter((f) => f.level === 'error').map(signature),
  );
  const introduced = findings.filter(
    (f) => f.level === 'error' && !previous.has(signature(f)),
  );
  if (introduced.length)
    throw new PageEditError(
      `Nenhuma alteração salva. O pedido introduziria erros: ${formatFindings(introduced)}`,
      422,
      introduced.map((f) => ({
        block: f.blockId ?? '',
        path:
          'path' in f
            ? String(f.path)
            : f.rule === 'hero-headline'
              ? 'headline'
              : f.rule === 'hero-subtexto'
                ? 'subtext'
                : '',
        message: f.message,
      })),
    );
  const previousRevision = pageRevision(page);
  const revision = pageRevision({ blocks });
  const changed = revision !== previousRevision;
  let undoAvailable = false;
  if (changed) {
    const saved = await db()`
      update pages set blocks = ${JSON.stringify(blocks)}::jsonb, updated_at = now()
      where id = ${page.id} and tenant_id = ${tenant.id}
        and blocks = ${JSON.stringify(page.blocks)}::jsonb
      returning id
    `;
    if (!Array.isArray(saved) || !saved.length)
      throw new PageEditError(
        'A página mudou durante a edição. Nenhuma alteração salva por esta chamada. Releia com get_page e reaplique apenas o pedido atual.',
        409,
      );
    // Depois da escrita: guardar antes e falhar aqui deixaria histórico de uma
    // edição que não aconteceu. O estado anterior já está em memória.
    undoAvailable = await recordPageRevision({
      tenantId: tenant.id,
      pageId: page.id,
      blocks: page.blocks,
      revision: previousRevision,
      origin,
      summary,
    });
  }
  return {
    ok: true,
    changed,
    page: `/${page.slug}`,
    revision,
    undoAvailable,
    preflight: formatFindings(findings),
    existingErrors: findings.filter((f) => f.level === 'error').length,
    saved: 'draft',
  };
}

/**
 * Restaura o rascunho da página para a versão anterior guardada.
 *
 * Não é um histórico de versões do site: alcança a última escrita do rascunho
 * daquela página e guarda o estado atual antes de restaurar, para que um
 * segundo desfazer devolva o que estava aqui. Snapshots publicados não mudam.
 */
export async function undoPageEdit({
  tenant,
  page,
  brand,
}: {
  tenant: Pick<Tenant, 'id'>;
  page: Page;
  brand: Brand;
}) {
  const previous = await lastPageRevision(tenant.id, page.id);
  if (!previous)
    throw new PageEditError(
      `Não há alteração anterior guardada para /${page.slug}. O desfazer alcança apenas as edições feitas depois que o histórico do rascunho passou a ser gravado. Nenhuma alteração foi feita.`,
      404,
    );
  const current = pageRevision(page);
  if (previous.revision === current)
    throw new PageEditError(
      `A página /${page.slug} já está na versão anterior guardada. Nenhuma alteração foi feita.`,
      409,
    );
  const saved = await db()`
    update pages set blocks = ${JSON.stringify(previous.blocks)}::jsonb, updated_at = now()
    where id = ${page.id} and tenant_id = ${tenant.id}
      and blocks = ${JSON.stringify(page.blocks)}::jsonb
    returning id
  `;
  if (!Array.isArray(saved) || !saved.length)
    throw new PageEditError(
      'A página mudou durante o desfazer. Nada foi restaurado. Releia a página e tente de novo.',
      409,
    );
  // O estado que acabou de sair vira o próximo ponto de retorno; a versão
  // consumida sai da fila para o desfazer não ficar oscilando entre as duas.
  await recordPageRevision({
    tenantId: tenant.id,
    pageId: page.id,
    blocks: page.blocks,
    revision: current,
    origin: 'desfazer',
    summary: 'Estado anterior ao desfazer.',
  });
  await dropPageRevision(previous.id);
  const findings = [
    ...lintPage({ ...page, blocks: previous.blocks }, brand.design),
    ...lintTextStyles({ ...page, blocks: previous.blocks }, brand),
  ];
  return {
    ok: true,
    changed: true,
    page: `/${page.slug}`,
    revision: previous.revision,
    undoAvailable: true,
    restored: {
      origin: previous.origin,
      summary: previous.summary,
      createdAt: previous.createdAt,
    },
    preflight: formatFindings(findings),
    existingErrors: findings.filter((f) => f.level === 'error').length,
    saved: 'draft',
  };
}
