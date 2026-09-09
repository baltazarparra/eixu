'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';

type PageRef = { slug: string; type: string; title: string; blocks: number; published: boolean };

export function Workspace({
  tenantSlug,
  tenantName,
  pages,
  history,
}: {
  tenantSlug: string;
  tenantName: string;
  pages: PageRef[];
  history: { role: string; content: string }[];
}) {
  const [input, setInput] = useState('');
  const [current, setCurrent] = useState(pages[0]?.slug ?? '');
  const [nonce, setNonce] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
      body: { tenant: tenantSlug },
    }),
  });

  // Quando a resposta termina, o modelo já gravou no banco. Recarregar a rota
  // traz páginas, preview e pre-flight atualizados de uma vez.
  useEffect(() => {
    if (status !== 'ready' || messages.length === 0) return;
    const timer = setTimeout(() => {
      router.refresh();
      setNonce((value) => value + 1);
    }, 400);
    return () => clearTimeout(timer);
  }, [status, messages.length, router]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  const busy = status === 'submitted' || status === 'streaming';
  const previewUrl = `/s/${tenantSlug}/${current}?preview=1&__tenant=${tenantSlug}&v=${nonce}`;

  return (
    <div className="grid h-screen grid-rows-[auto_1fr] lg:grid-cols-[minmax(360px,38%)_1fr] lg:grid-rows-1">
      <section className="flex min-h-0 flex-col border-b lg:border-r lg:border-b-0">
        <header className="flex items-center justify-between gap-3 border-b px-5 py-4">
          <div className="min-w-0">
            <Link href="/admin" className="text-xs text-[var(--color-muted)] hover:text-[var(--color-text)]">
              Clientes
            </Link>
            <h1 className="truncate text-base font-medium">{tenantName}</h1>
          </div>
          <nav className="flex shrink-0 gap-3 text-xs">
            <Link href={`/admin/${tenantSlug}/leads`} className="text-[var(--color-muted)] hover:text-[var(--color-text)]">
              Leads
            </Link>
            <Link href={`/admin/${tenantSlug}/trafego`} className="text-[var(--color-muted)] hover:text-[var(--color-text)]">
              Tráfego
            </Link>
          </nav>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-6">
          {history.length === 0 && messages.length === 0 ? (
            <div className="flex flex-col gap-4 text-sm text-[var(--color-muted)]">
              <p className="text-[var(--color-text)]">Descreva o site que este cliente precisa.</p>
              <p>
                Diga o segmento, para quem vende, o que quer que o visitante faça e as páginas que imagina.
                Quanto mais concreto, melhor o resultado.
              </p>
              <button
                type="button"
                onClick={() =>
                  setInput(
                    'Clínica de estética em Bauru, atende mulheres de 30 a 55 anos. Quero home, sobre, serviços, blog e uma página de agradecimento. A conversão principal é WhatsApp. Tom sóbrio, nada de clichê de clínica.',
                  )
                }
                className="self-start rounded-md border px-3 py-2 text-left text-xs hover:bg-[var(--color-surface)]"
              >
                Usar um exemplo pronto
              </button>
            </div>
          ) : null}

          <div className="flex flex-col gap-5">
            {history.map((message, index) => (
              <Bubble key={`h${index}`} role={message.role}>
                {message.content}
              </Bubble>
            ))}
            {messages.map((message) => (
              <Bubble key={message.id} role={message.role}>
                {message.parts.map((part, index) => {
                  if (part.type === 'text') return <span key={index}>{part.text}</span>;
                  if (part.type.startsWith('tool-')) {
                    const name = part.type.replace('tool-', '');
                    return (
                      <span
                        key={index}
                        className="mr-1.5 mb-1.5 inline-block rounded border px-2 py-0.5 font-mono text-[0.68rem] text-[var(--color-muted)]"
                      >
                        {name}
                      </span>
                    );
                  }
                  return null;
                })}
              </Bubble>
            ))}
            {busy ? <p className="text-xs text-[var(--color-muted)]">Trabalhando…</p> : null}
            {error ? (
              <p className="rounded-md border border-[var(--color-err)] px-3 py-2 text-xs text-[var(--color-err)]">
                {/rate.?limit|429|free tier|not have access/i.test(error.message)
                  ? 'O AI Gateway recusou a chamada por limite do plano gratuito. Adicione créditos no AI Gateway da Vercel e defina EIXU_MODEL, por exemplo anthropic/claude-sonnet-4.5.'
                  : error.message}
              </p>
            ) : null}
          </div>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!input.trim() || busy) return;
            void sendMessage({ text: input });
            setInput('');
          }}
          className="flex gap-2 border-t px-5 py-4"
        >
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            rows={2}
            placeholder="Descreva o que você quer"
            className="min-h-[3rem] flex-1 resize-none rounded-md border bg-[var(--color-surface)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--color-accent)]"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="self-end rounded-md bg-[var(--color-accent)] px-4 py-2.5 text-sm font-medium text-[var(--color-accent-ink)] disabled:opacity-50"
          >
            Enviar
          </button>
        </form>
      </section>

      <section className="flex min-h-0 flex-col">
        <header className="flex flex-wrap items-center gap-2 border-b px-5 py-3">
          {pages.length === 0 ? (
            <span className="text-xs text-[var(--color-muted)]">Nenhuma página ainda.</span>
          ) : (
            pages.map((page) => (
              <button
                key={page.slug}
                type="button"
                onClick={() => setCurrent(page.slug)}
                className={`rounded-md px-2.5 py-1.5 font-mono text-xs ${
                  current === page.slug
                    ? 'bg-[var(--color-surface-2)] text-[var(--color-text)]'
                    : 'text-[var(--color-muted)] hover:bg-[var(--color-surface)]'
                }`}
              >
                /{page.slug}
                {page.published ? <span className="ml-1.5 text-[var(--color-ok)]">•</span> : null}
              </button>
            ))
          )}
          <a
            href={previewUrl}
            target="_blank"
            rel="noreferrer"
            className="ml-auto text-xs text-[var(--color-muted)] hover:text-[var(--color-text)]"
          >
            Abrir em nova aba
          </a>
        </header>
        <div className="flex-1 bg-white">
          {pages.length > 0 ? (
            <iframe key={nonce} src={previewUrl} title="Preview do site" className="h-full w-full border-0" />
          ) : (
            <div className="flex h-full items-center justify-center bg-[var(--color-bg)] px-8 text-center text-sm text-[var(--color-muted)]">
              O preview aparece assim que a primeira página for criada.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function Bubble({ role, children }: { role: string; children: React.ReactNode }) {
  const isUser = role === 'user';
  return (
    <div className={`flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}>
      <span className="text-[0.68rem] uppercase tracking-[0.14em] text-[var(--color-muted)]">
        {isUser ? 'Você' : 'Editor'}
      </span>
      <div
        className={`max-w-[92%] whitespace-pre-wrap rounded-lg px-3.5 py-2.5 text-sm leading-relaxed ${
          isUser ? 'bg-[var(--color-surface-2)]' : 'border bg-[var(--color-surface)]'
        }`}
      >
        {children}
      </div>
    </div>
  );
}
