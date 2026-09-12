import { z } from 'zod';
import type { Vibe } from './vibes';

/**
 * Três jornadas completas por vibe. A chave fica no perfil v5 para que o
 * plano de cenas, o prompt, o pre-flight e o renderer usem a mesma decisão.
 */
export const STRUCTURE_KEYS = [
  'comercial-atendimento',
  'comercial-vitrine',
  'comercial-confianca',
  'moderno-editorial',
  'moderno-sistema',
  'moderno-exploracao',
  'ousado-manifesto',
  'ousado-campanha',
  'ousado-mostruario',
  'artistico-atelier',
  'artistico-revista',
  'artistico-galeria',
] as const;

export type StructureKey = (typeof STRUCTURE_KEYS)[number];
export const structureKeySchema = z.enum(STRUCTURE_KEYS);

/** Cada estrutura usa um arranjo autoral próprio no bloco de assinatura. */
export const SIGNATURE_LAYOUTS = [
  'decision-path',
  'service-lens',
  'proof-route',
  'editorial-index',
  'system-map',
  'detail-lens',
  'impact-manifesto',
  'campaign-sequence',
  'visual-selector',
  'material-table',
  'editorial-spread',
  'story-orbit',
] as const;

export type SignatureLayout = (typeof SIGNATURE_LAYOUTS)[number];

export const SIGNATURE_MAP_LAYOUTS: readonly SignatureLayout[] = [
  'proof-route',
  'system-map',
  'material-table',
];

/** Ordem compartilhada pelo renderer e pela comparação entre tenants. */
export function signatureItemsInRenderOrder<T>(
  layout: string,
  items: T[],
): T[] {
  if (!SIGNATURE_MAP_LAYOUTS.some((candidate) => candidate === layout))
    return items;
  const focus = items.findIndex(
    (item) =>
      item !== null &&
      typeof item === 'object' &&
      'role' in item &&
      item.role === 'focus',
  );
  if (focus <= 0) return items;
  return [items[focus], ...items.slice(0, focus), ...items.slice(focus + 1)];
}

export type SiteStructure = {
  key: StructureKey;
  vibe: Vibe;
  label: string;
  intent: string;
  /** Ordem mínima. Outras seções podem entrar entre estas marcas. */
  sequence: readonly string[];
  openings: readonly string[];
  protagonists: readonly string[];
  innerOpenings: readonly string[];
  closings: readonly string[];
  support: readonly string[];
  signatureLayout: SignatureLayout;
  signatureRatio: '4:3' | '16:9' | '4:5';
};

