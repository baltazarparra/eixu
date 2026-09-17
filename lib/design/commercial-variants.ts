import type { Ratio } from '@/lib/images/ratios';
import type { SceneRole } from '@/lib/images/scene-slots';
import { SCENE_TARGET_BLOCKS } from '@/lib/images/scene-slots';

/**
 * Variações por área da Comercial v8.
 *
 * A estrutura `comercial-marca` nasceu com uma sequência literal: todo cliente
 * recebia as mesmas treze seções, nos mesmos layouts, com o mesmo repertório de
 * fotos. A trava de unicidade chegou a ser desligada para a v8 justamente
 * porque não havia o que comparar. Aqui cada área declara suas versões — mesmo
 * propósito, composição diferente — e uma semente do tenant escolhe uma delas.
 *
 * Este módulo é a fonte única da decisão: a sequência da home, os `data-*` de
 * tratamento, o contrato de conteúdo do pre-flight e as vagas do plano de cenas
 * saem todos daqui. Ele é folha de propósito (só tipos de imagem entram), para
 * que o perfil, a gramática da vibe e o plano de cenas possam importá-lo.
 */

/** Ordem de leitura da página: navegação, as treze seções e o rodapé. */
export const COMMERCIAL_AREAS = [
  'navegacao',
  'abertura',
  'ligacao',
  'setores',
  'ofertas',
  'redes',
  'faixa-abertura',
  'historia',
  'faixa-fechamento',
  'carreira',
  'galeria',
  'convite',
  'formulario',
  'unidades',
  'rodape',
] as const;

export type CommercialArea = (typeof COMMERCIAL_AREAS)[number];

/** As áreas que ocupam a sequência da home, na ordem exigida pelo pre-flight. */
export const COMMERCIAL_SEQUENCE_AREAS = [
  'abertura',
  'ligacao',
  'setores',
  'ofertas',
  'redes',
  'faixa-abertura',
  'historia',
  'faixa-fechamento',
  'carreira',
  'galeria',
  'convite',
  'formulario',
  'unidades',
] as const satisfies readonly CommercialArea[];

export type CommercialSceneSlot = {
  role: SceneRole;
  targetBlock: (typeof SCENE_TARGET_BLOCKS)[number];
  ratio: Ratio;
  /** Quantas fotos esta variação pede no plano. */
  count: number;
  /** `{i}` recebe o número da vaga quando `count` é maior que um. */
  hint: string;
};

export type CommercialVariant = {
  /** Identidade persistida no perfil; sobrevive a reordenar o par. */
  key: string;
  /**
   * `silhueta` troca a assinatura `bloco:layout` e aparece no pre-flight, na
   * silhueta e na unicidade. `tratamento` preserva a assinatura e muda só o CSS
   * por um `data-*` no tema — serve onde o enum de layout já está amarrado por
   * outra regra, como a navegação, presa a `bar` na faixa da vibe.
   */
  kind: 'silhueta' | 'tratamento';
  signature: string;
  /** Valor do `data-commercial-<área>` quando `kind` é `tratamento`. */
  treatment?: string;
  label: string;
  /** Uma frase para o prompt: o que esta versão faz, não como ela é bonita. */
  intent: string;
  /** Contagem de itens exigida pelo pre-flight desta variação. */
  items?: { exact?: number; min?: number; max?: number };
  /** Exige uma foto distinta por item. */
  distinctImages?: boolean;
  /** Vagas que esta variação acrescenta ao plano de cenas. */
  scenes?: readonly CommercialSceneSlot[];
};

/**
 * O primeiro item de cada área é a combinação base: exatamente o que está no ar
 * hoje. Um perfil sem `commercialVariants` cai nela, então nenhum site já
 * gerado muda de forma.
 */
