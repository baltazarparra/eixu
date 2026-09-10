'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';

export type PageState = {
  slug: string;
  type: string;
  title: string;
  blocks: number;
  published: boolean;
  publishedAt: string | null;
  dirty: boolean;
  errors: string[];
  warnings: string[];
};

type SiteState = {
  tenant: { slug: string; name: string };
  pages: PageState[];
};

type Props = {
  initial: SiteState;
  history: { role: string; content: string }[];
};

const SUGGESTIONS = [
  'Deixa o hero mais direto, com o benefício na primeira linha.',
  'Adiciona uma seção de perguntas frequentes sobre preço e prazo.',
  'Cria uma página de serviços com os três principais.',
  'Troca a cor de acento para algo mais sóbrio.',
];

const str = (value: unknown): string => (typeof value === 'string' ? value : '');
const num = (value: unknown): number => (typeof value === 'number' ? value : 0);

/** Texto legível para cada ferramenta que o agente chama. */
function describeTool(name: string, input: unknown, output: unknown, state: string): string {
  const inp = (input ?? {}) as Record<string, unknown>;
  const out = (output ?? {}) as Record<string, unknown>;
  const page = typeof inp.page === 'string' ? `/${inp.page}` : '';
  const slug = str(inp.slug);
  const erros = num(out.erros);
  const pending = state !== 'output-available';
  switch (name) {
    case 'build_site': {
      const pages = Array.isArray(inp.pages) ? inp.pages.length : 0;
      if (pending) return `Montando o site${pages ? `, ${pages} páginas` : ''}`;
      const report = (out.pages ?? []) as { page: string; blocks: number; erros: number }[];
      const errors = report.reduce((sum, item) => sum + item.erros, 0);
      return `Site montado: ${report.map((item) => `${item.page} (${item.blocks} blocos)`).join(', ')}${
        errors ? `. ${errors} apontamentos para corrigir` : '. Pre-flight aprovado'
      }`;
    }
    case 'set_blocks':
      return pending ? `Refazendo ${page}` : `Refez ${page}${erros ? `, ${erros} apontamentos` : ', pre-flight aprovado'}`;
    case 'update_block':
      return pending ? `Ajustando um bloco em ${page}` : `Ajustou um bloco em ${page}`;
    case 'insert_block': {
      const type = (inp.block as { type?: string } | undefined)?.type ?? 'bloco';
      return pending ? `Inserindo ${type} em ${page}` : `Inseriu ${type} em ${page}`;
    }
    case 'remove_block':
      return pending ? `Removendo um bloco de ${page}` : `Removeu um bloco de ${page}`;
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
      return pending ? `Rodando pre-flight em ${page}` : out.aprovado ? `Pre-flight aprovado em ${page}` : `Pre-flight com apontamentos em ${page}`;
    case 'publish_page':
      return pending ? `Publicando ${page}` : out.publicado ? `Publicou ${page}` : `Publicação bloqueada em ${page}`;
    case 'list_state':
      return pending ? 'Lendo o site' : 'Leu o site';
    case 'describe_block':
      return pending ? 'Consultando o catálogo' : 'Consultou o catálogo';
    default:
      return name;
  }
}

