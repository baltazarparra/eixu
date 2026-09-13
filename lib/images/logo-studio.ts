import { randomUUID } from 'node:crypto';
import { LOGO_STUDIO_TIMEOUT_MS } from '@/lib/ai/models';
import { logoSourceHash, prepareLogoAsset } from '@/lib/images/logo-asset';
import { logoStudioState } from '@/lib/images/logo-studio-state';
import { deriveLogoAssets } from '@/lib/images/logo-apply';
import { fetchReferenceRaw, generateLogoCandidates } from '@/lib/images/logo';
import { critiqueLogo } from '@/lib/images/logo-critic';
import { canApplyLogo } from '@/lib/images/logo-access';
import { listImages, insertImage } from '@/lib/images/queries';
import {
  replaceBrandLogoIfSource,
  setBrandLogoDerived,
} from '@/lib/tenant-queries';
import {
  claimLogoStudio,
  ensureLogoRevision,
  finishLogoStudio,
  persistLogoReceipt,
} from '@/lib/images/logo-studio-queries';
import type { Critique, LogoStudioState, Tenant } from '@/lib/types';

export function manualLogoSource(slug: string, url: string): boolean {
  return canApplyLogo(slug, url);
}

export function shouldRunLogoStudio(tenant: Tenant, hash: string): boolean {
  if (!tenant.brand.logoUrl) return false;
  const state = logoStudioState(tenant.brief);
  if (
    state?.status === 'done' &&
    state.proposals.some(
      (p) => p.seq === state.applied?.seq && p.url === tenant.brand.logoUrl,
    )
  )
    return false;
  if (state?.sourceHash !== hash) return true;
  if (state.status === 'done') return false;
  return (
    state.status !== 'running' ||
    Date.now() - Date.parse(state.startedAt) >= 15 * 60_000
  );
}

export function logoAutoApplyGate(input: {
  tenant: Tenant;
  proposal?: LogoStudioState['proposals'][number];
  trigger: 'briefing' | 'chat';
  enabled?: boolean;
}): string | undefined {
  if (input.enabled === false) return 'Aplicação automática desativada.';
  if (input.trigger !== 'briefing')
    return 'No chat, escolha a proposta para aplicar.';
  if (!manualLogoSource(input.tenant.slug, input.tenant.brand.logoUrl ?? ''))
    return 'O logo atual já foi escolhido na biblioteca.';
  const p = input.proposal;
  if (!p || p.variant !== 'fiel')
    return 'A proposta fiel não ficou disponível.';
  if (!p.aprovado || p.nomeCorreto !== true)
    return 'A proposta fiel não passou na conferência de qualidade e grafia.';
  if (p.score === null || p.score < 8)
    return 'A nota da proposta fiel ficou abaixo de 8.';
  if (p.fidelidade === null || p.fidelidade < 7)
    return 'A fidelidade ao original ficou abaixo de 7.';
  return undefined;
}

const defaults = {
  fetch: fetchReferenceRaw,
  prepare: prepareLogoAsset,
  generate: generateLogoCandidates,
  critique: critiqueLogo,
  list: listImages,
  insert: insertImage,
  replace: replaceBrandLogoIfSource,
  derive: deriveLogoAssets,
  setDerived: setBrandLogoDerived,
  claim: claimLogoStudio,
  revision: ensureLogoRevision,
  finish: finishLogoStudio,
  receipt: persistLogoReceipt,
};
export type LogoStudioDeps = Partial<typeof defaults>;
type StudioEvent = {
  kind: 'start' | 'end' | 'note';
  label: string;
  payload?: Record<string, unknown>;
};