export const COMMERCIAL_VARIANTS = {
  navegacao: [
    {
      key: 'nav-sobreposta',
      kind: 'tratamento',
      signature: 'nav.bar:bar',
      treatment: 'sobreposta',
      label: 'Navegação sobre a fachada',
      intent:
        'A barra flutua sobre a foto de abertura, sem reservar cabeçalho próprio.',
    },
  ],
  abertura: [
    {
      key: 'abertura-fachada',
      kind: 'silhueta',
      signature: 'hero.split:brand',
      label: 'Fachada panorâmica',
      intent:
        'A fachada real ocupa a tela inteira sob uma camada da cor da marca.',
      scenes: [
        {
          role: 'hero',
          targetBlock: 'hero.brand',
          ratio: '16:9',
          count: 1,
          hint: 'Fotografia documental panorâmica da fachada real do comércio, com o nome ou logo da própria marca claramente visível no letreiro. Use apenas foto enviada pelo operador ou importada do site oficial; nunca gere ou invente a fachada.',
        },
      ],
    },
  ],
  ligacao: [
    {
      key: 'ligacao-painel',
      kind: 'silhueta',
      signature: 'editorial.text:bridge',
      label: 'Painel da unidade',
      intent:
        'Painel na cor da marca com nome e endereço confirmado, texto institucional ao lado, encostado na base do hero.',
    },
  ],
  setores: [
    {
      key: 'setores-grade',
      kind: 'silhueta',
      signature: 'feature.bento:gallery',
      label: 'Grade de seis setores',
      intent: 'Seis setores em grade de três colunas, todos com o mesmo peso.',
      items: { exact: 6 },
      distinctImages: true,
      scenes: [
        {
          role: 'protagonista',
          targetBlock: 'feature.bento',
          ratio: '4:3',
          count: 6,
          hint: 'Uma categoria real e diferente do comércio, fotografada de modo simples e reconhecível para o item {i} da grade de seis setores.',
        },
      ],
    },
  ],
  ofertas: [
    {
      key: 'ofertas-faixa',
      kind: 'silhueta',
      signature: 'cta.band:band',
      label: 'Faixa de ofertas',
      intent: 'Faixa sólida com a chamada de ofertas e uma ação.',
    },
  ],
  redes: [
    {
      key: 'redes-galeria',
      kind: 'silhueta',
      signature: 'social.follow:gallery',
      label: 'Redes com galeria',
      intent: 'Texto das redes ao lado de três fotos do acervo.',
      items: { min: 3 },
    },
  ],
  'faixa-abertura': [
    {
      key: 'faixa-abertura-imersiva',
      kind: 'silhueta',
      signature: 'media.image:immersive',
      label: 'Faixa imersiva',
      intent: 'Fotografia de largura cheia com parallax entre duas leituras.',
      scenes: [
        {
          role: 'apoio',
          targetBlock: 'media.image',
          ratio: '16:9',
          count: 1,
          hint: 'Cena panorâmica documental de produtos ou ambiente, própria para uma faixa fotográfica larga com parallax e sem texto incorporado.',
        },
      ],
    },
  ],
  historia: [
    {
      key: 'historia-centrada',
      kind: 'silhueta',
      signature: 'editorial.text:narrow',
      label: 'História centrada',
      intent: 'Texto da história em coluna estreita e centralizada.',
    },
  ],
  'faixa-fechamento': [
    {
      key: 'faixa-fechamento-imersiva',
      kind: 'silhueta',
      signature: 'media.image:immersive',
      label: 'Segunda faixa imersiva',
      intent: 'Segunda pausa fotográfica, com foto distinta da primeira.',
    },
  ],
  carreira: [
    {
      key: 'carreira-dividida',
      kind: 'silhueta',
      signature: 'cta.band:split',
      label: 'Carreira em duas metades',
      intent: 'Convite de carreira com foto do ambiente em metade da seção.',
      scenes: [
        {
          role: 'apoio',
          targetBlock: 'cta.band',
          ratio: '16:9',
          count: 1,
          hint: 'Cena documental do ambiente de trabalho real ou de atendimento, para acompanhar o convite de carreira sem retrato posado.',
        },
      ],
    },
  ],
  galeria: [
    {
      key: 'galeria-grade',
      kind: 'silhueta',
      signature: 'media.gallery:grid',
      label: 'Galeria em grade',
      intent: 'Pelo menos seis fotos do comércio em grade regular.',
      items: { min: 6 },
    },
  ],
  convite: [
    {
      key: 'convite-minimo',
      kind: 'silhueta',
      signature: 'cta.band:minimal',
      label: 'Convite mínimo',
      intent: 'Chamada curta de contato antes do formulário.',
    },
  ],
  formulario: [
    {
      key: 'formulario-dividido',
      kind: 'silhueta',
      signature: 'form.lead:split',
      label: 'Formulário em duas metades',
      intent: 'Formulário ao lado do texto de contato.',
    },
  ],
  unidades: [
    {
      key: 'unidades-largas',
      kind: 'silhueta',
      signature: 'media.map:wide',
      label: 'Unidades em largura cheia',
      intent: 'Cada unidade cadastrada com endereço, horário, rota e mapa.',
    },
  ],
  rodape: [
    {
      key: 'rodape-dividido',
      kind: 'silhueta',
      signature: 'footer.compact:split',
      label: 'Rodapé dividido',
      intent: 'Rodapé em duas colunas com contatos e navegação.',
    },
  ],
} as const satisfies Record<CommercialArea, readonly CommercialVariant[]>;

export type CommercialVariantKeys = Record<CommercialArea, string>;
export type ResolvedCommercialVariants = Record<
  CommercialArea,
  CommercialVariant
>;

/**
 * FNV-1a de 32 bits. Precisa ser estável entre execuções e entre máquinas — o
 * hash de string do runtime não é contrato — e não vale acrescentar dependência
 * por seis linhas.
 */
