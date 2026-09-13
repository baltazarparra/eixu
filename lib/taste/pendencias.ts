import { imageLayouts } from '@/lib/blocks/registry';
import {
  confirmedEvidence,
  factWritten,
  phraseSupported,
} from '@/lib/ai/evidence';
import {
  expectedRatio,
  ratioFits,
  type Ratio,
} from '@/lib/images/ratios';
import type { TenantImage } from '@/lib/types';
import { claimSupported, landingClaims, type LandingClaim } from './landing';
import {
  availablePhotos,
  blockImageUrls,
  layoutOf,
  type SitePage,
} from './metrics';
import { lintSite, type LintBrand, type SiteFinding } from './site';

/** `evidenceRef` e `confirm_evidence` aceitam 140 caracteres; o cadastro aceita
 * 160. Uma frase mais longa não cabe no bloco e precisa ser encurtada em Dados. */
const REF_LIMIT = 140;

export type PendenciaAlinhar = {
  bloco: string;
  caminho: string;
  valor: string;
};

export type PendenciaConfirmar = {
  frase: string;
  /** O operador já escreveu esta frase nesta conversa. */
  escrita: boolean;
  canal: 'chat' | 'dados';
};

export type PendenciaImagem = {
  numero: string;
  atual: string;
  esperada: Ratio;
  bloco: string;
  tipo: string;
  layout?: string;
  biblioteca: { numero: string; url: string; ratio: string }[];
  layouts: string[];
  gerar?: { ferramenta: 'update_image'; image: string; ratio: Ratio };
};

export type Pendencia = {
  regra: string;
  nivel: 'erro' | 'recomendacao';
  pagina: string;
  bloco?: string;
  mensagem: string;
  acao: 'alinhar' | 'confirmar' | 'imagem' | 'manual';
  alinhar?: PendenciaAlinhar[];
  confirmar?: PendenciaConfirmar[];
  imagem?: PendenciaImagem;
  nota?: string;
};

/** Uma frase só é confirmável pelo chat quando `factWritten` consegue compará-la
 * com uma sentença inteira do operador. Pontuação interna e pergunta não passam. */
function chatConfirmable(phrase: string): boolean {
  return (
    phrase.length <= REF_LIMIT &&
    !phrase.includes('?') &&
    !/\n/.test(phrase) &&
    !/[.!?;]\s/.test(phrase.trim())
  );
}

function proofResolution(
  finding: SiteFinding,
  claims: LandingClaim[],
  evidence: string[],
  operatorText: string,
): Partial<Pendencia> {
  const failing = claims.filter(
    (claim) =>
      claim.block.id === finding.blockId && !claimSupported(claim, evidence),
  );
  if (!failing.length) return { acao: 'manual' };
  const alinhar: PendenciaAlinhar[] = [];
  const confirmar: PendenciaConfirmar[] = [];
  const notas: string[] = [];
  for (const claim of failing) {
    if (claim.photoInvalid) {
      notas.push(
        `${claim.path}: o depoimento usa uma foto que não é envio do cliente. Troque pela foto enviada ou remova a imagem a pedido do operador.`,
      );
      continue;
    }
    const full = claim.parts.length
      ? evidence.find((entry) =>
          claim.parts.every((part) => phraseSupported(entry, part)),
        )
      : undefined;
    if (full && full.length > REF_LIMIT) {
      notas.push(
        `${claim.path}: a evidência confirmada tem mais de ${REF_LIMIT} caracteres e não cabe no campo. Encurte em Dados › Evidências.`,
      );
      continue;
    }
    if (full && claim.refPath) {
      alinhar.push({
        bloco: claim.block.id,
        caminho: claim.refPath,
        valor: full,
      });
      continue;
    }
    const ref = typeof claim.ref === 'string' ? claim.ref.trim() : '';
    const frase =
      ref && claim.parts.every((part) => phraseSupported(ref, part))
        ? ref
        : claim.parts.join(' ');
    if (!frase) {
      notas.push(`${claim.path}: sem texto para comprovar.`);
      continue;
    }
    if (confirmar.some((item) => item.frase === frase)) continue;
    confirmar.push({
      frase,
      escrita: factWritten(frase, operatorText),
      canal: chatConfirmable(frase) ? 'chat' : 'dados',
    });
  }
  return {
    acao: alinhar.length
      ? 'alinhar'
      : confirmar.length
        ? 'confirmar'
        : 'manual',
    ...(alinhar.length ? { alinhar } : {}),
    ...(confirmar.length ? { confirmar } : {}),
    ...(notas.length ? { nota: notas.join(' ') } : {}),
  };
}

