/**
 * Regras da exclusão de cliente, puras para o diálogo e a ação usarem a mesma
 * decisão. A confirmação por slug existe onde o dado perdido é do negócio, não
 * só do rascunho.
 */
export type DeletableTenant = {
  slug: string;
  name: string;
  status: string;
  pageCount: number;
  leadCount: number;
  imageCount?: number;
};

export function requiresSlugConfirmation(
  tenant: Pick<DeletableTenant, 'status' | 'leadCount'>,
): boolean {
  return tenant.status === 'published' || tenant.leadCount > 0;
}

export function confirmationAccepted(
  tenant: Pick<DeletableTenant, 'status' | 'leadCount' | 'slug'>,
  typed: string,
): boolean {
  if (!requiresSlugConfirmation(tenant)) return true;
  return typed.trim().toLowerCase() === tenant.slug;
}

const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

/** O que some com a exclusão, para o operador ler antes de confirmar. */
export function deletionImpact(tenant: DeletableTenant): string[] {
  const impact: string[] = [];
  if (tenant.status === 'published')
    impact.push(
      `O site ${tenant.slug}.eixu.com.br sai do ar imediatamente e passa a responder 404.`,
    );
  impact.push(
    `${plural(tenant.pageCount, 'página', 'páginas')} do rascunho e do snapshot publicado.`,
  );
  impact.push(
    `${plural(tenant.leadCount, 'contato recebido', 'contatos recebidos')} por formulário, além dos eventos de tráfego e gastos lançados.`,
  );
  impact.push(
    tenant.imageCount === undefined
      ? 'Biblioteca de imagens, logo e arquivos enviados.'
      : `${plural(tenant.imageCount, 'imagem', 'imagens')} da biblioteca, o logo e os arquivos enviados.`,
  );
  impact.push('Histórico das conversas do site e do estúdio de imagens.');
  return impact;
}
