import {
  confirmedEvidence,
  MAX_EVIDENCE_LENGTH,
  phraseSupported,
} from '@/lib/ai/evidence';
import { blockSchemas, isBlockType } from '@/lib/blocks/registry';
import { claimSupported, landingClaims } from '@/lib/taste/landing';
import type { BlockInstance, Page, TenantImage } from '@/lib/types';

const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

/** Reparo restrito às alegações verificadas pelo lint. Nunca registra evidência,
 * gera imagem ou altera conteúdo fora dos blocos com prova/preço pendentes. */
export function repairPublicationProof(
  page: Page,
  images: TenantImage[],
  brief: Record<string, unknown>,
) {
  const evidence = confirmedEvidence(brief);
  const claims = landingClaims(page, images);
  const summary: string[] = [];
  const blocks: BlockInstance[] = [];
  for (const original of page.blocks) {
    const own = claims.filter((claim) => claim.block.id === original.id);
    if (!own.some((claim) => !claimSupported(claim, evidence))) {
      blocks.push(original);
      continue;
    }
    const props = structuredClone(original.props);
    const kept = new Set<number>();
    const confirmedText: string[] = [];
    for (const claim of own) {
      const source = evidence.find(
        (entry) =>
          claim.parts.length > 0 &&
          claim.parts.every((part) => phraseSupported(entry, part)),
      );
      if (
        !source ||
        (claim.refRequired && source.length > MAX_EVIDENCE_LENGTH)
      ) {
        summary.push(
          `Em ${original.id}, retirei a alegação sem evidência: ${claim.parts.join(' · ')}.`,
        );
        continue;
      }
      const [field, indexText] = claim.path.split('.');
      const index = Number(indexText);
      const item = claim.path
        ? object((props[field] as unknown[])?.[index])
        : props;
      if (claim.refPath) item.evidence = source;
      if (claim.photoInvalid) {
        delete item.image;
        delete item.imageAlt;
        summary.push(
          `Em ${original.id}, retirei a foto sem origem de envio e preservei o depoimento confirmado.`,
        );
      }
      if (claim.path) kept.add(index);
      confirmedText.push(...claim.parts);
    }
    const field = own[0]?.path.split('.')[0];
    if (field && Array.isArray(props[field])) {
      const positions = new Map<number, number>();
      props[field] = (props[field] as unknown[]).filter((_, index) => {
        if (!kept.has(index)) return false;
        positions.set(index, positions.size);
        return true;
      });
      if (Array.isArray(props.textStyles))
        props.textStyles = props.textStyles.flatMap((style) => {
          const value = object(style);
          if (typeof value.field !== 'string') return [style];
          const path = value.field.split('.');
          if (path[0] !== field) return [style];
          const next = positions.get(Number(path[1]));
          return next === undefined
            ? []
            : [{ ...value, field: [field, next, ...path.slice(2)].join('.') }];
        });
    }
    const candidate = { ...original, props };
    const parsed = isBlockType(original.type)
      ? blockSchemas[original.type].strict().safeParse(props)
      : undefined;
    // Falha em outro campo não autoriza trocar a abertura ou descartar conteúdo.
    // O armazenamento/edição seguinte continua apontando esses erros técnicos.
    const minimum =
      original.type === 'proof.logos' ||
      (original.type === 'proof.strip' && props.layout === 'logos')
        ? 3
        : 2;
    const tooFew =
      field && Array.isArray(props[field]) && props[field].length < minimum;
    if (
      original.type === 'hero.landing' ||
      (field ? parsed?.success || !tooFew : confirmedText.length > 0)
    ) {
      blocks.push(candidate);
      summary.push(
        `Em ${original.id}, alinhei a prova às evidências disponíveis.`,
      );
      continue;
    }
    // Se a lista ficou menor que o mínimo do componente, conserve os fatos
    // confirmados em texto. Nunca complete a lista inventando outra prova.
    const body = [...new Set(confirmedText)].join('\n\n');
    const shared = {
      ...(props.anchor ? { anchor: props.anchor } : {}),
      ...(props.presentation ? { presentation: props.presentation } : {}),
    };
    if (body.length && body.length <= 3975) {
      blocks.push({
        ...original,
        type: 'editorial.text',
        props: {
          ...shared,
          body: body.length >= 20 ? body : `Informação confirmada: ${body}`,
        },
      });
      summary.push(
        `Em ${original.id}, preservei os fatos confirmados em uma seção de texto.`,
      );
    } else if (props.anchor) {
      const offer = object(brief.intake).offer;
      const title =
        typeof offer === 'string' && offer.length >= 8 && offer.length <= 160
          ? offer
          : 'Converse com a gente para conhecer os detalhes.';
      blocks.push({
        ...original,
        type: 'narrative.statement',
        props: { ...shared, title },
      });
      summary.push(
        `Em ${original.id}, substituí a prova sem confirmação e preservei o destino da seção.`,
      );
    } else {
      summary.push(
        `Retirei a seção ${original.id}, que não tinha fatos confirmados.`,
      );
    }
  }
  return { blocks, summary };
}