export const SITE_STRUCTURES: Record<StructureKey, SiteStructure> = {
  'comercial-atendimento': {
    key: 'comercial-atendimento',
    vibe: 'comercial',
    label: 'Atendimento guiado',
    intent:
      'Começa pela necessidade, organiza o caminho de decisão e conduz ao contato.',
    sequence: [
      'hero.split:split',
      'feature.numbered:ledger',
      'signature.composition:decision-path',
      'faq.accordion:split',
      'form.lead:panel',
    ],
    openings: ['hero.split:split'],
    protagonists: ['signature.composition:decision-path'],
    innerOpenings: ['hero.statement:framed', 'hero.split:split'],
    closings: ['form.lead:panel'],
    support: ['narrative.split', 'media.image'],
    signatureLayout: 'decision-path',
    signatureRatio: '4:3',
  },
  'comercial-vitrine': {
    key: 'comercial-vitrine',
    vibe: 'comercial',
    label: 'Vitrine de aplicações',
    intent:
      'Mostra a oferta em uso, deixa comparar alternativas e abre caminhos de aprofundamento.',
    sequence: [
      'hero.split:cover',
      'signature.composition:service-lens',
      'feature.explorer:showroom',
      'editorial.resources:feature',
      'cta.band:split',
    ],
    openings: ['hero.split:cover'],
    protagonists: ['signature.composition:service-lens'],
    innerOpenings: ['hero.split:split', 'hero.statement:framed'],
    closings: ['cta.band:split'],
    support: ['media.image', 'narrative.split'],
    signatureLayout: 'service-lens',
    signatureRatio: '4:3',
  },
  'comercial-confianca': {
    key: 'comercial-confianca',
    vibe: 'comercial',
    label: 'Confiança por evidências',
    intent:
      'Constrói confiança pela clareza da abordagem, responde dúvidas e fecha a história visualmente.',
    sequence: [
      'hero.split:split',
      'editorial.text:narrow',
      'faq.accordion:stack',
      'signature.composition:proof-route',
      'cta.band:band',
    ],
    openings: ['hero.split:split'],
    protagonists: ['signature.composition:proof-route'],
    innerOpenings: ['hero.statement:framed', 'hero.split:split'],
    closings: ['cta.band:band'],
    support: ['narrative.split', 'media.image'],
    signatureLayout: 'proof-route',
    signatureRatio: '16:9',
  },
  'moderno-editorial': {
    key: 'moderno-editorial',
    vibe: 'moderno',
    label: 'Capítulos editoriais',
    intent:
      'Abre espaço para uma ideia forte e aprofunda a oferta em capítulos precisos.',
    sequence: [
      'hero.split:editorial',
      'editorial.text:lead',
      'signature.composition:editorial-index',
      'narrative.split:editorial',
      'cta.band:minimal',
    ],
    openings: ['hero.split:editorial'],
    protagonists: ['signature.composition:editorial-index'],
    innerOpenings: ['hero.statement:framed', 'hero.split:editorial'],
    closings: ['cta.band:minimal'],
    support: ['media.image', 'narrative.split'],
    signatureLayout: 'editorial-index',
    signatureRatio: '16:9',
  },
  'moderno-sistema': {
    key: 'moderno-sistema',
    vibe: 'moderno',
    label: 'Sistema em funcionamento',
    intent:
      'Revela relações entre partes, processo e resultado como um sistema legível.',
    sequence: [
      'hero.split:offset',
      'signature.composition:system-map',
      'feature.numbered:rail',
      'narrative.steps:chapters',
      'cta.band:split',
    ],
    openings: ['hero.split:offset'],
    protagonists: ['signature.composition:system-map'],
    innerOpenings: ['hero.statement:framed', 'hero.split:editorial'],
    closings: ['cta.band:split'],
    support: ['narrative.split', 'media.image'],
    signatureLayout: 'system-map',
    signatureRatio: '4:3',
  },
  'moderno-exploracao': {
    key: 'moderno-exploracao',
    vibe: 'moderno',
    label: 'Exploração de detalhes',
    intent:
      'Parte de aplicações concretas e permite investigar os detalhes antes da conversão.',
    sequence: [
      'hero.split:editorial',
      'feature.explorer:panorama',
      'signature.composition:detail-lens',
      'editorial.resources:list',
      'form.lead:panel',
    ],
    openings: ['hero.split:editorial'],
    protagonists: ['signature.composition:detail-lens'],
    innerOpenings: ['hero.statement:framed', 'hero.split:editorial'],
    closings: ['form.lead:panel'],
    support: ['media.image', 'narrative.split'],
    signatureLayout: 'detail-lens',
    signatureRatio: '4:3',
  },
  'ousado-manifesto': {
    key: 'ousado-manifesto',
    vibe: 'ousado',
    label: 'Manifesto visual',
    intent:
      'Faz uma afirmação curta, prova pela imagem e termina com uma ação inequívoca.',
    sequence: [
      'hero.split:cover',
      'signature.composition:impact-manifesto',
      'editorial.text:lead',
      'media.image:bleed',
      'cta.band:poster',
    ],
    openings: ['hero.split:cover'],
    protagonists: ['signature.composition:impact-manifesto'],
    innerOpenings: ['hero.statement:oversize', 'hero.statement:center'],
    closings: ['cta.band:poster'],
    support: ['media.image', 'media.image'],
    signatureLayout: 'impact-manifesto',
    signatureRatio: '16:9',
  },
  'ousado-campanha': {
    key: 'ousado-campanha',
    vibe: 'ousado',
    label: 'Campanha em sequência',
    intent:
      'Constrói impacto em quadros sucessivos, alternando fotografia, frase e ação.',
    sequence: [
      'hero.split:poster',
      'media.gallery:collage',
      'signature.composition:campaign-sequence',
      'narrative.steps:horizontal',
      'cta.band:band',
    ],
    openings: ['hero.split:poster'],
    protagonists: ['signature.composition:campaign-sequence'],
    innerOpenings: ['hero.statement:oversize', 'hero.statement:center'],
    closings: ['cta.band:band'],
    support: ['media.image', 'media.image'],
    signatureLayout: 'campaign-sequence',
    signatureRatio: '4:3',
  },
  'ousado-mostruario': {
    key: 'ousado-mostruario',
    vibe: 'ousado',
    label: 'Mostruário gráfico',
    intent:
      'Transforma produtos ou aplicações em uma seleção visual de leitura rápida.',
    sequence: [
      'hero.split:cover',
      'signature.composition:visual-selector',
      'media.gallery:grid',
      'editorial.facts:poster',
      'cta.band:poster',
    ],
    openings: ['hero.split:cover'],
    protagonists: ['signature.composition:visual-selector'],
    innerOpenings: ['hero.statement:oversize', 'hero.statement:center'],
    closings: ['cta.band:poster'],
    support: ['media.image', 'media.image'],
    signatureLayout: 'visual-selector',
    signatureRatio: '4:5',
  },
  'artistico-atelier': {
    key: 'artistico-atelier',
    vibe: 'artistico',
    label: 'Mesa de atelier',
    intent:
      'Apresenta matéria, gesto e detalhes como objetos de uma mesma composição.',
    sequence: [
      'hero.split:atelier',
      'signature.composition:material-table',
      'narrative.split:overlap',
      'media.gallery:masonry',
      'form.lead:stack',
    ],
    openings: ['hero.split:atelier'],
    protagonists: ['signature.composition:material-table'],
    innerOpenings: ['hero.statement:center', 'hero.split:offset'],
    closings: ['form.lead:stack'],
    support: ['narrative.split', 'media.image'],
    signatureLayout: 'material-table',
    signatureRatio: '4:3',
  },
  'artistico-revista': {
    key: 'artistico-revista',
    vibe: 'artistico',
    label: 'Ensaio de revista',
    intent:
      'Combina manchete, imagens e leitura longa em uma sequência editorial próxima.',
    sequence: [
      'hero.split:offset',
      'editorial.text:lead',
      'signature.composition:editorial-spread',
      'editorial.resources:feature',
      'cta.band:split',
    ],
    openings: ['hero.split:offset'],
    protagonists: ['signature.composition:editorial-spread'],
    innerOpenings: ['hero.statement:center', 'hero.split:offset'],
    closings: ['cta.band:split'],
    support: ['narrative.split', 'media.image'],
    signatureLayout: 'editorial-spread',
    signatureRatio: '16:9',
  },
  'artistico-galeria': {
    key: 'artistico-galeria',
    vibe: 'artistico',
    label: 'Galeria guiada',
    intent:
      'Conduz por uma coleção de cenas e histórias, com ritmo de visita e descoberta.',
    sequence: [
      'hero.split:atelier',
      'media.gallery:filmstrip',
      'signature.composition:story-orbit',
      'narrative.split:reverse',
      'cta.band:band',
    ],
    openings: ['hero.split:atelier'],
    protagonists: ['signature.composition:story-orbit'],
    innerOpenings: ['hero.statement:center', 'hero.split:offset'],
    closings: ['cta.band:band'],
    support: ['narrative.split', 'media.image'],
    signatureLayout: 'story-orbit',
    signatureRatio: '4:5',
  },
};

