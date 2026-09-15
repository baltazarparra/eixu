import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const GENERATOR_MANUAL_PATH = 'docs/manual-gerador-sites.md';

export const GENERATOR_MANUAL_SECTIONS = [
  ['visao-geral', 'Visão geral'],
  ['acesso-e-painel', 'Acesso e painel'],
  ['cadastro-e-fontes', 'Cadastro e fontes'],
  ['direcao-e-vibes', 'Direção, vibes e estruturas'],
  ['geracao-e-retomada', 'Geração e retomada'],
  ['catalogo-de-blocos', 'Catálogo de blocos'],
  ['imagens-e-logos', 'Imagens e logos'],
  ['conversa-e-edicao', 'Conversa e edição'],
  ['preview-qualidade-publicacao', 'Prévia, qualidade e publicação'],
  ['seo-conversao-trafego', 'SEO, conversão e tráfego'],
  ['ferramentas-do-agente', 'Ferramentas do agente'],
  ['limites-atuais', 'Limites atuais'],
  ['operacao-e-verificacao', 'Operação e verificação'],
] as const;

export type GeneratorManualSection =
  (typeof GENERATOR_MANUAL_SECTIONS)[number][0];

export const GENERATOR_MANUAL_SECTION_IDS = GENERATOR_MANUAL_SECTIONS.map(
  ([id]) => id,
) as [GeneratorManualSection, ...GeneratorManualSection[]];

const manual = readFileSync(join(process.cwd(), GENERATOR_MANUAL_PATH), 'utf8');

function section(heading: string): string {
  const marker = `## ${heading}`;
  const start = manual.indexOf(marker);
  if (start < 0)
    throw new Error(
      `Seção obrigatória ausente em ${GENERATOR_MANUAL_PATH}: ${heading}`,
    );
  const end = manual.indexOf('\n## ', start + marker.length);
  return manual.slice(start, end < 0 ? undefined : end).trim();
}

const sections = new Map<GeneratorManualSection, string>(
  GENERATOR_MANUAL_SECTIONS.map(([id, heading]) => [id, section(heading)]),
);

export function generatorManualIndex(): string {
  return GENERATOR_MANUAL_SECTIONS.map(
    ([id, heading]) => `- ${id}: ${heading}`,
  ).join('\n');
}

export function readGeneratorManual(
  requested: GeneratorManualSection[],
): string {
  return [...new Set(requested)]
    .map((id) => sections.get(id))
    .filter((value): value is string => Boolean(value))
    .join('\n\n');
}
