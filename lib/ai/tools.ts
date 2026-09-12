import { createHash } from 'node:crypto';
import { tool } from 'ai';
import { z } from 'zod';
import { db } from '@/lib/db';
import {
  blockInput,
  buildSiteInput,
  pageType,
  repairSiteDraft,
  repairSiteInput,
  type SiteDraft,
} from '@/lib/ai/site-draft';
import { accessibleAccent, contrastRatio } from '@/lib/blocks/contrast';
import { BLOCK_TYPES, blockSchemas, isBlockType } from '@/lib/blocks/registry';
import {
  completeDesignProfile,
  designProfileInputSchema,
  isDesignProfile,
  nearestDesign,
} from '@/lib/design/profile';
import {
  compositionConflict,
  compositionConflictMessage,
} from '@/lib/design/uniqueness';
import {
  VIBE_GRAMMAR,
  VIBE_LABEL,
  grammarDirection,
  laneIssues,
  vibeOf,
} from '@/lib/design/vibes';
import {
  normalizeReferenceUrl,
  referenceUrls,
  referenceSources,
  referenceAspects,
  referenceDirectionIssues,
} from '@/lib/design/references';
import { readReferenceVisual } from '@/lib/references/read';
import { guideTool } from '@/lib/ai/guide-tool';
import {
  getGuide,
  getImage,
  getImageByNumber,
  guideIsEmpty,
  listImages,
} from '@/lib/images/queries';
import { fetchReference, generateLogoCandidates } from '@/lib/images/logo';
import { critiqueLogo } from '@/lib/images/logo-critic';
import { prepareSiteImages } from '@/lib/images/site-assets';
import { reviseImage } from '@/lib/images/revise';
import { replaceDraftImage } from '@/lib/images/replacement';
import { withSceneGenerationLock } from '@/lib/images/generation-lock';
import {
  SCENE_ROLES,
  SCENE_TARGET_BLOCKS,
  sceneCoverage,
  scenePlan,
  sceneRequestsMatchPlan,
  sceneText,
} from '@/lib/images/scene-plan';
import { RATIOS, expectedRatio } from '@/lib/images/ratios';
import { publishSite } from '@/lib/sites/publish';
import { formatFindings, lintPage } from '@/lib/taste/lint';
import { inboundSchema, lintSite, type SitePage } from '@/lib/taste/site';
import {
  generatedPhotos,
  siteMetrics,
  structuralFindings,
} from '@/lib/taste/metrics';
import { readReference } from '@/lib/ai/reference';
import { referenceFromSocial, readSocialProfile } from '@/lib/ai/social';
import { normalizeSocialUrl, parseSocialRecord } from '@/lib/social-profile';
import { capturePages, type Shot } from '@/lib/review/capture';
import { critiquePages } from '@/lib/review/critic';
import {
  captureEnabled,
  pageReviewFingerprint,
  pendingReviewPages,
  reviewFingerprint,
  savedReview,
  type PageReviewReceipt,
  type ReviewFindingReceipt,
  type ReviewReceipt,
} from '@/lib/review/state';
import {
  getPage,
  getTenantBySlug,
  listPages,
  setBrandLogo,
} from '@/lib/tenant-queries';
import { REVIEW_CALLS_PER_TURN, type Phase } from '@/lib/taste/phases';
import {
  editTools,
  scopedUpdateError,
  type EditPolicy,
} from '@/lib/ai/edit-policy';
import type { BlockInstance, Tenant, TenantImage } from '@/lib/types';

function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** Normaliza blocos vindos da IA, atribuindo ids estáveis. */
function toBlocks(
  input: { type: string; props: Record<string, unknown> }[],
): BlockInstance[] {
  return input.map((block) => ({
    id: newId(),
    type: block.type,
    props: block.props,
  }));
}

export class ToolError extends Error {}

async function requirePage(tenantId: string, slug: string) {
  const clean = slug.replace(/^\/+|\/+$/g, '');
  const page = await getPage(tenantId, clean);
  if (!page)
    throw new ToolError(
      `Página "/${clean}" não existe. Use list_state para ver as páginas ou create_page para criar.`,
    );
  return page;
}

/**
 * Localiza um bloco por id, por tipo ("hero.split") ou por família ("hero").
 * O erro lista o que existe, para o agente acertar na próxima chamada.
 */
function findBlock(blocks: BlockInstance[], selector: string): BlockInstance {
  const byId = blocks.find((block) => block.id === selector);
  if (byId) return byId;
  const wanted = selector.toLowerCase();
  const matches = blocks.filter(
    (block) =>
      block.type.toLowerCase() === wanted ||
      block.type.toLowerCase().split('.')[0] === wanted,
  );
  if (matches.length === 1) return matches[0];
  const inventory = blocks
    .map((block, index) => `${index}: ${block.type} (id ${block.id})`)
    .join('; ');
  if (matches.length > 1) {
    throw new ToolError(
      `"${selector}" bate com ${matches.length} blocos. Use o id. Blocos: ${inventory}`,
    );
  }
  throw new ToolError(
    `Nenhum bloco "${selector}" nesta página. Blocos: ${inventory}`,
  );
}

/** Envolve o execute para devolver erro como resultado, sem derrubar o passo do agente. */
export function safe<I, O>(run: (input: I) => Promise<O>) {
  return async (input: I): Promise<O | { error: string }> => {
    try {
      return await run(input);
    } catch (error) {
      if (error instanceof ToolError) return { error: error.message };
      console.error('[tool] falha inesperada:', error);
      return {
        error: error instanceof Error ? error.message : 'Falha inesperada.',
      };
    }
  };
}

export type ToolContext = {
  /** Origem HTTP para a revisão renderizar o rascunho. */
  origin?: string;
  /** Sessão apenas para o navegador de revisão, nunca para o modelo. */
  cookie?: string;
  /** Fase ativa da geração. Fora dela o chat trabalha sem esses limites. */
  phase?: Phase;
  /** Última mensagem do operador, para as decisões que exigem pedido dele. */
  lastUserText?: string;
  editPolicy?: EditPolicy;
  /** Subetapas persistidas pelo runner para o painel acompanhar a revisão. */
  onReviewProgress?: (event: {
    stage: 'preflight' | 'capture' | 'critic';
    label: string;
    completed?: number;
    total?: number;
    page?: string;
    viewport?: 'desktop' | 'mobile';
  }) => void | Promise<void>;
};

function reviewFindingId(
  finding: Omit<ReviewFindingReceipt, 'id' | 'status'>,
  occurrence = 0,
): string {
  return createHash('sha256')
    .update(
      [
        finding.pagina,
        finding.regra,
        finding.bloco ?? '',
        finding.viewport ?? '',
        occurrence,
      ].join('|'),
    )
    .digest('hex')
    .slice(0, 16);
}

/** IDs estáveis permitem distinguir problema persistente de resolvido. */
function identifyFindings(
  findings: Omit<ReviewFindingReceipt, 'id' | 'status'>[],
): ReviewFindingReceipt[] {
  const occurrences = new Map<string, number>();
  return findings.map((finding) => {
    const key = [
      finding.pagina,
      finding.regra,
      finding.bloco ?? '',
      finding.viewport ?? '',
    ].join('|');
    const occurrence = occurrences.get(key) ?? 0;
    occurrences.set(key, occurrence + 1);
    return {
      ...finding,
      id: reviewFindingId(finding, occurrence),
      status: 'open',
    };
  });
}

/**
 * Trocar o logo do site é decisão do operador. O prompt já dizia isso e mesmo
 * assim o agente aplicou sozinho uma variante reprovada pelo próprio crítico:
 * o código exige o pedido na última mensagem dele.
 */
function operatorAsked(lastUserText: string): boolean {
  return /\b(aprov\w*|usa\w*|use\w*|aplic\w*|defin\w*|coloc\w*|escolh\w*|pode\s+ser|essa\s+mesma?)\b/i.test(
    lastUserText,
  );
}