export function logoStudioReceipt(state: LogoStudioState): string {
  const proposals = state.proposals
    .map(
      (p) =>
        `#${p.seq} (${p.variant}${p.score === null ? '' : `, nota ${p.score.toLocaleString('pt-BR')}`})`,
    )
    .join(' e ');
  const original = state.original
    ? ` O original ficou como #${state.original.seq}.`
    : '';
  if (state.applied)
    return `Logo modernizado: apliquei a #${state.applied.seq} no rascunho. Propostas ${proposals} na biblioteca.${original} Diga '${state.original ? `volta para a #${state.original.seq}` : `usa a #${state.proposals[0]?.seq}`}' para trocar. O site no ar só muda ao publicar.`;
  if (state.proposals.length)
    return `Propostas ${proposals} disponíveis.${original} Para aplicar, peça 'usa a #${state.recommended ?? state.proposals[0].seq}'. ${state.gate ?? ''}`.trim();
  return `A modernização do logo não completou. ${state.error ?? 'O logo enviado foi preservado.'}`;
}

/** Job de intake independente do agente. Falhas nunca decidem o resultado da geração. */
export async function runLogoStudio(
  input: {
    tenant: Tenant;
    trigger: 'briefing' | 'chat';
    signal?: AbortSignal;
    onEvent?: (event: StudioEvent) => Promise<void>;
    persistReceipt?: (text: string) => Promise<void>;
  },
  overrides: LogoStudioDeps = {},
): Promise<LogoStudioState> {
  const deps = { ...defaults, ...overrides };
  const state: LogoStudioState = {
    status: 'skipped',
    sourceHash: '',
    startedAt: new Date().toISOString(),
    proposals: [],
  };
  let claimed = false;
  const note = (event: StudioEvent) =>
    input.onEvent?.(event).catch(() => undefined);
  const source = input.tenant.brand.logoUrl;
  if (!source) return state;
  const timeout = AbortSignal.timeout(LOGO_STUDIO_TIMEOUT_MS);
  const signal = input.signal
    ? AbortSignal.any([input.signal, timeout])
    : timeout;
  try {
    const raw = await deps.fetch(source, signal);
    state.sourceHash = logoSourceHash(raw.bytes);
    if (!shouldRunLogoStudio(input.tenant, state.sourceHash))
      return logoStudioState(input.tenant.brief) ?? state;
    state.status = 'running';
    claimed = await deps.claim(input.tenant.id, source, state);
    if (!claimed) return { ...state, status: 'skipped' };
    await note({
      kind: 'start',
      label: 'Modernizando o logo em paralelo ao briefing',
    });
    signal.throwIfAborted();
    const brand = await deps.revision(input.tenant.id, source);
    if (!brand) throw new Error('O logo foi trocado antes da preparação.');
    const tenant = { ...input.tenant, brand };
    const { asset, master } = await deps.prepare({
      tenant,
      source,
      bytes: raw.bytes,
      read: true,
    });
    if (
      !(await deps.setDerived(
        tenant.id,
        source,
        { asset },
        brand.logoRevision!,
      ))
    )
      throw new Error('O logo foi trocado durante a preparação.');
    const library = await deps.list(tenant.id);
    const registered = library.find(
      (image) =>
        image.kind === 'logo' &&
        image.status !== 'rejeitada' &&
        (image.url === source || image.url === asset.master.url),
    );
    if (registered) state.original = { seq: registered.seq };
    else if (manualLogoSource(tenant.slug, source)) {
      const row = await deps.insert({
        tenantId: tenant.id,
        batchId: randomUUID(),
        kind: 'logo',
        model: 'upload',
        requestText: 'Logo enviado pelo operador',
        targetBlock: 'logo',
        ratio: asset.aspect >= 2 ? '4:3' : '1:1',
        promptFinal:
          'Master limpo do upload original, preservado para reversão.',
        url: asset.master.url,
        blobPath: new URL(asset.master.url).pathname.slice(1),
        referenceUrls: [source],
        width: asset.master.width,
        height: asset.master.height,
      });
      state.original = { seq: row.seq };
    }
    signal.throwIfAborted();
    const brandName = asset.reading?.nome?.trim() || tenant.name;
    const wordmark = asset.reading?.tipo !== 'simbolo';
    const generated = await deps.generate({
      tenant: { ...tenant, brand: { ...brand, logoAsset: asset } },
      guide: tenant.imageGuide ?? {},
      mode: 'modernizar',
      variants: 2,
      brandName,
      wordmark,
      reference: master,
      referenceUrl: source,
      signal,
    });
    if (!generated.images.length)
      throw new Error(
        generated.failures.join(' | ') || 'Nenhuma proposta foi gerada.',
      );
    state.proposals = await Promise.all(
      generated.images
        .filter(
          (image) => image.variant === 'fiel' || image.variant === 'ousada',
        )
        .map(async (image) => {
          const critique: Critique = await deps
            .critique({
              id: image.id,
              bytes: image.bytes,
              variant: image.variant,
              mode: 'modernizar',
              brandName,
              wordmark,
              reference: master,
              signal,
            })
            .catch(() => ({}));
          return {
            seq: image.seq,
            imageId: image.id,
            variant: image.variant as 'fiel' | 'ousada',
            url: image.url,
            score: critique.nota ?? null,
            aprovado: critique.aprovado === true,
            nomeCorreto: wordmark
              ? (critique.nome_correto ?? null)
              : critique.aprovado === true,
            fidelidade: critique.fidelidade_original ?? null,
            aspect: (image.width ?? 1) / (image.height ?? 1),
          };
        }),
    );
    const faithful = state.proposals.find((p) => p.variant === 'fiel');
    state.recommended =
      state.proposals.find((p) => p.variant === 'fiel' && p.aprovado)?.seq ??
      state.proposals.find((p) => p.aprovado)?.seq;
    state.gate = logoAutoApplyGate({
      tenant,
      proposal: faithful,
      trigger: input.trigger,
      enabled: process.env.EIXU_LOGO_AUTO_APPLY !== '0',
    });
    signal.throwIfAborted();
    if (!state.gate && faithful) {
      // A troca e a nova revisão ocorrem no mesmo UPDATE. Não reaplicar sem condição depois do CAS.
      const applied = await deps.replace(
        tenant.id,
        source,
        faithful.url,
        brand.logoRevision,
      );
      if (applied) {
        state.applied = { seq: faithful.seq, at: new Date().toISOString() };
        await deps
          .derive({ ...tenant, brand: applied }, faithful.url, {
            read: false,
            wait: true,
            signal,
          })
          .catch(() => undefined);
      } else
        state.gate =
          'O logo foi alterado pelo operador durante a modernização.';
    }
    state.status = 'done';
    if (generated.failures.length)
      state.error = generated.failures.join(' | ').slice(0, 240);
  } catch (error) {
    state.status = state.proposals.length ? 'done' : 'failed';
    state.error = signal.aborted
      ? 'Modernização interrompida ou tempo limite atingido.'
      : error instanceof Error
        ? error.message.slice(0, 240)
        : 'Falha na modernização do logo.';
  }
  state.finishedAt = new Date().toISOString();
  if (claimed) {
    try {
      if (await deps.finish(input.tenant.id, state))
        await (input.persistReceipt
          ? input.persistReceipt(logoStudioReceipt(state))
          : deps.receipt(input.tenant.id, logoStudioReceipt(state)));
    } catch (error) {
      console.warn(
        '[logo-studio] falha ao registrar recibo',
        error instanceof Error ? error.message : 'erro',
      );
    }
    await note({
      kind: 'end',
      label: state.applied
        ? `Logo #${state.applied.seq} aplicado no rascunho`
        : state.status === 'done'
          ? 'Propostas de logo disponíveis'
          : 'A modernização do logo não completou',
      payload: {
        status: state.status,
        applied: state.applied ?? null,
        proposals: state.proposals.map((p) => p.seq),
      },
    });
  }
  return state;
}
