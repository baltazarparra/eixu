'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, getToolName, isToolUIPart } from 'ai';
import { ChatActivity, Message, chatErrorMessage } from './chat-parts';
import { GenerationBar, GenerationPanel } from './generation-panel';
import { isRunning, useGeneration } from './use-generation';

import { AdminHeader, MobileViews } from '@/components/admin/navigation';
import { ChatUsageDetails } from '@/components/admin/chat-usage';
import { adminFetch } from '@/lib/admin/http';
import { mergeSavedMessages } from '@/lib/admin/chat-messages';
import type { SiteState } from '@/lib/admin/state';
import type { ChatMessage } from '@/lib/ai/usage';

type Props = {
  initial: SiteState;
  history: ChatMessage[];
  /** Último id gravado: o painel busca daí em diante o que a geração escrever. */
  lastMessageId: number;
  imageRequest?: string;
};

const SUGGESTIONS = [
  'Deixa o hero mais direto, com o benefício na primeira linha.',
  'Adiciona uma seção de perguntas frequentes sobre preço e prazo.',
  'Cria uma página de serviços com os três principais.',
  'Troca a cor de acento para algo mais sóbrio.',
];

export function Workspace({
  initial,
  history,
  lastMessageId,
  imageRequest = '',
}: Props) {
  const tenantSlug = initial.tenant.slug;
  const [site, setSite] = useState<SiteState>(initial);
  const [current, setCurrent] = useState(initial.pages[0]?.slug ?? '');
  const [input, setInput] = useState(imageRequest);
  const [view, setView] = useState<'chat' | 'content'>(
    initial.pages.length && !imageRequest ? 'content' : 'chat',
  );
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [nonce, setNonce] = useState(0);
  const [publishing, setPublishing] = useState(false);
  const [notice, setNotice] = useState<{
    tone: 'info' | 'ok' | 'warn' | 'err';
    text: string;
  } | null>(null);
  const [attachments, setAttachments] = useState<
    { url: string; name: string; type: string }[]
  >([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const toolCountRef = useRef(0);
  const refreshSeq = useRef(0);
  const previewRevision = useRef(initial.previewRevision);

  const { messages, setMessages, sendMessage, status, error, stop } =
    useChat<ChatMessage>({
      messages: history,
      onFinish: () => {
        void refresh().catch((failure: Error) => fail(failure.message));
      },
      transport: new DefaultChatTransport({
        api: '/api/chat',
        body: () => ({ tenant: tenantSlug, page: current }),
      }),
    });
  const busy = status === 'submitted' || status === 'streaming';

  const applySite = useCallback((next: SiteState) => {
    setSite(next);
    setCurrent((slug) =>
      next.pages.some((page) => page.slug === slug)
        ? slug
        : (next.pages[0]?.slug ?? ''),
    );
    // O feed resume blocos por quantidade. A revisão detecta também mudanças
    // de texto/props com a mesma quantidade, sem recarregar a cada consulta.
    if (previewRevision.current !== next.previewRevision) {
      previewRevision.current = next.previewRevision;
      setNonce((value) => value + 1);
    }
  }, []);

  const refresh = useCallback(async () => {
    const ticket = ++refreshSeq.current;
    const next = await adminFetch<SiteState>(`/api/admin/${tenantSlug}/state`, {
      signal: AbortSignal.timeout(20_000),
    });
    // A ferramenta concluída e o laço da geração atualizam em paralelo: uma
    // resposta atrasada não pode sobrescrever a leitura mais nova.
    if (ticket !== refreshSeq.current) return next;
    applySite(next);
    return next;
  }, [tenantSlug, applySite]);

  const fail = useCallback(
    (text: string) => setNotice({ tone: 'err', text: chatErrorMessage(text) }),
    [],
  );

  // O painel acompanha a execução pelo servidor: recarregar, trocar de aba ou
  // fechar o navegador não interrompe nem esconde o que está acontecendo.
  const generation = useGeneration({
    tenant: tenantSlug,
    initialMessageId: lastMessageId,
    onState: applySite,
    // Ao terminar o stream, consulta novamente e descobre inclusive um run
    // iniciado pela palavra "continuar". Recibos não disputam a bolha ativa.
    paused: busy,
    onMessages: (saved) =>
      setMessages((current) => mergeSavedMessages(current, saved)),
  });
  const running = isRunning(generation.run);

  async function startGeneration() {
    setNotice(null);
    setView('chat');
    try {
      await generation.start();
    } catch (failure) {
      fail(failure instanceof Error ? failure.message : 'Falha na geração.');
    }
  }

  async function stopGeneration() {
    try {
      await generation.stop();
      setNotice({
        tone: 'info',
        text: 'Pausa pedida. A etapa atual termina e a próxima não começa.',
      });
    } catch (failure) {
      fail(failure instanceof Error ? failure.message : 'Falha ao pausar.');
    }
  }

  // Cada ferramenta concluída pelo agente muda o site no banco: atualiza o preview na hora.
  const completedTools = useMemo(
    () =>
      messages.reduce(
        (count, message) =>
          count +
          message.parts.filter(
            (part) =>
              isToolUIPart(part) &&
              ![
                'get_page',
                'list_state',
                'list_images',
                'describe_block',
                'lint_page',
                'lint_site',
              ].includes(getToolName(part)) &&
              part.state === 'output-available',
          ).length,
        0,
      ),
    [messages],
  );
  useEffect(() => {
    if (completedTools !== toolCountRef.current) {
      toolCountRef.current = completedTools;
      void refresh().catch((error: Error) => fail(error.message));
    }
  }, [completedTools, refresh, fail]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages, status]);

  // Conversa livre e geração disputariam as mesmas páginas: enquanto uma roda,
  // a outra espera, e a tela diz por quê.
  const locked = busy || running;
  const page = site.pages.find((item) => item.slug === current);
  const previewUrl = `/s/${tenantSlug}/${current}?preview=1&__tenant=${tenantSlug}&v=${nonce}`;
  const totalErrors = site.pages.reduce(
    (sum, item) => sum + item.errors.length,
    site.errors.length,
  );
  // Pendência não significa execução ativa: pausas, falhas e edições manuais
  // precisam mostrar os motivos que ainda bloqueiam a publicação.
  const showReview =
    site.pages.length > 0 &&
    !running &&
    (totalErrors > 0 ||
      site.warnings.length > 0 ||
      (page?.warnings.length ?? 0) > 0);
  const publishable =
    site.pages.length > 0 &&
    totalErrors === 0 &&
    !locked &&
    site.pages.some((item) => item.dirty);
  // Publicação manual vale pelo pre-flight; a revisão visual é outra garantia.
  const reviewPending =
    site.pages.length > 0 && !site.generation.reviewComplete;

  async function publishAll() {
    setPublishing(true);
    setNotice(null);
    try {
      const result = await adminFetch<{
        published: string[];
        blocked: { page: string }[];
        url: string;
      }>(`/api/admin/${tenantSlug}/publish`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
      setNotice(
        result.blocked.length
          ? {
              tone: 'warn',
              text: `Bloqueado em ${result.blocked.map((item) => item.page).join(', ')}. Peça ao agente para corrigir.`,
            }
          : { tone: 'ok', text: `Publicado. ${result.url}` },
      );
      await refresh();
    } catch (error) {
      fail(
        error instanceof Error ? error.message : 'Não foi possível publicar.',
      );
    } finally {
      setPublishing(false);
    }
  }

  /** Sobe para o Blob e devolve a URL pública. O agente só entende URL. */
  async function upload(file: File, kind: 'media' | 'logo' = 'media') {
    const form = new FormData();
    form.append('file', file);
    form.append('kind', kind);
    const response = await fetch(`/api/admin/${tenantSlug}/upload`, {
      method: 'POST',
      body: form,
    });
    const result = (await response.json()) as { url?: string; error?: string };
    if (!response.ok || !result.url)
      throw new Error(result.error ?? 'Falha no upload.');
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
        setAttachments((list) => [
          ...list,
          { url, name: file.name, type: file.type },
        ]);
      }
    } catch (error) {
      fail(error instanceof Error ? error.message : 'Falha no upload.');
    } finally {
      setUploading(false);
    }
  }

  function submit(text: string) {
    if ((!text.trim() && attachments.length === 0) || locked || uploading)
      return;
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
    <div className="admin-workspace" data-view={view}>
      <AdminHeader
        tenant={site.tenant}
        active="site"
        actions={
          <button
            type="button"
            onClick={publishAll}
            disabled={!publishable || publishing}
            title={
              totalErrors
                ? `${totalErrors} pendências bloqueiam a publicação`
                : reviewPending
                  ? 'Revisão visual pendente: a publicação vale pelo pre-flight'
                  : 'Publicar as alterações revisadas'
            }
            className="admin-primary"
          >
            {publishing ? 'Publicando…' : 'Publicar'}
          </button>
        }
        note={reviewPending && !running ? 'Revisão visual pendente' : undefined}
      />
      <MobileViews value={view} onChange={setView} />
      {notice ? (
        <output
          className="admin-notice"
          data-tone={notice.tone}
          aria-live="polite"
        >
          <span>{notice.text}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label="Fechar aviso"
          >
            ×
          </button>
        </output>
      ) : null}
      <GenerationBar
        run={generation.run}
        events={generation.events}
        state={site}
        onOpen={() => setView('chat')}
      />
      <div className="admin-workspace-body">
        <section className="admin-conversation" aria-label="Conversa de edição">
          <GenerationPanel
            run={generation.run}
            events={generation.events}
            state={site}
            error={generation.error}
            busy={busy}
            onStart={() => void startGeneration()}
            onStop={() => void stopGeneration()}
          />
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-5">
            {messages.length === 0 ? (
              <div className="flex flex-col gap-3 text-sm">
                <p className="text-base font-medium">
                  O que este cliente precisa?
                </p>
                <p className="text-[var(--color-muted)]">
                  Descreva o negócio e as referências, ou continue a geração em
                  etapas: briefing e direção, cenas, composição e revisão. As
                  imagens ficam na biblioteca e são usadas sem aprovação. Peça
                  alterações pelo número, como “atualize a imagem #5 com outro
                  carro”. No fim, confira a prévia e publique.
                </p>
              </div>
            ) : null}

            <div className="flex flex-col gap-5">
              {messages.map((message) => (
                <Message key={message.id} message={message} />
              ))}
              {busy ? <ChatActivity messages={messages} /> : null}
              {error ? (
                <p className="rounded-md border border-[var(--color-err)] px-3 py-2 text-xs text-[var(--color-err)]">
                  {chatErrorMessage(error.message)}
                </p>
              ) : null}
            </div>

            {!locked && site.pages.length > 0 ? (
              <div className="mt-6 flex flex-wrap gap-2">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => setInput(suggestion)}
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
                      <img
                        src={item.url}
                        alt={item.name}
                        className="h-14 w-14 rounded-md border object-cover"
                      />
                      <button
                        type="button"
                        aria-label={`Remover ${item.name}`}
                        onClick={() =>
                          setAttachments((list) =>
                            list.filter((entry) => entry.url !== item.url),
                          )
                        }
                        className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full border bg-[var(--color-bg)] text-[0.65rem]"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              <textarea
                aria-label="Mensagem para editar o site"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onPaste={(event) => {
                  const files = Array.from(event.clipboardData.files).filter(
                    (file) => file.type.startsWith('image/'),
                  );
                  if (files.length) {
                    event.preventDefault();
                    void attach(files);
                  }
                }}
                onKeyDown={(event) => {
                  if (
                    event.key === 'Enter' &&
                    !event.shiftKey &&
                    !event.nativeEvent.isComposing
                  ) {
                    event.preventDefault();
                    submit(input);
                  }
                }}
                rows={3}
                disabled={running}
                placeholder={
                  running
                    ? 'Geração em andamento. O chat volta quando ela terminar.'
                    : site.pages.length
                      ? 'Peça uma mudança'
                      : 'Descreva o site'
                }
                className="w-full resize-none bg-transparent px-1.5 py-1 text-sm outline-none"
              />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading || locked}
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
                    {running
                      ? 'A geração está rodando; peça alterações quando ela terminar'
                      : page
                        ? `Falando sobre /${page.slug}`
                        : 'Enter envia, Shift+Enter quebra linha'}
                  </span>
                </div>
                {busy ? (
                  <button
                    type="button"
                    onClick={() => void stop()}
                    className="rounded-md border px-3 py-1.5 text-xs"
                  >
                    Parar
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={
                      (!input.trim() && attachments.length === 0) ||
                      uploading ||
                      running
                    }
                    className="rounded-md bg-[var(--color-accent)] px-3.5 py-1.5 text-xs font-medium text-[var(--color-accent-ink)] disabled:opacity-40"
                  >
                    Enviar
                  </button>
                )}
              </div>
            </div>
          </form>
          <ChatUsageDetails messages={messages} />
        </section>

        <section className="admin-content" aria-label="Prévia e revisão">
          <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
            <label className="admin-page-selector">
              Página
              <select
                aria-label="Página em edição"
                value={current}
                onChange={(event) => setCurrent(event.target.value)}
                className="admin-input max-w-72"
              >
                {!site.pages.length ? (
                  <option value="">Nenhuma página</option>
                ) : null}
                {site.pages.map((item) => (
                  <option key={item.slug} value={item.slug}>
                    {item.title} (/{item.slug}){item.dirty ? ' • rascunho' : ''}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-center gap-1">
              {(['desktop', 'mobile'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={device === option}
                  onClick={() => setDevice(option)}
                  className={`rounded-md px-3 py-2 text-xs ${device === option ? 'bg-[var(--color-surface-2)]' : 'text-[var(--color-muted)]'}`}
                >
                  {option === 'desktop' ? 'Desktop' : 'Celular'}
                </button>
              ))}
              {page ? (
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="admin-secondary"
                >
                  Abrir prévia
                </a>
              ) : null}
            </div>
          </div>

          {showReview ? (
            <details
              className="admin-review"
              open={totalErrors > 0 ? true : undefined}
            >
              <summary
                className={
                  totalErrors
                    ? 'text-[var(--color-warn)]'
                    : 'text-[var(--color-ok)]'
                }
              >
                {totalErrors
                  ? `${totalErrors} pendências para publicar`
                  : site.pages.length
                    ? site.pages.some((item) => item.dirty)
                      ? 'Rascunho pronto para sua revisão'
                      : 'Páginas publicadas e atualizadas'
                    : 'Crie as páginas para começar'}
              </summary>
              <p className="mt-2 text-[var(--color-muted)]">
                Confira a prévia e as imagens antes de publicar. Os ajustes
                feitos pelo chat são salvos no rascunho.
              </p>
              <ul>
                {site.errors.map((message) => (
                  <li key={message} className="text-[var(--color-err)]">
                    {message}
                  </li>
                ))}
                {site.warnings.map((message) => (
                  <li key={message} className="text-[var(--color-muted)]">
                    Recomendação: {message}
                  </li>
                ))}
                {site.pages.flatMap((item) =>
                  item.errors.map((message) => (
                    <li key={`${item.slug}-${message}`}>
                      <button
                        type="button"
                        onClick={() => setCurrent(item.slug)}
                        className="mr-2 underline"
                      >
                        /{item.slug}
                      </button>
                      <span className="text-[var(--color-err)]">{message}</span>
                    </li>
                  )),
                )}
                {page?.warnings.map((message) => (
                  <li key={message} className="text-[var(--color-muted)]">
                    Recomendação: {message}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
          <div className="flex min-h-0 flex-1 items-start justify-center overflow-auto p-4">
            {site.pages.length > 0 ? (
              <iframe
                key={`${current}-${nonce}`}
                src={previewUrl}
                title="Preview do site"
                className={`h-full rounded-lg border bg-white shadow-[0_20px_60px_-30px_rgba(0,0,0,0.6)] transition-[width] ${
                  device === 'mobile' ? 'w-[390px] max-w-full' : 'w-full'
                }`}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-center text-sm text-[var(--color-muted)]">
                {busy
                  ? 'O agente está montando o site'
                  : 'O preview aparece assim que o agente criar a primeira página.'}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
