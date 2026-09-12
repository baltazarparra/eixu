import { db } from '@/lib/db';
import { PageEditError, pageRevision } from '@/lib/ai/page-edits';
import { lintPage, formatFindings } from '@/lib/taste/lint';
import { lintTextStyles } from '@/lib/blocks/text-style-lint';
import type { BlockInstance, Brand, Page, Tenant } from '@/lib/types';

/** Chat e edição direta compartilham validação e comparação atômica do rascunho. */
export async function savePageEdit({
  tenant,
  page,
  blocks,
  brand,
}: {
  tenant: Pick<Tenant, 'id'>;
  page: Page;
  blocks: BlockInstance[];
  brand: Brand;
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
  const revision = pageRevision({ blocks });
  const changed = revision !== pageRevision(page);
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
  }
  return {
    ok: true,
    changed,
    page: `/${page.slug}`,
    revision,
    preflight: formatFindings(findings),
    existingErrors: findings.filter((f) => f.level === 'error').length,
    saved: 'draft',
  };
}
