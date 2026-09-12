/**
 * Texto legível de cada ferramenta, em pt-BR. Vive fora do componente porque
 * o runner do servidor grava o mesmo rótulo nos eventos da geração: o painel
 * mostra a atividade atual mesmo depois de recarregar, sem o stream do chat.
 */
const str = (value: unknown): string =>
  typeof value === 'string' ? value : '';
const num = (value: unknown): number => (typeof value === 'number' ? value : 0);

/** Cobre o agente de sites e o de imagens: o progresso é lido do mesmo jeito. */
export function describeTool(
  name: string,
  input: unknown,
  output: unknown,
  state: string,
): string {
  const inp = (input ?? {}) as Record<string, unknown>;
  const out = (output ?? {}) as Record<string, unknown>;
  // O agente às vezes já manda o caminho com barra; "//contato" no rótulo
  // parecia defeito de dado.
  const page =
    typeof inp.page === 'string' ? `/${inp.page.replace(/^\/+/, '')}` : '';
  const slug = str(inp.slug);
  const erros = num(out.erros);
  const pending = state !== 'output-available';

  switch (name) {
    // Agente de sites
    case 'build_site':
    case 'repair_site': {
      if (pending)
        return name === 'repair_site'
          ? 'Ajustando as páginas'
          : 'Montando o projeto';
      if (out.ok !== true)
        return 'O projeto precisa de ajustes antes de salvar';
      const pages = Array.isArray(out.pages) ? out.pages.length : 0;
      const approvals =
        Array.isArray(out.publicationPending) &&
        out.publicationPending.length > 0;
      return `Projeto salvo: ${pages} páginas${approvals ? '. Há pendências para publicar' : ''}`;
    }
    case 'set_design':
      return pending
        ? 'Definindo a identidade visual'
        : out.ok === true
          ? 'Identidade visual definida'
          : 'A identidade visual precisa de ajustes';
    case 'lint_site':
      return pending
        ? 'Verificando o projeto'
        : Array.isArray(out.findings) && out.findings.length
          ? 'O projeto tem ajustes pendentes'
          : 'Verificação do projeto concluída';
    case 'publish_site':
      return pending
        ? 'Publicando o projeto'
        : Array.isArray(out.published) && out.published.length
          ? 'Projeto publicado'
          : 'Publicação bloqueada';
    case 'read_reference':
      return pending
        ? 'Lendo a referência'
        : out.status === 'ok'
          ? `Referência lida: ${str(out.titulo) || str(inp.url)}`
          : `Referência inacessível: ${str(out.motivo) || 'sem acesso'}`;
    case 'define_image_guide':
      return pending ? 'Definindo o guia de imagem' : 'Guia de imagem definido';
    case 'review_pages': {
      if (pending) return 'Conferindo estrutura e pixels';
      if (out.preflightOnly === true)
        return `${num(out.erros)} erro(s) estrutural(is) para corrigir antes dos pixels`;
      if (
        out.error ||
        out.visual === 'unavailable' ||
        out.visual === 'disabled'
      )
        return 'A análise solicitada não completou';
      const erradas = num(out.erros);
      const apontamentos = Array.isArray(out.apontamentos)
        ? out.apontamentos.length
        : 0;
      if (erradas) return `Revisão: ${erradas} erros para corrigir`;
      const reviewed = Array.isArray(out.reviewedPages)
        ? out.reviewedPages.length
        : 0;
      const reused = Array.isArray(out.reusedPages)
        ? out.reusedPages.length
        : 0;
      if (!reviewed && reused)
        return `Revisão atual reutilizada em ${reused} página(s)`;
      return apontamentos
        ? `Revisão: ${apontamentos} pontos de atenção · ${reviewed} página(s) conferida(s)`
        : `Revisão sem apontamentos · ${reviewed} página(s) conferida(s)`;
    }
    case 'prepare_site_images': {
      const requested = Array.isArray(inp.scenes) ? inp.scenes.length : 1;
      if (pending)
        return requested === 1
          ? 'Gerando uma cena'
          : `Gerando ${requested} cenas em lotes`;
      const list = (out.imagens ?? []) as { numero: string }[];
      if (out.error || !Array.isArray(out.imagens) || !list.length)
        return 'As imagens precisam de atenção';
      return list.length === 1
        ? `Cena ${list[0].numero} disponível na biblioteca`
        : `${list.length} cenas disponíveis na biblioteca`;
    }
    case 'update_image':
      return pending
        ? `Atualizando a imagem ${str(inp.image)}`
        : out.ok === true
          ? `Imagem ${str(out.anterior)} atualizada: nova versão ${str(out.numero)}`
          : out.numero
            ? `Nova versão ${str(out.numero)} salva; aplicação precisa de atenção`
            : 'A imagem não pôde ser atualizada';
    case 'set_blocks':
      return pending
        ? `Refazendo ${page}`
        : `Refez ${page}${erros ? `, ${erros} apontamentos` : ', pre-flight aprovado'}`;
    case 'update_block':
      return pending
        ? `Ajustando um bloco em ${page}`
        : `Ajustou um bloco em ${page}`;
    case 'insert_block': {
      const type =
        (inp.block as { type?: string } | undefined)?.type ?? 'bloco';
      return pending
        ? `Inserindo ${type} em ${page}`
        : `Inseriu ${type} em ${page}`;
    }
    case 'remove_block':
      return pending
        ? `Removendo um bloco de ${page}`
        : `Removeu um bloco de ${page}`;
    case 'move_block':
      return pending ? `Reordenando ${page}` : `Reordenou ${page}`;
    case 'create_page':
      return pending ? `Criando /${slug}` : `Criou /${slug}`;
    case 'delete_page':
      return pending ? `Apagando ${page}` : `Apagou ${page}`;
    case 'set_brand':
      return pending ? 'Definindo marca e dials' : 'Definiu marca e dials';
    case 'set_seo':
      return pending ? `Ajustando SEO de ${page}` : `Ajustou SEO de ${page}`;
    case 'lint_page':
      return pending
        ? `Rodando pre-flight em ${page}`
        : out.aprovado
          ? `Pre-flight aprovado em ${page}`
          : `Pre-flight com apontamentos em ${page}`;
    case 'publish_page':
      return pending
        ? `Publicando ${page}`
        : out.publicado
          ? `Publicou ${page}`
          : `Publicação bloqueada em ${page}`;
    case 'list_state':
      return pending ? 'Lendo o site' : 'Leu o site';
    case 'get_page':
      return pending ? `Lendo ${page}` : `Leu ${page}`;
    case 'describe_block':
      return pending ? 'Consultando o catálogo' : 'Consultou o catálogo';

    case 'generate_logo': {
      const mode =
        str(inp.mode) === 'modernizar'
          ? 'modernizando o logo'
          : 'criando o logo';
      if (pending) return `Gerando variantes e ${mode}`;
      const list = (out.variantes ?? []) as { numero: string }[];
      if (!list.length) return 'Nenhuma variante gerada';
      return `${list.length} variantes de logo disponíveis na biblioteca`;
    }
    case 'set_site_logo':
      return pending
        ? 'Definindo o logo do site'
        : `Definiu ${str(out.numero) || 'a imagem'} como logo do site`;
    case 'list_images':
      return pending
        ? 'Lendo a biblioteca de imagens'
        : 'Leu a biblioteca de imagens';

    default:
      return name;
  }
}
