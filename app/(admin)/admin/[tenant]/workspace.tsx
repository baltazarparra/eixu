'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { Bubble, Message, chatErrorMessage } from './chat-parts';

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

export function Workspace({ initial, history }: Props) {
  const tenantSlug = initial.tenant.slug;
  const [site, setSite] = useState<SiteState>(initial);
  const [current, setCurrent] = useState(initial.pages[0]?.slug ?? '');
  const [input, setInput] = useState('');
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [nonce, setNonce] = useState(0);
  const [publishing, setPublishing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<{ url: string; name: string; type: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
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

  /** Sobe para o Blob e devolve a URL pública. O agente só entende URL. */
  async function upload(file: File, kind: 'media' | 'logo' = 'media') {
    const form = new FormData();
    form.append('file', file);
    form.append('kind', kind);
    const response = await fetch(`/api/admin/${tenantSlug}/upload`, { method: 'POST', body: form });
    const result = (await response.json()) as { url?: string; error?: string };
    if (!response.ok || !result.url) throw new Error(result.error ?? 'Falha no upload.');
    return result.url;
  }

  async function attach(files: FileList | File[] | null) {
    if (!files?.length) return;
    setUploading(true);
    setNotice(null);
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) continue;
        const url = await upload(file);
        setAttachments((list) => [...list, { url, name: file.name, type: file.type }]);
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Falha no upload.');
    } finally {
      setUploading(false);
    }
  }

  async function setLogo(files: FileList | null) {
    if (!files?.[0]) return;
    setUploading(true);
    setNotice(null);
    try {
      const url = await upload(files[0], 'logo');
      const response = await fetch(`/api/admin/${tenantSlug}/settings`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ logoUrl: url }),
      });
      if (!response.ok) throw new Error('Não consegui salvar o logo.');
      setNotice('Logo atualizado. A navegação e o rodapé já usam a imagem.');
      setNonce((value) => value + 1);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Falha no upload do logo.');
    } finally {
      setUploading(false);
    }
  }

  function submit(text: string) {
    if ((!text.trim() && attachments.length === 0) || busy || uploading) return;
    const files = attachments.map((item) => ({
      type: 'file' as const,
      mediaType: item.type,
      url: item.url,
      filename: item.name,
    }));
    void sendMessage({ text: text.trim() || 'Use a imagem anexada.', files });
    setInput('');
    setAttachments([]);
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
          <button
            type="button"
            onClick={() => logoInputRef.current?.click()}
            disabled={uploading}
            className="text-[var(--color-muted)] hover:text-[var(--color-text)] disabled:opacity-50"
          >
            Logo do cliente
          </button>
          <input
            ref={logoInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="hidden"
            onChange={(event) => {
              void setLogo(event.target.files);
              event.target.value = '';
            }}
          />
          <Link href={`/admin/${tenantSlug}/imagens`} className="text-[var(--color-muted)] hover:text-[var(--color-text)]">
            Imagens
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
                  {chatErrorMessage(error.message)}
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
            <div
              className="flex flex-col gap-2 rounded-lg border bg-[var(--color-surface)] p-2 focus-within:border-[var(--color-accent)]"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                void attach(event.dataTransfer.files);
              }}
            >
              {attachments.length ? (
                <ul className="flex flex-wrap gap-2 px-1 pt-1">
                  {attachments.map((item) => (
                    <li key={item.url} className="relative">
                      {/* Miniatura de arquivo recém-enviado ao Blob; o otimizador não agrega nada aqui. */}
                      {/* oxlint-disable-next-line next/no-img-element */}
                      <img src={item.url} alt={item.name} className="h-14 w-14 rounded-md border object-cover" />
                      <button
                        type="button"
                        aria-label={`Remover ${item.name}`}
                        onClick={() => setAttachments((list) => list.filter((entry) => entry.url !== item.url))}
                        className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full border bg-[var(--color-bg)] text-[0.65rem]"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onPaste={(event) => {
                  const files = Array.from(event.clipboardData.files).filter((file) => file.type.startsWith('image/'));
                  if (files.length) {
                    event.preventDefault();
                    void attach(files);
                  }
                }}
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
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading || busy}
                    className="rounded-md border px-2.5 py-1 text-[0.72rem] text-[var(--color-muted)] hover:text-[var(--color-text)] disabled:opacity-50"
                  >
                    {uploading ? 'Enviando' : 'Imagem'}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(event) => {
                      void attach(event.target.files);
                      event.target.value = '';
                    }}
                  />
                  <span className="text-[0.68rem] text-[var(--color-muted)]">
                    {page ? `Falando sobre /${page.slug}` : 'Enter envia, Shift+Enter quebra linha'}
                  </span>
                </div>
                {busy ? (
                  <button type="button" onClick={() => stop()} className="rounded-md border px-3 py-1.5 text-xs">
                    Parar
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={(!input.trim() && attachments.length === 0) || uploading}
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
