'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { Message, chatErrorMessage } from '../chat-parts';
import type { ImageGuide, TenantImage } from '@/lib/types';

type LibraryState = { guide: ImageGuide; images: TenantImage[]; logoUrl?: string | null };

type Props = {
  tenant: { slug: string; name: string };
  initial: LibraryState;
  history: { role: string; content: string }[];
};

const SUGGESTIONS = [
  'Define o guia de imagem a partir do briefing.',
  'Gera uma imagem para o hero da home.',
  'Cria um logo para o cliente.',
  'Moderniza o logo anexado.',
];

/** Xadrez atrás do logo, para a transparência ficar visível. */
const CHECKER =
  'bg-[conic-gradient(#d8d8d8_25%,#ffffff_0_50%,#d8d8d8_0_75%,#ffffff_0)] bg-[length:16px_16px]';

const STATUS_LABEL: Record<string, string> = {
  aprovada: 'Aprovada',
  candidata: 'Candidata',
  rejeitada: 'Rejeitada',
};

/** Cor da nota: verde a partir de 7, amarelo de 5 a 7, vermelho abaixo. */
function scoreTone(score: number | null): string {
  if (score === null) return 'text-[var(--color-muted)]';
  if (score >= 7) return 'text-[var(--color-ok)]';
  if (score >= 5) return 'text-[var(--color-warn)]';
  return 'text-[var(--color-err)]';
}