export function Workspace({ initial, history }: Props) {
  const tenantSlug = initial.tenant.slug;
  const [site, setSite] = useState<SiteState>(initial);
  const [current, setCurrent] = useState(initial.pages[0]?.slug ?? '');
  const [input, setInput] = useState('');
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [nonce, setNonce] = useState(0);
  const [publishing, setPublishing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const toolCountRef = useRef(0);

  const { messages, sendMessage, status, error, stop } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
      body: () => ({ tenant: tenantSlug, page: current }),
    }),
  });

  const refresh = useCallback(async () => {
    const response = await fetch(`/api/admin/${tenantSlug}/state`, { cache: 'no-store' });
    if (!response.ok) return;
    const next = (await response.json()) as SiteState;
    setSite(next);
    setCurrent((slug) => (next.pages.some((page) => page.slug === slug) ? slug : (next.pages[0]?.slug ?? '')));
    setNonce((value) => value + 1);
  }, [tenantSlug]);

  // Cada ferramenta concluída pelo agente muda o site no banco: atualiza o preview na hora.
  const completedTools = useMemo(
    () =>
      messages.reduce(
        (count, message) =>
          count +
          message.parts.filter((part) => part.type.startsWith('tool-') && (part as { state?: string }).state === 'output-available')
            .length,
        0,
      ),
    [messages],
  );
  useEffect(() => {
    if (completedTools !== toolCountRef.current) {
      toolCountRef.current = completedTools;
      void refresh();
    }
  }, [completedTools, refresh]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, status]);

  const busy = status === 'submitted' || status === 'streaming';
  const page = site.pages.find((item) => item.slug === current);
  const previewUrl = `/s/${tenantSlug}/${current}?preview=1&__tenant=${tenantSlug}&v=${nonce}`;
  const totalErrors = site.pages.reduce((sum, item) => sum + item.errors.length, 0);
  const publishable = site.pages.length > 0 && totalErrors === 0 && !busy;

  async function publishAll() {
    setPublishing(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/admin/${tenantSlug}/publish`, { method: 'POST', body: '{}' });
      const result = (await response.json()) as { published: string[]; blocked: { page: string }[]; url: string };
      setNotice(
        result.blocked.length
          ? `Bloqueado em ${result.blocked.map((item) => item.page).join(', ')}. Peça ao agente para corrigir.`
          : `Publicado. ${result.url}`,
      );
      await refresh();
    } finally {
      setPublishing(false);
    }
  }

  function submit(text: string) {
    if (!text.trim() || busy) return;
    void sendMessage({ text });
    setInput('');
  }

  return (
    <div className="grid h-screen grid-rows-[auto_1fr] overflow-hidden">
      <header className="flex items-center gap-4 border-b px-4 py-2.5">
        <Link href="/admin" className="text-xs text-[var(--color-muted)] hover:text-[var(--color-text)]">
          Clientes
        </Link>
        <span className="text-xs text-[var(--color-muted)]">/</span>
        <span className="text-sm font-medium">{site.tenant.name}</span>
        <span className="font-mono text-xs text-[var(--color-muted)]">{tenantSlug}.eixu.com.br</span>
        <nav className="ml-auto flex items-center gap-4 text-xs">
          <Link href={`/admin/${tenantSlug}/leads`} className="text-[var(--color-muted)] hover:text-[var(--color-text)]">
            Leads
          </Link>
          <Link href={`/admin/${tenantSlug}/trafego`} className="text-[var(--color-muted)] hover:text-[var(--color-text)]">
            Tráfego
          </Link>
          <a
            href={`https://${tenantSlug}.eixu.com.br`}
            target="_blank"
            rel="noreferrer"
            className="text-[var(--color-muted)] hover:text-[var(--color-text)]"
          >
            Ver site
          </a>
          <button
            type="button"
            onClick={publishAll}
            disabled={!publishable || publishing}
            title={totalErrors ? `${totalErrors} erros de pre-flight bloqueiam a publicação` : 'Publicar todas as páginas'}
            className="rounded-md bg-[var(--color-accent)] px-3.5 py-1.5 text-xs font-medium text-[var(--color-accent-ink)] disabled:opacity-40"
          >
            {publishing ? 'Publicando' : 'Publicar'}
          </button>
        </nav>
      </header>

      <div className="grid min-h-0 grid-cols-1 lg:grid-cols-[400px_1fr]">
        <section className="flex min-h-0 flex-col border-r">
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-5">
            {history.length === 0 && messages.length === 0 ? (
              <div className="flex flex-col gap-3 text-sm">
                <p className="text-base font-medium">O que este cliente precisa?</p>
                <p className="text-[var(--color-muted)]">
                  Diga o segmento, a cidade, para quem vende e o que o visitante deve fazer. O agente monta o site,
                  mostra ao lado e você vai pedindo ajustes.
                </p>
                <button
                  type="button"
                  onClick={() =>
                    setInput(
                      'Clínica de fisioterapia e pilates em Bauru, adultos de 35 a 65 anos com dor na coluna e pós-operatório. Home, página sobre e uma de agradecimento. Conversão principal por WhatsApp, e um formulário com nome, telefone e a queixa. Tom sóbrio, sem clichê de bem-estar.',
                    )
                  }
                  className="self-start rounded-md border px-3 py-2 text-left text-xs text-[var(--color-muted)] hover:bg-[var(--color-surface)]"
                >
                  Usar um exemplo
                </button>
              </div>
            ) : null}

            <div className="flex flex-col gap-5">
              {history.map((message, index) => (
                <Bubble key={`h${index}`} from={message.role}>
                  {message.content}
                </Bubble>
              ))}
              {messages.map((message) => (
                <Message key={message.id} message={message} />
              ))}
              {status === 'submitted' ? <p className="text-xs text-[var(--color-muted)]">Pensando</p> : null}
              {error ? (
                <p className="rounded-md border border-[var(--color-err)] px-3 py-2 text-xs text-[var(--color-err)]">
                  {/rate.?limit|429|free tier|not have access/i.test(error.message)
                    ? 'O AI Gateway recusou a chamada. Verifique créditos e o modelo em EIXU_MODEL.'
                    : error.message}
                </p>
              ) : null}
            </div>

            {!busy && site.pages.length > 0 ? (
              <div className="mt-6 flex flex-wrap gap-2">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => submit(suggestion)}
                    className="rounded-full border px-3 py-1.5 text-left text-[0.72rem] text-[var(--color-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              submit(input);
            }}
            className="border-t p-3"
          >
            <div className="flex flex-col gap-2 rounded-lg border bg-[var(--color-surface)] p-2 focus-within:border-[var(--color-accent)]">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    submit(input);
                  }
                }}
                rows={3}
                placeholder={site.pages.length ? 'Peça uma mudança' : 'Descreva o site'}
                className="w-full resize-none bg-transparent px-1.5 py-1 text-sm outline-none"
              />
              <div className="flex items-center justify-between">
                <span className="px-1.5 text-[0.68rem] text-[var(--color-muted)]">
                  {page ? `Falando sobre /${page.slug}` : 'Enter envia, Shift+Enter quebra linha'}
                </span>
                {busy ? (
                  <button type="button" onClick={() => stop()} className="rounded-md border px-3 py-1.5 text-xs">
                    Parar
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!input.trim()}
                    className="rounded-md bg-[var(--color-accent)] px-3.5 py-1.5 text-xs font-medium text-[var(--color-accent-ink)] disabled:opacity-40"
                  >
                    Enviar
                  </button>
                )}
              </div>
            </div>
          </form>
        </section>

        <section className="flex min-h-0 flex-col bg-[var(--color-surface)]">
          <div className="flex flex-wrap items-center gap-1.5 border-b px-3 py-2">
            {site.pages.map((item) => (
              <button
                key={item.slug}
                type="button"
                onClick={() => setCurrent(item.slug)}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-mono text-xs ${
                  current === item.slug
                    ? 'bg-[var(--color-surface-2)] text-[var(--color-text)]'
                    : 'text-[var(--color-muted)] hover:bg-[var(--color-surface-2)]'
                }`}
                title={[...item.errors, ...item.warnings].join('\n') || item.title}
              >
                /{item.slug}
                {item.errors.length ? (
                  <span className="size-1.5 rounded-full bg-[var(--color-err)]" />
                ) : item.published && !item.dirty ? (
                  <span className="size-1.5 rounded-full bg-[var(--color-ok)]" />
                ) : item.published && item.dirty ? (
                  <span className="size-1.5 rounded-full bg-[var(--color-warn)]" />
                ) : null}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-1">
              {(['desktop', 'mobile'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setDevice(option)}
                  className={`rounded-md px-2.5 py-1.5 text-xs ${
                    device === option ? 'bg-[var(--color-surface-2)]' : 'text-[var(--color-muted)]'
                  }`}
                >
                  {option === 'desktop' ? 'Desktop' : 'Celular'}
                </button>
              ))}
              <a
                href={previewUrl}
                target="_blank"
                rel="noreferrer"
                className="ml-2 text-xs text-[var(--color-muted)] hover:text-[var(--color-text)]"
              >
                Abrir
              </a>
            </div>
          </div>

          {notice ? (
            <p className="border-b px-4 py-2 text-xs text-[var(--color-muted)]">{notice}</p>
          ) : page && (page.errors.length || page.warnings.length) ? (
            <ul className="flex flex-wrap gap-x-4 gap-y-1 border-b px-4 py-2 font-mono text-[0.68rem]">
              {page.errors.map((message) => (
                <li key={message} className="text-[var(--color-err)]">
                  {message}
                </li>
              ))}
              {page.warnings.map((message) => (
                <li key={message} className="text-[var(--color-warn)]">
                  {message}
                </li>
              ))}
            </ul>
          ) : null}

          <div className="flex min-h-0 flex-1 items-start justify-center overflow-auto p-4">
            {site.pages.length > 0 ? (
              <iframe
                key={`${current}-${nonce}`}
                src={previewUrl}
                title="Preview do site"
                className={`h-full rounded-lg border bg-white shadow-[0_20px_60px_-30px_rgba(0,0,0,0.6)] transition-[width] ${
                  device === 'mobile' ? 'w-[390px]' : 'w-full'
                }`}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-center text-sm text-[var(--color-muted)]">
                {busy ? 'O agente está montando o site' : 'O preview aparece assim que o agente criar a primeira página.'}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function Message({ message }: { message: UIMessage }) {
  if (message.role === 'user') {
    const text = message.parts
      .filter((part) => part.type === 'text')
      .map((part) => (part as { text: string }).text)
      .join('');
    return <Bubble from="user">{text}</Bubble>;
  }

  // Renderiza na ordem em que o agente trabalhou: pensa, age, pensa, age, resume.
  type ToolPart = { type: string; state?: string; input?: unknown; output?: unknown; errorText?: string };
  const groups: ({ kind: 'text'; text: string } | { kind: 'tools'; parts: ToolPart[] })[] = [];
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
          <ol key={index} className="flex flex-col gap-1 rounded-md border bg-[var(--color-surface)] px-3 py-2">
            {collapse(group.parts).map((item, itemIndex) => (
              <li key={itemIndex} className="flex items-start gap-2 text-[0.75rem]">
                <span
                  className={`mt-1.5 size-1.5 shrink-0 rounded-full ${
                    item.failed
                      ? 'bg-[var(--color-err)]'
                      : item.done
                        ? 'bg-[var(--color-ok)]'
                        : 'animate-pulse bg-[var(--color-warn)]'
                  }`}
                />
                <span className={item.done || item.failed ? 'text-[var(--color-muted)]' : ''}>{item.label}</span>
              </li>
            ))}
          </ol>
        ),
      )}
    </div>
  );
}

/** Junta chamadas repetidas de consulta numa linha só, para a lista não virar ruído. */
function collapse(parts: { type: string; state?: string; input?: unknown; output?: unknown; errorText?: string }[]) {
  const out: { label: string; done: boolean; failed: boolean; count: number }[] = [];
  for (const raw of parts) {
    const name = raw.type.replace('tool-', '');
    const done = raw.state === 'output-available';
    const failed = raw.state === 'output-error';
    const label = failed ? `Falhou: ${raw.errorText ?? name}` : describeTool(name, raw.input, raw.output, raw.state ?? '');
    const last = out[out.length - 1];
    if (last && (name === 'describe_block' || name === 'list_state') && last.label.startsWith(label.replace(/ \(\d+\)$/, ''))) {
      last.count += 1;
      last.done = last.done && done;
      last.label = `${label} (${last.count})`;
      continue;
    }
    out.push({ label, done, failed, count: 1 });
  }
  return out;
}

function Bubble({ from, children }: { from: string; children: React.ReactNode }) {
  const isUser = from === 'user';
  return (
    <div className={`flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}>
      <div
        className={`max-w-[94%] whitespace-pre-wrap rounded-lg px-3.5 py-2.5 text-sm leading-relaxed ${
          isUser ? 'bg-[var(--color-surface-2)]' : 'border bg-[var(--color-surface)]'
        }`}
      >
        {children}
      </div>
    </div>
  );
}