/** Resolve "#3", "3" ou o uuid para uma imagem do cliente. */
async function requireImage(
  tenantId: string,
  ref: string,
): Promise<TenantImage> {
  const clean = ref.trim().replace(/^#/, '');
  const image = /^[1-9]\d{0,8}$/.test(clean)
    ? await getImageByNumber(tenantId, Number(clean))
    : z.uuid().safeParse(clean).success
      ? await getImage(tenantId, clean)
      : null;
  if (!image) {
    const all = await listImages(tenantId);
    const inventory = all
      .slice(0, 12)
      .map((item) => `#${item.seq} ${item.status}`)
      .join(', ');
    throw new ToolError(
      `Imagem "${ref}" não existe. Biblioteca: ${inventory || 'vazia'}`,
    );
  }
  return image;
}

export function buildTools(tenant: Tenant, context: ToolContext = {}) {
  let activeBrand = { ...tenant.brand };
  let activeDials = { ...tenant.dials };
  let activeBrief = { ...tenant.brief };
  let scenesPrepared = 0;
  let referencesRead = 0;
  let reviewRounds = 0;
  let pendingDraft: SiteDraft | undefined;

  async function saveSiteDraft(input: SiteDraft) {
    const { pages } = input;
    if (!isDesignProfile(activeBrand.design)) {
      throw new ToolError(
        'build_site exige uma direção de arte persistida. Chame set_design antes de montar as páginas.',
      );
    }
    const staged = pages.map((input) => {
      const slug = input.slug.replace(/^\/+|\/+$/g, '');
      const noindex = input.type === 'thank_you' || input.type === 'paid_lp';
      const seo = {
        title: input.seoTitle ?? input.title,
        description: input.seoDescription,
        noindex,
      };
      const meta = {
        ...(input.type === 'post'
          ? { excerpt: input.excerpt, date: input.date }
          : {}),
        ...(input.inbound ? { inbound: input.inbound } : {}),
      };
      const blocks = toBlocks(input.blocks);
      const findings = lintPage(
        { type: input.type, title: input.title, seo, blocks, meta },
        activeBrand.design,
      );
      return { input, slug, seo, meta, blocks, findings };
    });
    const invalid = staged.filter((page) =>
      page.findings.some((finding) => finding.level === 'error'),
    );
    if (invalid.length) {
      return {
        ok: false,
        error:
          'Nenhuma página foi gravada. O lote está em memória neste turno. Use repair_site com somente as correções e os índices abaixo; não reenvie páginas inalteradas nem use update_block.',
        pages: invalid.map((page) => ({
          page: `/${page.slug}`,
          preflight: formatFindings(page.findings),
          blocks: page.blocks.map((block, index) => ({
            index,
            type: block.type,
          })),
        })),
      };
    }
    const home = staged.find((page) => page.slug === '');
    const [existing, images] = await Promise.all([
      listPages(tenant.id),
      listImages(tenant.id),
    ]);
    const stagedSlugs = new Set(staged.map((p) => p.slug));
    const prospective: SitePage[] = [
      ...existing.filter((p) => !stagedSlugs.has(p.slug)),
      ...staged.map((p) => ({
        slug: p.slug,
        title: p.input.title,
        type: p.input.type,
        seo: p.seo,
        blocks: p.blocks,
        meta: p.meta,
      })),
    ];
    const projectFindings = lintSite(prospective, images, 'draft', activeBrand);
    if (home) {
      const conflict = await compositionConflict(
        tenant.id,
        home.blocks,
        activeBrand.design,
      );
      if (conflict) throw new ToolError(compositionConflictMessage(conflict));
    }

    const report: {
      page: string;
      blocks: number;
      erros: number;
      preflight: string;
    }[] = [];
    const sql = db();
    await sql.transaction(
      staged.map(
        (page) => sql`
            insert into pages (tenant_id, slug, type, title, seo, meta, blocks)
            values (${tenant.id}, ${page.slug}, ${page.input.type}, ${page.input.title},
                    ${JSON.stringify(page.seo)}::jsonb, ${JSON.stringify(page.meta)}::jsonb, ${JSON.stringify(page.blocks)}::jsonb)
            on conflict (tenant_id, slug) do update
              set type = excluded.type, title = excluded.title, seo = excluded.seo,
                  meta = excluded.meta, blocks = excluded.blocks, updated_at = now()
          `,
      ),
    );
    for (const page of staged) {
      report.push({
        page: `/${page.slug}`,
        blocks: page.blocks.length,
        erros: 0,
        preflight: formatFindings(page.findings),
      });
    }
    if (pendingDraft === input) pendingDraft = undefined;
    return {
      ok: true,
      pages: report,
      // Pendência de projeto não impede a gravação, mas impede a publicação.
      // Corrija-a com edições pontuais antes de encerrar.
      ...(projectFindings.length ? { pendencias: projectFindings } : {}),
      publicationPending: lintSite(prospective, images, 'publish', activeBrand),
    };
  }

  const tools = {
    define_image_guide: guideTool(tenant, safe),

    prepare_site_images: tool({
      description:
        'Executa em uma chamada todas as cenas que faltam no plano, em lotes concorrentes de três, com o guia do cliente e crítica informativa por imagem. Retorna número e URL disponíveis imediatamente, sem aprovação. Para alterar uma imagem existente pelo número, use update_image.',
      inputSchema: z.object({
        scenes: z
          .array(
            z.object({
              request: z
                .string()
                .min(30)
                .max(500)
                .describe(
                  'A cena concreta: quem ou o que aparece, fazendo o quê, onde. Sem adjetivo publicitário.',
                ),
              role: z
                .enum(SCENE_ROLES)
                .describe(
                  'O papel da cena no site, conforme o plano de cenas.',
                ),
              targetBlock: z.enum(SCENE_TARGET_BLOCKS),
              ratio: z
                .enum(RATIOS)
                .optional()
                .describe('Derivada do bloco quando omitida.'),
            }),
          )
          .min(1)
          .max(6),
      }),
      execute: safe(async ({ scenes }) => {
        const design = activeBrand.design;
        if (!isDesignProfile(design))
          throw new ToolError(
            'prepare_site_images exige a direção de arte. Chame set_design antes de gerar cenas.',
          );
        // O estúdio gera em lotes paralelos. Uma cena por requisição fazia o
        // plano inteiro custar cinco idas ao modelo e cinco minutos de espera.
        const inPhase = context.phase === 'cenas';
        const budget = 8;
        if (scenesPrepared + scenes.length > budget)
          throw new ToolError(
            `Orçamento de cenas deste turno esgotado: ${scenesPrepared} de ${budget} já ${scenesPrepared === 1 ? 'foi pedida' : 'foram pedidas'}. Encerre o turno.`,
          );

        const prepared = scenes.map((scene) => {
          // A proporção nasce da composição decidida, não de um palpite: foto
          // 4:3 num hero editorial 16:9 perde o assunto no recorte.
          if (
            scene.targetBlock.startsWith('hero.') &&
            scene.targetBlock !== `hero.${design.heroComposition}`
          )
            throw new ToolError(
              `A abertura deste cliente é ${design.heroComposition}. Use targetBlock hero.${design.heroComposition} para a cena do hero.`,
            );
          if (
            scene.role === 'hero-detail' &&
            design.heroComposition !== 'atelier'
          )
            throw new ToolError(
              'O papel hero-detail existe só na composição atelier, que mostra ambiente e detalhe juntos.',
            );
          const ratio = expectedRatio(scene.targetBlock);
          if (scene.ratio && scene.ratio !== ratio)
            throw new ToolError(
              `${scene.targetBlock} exibe ${ratio}. A proporção ${scene.ratio} seria recortada; envie ${ratio} ou omita o campo.`,
            );
          return { ...scene, ratio };
        });
        // Reserva antes do primeiro await: ferramentas do mesmo turno podem
        // ser executadas em paralelo. Só devolve orçamento sem tentativa paga.
        scenesPrepared += prepared.length;
        let generationStarted = false;
        try {
          const guide = await getGuide(tenant.id);
          if (guideIsEmpty(guide))
            throw new ToolError(
              'O guia de imagem ainda não existe. Chame define_image_guide antes de gerar: sem ele as cenas saem genéricas.',
            );
          const result = await withSceneGenerationLock(tenant.id, async () => {
            // Relê a cobertura dentro do lock, pois outra requisição pode ter
            // gerado a mesma vaga depois do snapshot da rota.
            const library = await listImages(tenant.id);
            const plan = scenePlan(design, 3, vibeOf(activeBrand));
            const { missing } = sceneCoverage(plan, generatedPhotos(library));
            if (inPhase) {
              if (!missing.length)
                throw new ToolError(
                  'O plano já está coberto por fotos disponíveis. Siga para a composição.',
                );
              // Cada cena pedida ocupa uma vaga que falta: o lote cobre o
              // plano sem gerar foto repetida para o mesmo bloco.
              const slots = [...missing];
              for (const scene of prepared) {
                const index = slots.findIndex(
                  (slot) => slot.targetBlock === scene.targetBlock,
                );
                if (index === -1)
                  throw new ToolError(
                    `A cena ${scene.targetBlock} não é uma vaga em aberto. Faltam: ${missing
                      .map((slot) => sceneText(slot))
                      .join(' | ')}.`,
                  );
                slots.splice(index, 1);
              }
            }
            generationStarted = true;
            const generated = await prepareSiteImages(
              {
                ...tenant,
                brand: activeBrand,
                dials: activeDials,
                brief: activeBrief,
              },
              prepared,
            );
            const coverage = sceneCoverage(
              plan,
              generatedPhotos(await listImages(tenant.id)),
            );
            return {
              ...generated,
              cobertura: coverage.missing.length
                ? `Vagas do plano ainda sem foto: ${coverage.missing
                    .map((slot) => `${slot.role} (${slot.targetBlock})`)
                    .join(', ')}.`
                : 'O plano de cenas já está coberto por fotos disponíveis.',
            };
          });
          if (result === null)
            throw new ToolError(
              'Já há uma geração de cenas em andamento para este cliente. Aguarde a conclusão antes de tentar novamente.',
            );
          return result;
        } finally {
          if (!generationStarted) scenesPrepared -= prepared.length;
        }
      }),
    }),

    update_image: tool({
      description:
        'Altera uma imagem existente pelo número, por exemplo "quero atualizar a imagem #5, quero outro carro". Usa a imagem original como referência, mantém a proporção e salva uma nova versão numerada na biblioteca, sem aprovação. Troca as ocorrências nos rascunhos deste cliente e preserva os snapshots publicados. Para logo, a aplicação na marca continua em set_site_logo por pedido do usuário.',
      inputSchema: z.object({
        image: z
          .string()
          .describe('Número da imagem ("#5") ou seu id, sempre deste cliente.'),
        request: z
          .string()
          .trim()
          .min(3)
          .max(500)
          .describe('O que o usuário quer mudar na imagem.'),
        brandName: z
          .string()
          .trim()
          .min(1)
          .max(60)
          .optional()
          .describe('Só para logo: nome exato, quando solicitado.'),
        wordmark: z
          .boolean()
          .optional()
          .describe(
            'Só para logo: false para remover texto; omita para preservar.',
          ),
      }),
      execute: safe(async ({ image: ref, request, brandName, wordmark }) => {
        if (scenesPrepared >= 8)
          throw new ToolError(
            'Orçamento de imagens deste turno esgotado. Encerre o turno.',
          );
        scenesPrepared += 1;
        let generationStarted = false;
        try {
          const result = await withSceneGenerationLock(tenant.id, async () => {
            const previous = await requireImage(tenant.id, ref);
            generationStarted = true;
            const image = await reviseImage(
              {
                ...tenant,
                brand: activeBrand,
                dials: activeDials,
                brief: activeBrief,
              },
              previous,
              request,
              { brandName, wordmark },
            );
            const saved = {
              anterior: `#${previous.seq}`,
              numero: `#${image.seq}`,
              url: image.url,
              alt: image.alt,
              nota: image.score,
              problemas: image.critique.problemas ?? [],
            };
            try {
              const pages = await replaceDraftImage(tenant.id, previous, image);
              return {
                ok: true,
                ...saved,
                paginasAtualizadas: pages,
                orientacao:
                  previous.url === activeBrand.logoUrl
                    ? 'Nova versão salva na biblioteca. O logo da marca ainda é o anterior; use set_site_logo somente quando a aplicação foi solicitada.'
                    : 'Nova versão salva na biblioteca. A anterior foi preservada; as páginas publicadas só mudam após nova publicação.',
              };
            } catch (error) {
              return {
                ok: false,
                ...saved,
                error: `A nova imagem foi salva, mas não foi aplicada aos rascunhos: ${error instanceof Error ? error.message : 'falha na gravação'}`,
              };
            }
          });
          if (result === null)
            throw new ToolError(
              'Já há uma geração de imagens em andamento para este cliente. Aguarde a conclusão.',
            );
          return result;
        } finally {
          if (!generationStarted) scenesPrepared -= 1;
        }
      }),
    }),

    generate_logo: tool({
      description:
        'Cria variantes de logotipo e avalia cada uma. Em "modernizar", usa a URL do logo anexado; devolve uma variante fiel e uma ousada. Em "criar", propõe conceitos do zero. As variantes ficam disponíveis na biblioteca com número e URL, sem aprovação. A aplicação como logo do site depende do pedido do usuário.',
      inputSchema: z.object({
        mode: z.enum(['modernizar', 'criar']),
        referenceUrl: z
          .url()
          .optional()
          .describe('URL do logo anexado. Obrigatória em modernizar.'),
        brief: z
          .string()
          .max(400)
          .optional()
          .describe('Segmento, tom, símbolo desejado, cores.'),
        brandName: z
          .string()
          .max(60)
          .optional()
          .describe('Nome exato a escrever. Padrão: o nome do cliente.'),
        wordmark: z
          .boolean()
          .default(true)
          .describe('false quando o operador pediu só o símbolo, sem texto.'),
        variants: z.number().int().min(2).max(3).default(2),
      }),
      execute: safe(async (input) => {
        if (input.mode === 'modernizar' && !input.referenceUrl)
          throw new ToolError(
            'Para modernizar eu preciso do logo atual. Peça para o operador anexar a imagem no chat.',
          );

        const brandName = input.brandName?.trim() || tenant.name;
        const reference = input.referenceUrl
          ? await fetchReference(input.referenceUrl)
          : undefined;
        const guide = await getGuide(tenant.id);

        const { images, failures } = await generateLogoCandidates({
          tenant: { ...tenant, brand: activeBrand },
          guide,
          mode: input.mode,
          brandName,
          wordmark: input.wordmark,
          brief: input.brief,
          reference,
          referenceUrl: input.referenceUrl,
          variants: input.variants,
        });
        if (!images.length)
          throw new ToolError(
            `Nenhuma variante foi gerada. Motivos: ${failures.join(' | ') || 'desconhecido'}`,
          );

        const critiques = await Promise.all(
          images.map((image) =>
            critiqueLogo({
              id: image.id,
              bytes: image.bytes,
              variant: image.variant,
              mode: input.mode,
              brandName,
              wordmark: input.wordmark,
              reference,
            }),
          ),
        );

        return {
          variantes: images
            .map((image, index) => ({
              numero: `#${image.seq}`,
              url: image.url,
              variante: image.variant,
              nota: critiques[index].nota ?? null,
              fidelidade_original: critiques[index].fidelidade_original ?? null,
              nome_lido: critiques[index].nome_lido ?? null,
              nome_correto: critiques[index].nome_correto ?? null,
              problemas:
                critiques[index].problemas ??
                (critiques[index].erro ? [critiques[index].erro] : []),
            }))
            .sort((a, b) => (b.nota ?? -1) - (a.nota ?? -1)),
          ...(failures.length ? { falhas: failures } : {}),
          orientacao:
            'Variantes disponíveis na biblioteca, sem aprovação. Aplique como logo somente quando solicitado pelo usuário.',
        };
      }),
    }),

    set_site_logo: tool({
      description:
        'Define um logo da biblioteca como o logo do site, na navegação e no rodapé. Não exige aprovação da imagem; use quando o usuário pedir a aplicação.',
      inputSchema: z.object({
        image: z.string().describe('O número ("#3") ou o id da imagem.'),
      }),
      execute: safe(async ({ image: ref }) => {
        if (!operatorAsked(context.lastUserText ?? '')) {
          console.warn('[chat] troca de logo bloqueada: o operador não pediu.');
          throw new ToolError(
            'Trocar o logo do site é decisão do operador. Apresente as opções e pergunte qual ele quer, em vez de decidir sozinho.',
          );
        }
        const image = await requireImage(tenant.id, ref);
        if (image.kind !== 'logo')
          throw new ToolError(
            `A imagem #${image.seq} é uma foto, não um logo. Gere um logo com generate_logo.`,
          );
        if (image.status === 'rejeitada')
          throw new ToolError(
            `A imagem #${image.seq} foi rejeitada anteriormente. Escolha outro logo ou peça uma nova versão.`,
          );
        activeBrand = { ...activeBrand, logoUrl: image.url };
        await setBrandLogo(tenant.id, image.url);
        return { ok: true, numero: `#${image.seq}` };
      }),
    }),

    read_reference: tool({
      description:
        'Lê conteúdo real da URL. Para referências do cadastro, captura desktop/mobile e analisa estrutura, tipografia, imagens, ritmo e superfícies. A leitura visual orienta a direção acima da vibe. Fonte ou captura inacessível vira lacuna. Redes sociais fornecem contexto factual, sem presumir estilo de site.',
      inputSchema: z.object({ url: z.url() }),
      execute: safe(async ({ url }) => {
        if (referencesRead >= 6)
          throw new ToolError(
            'Limite de seis referências por turno. Preserve as demais como lacunas e retome a leitura se forem necessárias.',
          );
        referencesRead += 1;
        // O perfil do briefing já foi lido no cadastro; reler a cada geração
        // gastaria rede e chamaria a rede social de novo sem necessidade.
        const social = normalizeSocialUrl(url);
        const saved = parseSocialRecord(activeBrief.social);
        const fresh =
          saved &&
          social &&
          saved.url === social.url &&
          saved.status === 'ok' &&
          Date.now() - new Date(saved.lidoEm).getTime() < 24 * 60 * 60 * 1000
            ? saved
            : null;
        const reference = social
          ? referenceFromSocial(fresh ?? (await readSocialProfile(social)))
          : await readReference(url);
        if (referenceUrls(activeBrief).includes(normalizeReferenceUrl(url))) {
          reference.visual =
            social || reference.status !== 'ok'
              ? {
                  status: 'inacessivel',
                  motivo: social
                    ? 'Perfil social não define composição de site.'
                    : reference.motivo,
                  capturedAt: new Date().toISOString(),
                }
              : await readReferenceVisual(url, tenant.id);
        }
        const previous = Array.isArray(activeBrief.sources)
          ? (activeBrief.sources as { url?: string }[])
          : [];
        const sources = [
          ...previous.filter(
            (source) =>
              !source?.url ||
              normalizeReferenceUrl(source.url) !==
                normalizeReferenceUrl(reference.url),
          ),
          reference,
        ];
        activeBrief = { ...activeBrief, sources };
        // Leituras de URLs diferentes podem terminar em paralelo. Mescle a
        // fonte no registro atual para não perder a leitura de outra chamada.
        await db()`
          update tenants set brief = jsonb_set(brief, '{sources}',
            coalesce((select jsonb_agg(source)
              from jsonb_array_elements(case when jsonb_typeof(brief->'sources') = 'array'
                then brief->'sources' else '[]'::jsonb end) source
              where source->>'url' <> ${reference.url}), '[]'::jsonb)
            || ${JSON.stringify([reference])}::jsonb), updated_at = now()
          where id = ${tenant.id}
        `;
        return reference;
      }),
    }),

    review_pages: tool({
      description:
        'Valida primeiro a estrutura e revisa em pixels somente páginas sem recibo atual. Devolve achados estáveis com página, bloco e evidência. Informe pages apenas para limitar a próxima captura; a conclusão ainda exige cobertura atual de todo o site.',
      inputSchema: z.object({
        pages: z
          .array(z.string().max(160))
          .max(12)
          .optional()
          .describe(
            'Caminhos afetados, como ["/servicos"]. Omita para revisar automaticamente tudo que estiver sem evidência atual.',
          ),
      }),
      execute: safe(async ({ pages: requestedPages }) => {
        if (reviewRounds >= REVIEW_CALLS_PER_TURN)
          throw new ToolError(
            `${REVIEW_CALLS_PER_TURN} leituras neste turno. Informe as pendências e encerre o turno; uma nova rodada precisa partir do rascunho atual.`,
          );
        reviewRounds += 1;
        const [pages, images, reviewedTenant] = await Promise.all([
          listPages(tenant.id),
          listImages(tenant.id),
          getTenantBySlug(tenant.slug),
        ]);
        if (!reviewedTenant || reviewedTenant.id !== tenant.id)
          throw new ToolError('Cliente indisponível para revisão.');
        if (!pages.length)
          throw new ToolError(
            'Não há páginas para revisar. Monte o projeto com build_site antes.',
          );
        const normalizePage = (value: string) => {
          const clean = value.trim().replace(/^\/+|\/+$/g, '');
          return `/${clean}`;
        };
        const pageByPath = new Map(
          pages.map((page) => [`/${page.slug}`, page]),
        );
        const requested = requestedPages?.length
          ? new Set(requestedPages.map(normalizePage))
          : null;
        const invalid = requested
          ? [...requested].filter((path) => !pageByPath.has(path))
          : [];
        if (invalid.length)
          throw new ToolError(
            `Página(s) inexistente(s) na revisão: ${invalid.join(', ')}. Use list_state para ver os caminhos atuais.`,
          );

        const preflightStarted = Date.now();
        await context.onReviewProgress?.({
          stage: 'preflight',
          label: 'Validando estrutura, conteúdo e publicação',
        });
        const deterministic = identifyFindings([
          ...lintSite(pages, images, 'publish', reviewedTenant.brand).map(
            (finding) => ({
              pagina: finding.page,
              nivel: finding.level,
              regra: finding.rule,
              bloco: undefined as string | undefined,
              correcao: finding.message,
            }),
          ),
          ...structuralFindings(pages, images, reviewedTenant.brand).map(
            (finding) => ({
              pagina: finding.page,
              nivel: finding.level,
              regra: finding.rule,
              bloco:
                finding.blockIndex === undefined
                  ? undefined
                  : `${finding.blockIndex}: ${finding.blockType}#${finding.blockId}`,
              correcao: finding.message,
            }),
          ),
          ...pages.flatMap((page) =>
            lintPage(page, reviewedTenant.brand.design)
              .filter((finding) => finding.level === 'error')
              .map((finding) => ({
                pagina: `/${page.slug}`,
                nivel: finding.level,
                regra: finding.rule,
                bloco: finding.blockId,
                correcao: finding.message,
              })),
          ),
        ]);
        const preflightMs = Date.now() - preflightStarted;
        const metrics = siteMetrics(pages, images, reviewedTenant.brand.design);
        const previous = savedReview(reviewedTenant);
        const pageReceipts: Record<string, PageReviewReceipt> = {};
        if (previous?.version === 2 && previous.pages) {
          for (const page of pages) {
            const path = `/${page.slug}`;
            const saved = previous.pages[path];
            if (
              saved?.fingerprint ===
              pageReviewFingerprint(reviewedTenant, page, images)
            )
              pageReceipts[path] = saved;
          }
        }

        const stale = pendingReviewPages(
          reviewedTenant,
          pages,
          images,
          previous,
        );
        const targets = stale.filter(
          (page) => !requested || requested.has(`/${page.slug}`),
        );
        const blockingPreflight = deterministic.filter(
          (finding) => finding.nivel === 'error',
        );
        let capturas: Shot[] = [];
        let captureMs = 0;
        let criticMs = 0;
        const reviewedPaths = new Set<string>();
        const technicalFindings: ReviewFindingReceipt[] = [];
        let critica: Awaited<ReturnType<typeof critiquePages>> | undefined;
        let captureFailures: {
          page: string;
          viewport: 'desktop' | 'mobile';
          message: string;
        }[] = [];
        let criticFailed = false;

        // Erro determinístico já é acionável. Capturar o mesmo rascunho só
        // acrescentaria custo e repetiria um problema que o agente pode reparar.
        if (blockingPreflight.length) {
          await context.onReviewProgress?.({
            stage: 'preflight',
            label: `${blockingPreflight.length} erro(s) estrutural(is) encontrado(s); pixels preservados`,
          });
        } else if (!captureEnabled()) {
          for (const page of targets) {
            const path = `/${page.slug}`;
            pageReceipts[path] = {
              fingerprint: pageReviewFingerprint(reviewedTenant, page, images),
              visual: 'disabled',
              viewports: { desktop: false, mobile: false },
              errors: 1,
              reviewedAt: new Date().toISOString(),
              findings: identifyFindings([
                {
                  pagina: path,
                  nivel: 'error',
                  regra: 'revisao-desabilitada',
                  correcao:
                    'A captura visual está desabilitada. Ative-a e confira desktop e celular antes de concluir.',
                },
              ]),
            };
          }
        } else if (targets.length) {
          const captureStarted = Date.now();
          await context.onReviewProgress?.({
            stage: 'capture',
            label: `Preparando ${targets.length * 2} capturas`,
            completed: 0,
            total: targets.length * 2,
          });
          try {
            if (!context.origin) throw new Error('Origem da prévia ausente.');
            capturas = await capturePages(
              context.origin,
              tenant.slug,
              targets.map((page) => page.slug),
              {
                cookie: context.cookie,
                concurrency: 2,
                retries: 1,
                onProgress: async (progress) =>
                  context.onReviewProgress?.({
                    stage: 'capture',
                    label: `Conferindo ${progress.page || '/'} no ${progress.viewport === 'mobile' ? 'celular' : 'desktop'} · ${progress.completed} de ${progress.total}`,
                    ...progress,
                  }),
              },
            );
          } catch (error) {
            const partial = error as {
              shots?: Shot[];
              failures?: typeof captureFailures;
            };
            if (Array.isArray(partial.shots)) capturas = partial.shots;
            if (Array.isArray(partial.failures))
              captureFailures = partial.failures;
            console.error(
              '[review] indisponível:',
              error instanceof Error
                ? `${error.name}: ${error.message.slice(0, 200)}`
                : 'unknown',
            );
          }
          captureMs = Date.now() - captureStarted;

          // Um mock ou provedor antigo não informa a falha por viewport. A
          // cobertura observada ainda permite localizar exatamente o que falta.
          for (const page of targets) {
            const path = `/${page.slug}`;
            for (const viewport of ['desktop', 'mobile'] as const) {
              if (
                !capturas.some(
                  (shot) => shot.page === path && shot.viewport === viewport,
                ) &&
                !captureFailures.some(
                  (failure) =>
                    failure.page === path && failure.viewport === viewport,
                )
              )
                captureFailures.push({
                  page: path,
                  viewport,
                  message: 'A captura não devolveu este viewport.',
                });
            }
          }

          const completeTargets = targets.filter((page) => {
            const path = `/${page.slug}`;
            return (['desktop', 'mobile'] as const).every((viewport) =>
              capturas.some(
                (shot) => shot.page === path && shot.viewport === viewport,
              ),
            );
          });
          if (completeTargets.length) {
            const criticStarted = Date.now();
            await context.onReviewProgress?.({
              stage: 'critic',
              label: `Avaliando ${completeTargets.length} página(s) com evidência visual`,
              completed: 0,
              total: completeTargets.length,
            });
            try {
              const completePaths = new Set(
                completeTargets.map((page) => `/${page.slug}`),
              );
              critica = await critiquePages(
                reviewedTenant,
                completeTargets,
                capturas.filter((shot) => completePaths.has(shot.page)),
              );
              await context.onReviewProgress?.({
                stage: 'critic',
                label: `Crítica concluída em ${completeTargets.length} página(s)`,
                completed: completeTargets.length,
                total: completeTargets.length,
              });
            } catch (error) {
              criticFailed = true;
              console.error(
                '[review] crítica indisponível:',
                error instanceof Error
                  ? `${error.name}: ${error.message.slice(0, 200)}`
                  : 'unknown',
              );
            }
            criticMs = Date.now() - criticStarted;
          }

          for (const page of targets) {
            const path = `/${page.slug}`;
            const pageShots = capturas.filter((shot) => shot.page === path);
            const viewports = {
              desktop: pageShots.some((shot) => shot.viewport === 'desktop'),
              mobile: pageShots.some((shot) => shot.viewport === 'mobile'),
            };
            const raw: Omit<ReviewFindingReceipt, 'id' | 'status'>[] = [
              ...deterministic
                .filter((finding) => finding.pagina === path)
                .map(({ id: _id, status: _status, ...finding }) => finding),
              ...pageShots
                .filter((shot) => shot.overflow || shot.brokenImages)
                .map((shot) => ({
                  pagina: path,
                  nivel: 'error',
                  regra: 'render',
                  viewport: shot.viewport,
                  correcao: `${shot.viewport}: ${shot.overflow ? 'overflow horizontal; ' : ''}${shot.brokenImages} imagem(ns) quebrada(s). Corrija e capture novamente.`,
                })),
              ...captureFailures
                .filter((failure) => failure.page === path)
                .map((failure) => ({
                  pagina: path,
                  nivel: 'error',
                  regra: 'captura-indisponivel',
                  viewport: failure.viewport,
                  evidencia: failure.message,
                  correcao: `A captura de ${failure.viewport} falhou após a repetição local. Retome somente esta página.`,
                })),
              ...(critica?.findings ?? [])
                .filter((finding) => finding.page === path)
                .map((finding) => ({
                  pagina: path,
                  nivel: finding.level,
                  regra: finding.criterion,
                  bloco: finding.blockId ?? undefined,
                  evidencia: finding.evidence,
                  correcao: finding.correction,
                })),
            ];
            const hasBoth = viewports.desktop && viewports.mobile;
            if (hasBoth && criticFailed)
              raw.push({
                pagina: path,
                nivel: 'error',
                regra: 'critica-indisponivel',
                correcao:
                  'Os pixels foram capturados, mas a crítica não completou. Retome esta página sem reescrever seu conteúdo.',
              });
            const findings = identifyFindings(raw);
            const visual =
              hasBoth && !criticFailed ? 'complete' : 'unavailable';
            if (visual === 'complete') reviewedPaths.add(path);
            pageReceipts[path] = {
              fingerprint: pageReviewFingerprint(reviewedTenant, page, images),
              visual,
              viewports,
              errors: findings.filter((finding) => finding.nivel === 'error')
                .length,
              reviewedAt: new Date().toISOString(),
              findings,
            };
          }

          for (const finding of critica?.unresolvedFindings ?? [])
            technicalFindings.push(
              ...identifyFindings([
                {
                  pagina: '/',
                  nivel: finding.level,
                  regra: 'critica-sem-ancora',
                  evidencia: `${finding.evidence} Referência informada: ${finding.page}.`,
                  correcao: `${finding.correction} Localize a página antes de encerrar a revisão.`,
                },
              ]),
            );
          if (critica?.unlinked)
            technicalFindings.push(
              ...identifyFindings([
                {
                  pagina: '/',
                  nivel: 'warn',
                  regra: 'critica-bloco-sem-ancora',
                  correcao: `${critica.unlinked} achado(s) perderam o id do bloco, mas continuam ligados à página. Confira a evidência antes de editar.`,
                },
              ]),
            );
        }

        // Uma falha técnica não prova que um defeito visual anterior sumiu.
        // Preserve achados abertos até uma nova crítica completar a página.
        const carried = (previous?.findings ?? []).filter(
          (finding) =>
            finding.status !== 'resolved' &&
            pageByPath.has(finding.pagina) &&
            !reviewedPaths.has(finding.pagina),
        );
        const currentOpen = [
          ...deterministic,
          ...Object.values(pageReceipts).flatMap((item) => item.findings),
          ...technicalFindings,
          ...carried,
        ];
        const uniqueOpen = [
          ...new Map(
            currentOpen.map((finding) => [
              finding.id ?? JSON.stringify(finding),
              finding,
            ]),
          ).values(),
        ];
        const openIds = new Set(uniqueOpen.map((finding) => finding.id));
        const resolved = (previous?.findings ?? []).filter(
          (finding) =>
            finding.id &&
            finding.status !== 'resolved' &&
            reviewedPaths.has(finding.pagina) &&
            !openIds.has(finding.id),
        );
        const complete = pages.every((page) => {
          const item = pageReceipts[`/${page.slug}`];
          return (
            item?.fingerprint ===
              pageReviewFingerprint(reviewedTenant, page, images) &&
            item.visual === 'complete' &&
            item.viewports.desktop &&
            item.viewports.mobile
          );
        });
        const visual: ReviewReceipt['visual'] = complete
          ? 'complete'
          : captureEnabled()
            ? 'unavailable'
            : 'disabled';
        const reviewedAt = new Date().toISOString();
        const receipt: ReviewReceipt = {
          version: 2,
          fingerprint: reviewFingerprint(reviewedTenant, pages, images),
          complete,
          visual,
          errors: uniqueOpen.filter(
            (item) => item.nivel === 'error' && item.status !== 'resolved',
          ).length,
          reviewedAt,
          findings: [
            ...uniqueOpen,
            ...resolved.map((finding) => ({
              ...finding,
              status: 'resolved' as const,
            })),
          ],
          pages: pageReceipts,
          timings: { preflightMs, captureMs, criticMs },
        };
        const previousGeneration = reviewedTenant.brief.generation as
          | Record<string, unknown>
          | undefined;
        const generation = {
          ...previousGeneration,
          reviewRounds: Number(previousGeneration?.reviewRounds ?? 0) + 1,
          review: receipt,
          updatedAt: receipt.reviewedAt,
        };
        activeBrief = { ...activeBrief, generation };
        // Merge no banco, não por cima do snapshot da requisição: reescrever o
        // objeto inteiro apagava a fase gravada pela execução em andamento, e
        // a contagem de rodadas vinha de uma leitura que já podia estar velha.
        await db()`
          update tenants
          set brief = jsonb_set(
                coalesce(brief, '{}'::jsonb),
                '{generation}',
                coalesce(brief -> 'generation', '{}'::jsonb) || ${JSON.stringify(
                  { review: receipt, updatedAt: receipt.reviewedAt },
                )}::jsonb
                  || jsonb_build_object(
                       'reviewRounds',
                       coalesce((brief -> 'generation' ->> 'reviewRounds')::int, 0) + 1
                     ),
                true
              ),
              updated_at = now()
          where id = ${tenant.id}
        `;
        return {
          review: receipt,
          complete: receipt.complete && receipt.errors === 0,
          visual,
          preflightOnly: blockingPreflight.length > 0,
          reviewedPages: [...reviewedPaths],
          reusedPages: Object.keys(pageReceipts).filter(
            (path) => !reviewedPaths.has(path),
          ),
          pendingPages: pendingReviewPages(
            reviewedTenant,
            pages,
            images,
            receipt,
          ).map((page) => `/${page.slug}`),
          pontosFortes: critica?.strengths ?? [],
          criticUsage: critica?.usage,
          medicoes: capturas.map((shot) => ({
            pagina: shot.page,
            viewport: shot.viewport,
            larguraDaPagina: shot.scrollWidth,
            overflow: shot.overflow,
            imagensQuebradas: shot.brokenImages,
          })),
          rodada: reviewRounds,
          paginas: pages.map((page) => {
            const measured = metrics.pages.find((m) => m.slug === page.slug);
            return {
              pagina: `/${page.slug}`,
              secoes: measured?.sections ?? 0,
              fotos: measured?.images ?? 0,
              tons: measured?.tones ?? [],
              protagonista: measured?.protagonist ?? null,
              motion: measured?.motionMoments ?? 0,
              blocos: page.blocks.map(
                (block, index) =>
                  `${index}: ${block.type}#${block.id}${
                    typeof block.props.layout === 'string'
                      ? ` (${block.props.layout})`
                      : ''
                  }`,
              ),
            };
          }),
          apontamentos: receipt.findings,
          erros: receipt.errors,
        };
      }),
    }),

    lint_site: tool({
      description:
        'Valida o projeto completo: 3 páginas orgânicas, jornada de inbound, links internos e 2 fotos geradas na home.',
      inputSchema: z.object({}),
      execute: safe(async () => {
        const [pages, images] = await Promise.all([
          listPages(tenant.id),
          listImages(tenant.id),
        ]);
        return { findings: lintSite(pages, images, 'publish', activeBrand) };
      }),
    }),
    list_images: tool({
      description:
        'Lista as imagens disponíveis do cliente com número, descrição e URL exata para os blocos. Não há aprovação. Use update_image para pedidos de alteração pelo número.',
      inputSchema: z.object({}),
      execute: safe(async () => {
        const library = await listImages(tenant.id);
        return {
          imagens: library
            .filter((image) => image.status !== 'rejeitada')
            .map((image) => ({
              numero: `#${image.seq}`,
              kind: image.kind,
              url: image.url,
              alt: image.alt,
              ratio: image.ratio,
              bloco_sugerido: image.targetBlock,
              descricao: image.description ?? image.requestText,
            })),
        };
      }),
    }),

    list_state: tool({
      description:
        'Lê o estado atual do site: páginas, tipos, quantidade de blocos e se estão publicadas.',
      inputSchema: z.object({}),
      execute: async () => {
        const pages = await listPages(tenant.id);
        return {
          brief: activeBrief,
          brand: activeBrand,
          dials: activeDials,
          pages: pages.map((page) => ({
            slug: `/${page.slug}`,
            type: page.type,
            title: page.title,
            blocks: page.blocks.map((block) => `${block.type}#${block.id}`),
            published: Boolean(page.publishedBlocks),
          })),
        };
      },
    }),

    get_page: tool({
      description:
        'Lê uma página com os blocos, seus ids, tipos e props completas. Chame antes de update_block, move_block ou remove_block para saber o que existe.',
      inputSchema: z.object({
        page: z.string().describe('Slug. Vazio para a home.'),
      }),
      execute: safe(async ({ page: slug }) => {
        const page = await requirePage(tenant.id, slug);
        return {
          slug: `/${page.slug}`,
          type: page.type,
          title: page.title,
          seo: page.seo,
          blocks: page.blocks.map((block, index) => ({
            index,
            id: block.id,
            type: block.type,
            props: block.props,
          })),
        };
      }),
    }),

    describe_block: tool({
      description:
        'Mostra o schema exato de props de um bloco. Consulte quando o schema não estiver no contexto; não repita uma consulta já disponível.',
      inputSchema: z.object({ type: z.string() }),
      execute: async ({ type }) => {
        if (!isBlockType(type))
          return {
            error: `Bloco "${type}" não existe.`,
            available: BLOCK_TYPES,
          };
        return { type, schema: z.toJSONSchema(blockSchemas[type]) };
      },
    }),

    set_brand: tool({
      description:
        'Faz um ajuste pontual de marca existente. Para site novo ou reconstrução, use set_design.',
      inputSchema: z.object({
        accent: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .optional()
          .describe('Cor primária: seções e superfícies da marca.'),
        accentAlt: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .optional()
          .describe('Cor secundária: o tom complementar das seções.'),
        highlight: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .optional()
          .describe('Cor de acento: botões, links e destaques.'),
        ink: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .optional(),
        paper: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .optional(),
        radius: z.enum(['none', 'sm', 'md', 'lg', 'full']).optional(),
        font: z.enum(['sans', 'serif', 'mono']).optional(),
        variance: z.number().int().min(1).max(10).optional(),
        motion: z.number().int().min(1).max(10).optional(),
        density: z.number().int().min(1).max(10).optional(),
      }),
      execute: async (input) => {
        const brand = {
          ...activeBrand,
          ...(input.accent ? { accent: input.accent } : {}),
          ...(input.accentAlt ? { accentAlt: input.accentAlt } : {}),
          ...(input.highlight ? { highlight: input.highlight } : {}),
          ...(input.ink ? { ink: input.ink } : {}),
          ...(input.paper ? { paper: input.paper } : {}),
          ...(input.radius ? { radius: input.radius } : {}),
          ...(input.font ? { font: input.font } : {}),
        };
        const dials = {
          variance: input.variance ?? activeDials.variance,
          motion: input.motion ?? activeDials.motion,
          density: input.density ?? activeDials.density,
        };
        await db()`
          update tenants set brand = ${JSON.stringify(brand)}::jsonb,
                             dials = ${JSON.stringify(dials)}::jsonb,
                             updated_at = now()
          where id = ${tenant.id}
        `;
        activeBrand = brand;
        activeDials = dials;

        // O site escurece sozinho um acento que reprova no contraste. Avisar
        // aqui evita o agente insistir numa cor que nunca vai aparecer igual.
        const acao = brand.highlight ?? brand.accent ?? '#1f6feb';
        const contrast = accessibleAccent(acao);
        const aviso = contrast.adjusted
          ? `O acento ${acao} reprovava no contraste mínimo. O site vai usar ${contrast.accent}, a cor mais próxima que passa.`
          : null;
        return { brand, dials, ...(aviso ? { aviso } : {}) };
      },
    }),

    set_design: tool({
      description:
        'Define briefing e direção de arte versionada em uma chamada. Obrigatória antes de build_site. A direção é recusada quando repete a arquitetura visual de outro cliente.',
      inputSchema: designProfileInputSchema,
      execute: safe(async (input) => {
        // Cor escolhida no cadastro é decisão do operador: a direção de arte
        // define estrutura e leitura, não reescreve a marca dele.
        const locked = activeBrand.paletteSource === 'operador';
        // Com a paleta do cadastro, a escolha do operador vence. Sem ela, o
        // modelo propõe, mas a cor que o cliente já tinha continua valendo
        // quando ele não propõe nada: cliente antigo não fica sem paleta.
        const accent = locked
          ? (activeBrand.accent ?? input.accent)
          : (input.accent ?? activeBrand.accent);
        const accentAlt = locked
          ? (activeBrand.accentAlt ?? input.accentAlt)
          : (input.accentAlt ?? activeBrand.accentAlt);
        if (!accent || !accentAlt) {
          throw new ToolError(
            'Este cliente não tem cores no cadastro. Informe accent e accentAlt com papéis diferentes.',
          );
        }
        if (accent.toLowerCase() === accentAlt.toLowerCase()) {
          throw new ToolError(
            'accent e accentAlt precisam cumprir papéis diferentes. Escolha duas cores distintas.',
          );
        }
        if (input.paper.toLowerCase() === input.surface.toLowerCase()) {
          throw new ToolError(
            'paper e surface estão iguais. A página precisa de profundidade tonal perceptível.',
          );
        }
        if (contrastRatio(input.ink, input.paper) < 4.5) {
          throw new ToolError(
            'ink e paper não alcançam contraste AA para texto. Ajuste a paleta.',
          );
        }
        if (contrastRatio(input.ink, input.surface) < 4.5) {
          throw new ToolError(
            'ink e surface não alcançam contraste AA para texto. Ajuste a superfície.',
          );
        }

        // Sem fonte legível, o que sobra é o que o operador informou. A
        // lacuna precisa estar declarada, senão ela vira texto inventado.
        const sources = Array.isArray(activeBrief.sources)
          ? (activeBrief.sources as { status?: string }[])
          : [];
        const readable = sources.filter((source) => source?.status === 'ok');
        const blocked = sources.length - readable.length;
        if (
          !input.brief.gaps.length &&
          (blocked > 0 || (!input.brief.evidence.length && !readable.length))
        ) {
          throw new ToolError(
            'Nenhuma fonte confirmada sustenta os fatos deste cliente. Liste em brief.gaps o que ainda precisa ser confirmado (serviços, estrutura, região, prazos) antes de definir a direção.',
          );
        }

        const referenceIssues = referenceDirectionIssues(
          activeBrief,
          input.referenceDirection,
        );
        if (referenceIssues.length)
          throw new ToolError(referenceIssues.join(' '));
        if (
          referenceSources(activeBrief).some((source) => !source.reading) &&
          !input.brief.gaps.length
        )
          throw new ToolError(
            'Declare em brief.gaps as referências sem leitura visual; não trate texto ou URL como evidência de estilo.',
          );
        // Uma referência verificada decide dentro da vibe, não no lugar dela.
        // Antes ela pulava a faixa inteira: os dois clientes medidos em
        // 12/09/2026 gravaram eixos neutros e o renderer caía na base
        // comercial. Agora cada aspecto documentado libera só os seus eixos;
        // composição de hero, motivo, variância e movimento ficam com a vibe.
        const vibe = vibeOf(activeBrand);
        const referenceLed = !!input.referenceDirection;
        const aspects = referenceAspects({
          design: { version: 4, referenceDirection: input.referenceDirection },
        });
        const outOfLane = laneIssues(vibe, input, aspects);
        if (outOfLane.length) {
          throw new ToolError(
            `A direção não cabe na vibe ${VIBE_LABEL[vibe]} escolhida no cadastro. ${outOfLane.join(
              ' ',
            )}${
              referenceLed
                ? ` A referência dirige ${[...aspects].join(', ')}; os demais eixos continuam da vibe.`
                : ''
            }`,
          );
        }

        const profile = completeDesignProfile(input);
        if (
          context.phase === 'briefing' &&
          (!input.brief.imageScenes ||
            !sceneRequestsMatchPlan(
              scenePlan(profile, 3, vibe),
              input.brief.imageScenes,
            ))
        ) {
          throw new ToolError(
            `brief.imageScenes precisa preencher exatamente o plano estrutural: ${scenePlan(
              profile,
              3,
              vibe,
            )
              .map((scene) => `${scene.role} (${scene.targetBlock})`)
              .join(
                ', ',
              )}. Escreva cada pedido com o assunto da página correspondente.`,
          );
        }
        // A comparação é dentro da mesma vibe: faixas diferentes se sobrepõem
        // em vários eixos e um site moderno não repete um ousado com os
        // mesmos enums.
        const rows = (await db()`
          select brand->'design' as design
          from tenants
          where id <> ${tenant.id} and brand ? 'design'
            and coalesce(brand->>'vibe', 'comercial') = ${vibe}
        `) as { design?: unknown }[];
        const nearest = nearestDesign(
          profile,
          rows.map((row) => row.design),
        );
        if (!referenceLed && nearest && nearest.distance < 3) {
          throw new ToolError(
            `Direção estrutural muito parecida com outro site da vibe ${VIBE_LABEL[vibe]}: distância ${nearest.distance}/8. Mude pelo menos ${3 - nearest.distance} decisões entre heroComposition, navigation, rhythm, imageTreatment, surfaceStyle, motif e tipografia, sempre dentro da vibe.`,
          );
        }

        const legacyFont =
          profile.displayFont === 'editorial'
            ? 'serif'
            : profile.displayFont === 'mono'
              ? 'mono'
              : 'sans';
        const brand = {
          ...activeBrand,
          accent,
          accentAlt,
          ink: input.ink,
          paper: input.paper,
          surface: input.surface,
          radius: input.radius,
          font: legacyFont as 'sans' | 'serif' | 'mono',
          design: profile,
        };
        const dials = {
          variance: input.variance,
          motion: input.motion,
          density: input.density,
        };
        // O brief guarda também intake, fontes lidas e progresso da geração:
        // sobrescrever o objeto inteiro apagaria esse contexto.
        const brief = { ...activeBrief, ...input.brief };
        await db()`
          update tenants
          set brief = brief || ${JSON.stringify(input.brief)}::jsonb,
              brand = ${JSON.stringify(brand)}::jsonb,
              dials = ${JSON.stringify(dials)}::jsonb,
              updated_at = now()
          where id = ${tenant.id}
        `;
        activeBrief = brief;
        activeBrand = brand;
        activeDials = dials;
        return {
          ok: true,
          vibe,
          visualAuthority: referenceLed ? 'references' : 'vibe',
          referenceAspects: [...aspects],
          gramatica: grammarDirection(vibe),
          aberturaDaHome: VIBE_GRAMMAR[vibe].openings,
          protagonistaDaHome: VIBE_GRAMMAR[vibe].protagonists,
          ...(referenceLed && nearest && nearest.distance < 3
            ? {
                warning:
                  'Perfil próximo de outro site. Diferencie conteúdo e composição preservando os traços das referências; a trava de home idêntica continua ativa.',
              }
            : {}),
          concept: profile.concept,
          signatureElement: profile.signatureElement,
          structuralDistance: nearest?.distance ?? null,
          signature: profile.signature,
        };
      }),
    }),

    build_site: tool({
      description:
        'Cria ou substitui o projeto completo. Valida antes de gravar. Se houver erro, o lote fica em memória para repair_site neste turno.',
      inputSchema: buildSiteInput,
      execute: safe(async (input) => {
        pendingDraft = input;
        return saveSiteDraft(input);
      }),
    }),

    repair_site: tool({
      description:
        'Corrige apenas campos de um build_site recusado neste turno. Revalida o lote completo e grava atomicamente se válido. Não edita páginas fora do lote nem publica.',
      inputSchema: repairSiteInput,
      execute: safe(async (input) => {
        if (!pendingDraft)
          throw new ToolError(
            'Não há lote recusado neste turno. Para editar páginas salvas, use get_page e update_block.',
          );
        try {
          pendingDraft = repairSiteDraft(pendingDraft, input);
        } catch (error) {
          throw new ToolError(
            error instanceof Error ? error.message : 'Reparo inválido.',
          );
        }
        return saveSiteDraft(pendingDraft);
      }),
    }),

    delete_page: tool({
      description: 'Apaga uma página. Use só quando o operador pedir.',
      inputSchema: z.object({ page: z.string() }),
      execute: safe(async ({ page: slug }) => {
        const page = await requirePage(tenant.id, slug);
        await db()`delete from pages where id = ${page.id}`;
        return { ok: true, removida: `/${page.slug}` };
      }),
    }),

    create_page: tool({
      description:
        'Cria uma página. Use slug vazio para a home. Tipos: page, paid_lp, post, thank_you.',
      inputSchema: z.object({
        slug: z
          .string()
          .describe(
            'Sem barra inicial. Vazio para a home. Ex: "sobre", "blog", "blog/meu-post".',
          ),
        type: pageType,
        title: z.string().min(2).max(120),
        seoTitle: z.string().max(70).optional(),
        seoDescription: z.string().max(170).optional(),
        excerpt: z.string().max(220).optional().describe('Só para posts.'),
        inbound: inboundSchema.optional(),
        date: z
          .string()
          .optional()
          .describe('Só para posts, formato AAAA-MM-DD.'),
      }),
      execute: async (input) => {
        const slug = input.slug.replace(/^\/+|\/+$/g, '');
        const noindex = input.type === 'thank_you' || input.type === 'paid_lp';
        const seo = {
          title: input.seoTitle ?? input.title,
          description: input.seoDescription,
          noindex,
        };
        const meta = {
          ...(input.type === 'post'
            ? { excerpt: input.excerpt, date: input.date }
            : {}),
          ...(input.inbound ? { inbound: input.inbound } : {}),
        };
        await db()`
          insert into pages (tenant_id, slug, type, title, seo, meta, blocks)
          values (${tenant.id}, ${slug}, ${input.type}, ${input.title},
                  ${JSON.stringify(seo)}::jsonb, ${JSON.stringify(meta)}::jsonb, '[]'::jsonb)
          on conflict (tenant_id, slug) do update
            set type = excluded.type, title = excluded.title, seo = excluded.seo,
                meta = excluded.meta, updated_at = now()
        `;
        return { slug: slug || '(home)', type: input.type, created: true };
      },
    }),

    set_blocks: tool({
      description:
        'Substitui todos os blocos de uma página. É a forma principal de montar ou refazer uma página.',
      inputSchema: z.object({
        page: z.string().describe('Slug da página. Vazio para a home.'),
        blocks: z.array(blockInput).min(1).max(20),
      }),
      execute: safe(async ({ page: slug, blocks }) => {
        const page = await requirePage(tenant.id, slug);
        const next = toBlocks(blocks);
        if (page.slug === '' && isDesignProfile(activeBrand.design)) {
          const conflict = await compositionConflict(
            tenant.id,
            next,
            activeBrand.design,
          );
          if (conflict)
            throw new ToolError(compositionConflictMessage(conflict));
        }
        await db()`
          update pages set blocks = ${JSON.stringify(next)}::jsonb, updated_at = now()
          where id = ${page.id}
        `;
        const findings = lintPage(
          { ...page, blocks: next },
          activeBrand.design,
        );
        return {
          ok: true,
          blocks: next.length,
          preflight: formatFindings(findings),
          erros: findings.filter((f) => f.level === 'error').length,
        };
      }),
    }),

    insert_block: tool({
      description:
        'Insere um bloco em uma posição. Índice 0 é o topo. Omita o índice para colocar no fim, antes do rodapé.',
      inputSchema: z.object({
        page: z.string(),
        block: blockInput,
        index: z.number().int().min(0).optional(),
      }),
      execute: safe(async ({ page: slug, block, index }) => {
        const page = await requirePage(tenant.id, slug);
        const next = [...page.blocks];
        const [created] = toBlocks([block]);
        const footerAt = next.findIndex((b) => b.type.startsWith('footer.'));
        const at = index ?? (footerAt >= 0 ? footerAt : next.length);
        next.splice(at, 0, created);
        await db()`
          update pages set blocks = ${JSON.stringify(next)}::jsonb, updated_at = now()
          where id = ${page.id}
        `;
        return {
          ok: true,
          blockId: created.id,
          position: at,
          total: next.length,
        };
      }),
    }),

    update_block: tool({
      description:
        'Atualiza as props de um bloco existente. Passe apenas as props que mudam.',
      inputSchema: z.object({
        page: z.string(),
        block: z
          .string()
          .describe(
            'Id do bloco, ou o tipo ("hero.split") ou a família ("hero") quando só existe um.',
          ),
        props: z
          .record(z.string(), z.unknown())
          .describe(
            'Só as props que mudam. Objetos e listas são substituídos inteiros.',
          ),
        type: z
          .string()
          .optional()
          .describe(
            'Novo tipo do bloco, para trocar a variante mantendo as props em comum. Ex: hero.statement para hero.split.',
          ),
      }),
      execute: safe(async ({ page: slug, block: selector, props, type }) => {
        const page = await requirePage(tenant.id, slug);
        const target = findBlock(page.blocks, selector);
        if (type && !isBlockType(type))
          throw new ToolError(
            `Tipo "${type}" não existe. Tipos: ${BLOCK_TYPES.join(', ')}`,
          );
        const nextProps = {
          ...target.props,
          ...props,
          ...(props.presentation &&
          typeof props.presentation === 'object' &&
          !Array.isArray(props.presentation)
            ? {
                presentation: {
                  ...(target.props.presentation as Record<string, unknown>),
                  ...props.presentation,
                },
              }
            : {}),
        };
        const scopeError = scopedUpdateError(
          context.editPolicy,
          page.slug,
          target,
          nextProps,
          type,
        );
        if (scopeError) throw new ToolError(scopeError);
        const nextType = type ?? target.type;
        if (!isBlockType(nextType))
          throw new ToolError('O tipo do bloco não está no catálogo.');
        const validated = blockSchemas[nextType].strict().safeParse(nextProps);
        if (!validated.success)
          throw new ToolError(
            `A alteração deixaria o bloco inválido: ${validated.error.message}`,
          );
        const next = page.blocks.map((block) =>
          block.id === target.id
            ? {
                ...block,
                type: type ?? block.type,
                props: nextProps,
              }
            : block,
        );
        await db()`
          update pages set blocks = ${JSON.stringify(next)}::jsonb, updated_at = now()
          where id = ${page.id}
        `;
        return {
          ok: true,
          blockId: target.id,
          preflight: formatFindings(
            lintPage({ ...page, blocks: next }, activeBrand.design),
          ),
        };
      }),
    }),

    remove_block: tool({
      description: 'Remove um bloco da página. Aceita id, tipo ou família.',
      inputSchema: z.object({ page: z.string(), block: z.string() }),
      execute: safe(async ({ page: slug, block: selector }) => {
        const page = await requirePage(tenant.id, slug);
        const target = findBlock(page.blocks, selector);
        const next = page.blocks.filter((block) => block.id !== target.id);
        await db()`
          update pages set blocks = ${JSON.stringify(next)}::jsonb, updated_at = now()
          where id = ${page.id}
        `;
        return { ok: true, remaining: next.length };
      }),
    }),

    move_block: tool({
      description:
        'Move um bloco para outra posição na página. Aceita id, tipo ou família.',
      inputSchema: z.object({
        page: z.string(),
        block: z.string(),
        toIndex: z.number().int().min(0),
      }),
      execute: safe(async ({ page: slug, block: selector, toIndex }) => {
        const page = await requirePage(tenant.id, slug);
        const target = findBlock(page.blocks, selector);
        const from = page.blocks.findIndex((block) => block.id === target.id);
        const next = [...page.blocks];
        const [moved] = next.splice(from, 1);
        next.splice(Math.min(toIndex, next.length), 0, moved);
        await db()`
          update pages set blocks = ${JSON.stringify(next)}::jsonb, updated_at = now()
          where id = ${page.id}
        `;
        return { ok: true, from, to: toIndex };
      }),
    }),

    set_seo: tool({
      description: 'Define título, descrição e indexação de uma página.',
      inputSchema: z.object({
        page: z.string(),
        title: z.string().max(70).optional(),
        description: z.string().max(170).optional(),
        noindex: z.boolean().optional(),
        inbound: inboundSchema.optional(),
      }),
      execute: safe(async ({ page: slug, inbound, ...seoInput }) => {
        const page = await requirePage(tenant.id, slug);
        const seo = { ...page.seo, ...seoInput };
        await db()`
          update pages set seo = ${JSON.stringify(seo)}::jsonb, meta = ${JSON.stringify({ ...page.meta, ...(inbound ? { inbound } : {}) })}::jsonb, updated_at = now()
          where id = ${page.id}
        `;
        return { ok: true, seo };
      }),
    }),

    lint_page: tool({
      description:
        'Roda o pre-flight de qualidade em uma página. Corrija todo ERRO antes de considerar a página pronta.',
      inputSchema: z.object({ page: z.string() }),
      execute: safe(async ({ page: slug }) => {
        const page = await requirePage(tenant.id, slug);
        const findings = lintPage(page, activeBrand.design);
        return {
          aprovado: !findings.some((f) => f.level === 'error'),
          relatorio: formatFindings(findings),
        };
      }),
    }),

    publish_page: tool({
      description:
        'Publica uma página. Só use quando o operador pedir. Bloqueia se o pre-flight tiver erro.',
      inputSchema: z.object({ page: z.string() }),
      execute: safe(async ({ page: slug }) => {
        return publishSite({ ...tenant, brand: activeBrand }, slug);
      }),
    }),
    publish_site: tool({
      description:
        'Publica todas as páginas em uma transação após validar jornada, imagens e pre-flight. Use somente quando o operador pedir publicação.',
      inputSchema: z.object({}),
      execute: safe(async () => publishSite({ ...tenant, brand: activeBrand })),
    }),
  };
  return editTools(tools, context.editPolicy);
}
