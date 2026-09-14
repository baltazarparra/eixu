import { structuralFindings, type SitePage } from '@/lib/taste/metrics';
import type { BlockInstance, Brand, TenantImage } from '@/lib/types';

/** O piso que uma remoção não deve derrubar sem o operador saber. */
const FLOOR_RULES = new Set([
  'home-protagonista',
  'protagonista-fora-da-vibe',
  'pagina-sem-foto',
]);

/**
 * Compara o piso de composição antes e depois de uma remoção.
 *
 * `lintPage` não enxerga essas regras e, na publicação, elas já são
 * recomendação: apagar a seção protagonista da home passava sem nenhum aviso
 * no momento em que o operador ainda podia decidir. Aqui vira pergunta, antes
 * da escrita, e apenas para lotes que removem blocos.
 */
export function compositionFloorError(input: {
  pages: SitePage[];
  slug: string;
  blocks: BlockInstance[];
  images: TenantImage[];
  brand: Brand;
  brief: Record<string, unknown>;
  confirmation: string;
}): string | null {
  const { pages, slug, blocks, images, brand, brief } = input;
  const path = `/${slug}`;
  const relevant = (list: SitePage[]) =>
    structuralFindings(list, images, brand, brief)
      .filter(
        (finding) =>
          finding.page === path &&
          finding.level === 'error' &&
          FLOOR_RULES.has(finding.rule),
      )
      .map((finding) => ({ rule: finding.rule, message: finding.message }));
  const before = new Set(relevant(pages).map((finding) => finding.rule));
  const after = relevant(
    pages.map((page) => (page.slug === slug ? { ...page, blocks } : page)),
  ).filter((finding) => !before.has(finding.rule));
  if (!after.length) return null;
  return `Esta remoção derruba o piso de composição de /${slug}: ${after
    .map((finding) => finding.message)
    .join(' ')} Nenhuma alteração foi salva. Explique isso ao operador e pergunte se, mesmo assim, ${input.confirmation}.`;
}
