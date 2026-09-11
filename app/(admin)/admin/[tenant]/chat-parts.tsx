'use client';

import type { UIMessage } from 'ai';

const str = (value: unknown): string =>
  typeof value === 'string' ? value : '';
const num = (value: unknown): number => (typeof value === 'number' ? value : 0);

/**
 * Texto legível para cada ferramenta. Cobre o agente de sites e o de imagens,
 * porque os dois workspaces renderizam o progresso do mesmo jeito.
 */
export function describeTool(
  name: string,
  input: unknown,
  output: unknown,
  state: string,
): string {
  const inp = (input ?? {}) as Record<string, unknown>;
  const out = (output ?? {}) as Record<string, unknown>;
  const page = typeof inp.page === 'string' ? `/${inp.page}` : '';
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
      if (pending) return 'Revisando o resultado';
      const erradas = num(out.erros);
      const apontamentos = Array.isArray(out.apontamentos)
        ? out.apontamentos.length
        : 0;
      if (erradas) return `Revisão: ${erradas} erros para corrigir`;
      return apontamentos
        ? `Revisão: ${apontamentos} pontos de atenção`
        : 'Revisão sem apontamentos';
    }
    case 'prepare_site_images': {
      if (pending) return 'Gerando a cena';
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

type ToolPart = {
  type: string;
  state?: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
};

/** Junta chamadas repetidas de consulta numa linha só, para a lista não virar ruído. */
const REPEATABLE = new Set([
  'describe_block',
  'list_state',
  'get_page',
  'list_images',
]);

function collapse(parts: ToolPart[]) {
  const out: {
    label: string;
    done: boolean;
    failed: boolean;
    count: number;
  }[] = [];
  for (const raw of parts) {
    const name = raw.type.replace('tool-', '');
    const done = raw.state === 'output-available';
    const output = (raw.output ?? {}) as Record<string, unknown>;
    const failed =
      raw.state === 'output-error' ||
      output.ok === false ||
      Boolean(output.error);
    const label =
      raw.state === 'output-error'
        ? `Falhou: ${raw.errorText ?? name}`
        : describeTool(name, raw.input, raw.output, raw.state ?? '');
    const last = out[out.length - 1];
    if (
      last &&
      REPEATABLE.has(name) &&
      last.label.startsWith(label.replace(/ \(\d+\)$/, ''))
    ) {
      last.count += 1;
      last.done = last.done && done;
      last.label = `${label} (${last.count})`;
      continue;
    }
    out.push({ label, done, failed, count: 1 });
  }
  return out;
}

export function Message({ message }: { message: UIMessage }) {
  if (message.role === 'user') {
    const text = message.parts
      .filter((part) => part.type === 'text')
      .map((part) => (part as { text: string }).text)
      .join('');
    const images = message.parts.filter((part) => part.type === 'file') as {
      url: string;
      filename?: string;
    }[];
    return (
      <Bubble from="user">
        {images.length ? (
          <span className="mb-2 flex flex-wrap gap-2">
            {images.map((image) => (
              // oxlint-disable-next-line next/no-img-element
              <img
                key={image.url}
                src={image.url}
                alt={image.filename ?? 'imagem anexada'}
                className="h-16 w-16 rounded-md object-cover"
              />
            ))}
          </span>
        ) : null}
        {text}
      </Bubble>
    );
  }

  // Renderiza na ordem em que o agente trabalhou: pensa, age, pensa, age, resume.
  const groups: (
    | { kind: 'text'; text: string }
    | { kind: 'tools'; parts: ToolPart[] }
  )[] = [];
  for (const part of message.parts) {
    if (part.type === 'text') {
      const text = (part as { text: string }).text;
      if (!text.trim()) continue;
      const last = groups[groups.length - 1];
      if (last?.kind === 'text') last.text += text;
      else groups.push({ kind: 'text', text });
    } else if (part.type.startsWith('tool-')) {
      const last = groups[groups.length - 1];
      if (last?.kind === 'tools') last.parts.push(part as ToolPart);
      else groups.push({ kind: 'tools', parts: [part as ToolPart] });
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {groups.map((group, index) =>
        group.kind === 'text' ? (
          <Bubble key={index} from="assistant">
            {group.text.trim()}
          </Bubble>
        ) : (
          <ol
            key={index}
            className="flex flex-col gap-1 rounded-md border bg-[var(--color-surface)] px-3 py-2"
          >
            {collapse(group.parts).map((item, itemIndex) => (
              <li
                key={itemIndex}
                className="flex items-start gap-2 text-[0.75rem]"
              >
                <span
                  className={`mt-1.5 size-1.5 shrink-0 rounded-full ${
                    item.failed
                      ? 'bg-[var(--color-err)]'
                      : item.done
                        ? 'bg-[var(--color-ok)]'
                        : 'animate-pulse bg-[var(--color-warn)]'
                  }`}
                />
                <span
                  className={
                    item.done || item.failed ? 'text-[var(--color-muted)]' : ''
                  }
                >
                  {item.label}
                </span>
              </li>
            ))}
          </ol>
        ),
      )}
    </div>
  );
}

export function Bubble({
  from,
  children,
}: {
  from: string;
  children: React.ReactNode;
}) {
  const isUser = from === 'user';
  return (
    <div
      className={`flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}
    >
      <div
        className={`max-w-[94%] whitespace-pre-wrap rounded-lg px-3.5 py-2.5 text-sm leading-relaxed ${
          isUser
            ? 'bg-[var(--color-surface-2)]'
            : 'border bg-[var(--color-surface)]'
        }`}
      >
        {children}
      </div>
    </div>
  );
}

/** Erro do gateway em linguagem de gente. */
export function chatErrorMessage(message: string): string {
  return /rate.?limit|429|free tier|not have access/i.test(message)
    ? 'O AI Gateway recusou a chamada. Verifique créditos e o modelo em EIXU_MODEL.'
    : message;
}
