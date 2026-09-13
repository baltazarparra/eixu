import type { Reference } from '@/lib/ai/reference';
import { referenceUrls, normalizeReferenceUrl } from '@/lib/design/references';
import { intakeCurrentSiteUrl, intakeSocialUrl } from '@/lib/tenant-intake';
import {
  currentSiteMatches,
  currentSiteRecord,
  currentSitePrompt,
} from '@/lib/current-site/schema';

/** Só o recibo do endereço ainda configurado pode alimentar a geração. */
export function configuredCurrentSite(brief: Record<string, unknown>) {
  const url = intakeCurrentSiteUrl(brief.intake);
  return url && currentSiteMatches(brief.currentSite, url)
    ? currentSiteRecord(brief.currentSite)
    : null;
}

/** Leituras de estado e crítica seguem a mesma fronteira factual do prompt. */
export function briefForAgent(brief: Record<string, unknown>) {
  const { sources: _sources, currentSite: _currentSite, ...rest } = brief;
  const current = configuredCurrentSite(brief);
  return {
    ...rest,
    sources: sourceContextText(brief),
    ...(current ? { currentSite: currentSitePrompt(current) } : {}),
  };
}

/** O texto de outro negócio não entra no contexto como prova do cliente. */
export function sourceContextText(brief: Record<string, unknown>): string {
  const visualUrls = new Set(referenceUrls(brief));
  const socialUrl = intakeSocialUrl(brief.intake);
  const currentUrl = intakeCurrentSiteUrl(brief.intake);
  const sources = (
    Array.isArray(brief.sources) ? brief.sources : []
  ) as Reference[];
  return sources
    .flatMap((source) => {
      if (!source?.url) return [];
      const url = normalizeReferenceUrl(source.url);
      if (visualUrls.has(url))
        return [
          `- Referência visual ${url}: ${JSON.stringify(source.visual ?? { status: 'não lida' })}. Uso exclusivo de aparência; não fornece fatos nem contatos do cliente.`,
        ];
      // Leituras visuais removidas e versões textuais do Site atual não são
      // fontes adicionais. O site próprio tem seu recibo e verificação de identidade.
      if (
        source.visual ||
        (currentUrl && url === normalizeReferenceUrl(currentUrl))
      )
        return [];
      return [
        `- ${socialUrl && url === normalizeReferenceUrl(socialUrl) ? 'Perfil do cadastro' : 'Fonte adicional, identidade a conferir'} ${url} [${source.status}${source.motivo ? `: ${source.motivo}` : ''}] ${source.titulo ?? ''} ${source.descricao ?? ''} ${source.texto ?? ''}`.trim(),
      ];
    })
    .join('\n');
}

/** O roteiro é explícito nos quatro cenários, inclusive sem nenhum link. */
export function sourcePlan(brief: Record<string, unknown>): string {
  const current = intakeCurrentSiteUrl(brief.intake);
  const references = referenceUrls(brief);
  const social = intakeSocialUrl(brief.intake);
  return [
    '## Fontes deste cliente',
    current
      ? `Site atual: ${current}. Use read_current_site para fatos, páginas e ativos do próprio cliente; não use read_reference para substituí-lo.`
      : 'Site atual não informado. Continue com a história do operador; não procure nem deduza um domínio.',
    references.length
      ? `Referência visual: ${references.join(', ')}. Use read_reference para observar a aparência em desktop/mobile; o conteúdo comercial da fonte não pertence ao cliente.`
      : 'Referência visual não informada. Use a vibe escolhida, sem pedir um link para conseguir gerar.',
    social
      ? `Perfil social do cadastro: ${social}. Leitura factual com read_reference, sem autoridade visual.`
      : '',
    'Os dois links são opcionais e independentes. A mesma URL pode ocupar os dois campos: nesse caso faça as duas leituras, cada uma com seu papel. Ausência de link não é lacuna nem impede a criação. Falha de uma fonte não invalida a outra. Registre limites e conflitos reais e prossiga com a história, os contatos e a marca do operador.',
  ]
    .filter(Boolean)
    .join('\n');
}