export function ImagesWorkspace({ tenant, initial, history }: Props) {
  const [library, setLibrary] = useState<LibraryState>(initial);
  const [input, setInput] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [filter, setFilter] = useState<'todas' | 'aprovada' | 'candidata' | 'rejeitada' | 'logo'>('todas');
  const [attachments, setAttachments] = useState<{ url: string; name: string; type: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const toolCountRef = useRef(0);

  const { messages, sendMessage, status, error, stop } = useChat({
    transport: new DefaultChatTransport({ api: '/api/images/chat', body: () => ({ tenant: tenant.slug }) }),
  });

  const refresh = useCallback(async () => {
    const response = await fetch(`/api/admin/${tenant.slug}/images`, { cache: 'no-store' });
    if (!response.ok) return;
    setLibrary((await response.json()) as LibraryState);
  }, [tenant.slug]);

  // Cada ferramenta concluída mexeu no banco: recarrega a biblioteca.
  const completedTools = useMemo(
    () =>
      messages.reduce(
        (count, message) =>
          count +
          message.parts.filter(
            (part) => part.type.startsWith('tool-') && (part as { state?: string }).state === 'output-available',
          ).length,
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

  const busy = status === 'submitted' || status === 'streaming';

  // Geração leva bem mais que uma chamada de texto: enquanto roda, a grade
  // busca sozinha para as candidatas aparecerem conforme cada modelo responde.
  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => void refresh(), 3000);
    return () => clearInterval(timer);
  }, [busy, refresh]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, status]);

  /** Sobe para o Blob: o agente e o gerador só trabalham com URL pública. */
  async function attach(files: FileList | File[] | null) {
    if (!files?.length) return;
    setUploading(true);
    setNotice(null);
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) continue;
        const form = new FormData();
        form.append('file', file);
        form.append('kind', 'referencia');
        const response = await fetch(`/api/admin/${tenant.slug}/upload`, { method: 'POST', body: form });
        const result = (await response.json()) as { url?: string; error?: string };
        if (!response.ok || !result.url) throw new Error(result.error ?? 'Falha no upload.');
        setAttachments((list) => [...list, { url: result.url as string, name: file.name, type: file.type }]);
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Falha no upload.');
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
    void sendMessage({ text: text.trim() || 'Moderniza este logo.', files });
    setInput('');
    setAttachments([]);
  }

  async function applyAsLogo(url: string, seq: number) {
    setNotice(null);
    const response = await fetch(`/api/admin/${tenant.slug}/settings`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ logoUrl: url }),
    });
    if (!response.ok) {
      setNotice('Não consegui aplicar o logo.');
      return;
    }
    setNotice(`Logo #${seq} aplicado no site.`);
    await refresh();
  }

  async function act(id: string, next: 'aprovada' | 'rejeitada' | 'candidata') {
    setNotice(null);
    const response = await fetch(`/api/admin/${tenant.slug}/images`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id, status: next }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      setNotice(body.error ?? 'Não consegui atualizar a imagem.');
      return;
    }
    await refresh();
  }

  async function remove(id: string, seq: number) {
    setNotice(null);
    const response = await fetch(`/api/admin/${tenant.slug}/images`, {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    setNotice(response.ok ? `Imagem #${seq} apagada.` : (body.error ?? 'Não consegui apagar.'));
    await refresh();
  }

  const visible = library.images.filter((image) =>
    filter === 'todas' ? true : filter === 'logo' ? image.kind === 'logo' : image.status === filter,
  );
  const batches = useMemo(() => {
    const map = new Map<string, TenantImage[]>();
    for (const image of visible) {
      const list = map.get(image.batchId) ?? [];
      list.push(image);
      map.set(image.batchId, list);
    }
    // Dentro do lote, melhor nota primeiro: é a ordem em que se decide.
    for (const list of map.values()) list.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
    return [...map.values()];
  }, [visible]);

  const guide = library.guide;
  const hasGuide = Boolean(guide.estilo || guide.luz || guide.paleta?.length);

  return (
    <div className="grid h-screen grid-rows-[auto_1fr] overflow-hidden">
      <header className="flex items-center gap-4 border-b px-4 py-2.5">
        <Link href="/admin" className="text-xs text-[var(--color-muted)] hover:text-[var(--color-text)]">
          Clientes
        </Link>
        <span className="text-xs text-[var(--color-muted)]">/</span>
        <span className="text-sm font-medium">{tenant.name}</span>
        <span className="text-xs text-[var(--color-muted)]">Imagens</span>
        <nav className="ml-auto flex items-center gap-4 text-xs">
          <Link href={`/admin/${tenant.slug}`} className="text-[var(--color-muted)] hover:text-[var(--color-text)]">
            Site
          </Link>
          <Link href={`/admin/${tenant.slug}/trafego`} className="text-[var(--color-muted)] hover:text-[var(--color-text)]">
            Tráfego
          </Link>
        </nav>
      </header>

      <div className="grid min-h-0 grid-cols-1 lg:grid-cols-[400px_1fr]">
        <section className="flex min-h-0 flex-col border-r">
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-5">
            {history.length === 0 && messages.length === 0 ? (
              <div className="flex flex-col gap-3 text-sm">
                <p className="text-base font-medium">Que imagem este cliente precisa?</p>
                <p className="text-[var(--color-muted)]">
                  O agente define uma direção de imagem a partir do briefing, gera três candidatas, critica cada uma e
                  mostra ranqueado. Você escolhe qual entra no site.
                </p>
              </div>
            ) : null}

            <div className="flex flex-col gap-5">
              {history.map((message, index) => (
                <Message
                  key={`h${index}`}
                  message={{ id: `h${index}`, role: message.role as 'user' | 'assistant', parts: [{ type: 'text', text: message.content }] }}
                />
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

            {!busy ? (
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
                      {/* oxlint-disable-next-line next/no-img-element */}
                      <img src={item.url} alt={item.name} className={`h-14 w-14 rounded-md border object-contain ${CHECKER}`} />
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
                placeholder="Descreva a imagem que você quer"
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
                    {uploading ? 'Enviando' : 'Anexar logo'}
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
                    {hasGuide ? 'Guia definido' : 'Sem guia para fotos'}
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
          <div className="flex flex-wrap items-center gap-3 border-b px-4 py-2.5">
            {hasGuide ? (
              <div className="flex flex-wrap items-center gap-2 text-[0.72rem] text-[var(--color-muted)]">
                <span className="rounded-md bg-[var(--color-surface-2)] px-2 py-1">{guide.estilo}</span>
                {guide.luz ? <span>{guide.luz}</span> : null}
                {(guide.paleta ?? []).map((color) => (
                  <span key={color} className="rounded-md border px-2 py-1">
                    {color}
                  </span>
                ))}
                {guide.nunca?.length ? <span className="text-[var(--color-err)]">nunca: {guide.nunca.join(', ')}</span> : null}
              </div>
            ) : (
              <span className="text-[0.72rem] text-[var(--color-muted)]">Guia de imagem ainda não definido.</span>
            )}
            <div className="ml-auto flex items-center gap-1">
              {(['todas', 'logo', 'aprovada', 'candidata', 'rejeitada'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setFilter(option)}
                  className={`rounded-md px-2.5 py-1.5 text-xs ${
                    filter === option ? 'bg-[var(--color-surface-2)]' : 'text-[var(--color-muted)]'
                  }`}
                >
                  {option === 'todas' ? 'Todas' : option === 'logo' ? 'Logos' : STATUS_LABEL[option]}
                </button>
              ))}
            </div>
          </div>

          {notice ? <p className="border-b px-4 py-2 text-xs text-[var(--color-muted)]">{notice}</p> : null}

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {batches.length === 0 ? (
              <p className="flex h-full items-center justify-center text-center text-sm text-[var(--color-muted)]">
                {busy ? 'O agente está gerando e avaliando as imagens' : 'Nenhuma imagem ainda. Peça uma no chat.'}
              </p>
            ) : (
              <div className="flex flex-col gap-8">
                {batches.map((batch) => (
                  <section key={batch[0].batchId} className="flex flex-col gap-3">
                    <h2 className="text-xs text-[var(--color-muted)]">
                      {batch[0].requestText}
                      <span className="ml-2 font-mono">{batch[0].ratio}</span>
                      {batch[0].targetBlock && batch[0].targetBlock !== 'livre' ? (
                        <span className="ml-2 font-mono">{batch[0].targetBlock}</span>
                      ) : null}
                    </h2>
                    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                      {batch.map((image) => (
                        <li
                          key={image.id}
                          className={`flex flex-col overflow-hidden rounded-lg border bg-[var(--color-bg)] ${
                            image.status === 'rejeitada' ? 'opacity-50' : ''
                          }`}
                        >
                          <a
                            href={image.url}
                            target="_blank"
                            rel="noreferrer"
                            className={`block ${image.kind === 'logo' ? CHECKER : 'bg-black/20'}`}
                          >
                            {/* Arquivo recém-gerado no Blob; o otimizador não agrega nada aqui. */}
                            {/* oxlint-disable-next-line next/no-img-element */}
                            <img
                              src={image.url}
                              alt={image.alt ?? image.requestText}
                              className={`w-full object-contain ${image.kind === 'logo' ? 'max-h-52 p-4' : 'max-h-72'}`}
                              loading="lazy"
                            />
                          </a>
                          <div className="flex flex-col gap-2 p-3">
                            <div className="flex items-center gap-2 text-xs">
                              <span className="font-mono">#{image.seq}</span>
                              <span className={`font-medium ${scoreTone(image.score)}`}>
                                {image.score === null ? 'sem nota' : image.score.toFixed(1)}
                              </span>
                              <span className="text-[var(--color-muted)]">
                                {image.kind === 'logo'
                                  ? (image.critique.variante ?? 'logo')
                                  : image.model.split('/')[1]}
                              </span>
                              {image.kind === 'logo' && typeof image.critique.fidelidade_original === 'number' ? (
                                <span
                                  className="text-[var(--color-muted)]"
                                  title="Quanto a variante ainda lembra o logo original, de 0 a 10"
                                >
                                  fid {image.critique.fidelidade_original}
                                </span>
                              ) : null}
                              {image.url === library.logoUrl ? (
                                <span className="rounded-full bg-[color-mix(in_oklab,var(--color-accent)_25%,transparent)] px-2 py-0.5 text-[0.65rem] text-[var(--color-accent)]">
                                  Logo do site
                                </span>
                              ) : null}
                              <span
                                className={`ml-auto rounded-full px-2 py-0.5 text-[0.65rem] ${
                                  image.status === 'aprovada'
                                    ? 'bg-[color-mix(in_oklab,var(--color-ok)_22%,transparent)] text-[var(--color-ok)]'
                                    : 'bg-[var(--color-surface-2)] text-[var(--color-muted)]'
                                }`}
                              >
                                {STATUS_LABEL[image.status]}
                              </span>
                            </div>

                            {image.critique.problemas?.length ? (
                              <ul className="flex flex-col gap-0.5">
                                {image.critique.problemas.slice(0, 3).map((problem) => (
                                  <li key={problem} className="text-[0.7rem] leading-snug text-[var(--color-err)]">
                                    {problem}
                                  </li>
                                ))}
                              </ul>
                            ) : null}
                            {image.critique.pontos_fortes?.length ? (
                              <p className="text-[0.7rem] leading-snug text-[var(--color-muted)]">
                                {image.critique.pontos_fortes.slice(0, 2).join('. ')}
                              </p>
                            ) : null}
                            {image.critique.erro ? (
                              <p className="text-[0.7rem] text-[var(--color-warn)]">Crítica falhou: {image.critique.erro}</p>
                            ) : null}

                            <div className="mt-1 flex flex-wrap gap-1.5">
                              {image.status !== 'aprovada' ? (
                                <button
                                  type="button"
                                  onClick={() => void act(image.id, 'aprovada')}
                                  className="rounded-md bg-[var(--color-accent)] px-2.5 py-1 text-[0.7rem] font-medium text-[var(--color-accent-ink)]"
                                >
                                  Aprovar
                                </button>
                              ) : null}
                              {image.status !== 'rejeitada' ? (
                                <button
                                  type="button"
                                  onClick={() => void act(image.id, 'rejeitada')}
                                  className="rounded-md border px-2.5 py-1 text-[0.7rem] text-[var(--color-muted)]"
                                >
                                  Rejeitar
                                </button>
                              ) : null}
                              {image.status === 'aprovada' && image.kind === 'logo' && image.url !== library.logoUrl ? (
                                <button
                                  type="button"
                                  onClick={() => void applyAsLogo(image.url, image.seq)}
                                  className="rounded-md border px-2.5 py-1 text-[0.7rem] text-[var(--color-muted)] hover:text-[var(--color-text)]"
                                >
                                  Usar como logo
                                </button>
                              ) : null}
                              {image.status === 'aprovada' && image.kind !== 'logo' ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    void navigator.clipboard.writeText(`usa a imagem #${image.seq} no hero`);
                                    setNotice(`Copiado: "usa a imagem #${image.seq} no hero". Cole no chat do site.`);
                                  }}
                                  className="rounded-md border px-2.5 py-1 text-[0.7rem] text-[var(--color-muted)]"
                                >
                                  Usar no site
                                </button>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => void remove(image.id, image.seq)}
                                className="ml-auto rounded-md px-2 py-1 text-[0.7rem] text-[var(--color-muted)] hover:text-[var(--color-err)]"
                              >
                                Apagar
                              </button>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