export const STRUCTURES_BY_VIBE: Record<Vibe, readonly SiteStructure[]> = {
  comercial: STRUCTURE_KEYS.filter((key) => key.startsWith('comercial-')).map(
    (key) => SITE_STRUCTURES[key],
  ),
  moderno: STRUCTURE_KEYS.filter((key) => key.startsWith('moderno-')).map(
    (key) => SITE_STRUCTURES[key],
  ),
  ousado: STRUCTURE_KEYS.filter((key) => key.startsWith('ousado-')).map(
    (key) => SITE_STRUCTURES[key],
  ),
  artistico: STRUCTURE_KEYS.filter((key) => key.startsWith('artistico-')).map(
    (key) => SITE_STRUCTURES[key],
  ),
};

export function isStructureKey(value: unknown): value is StructureKey {
  return (
    typeof value === 'string' &&
    (STRUCTURE_KEYS as readonly string[]).includes(value)
  );
}

export function structureFor(vibe: Vibe, key: unknown): SiteStructure | null {
  if (!isStructureKey(key)) return null;
  const structure = SITE_STRUCTURES[key];
  return structure.vibe === vibe ? structure : null;
}

export function structuresDirection(vibe: Vibe): string {
  return STRUCTURES_BY_VIBE[vibe]
    .map(
      (structure) =>
        `- ${structure.key} (${structure.label}): ${structure.intent} Sequência mínima: ${structure.sequence.join(' > ')}.`,
    )
    .join('\n');
}