function imageResolution(
  finding: SiteFinding,
  pages: SitePage[],
  images: TenantImage[],
): Partial<Pendencia> {
  const page = pages.find((item) => `/${item.slug}` === finding.page);
  const block = page?.blocks.find((item) => item.id === finding.blockId);
  if (!block) return { acao: 'manual' };
  const layout = layoutOf(block);
  const esperada = expectedRatio(block.type, layout);
  const byUrl = new Map(
    images.filter((image) => image.kind === 'foto').map((i) => [i.url, i]),
  );
  const used = blockImageUrls(block)
    .map((url) => byUrl.get(url))
    .filter((image): image is TenantImage => Boolean(image));
  const seq = Number(/#(\d+)/.exec(finding.message)?.[1]);
  const image =
    used.find((item) => item.seq === seq) ??
    used.find((item) => !ratioFits(item.ratio, esperada));
  if (!image) return { acao: 'manual' };
  return {
    acao: 'imagem',
    imagem: {
      numero: `#${image.seq}`,
      atual: image.ratio,
      esperada,
      bloco: block.id,
      tipo: block.type,
      ...(layout ? { layout } : {}),
      biblioteca: availablePhotos(images)
        .filter(
          (item) => item.url !== image.url && ratioFits(item.ratio, esperada),
        )
        .slice(0, 5)
        .map((item) => ({
          numero: `#${item.seq}`,
          url: item.url,
          ratio: item.ratio,
        })),
      layouts: imageLayouts(block.type).filter(
        (option) =>
          option !== layout &&
          ratioFits(image.ratio, expectedRatio(block.type, option)),
      ),
      // Um depoimento exige foto real enviada: gerar a cena não resolve.
      ...(block.type === 'proof.testimonials'
        ? {}
        : {
            gerar: {
              ferramenta: 'update_image' as const,
              image: `#${image.seq}`,
              ratio: esperada,
            },
          }),
    },
  };
}

/**
 * O que falta para publicar e o que resolve cada item, decidido em código.
 * O agente recebe este plano no contexto e nos retornos das ferramentas: sem
 * ele, uma pendência de prova vira adivinhação sobre a causa do bloqueio.
 */
export function publicationPlan(input: {
  pages: SitePage[];
  images: TenantImage[];
  brand?: LintBrand;
  brief?: Record<string, unknown>;
  operatorText?: string;
  findings?: SiteFinding[];
}): Pendencia[] {
  const brief = input.brief ?? {};
  const findings =
    input.findings ??
    lintSite(input.pages, input.images, 'publish', input.brand, brief);
  if (!findings.length) return [];
  const evidence = confirmedEvidence(brief);
  const home = input.pages.find(
    (page) => page.slug === '' && page.type === 'page',
  );
  const claims = home ? landingClaims(home, input.images) : [];
  const seen = new Set<string>();
  const plan: Pendencia[] = [];
  for (const finding of findings) {
    const key = `${finding.rule}|${finding.page}|${finding.blockId ?? ''}|${finding.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const resolution =
      finding.rule === 'landing-prova' || finding.rule === 'landing-preco'
        ? proofResolution(
            finding,
            claims,
            evidence,
            input.operatorText ?? '',
          )
        : finding.rule === 'imagem-proporcao'
          ? imageResolution(finding, input.pages, input.images)
          : { acao: 'manual' as const };
    plan.push({
      regra: finding.rule,
      nivel: finding.level === 'error' ? 'erro' : 'recomendacao',
      pagina: finding.page,
      ...(finding.blockId ? { bloco: finding.blockId } : {}),
      mensagem: finding.message,
      acao: 'manual',
      ...resolution,
    });
  }
  return plan;
}

const quote = (value: string) => `"${value}"`;

function pendenciaLine(item: Pendencia): string {
  const head = `- ${item.nivel === 'erro' ? 'ERRO' : 'Recomendação'} ${item.regra} em ${item.pagina}${
    item.bloco ? ` (bloco ${item.bloco})` : ''
  }: ${item.mensagem}`;
  const parts: string[] = [];
  if (item.alinhar?.length)
    parts.push(
      `Ação alinhar: edit_page com set em ${item.alinhar
        .map(
          (fix) =>
            `${fix.caminho} do bloco ${fix.bloco} recebendo ${quote(fix.valor)}`,
        )
        .join('; ')}.`,
    );
  const escritas = item.confirmar?.filter((fact) => fact.escrita) ?? [];
  const faltantes =
    item.confirmar?.filter((fact) => !fact.escrita && fact.canal === 'chat') ??
    [];
  const noCadastro =
    item.confirmar?.filter((fact) => !fact.escrita && fact.canal === 'dados') ??
    [];
  if (escritas.length)
    parts.push(
      `Ação confirmar: o operador já escreveu nesta conversa ${escritas
        .map((fact) => quote(fact.frase))
        .join('; ')}. Use confirm_evidence com esse texto exato.`,
    );
  if (faltantes.length)
    parts.push(
      `Ação confirmar: o operador ainda não escreveu ${faltantes
        .map((fact) => quote(fact.frase))
        .join(
          '; ',
        )}. Peça que ele escreva essas frases ou registre em Dados › Evidências. Não invente nem deduza o fato.`,
    );
  if (noCadastro.length)
    parts.push(
      `Ação confirmar por Dados › Evidências, porque a frase não cabe no chat: ${noCadastro
        .map((fact) => quote(fact.frase))
        .join('; ')}.`,
    );
  if (item.imagem) {
    const image = item.imagem;
    parts.push(
      `Opções: ${[
        image.biblioteca.length
          ? `biblioteca ${image.biblioteca
              .map((photo) => `${photo.numero} (${photo.ratio})`)
              .join(', ')}`
          : 'nenhuma foto da biblioteca cabe',
        image.layouts.length
          ? `layouts que exibem ${image.atual}: ${image.layouts.join(', ')}`
          : 'sem layout alternativo',
        image.gerar
          ? `gerar com update_image image ${quote(image.gerar.image)} ratio ${quote(image.gerar.ratio)}`
          : 'sem geração, o bloco exige foto enviada',
      ].join('; ')}.`,
    );
  }
  if (item.nota) parts.push(item.nota);
  if (item.acao === 'manual' && !parts.length)
    parts.push('Ação manual: explique ao operador o que falta.');
  return `${head} ${parts.join(' ')}`.trim();
}

/** Seção do prompt com as pendências atuais e o que resolve cada uma. */
export function pendenciasContext(
  plan: Pendencia[],
  limit = 20,
): string | undefined {
  if (!plan.length) return undefined;
  const ordered = [...plan].sort((a, b) =>
    a.nivel === b.nivel ? 0 : a.nivel === 'erro' ? -1 : 1,
  );
  const lines = ordered.slice(0, limit).map(pendenciaLine);
  const rest = ordered.length - lines.length;
  if (rest > 0) lines.push(`- e mais ${rest} pendência(s) no painel.`);
  return `Validação atual do servidor, a mesma do painel. Erros bloqueiam a publicação; recomendações não. A ação de cada linha foi decidida em código.\n${lines.join('\n')}`;
}

/** Seção do prompt com as frases que a validação aceita como prova. */
export function evidenceContext(
  brief: Record<string, unknown>,
): string | undefined {
  const evidence = confirmedEvidence(brief);
  if (!evidence.length)
    return 'Nenhum fato confirmado. Sem frase escrita pelo operador no chat ou cadastrada em Dados › Evidências, nenhuma prova passa na validação. Não use a página montada como comprovação.';
  return `Frases aceitas pela validação, vindas do cadastro e do chat. Um selo, item de prova ou plano passa quando evidence copia uma destas frases e cada texto exibido aparece inteiro dentro dela, ignorando acento, caixa e ponto final.\n${evidence
    .map((fact) => `- ${quote(fact)}`)
    .join('\n')}`;
}