function fnv1a(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/**
 * Sorteio determinístico da combinação. O hash é refeito por área, e não
 * fatiado em bits de um hash único, para que as escolhas não fiquem
 * correlacionadas: dois tenants que caem na mesma abertura continuam podendo
 * divergir em todas as outras áreas.
 *
 * `attempt` permite re-sortear quando a combinação já existe em outro cliente,
 * sem perder o determinismo: a mesma semente sempre percorre a mesma ordem.
 */
export function commercialVariantsFor(
  seed: string,
  attempt = 0,
): CommercialVariantKeys {
  const suffix = attempt > 0 ? `#${attempt}` : '';
  return Object.fromEntries(
    COMMERCIAL_AREAS.map((area) => {
      const variants = COMMERCIAL_VARIANTS[area];
      const chosen =
        variants[fnv1a(`${seed}${suffix}:${area}`) % variants.length];
      return [area, chosen!.key];
    }),
  ) as CommercialVariantKeys;
}

/**
 * Chaves persistidas viram variações. Chave desconhecida e campo ausente caem
 * na base: um perfil gravado antes desta revisão, ou por uma versão que já
 * removeu uma variação, continua renderizando o que está no ar.
 */
export function resolveCommercialVariants(
  keys?: Partial<CommercialVariantKeys> | null,
): ResolvedCommercialVariants {
  return Object.fromEntries(
    COMMERCIAL_AREAS.map((area) => {
      const variants: readonly CommercialVariant[] = COMMERCIAL_VARIANTS[area];
      const chosen = variants.find((variant) => variant.key === keys?.[area]);
      return [area, chosen ?? variants[0]!];
    }),
  ) as ResolvedCommercialVariants;
}

/** As treze assinaturas da home, na ordem, para a estrutura e o pre-flight. */
export function commercialSequence(
  resolved: ResolvedCommercialVariants,
): string[] {
  return COMMERCIAL_SEQUENCE_AREAS.map((area) => resolved[area].signature);
}

/** A variante obrigatória do rodapé, que fica fora da sequência por semântica. */
export function commercialFooter(resolved: ResolvedCommercialVariants): string {
  return resolved.rodape.signature;
}

/** Os `data-commercial-*` que o tema publica para o CSS das variações. */
export function commercialTreatments(
  resolved: ResolvedCommercialVariants,
): Record<string, string> {
  const attributes: Record<string, string> = {};
  for (const area of COMMERCIAL_AREAS) {
    const variant = resolved[area];
    if (variant.kind === 'tratamento' && variant.treatment)
      attributes[`data-commercial-${area}`] = variant.treatment;
  }
  return attributes;
}

/** A área que responde por uma assinatura, quando ela aparece uma única vez. */
export function commercialAreaOf(
  resolved: ResolvedCommercialVariants,
  signature: string,
): CommercialArea | undefined {
  return COMMERCIAL_SEQUENCE_AREAS.find(
    (area) => resolved[area].signature === signature,
  );
}

/** Quantas seções da home usam esta assinatura na combinação resolvida. */
export function commercialSignatureCount(
  resolved: ResolvedCommercialVariants,
  signature: string,
): number {
  return COMMERCIAL_SEQUENCE_AREAS.filter(
    (area) => resolved[area].signature === signature,
  ).length;
}

export type CommercialScene = {
  role: SceneRole;
  targetBlock: (typeof SCENE_TARGET_BLOCKS)[number];
  ratio: Ratio;
  hint: string;
};

/** As vagas de foto da combinação, na ordem de leitura da página. */
export function commercialScenes(
  resolved: ResolvedCommercialVariants,
): CommercialScene[] {
  const scenes: CommercialScene[] = [];
  for (const area of COMMERCIAL_AREAS)
    for (const slot of resolved[area].scenes ?? [])
      for (let index = 0; index < slot.count; index++)
        scenes.push({
          role: slot.role,
          targetBlock: slot.targetBlock,
          ratio: slot.ratio,
          hint: slot.hint.replace('{i}', String(index + 1)),
        });
  return scenes;
}

/** Texto curto da combinação, para o prompt da fase de briefing. */
export function commercialCombinationText(
  resolved: ResolvedCommercialVariants,
): string {
  return COMMERCIAL_AREAS.map(
    (area) => `${area}: ${resolved[area].label} — ${resolved[area].intent}`,
  ).join('\n');
}

/** Parte da assinatura do perfil, para a comparação entre clientes. */
export function commercialSignaturePart(
  keys?: Partial<CommercialVariantKeys> | null,
): string {
  const resolved = resolveCommercialVariants(keys);
  return COMMERCIAL_AREAS.map((area) => resolved[area].key).join('+');
}
