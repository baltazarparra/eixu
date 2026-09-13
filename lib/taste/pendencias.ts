import { imageLayouts } from '@/lib/blocks/registry';
import {
  confirmedEvidence,
  factWritten,
  phraseSupported,
  MAX_EVIDENCE_LENGTH,
} from '@/lib/ai/evidence';
import { publicationFinding } from '@/lib/sites/publication-policy';
import { lintPage } from './lint';
import { expectedRatio, ratioFits, type Ratio } from '@/lib/images/ratios';
import type { TenantImage } from '@/lib/types';
import { claimSupported, landingClaims, type LandingClaim } from './landing';
import {
  availablePhotos,
  blockImageUrls,
  layoutOf,
  type SitePage,
} from './metrics';
import { lintSite, type LintBrand, type SiteFinding } from './site';

/** Referências, confirmação e cadastro compartilham o mesmo limite. */
const REF_LIMIT = MAX_EVIDENCE_LENGTH;

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
  acao: 'alinhar' | 'confirmar' | 'imagem' | 'reparar-prova' | 'editar';
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
  if (!failing.length) return { acao: 'editar' };
  const alinhar: PendenciaAlinhar[] = [];
  const confirmar: PendenciaConfirmar[] = [];
  const notas: string[] = [];
  for (const claim of failing) {
    if (claim.photoInvalid) {
      notas.push(
        `${claim.path}: o depoimento usa uma foto que não é envio do cliente. O reparo retira essa foto e preserva o texto se estiver confirmado.`,
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
        `${claim.path}: a evidência excede ${REF_LIMIT} caracteres. O reparo usa somente os fatos confirmados que cabem no componente.`,
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
    acao:
      confirmar.some((item) => !item.escrita) || notas.length
        ? 'reparar-prova'
        : alinhar.length
          ? 'alinhar'
          : confirmar.length
            ? 'confirmar'
            : 'editar',
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
  if (!block) return { acao: 'editar' };
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
  if (!image) return { acao: 'editar' };
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
  const findings = input.findings ?? [
    ...input.pages.flatMap((page) =>
      lintPage(page, input.brand?.design as Parameters<typeof lintPage>[1]).map(
        (finding) => ({ ...finding, page: `/${page.slug}` }),
      ),
    ),
    ...lintSite(input.pages, input.images, 'publish', input.brand, brief),
  ];
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
        ? proofResolution(finding, claims, evidence, input.operatorText ?? '')
        : finding.rule === 'imagem-proporcao'
          ? imageResolution(finding, input.pages, input.images)
          : { acao: 'editar' as const };
    plan.push({
      regra: finding.rule,
      nivel:
        publicationFinding(finding).level === 'error' ? 'erro' : 'recomendacao',
      pagina: finding.page,
      ...(finding.blockId ? { bloco: finding.blockId } : {}),
      mensagem: finding.message,
      acao: 'editar',
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
        )}. Se o pedido é resolver pendências, use repair_publication para retirar a alegação sem confirmação. Não peça repetição de frases, não invente nem registre a autorização como fato.`,
    );
  if (noCadastro.length)
    parts.push(
      `Alegações sem confirmação textual: ${noCadastro
        .map((fact) => quote(fact.frase))
        .join(
          '; ',
        )}. No pedido de resolver pendências, use repair_publication.`,
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
  if (item.acao === 'reparar-prova')
    parts.push(
      'Reparo disponível: repair_publication. Só executa mediante pedido atual para resolver pendências e preserva evidências e conteúdo confirmado.',
    );
  if (item.acao === 'editar' && !parts.length)
    parts.push(
      'Corrija com as ferramentas de edição: consulte o bloco e o schema, aplique a menor alteração e valide. Use o cadastro e o acervo existentes. Não encerre apenas repetindo a pendência; só peça dado externo se não houver correção possível com o contexto disponível.',
    );
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
  return `Validação atual do servidor, a mesma do painel. Só erros técnicos bloqueiam; recomendações editoriais não impedem a publicação autorizada. No pedido de publicar, publique sem exigir confirmação de fatos; no pedido de resolver, execute os reparos e valide.\n${lines.join('\n')}`;
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
