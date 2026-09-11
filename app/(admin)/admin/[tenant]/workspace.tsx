'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { Message, chatErrorMessage } from './chat-parts';
import { SceneReview, type Decision, type PendingImage } from './scene-review';
import {
  PHASES,
  PHASE_LABEL,
  PHASE_MESSAGE,
  type Phase,
} from '@/lib/taste/phases';

import { AdminHeader, MobileViews } from '@/components/admin/navigation';
import { ChatUsageDetails } from '@/components/admin/chat-usage';
import { AdminHttpError, adminFetch } from '@/lib/admin/http';
import type { SiteState } from '@/lib/admin/state';
import type { ChatMessage } from '@/lib/ai/usage';

type Props = { initial: SiteState; history: ChatMessage[] };

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
  const [view, setView] = useState<'chat' | 'content'>(
    initial.pages.length ? 'content' : 'chat',
  );
  const generationError = useRef<Error | null>(null);
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [nonce, setNonce] = useState(0);
  const [publishing, setPublishing] = useState(false);
  const [deciding, setDeciding] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<
    { url: string; name: string; type: string }[]
  >([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const toolCountRef = useRef(0);
  const [generating, setGenerating] = useState(false);
  const [phase, setPhase] = useState<Phase | null>(null);
  const stopGeneration = useRef(false);
  // O laço parou por causa de uma imagem na fila: a decisão do operador é que
  // retoma a sequência.
  const awaitingDecision = useRef(false);
  /** Pedido da próxima tentativa, escrito ao recusar uma cena. */
  const feedbackRef = useRef('');
  const refreshSeq = useRef(0);

  const { messages, sendMessage, status, error, stop } = useChat<ChatMessage>({
    messages: history,
    onError: (failure) => {
      generationError.current = failure;
    },
    transport: new DefaultChatTransport({
      api: '/api/chat',
      body: () => ({ tenant: tenantSlug, page: current }),
    }),
  });

  const refresh = useCallback(async () => {
    const ticket = ++refreshSeq.current;
    const next = await adminFetch<SiteState>(`/api/admin/${tenantSlug}/state`);
    // A ferramenta concluída e o laço da geração atualizam em paralelo: uma
    // resposta atrasada não pode sobrescrever a leitura mais nova.
    if (ticket !== refreshSeq.current) return next;
    setSite(next);
    setCurrent((slug) =>
      next.pages.some((page) => page.slug === slug)
        ? slug
        : (next.pages[0]?.slug ?? ''),
    );
    setNonce((value) => value + 1);
    return next;
  }, [tenantSlug]);

  // Cada ferramenta concluída pelo agente muda o site no banco: atualiza o preview na hora.
  const completedTools = useMemo(
    () =>
      messages.reduce(
        (count, message) =>
          count +
          message.parts.filter(
            (part) =>
              part.type.startsWith('tool-') &&
              ![
                'tool-get_page',
                'tool-list_state',
                'tool-list_images',
                'tool-describe_block',
                'tool-lint_page',
                'tool-lint_site',
              ].includes(part.type) &&
              (part as { state?: string }).state === 'output-available',
          ).length,
        0,
      ),
    [messages],
  );
  useEffect(() => {
    if (completedTools !== toolCountRef.current) {
      toolCountRef.current = completedTools;
      void refresh().catch((error: Error) => setNotice(error.message));
    }
  }, [completedTools, refresh]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages, status]);

  const busy = status === 'submitted' || status === 'streaming';
  const page = site.pages.find((item) => item.slug === current);
  const previewUrl = `/s/${tenantSlug}/${current}?preview=1&__tenant=${tenantSlug}&v=${nonce}`;
  const totalErrors = site.pages.reduce(
    (sum, item) => sum + item.errors.length,
    site.errors.length,
  );
  const pending = site.generation?.pendingImages ?? [];
  const awaiting = pending.length > 0;
  // As pendências só interessam no fim: num cliente novo elas são a lista do
  // que a geração ainda vai fazer, e o painel virava alarme falso.
  const flowRunning =
    generating ||
    (site.tenant.hasDesign &&
      ['briefing', 'cenas', 'composicao'].includes(site.generation.next));
  const showReview =
    site.pages.length > 0 &&
    !flowRunning &&
    (totalErrors > 0 ||
      site.warnings.length > 0 ||
      (page?.warnings.length ?? 0) > 0);
  const publishable =
    site.pages.length > 0 &&
    totalErrors === 0 &&
    !busy &&
    !generating &&
    site.pages.some((item) => item.dirty);

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
          ? `Bloqueado em ${result.blocked.map((item) => item.page).join(', ')}. Peça ao agente para corrigir.`
          : `Publicado. ${result.url}`,
      );
      await refresh();
    } catch (error) {
      setNotice(
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
      setNotice(error instanceof Error ? error.message : 'Falha no upload.');
    } finally {
      setUploading(false);
    }
  }

  /**
   * Geração em etapas. Cada fase é uma requisição própria, dentro do limite de
   * 300 segundos, e a próxima é decidida pelo estado persistido: interromper e
   * retomar não perde o progresso.
   */
  async function generate() {
    if (busy || generating) return;
    stopGeneration.current = false;
    setGenerating(true);
    setView('chat');
    setNotice(null);
    try {
      let previous: Phase | null = null;
      let repeated = 0;
      for (let step = 0; step < 8; step++) {
        if (stopGeneration.current) break;
        const state = await refresh();
        const next = state?.generation?.next;
        if (!next || next === 'pronto') break;
        // Uma imagem na fila é decisão do operador, e só a etapa de cenas
        // depende dela. Parar nas outras deixaria um cliente antigo, com
        // candidatas do fluxo anterior, sem conseguir nem rodar o briefing.
        if (next === 'cenas' && state.generation.pendingImages.length) {
          awaitingDecision.current = true;
          break;
        }
        // A mesma fase duas vezes seguidas significa que ela não avançou:
        // parar e mostrar o motivo é melhor que repetir e gastar tokens.
        repeated = next === previous ? repeated + 1 : 0;
        if (repeated >= 1) {
          setNotice(
            next === 'cenas'
              ? 'A etapa "Cenas" não produziu imagem para você decidir. Leia a resposta do agente e continue pelo chat.'
              : `A etapa "${PHASE_LABEL[next]}" não avançou. Leia a resposta do agente e continue pelo chat.`,
          );
          break;
        }
        previous = next;
        setPhase(next);
        generationError.current = null;
        // A recusa anterior vira o pedido desta tentativa. Fora da etapa de
        // cenas ela fica guardada, em vez de sumir sem ser usada.
        const retry = next === 'cenas' ? feedbackRef.current : '';
        if (retry) feedbackRef.current = '';
        await sendMessage(
          { text: retry || PHASE_MESSAGE[next] },
          { body: { tenant: tenantSlug, page: current, phase: next } },
        );
        if (generationError.current) throw generationError.current;
      }
      await refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Falha na geração.');
    } finally {
      setPhase(null);
      setGenerating(false);
    }
  }

  /**
   * Aprovar guarda a imagem; recusar apaga arquivo e registro. Só o que passa
   * por aqui entra na biblioteca, e é o operador quem decide, não a crítica.
   */
  async function decide(image: PendingImage, decision: Decision) {
    setDeciding(image.id);
    setNotice(null);
    const alt = decision.alt.trim();
    try {
      if (decision.action === 'aprovar') {
        await adminFetch(`/api/admin/${tenantSlug}/images`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            id: image.id,
            status: 'aprovada',
            ...(alt ? { alt } : {}),
          }),
        });
        if (decision.applyLogo)
          await adminFetch(`/api/admin/${tenantSlug}/settings`, {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ logoUrl: image.url }),
          });
      } else {
        try {
          await adminFetch(`/api/admin/${tenantSlug}/images`, {
            method: 'DELETE',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ id: image.id }),
          });
        } catch (error) {
          // Só a recusa por uso vira rejeição: uma falha ao apagar o arquivo
          // precisa continuar aparecendo para o operador tentar de novo.
          if (!(error instanceof AdminHttpError) || error.status !== 409)
            throw error;
          await adminFetch(`/api/admin/${tenantSlug}/images`, {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ id: image.id, status: 'rejeitada' }),
          });
          setNotice(
            `${error.message} Ela ficou rejeitada; peça ao agente para trocar a imagem do bloco.`,
          );
        }
        const pedido = decision.feedback.trim();
        if (pedido) {
          const texto =
            image.kind === 'logo'
              ? `Recusei o logo #${image.seq}: ${pedido}. Gere outra variante.`
              : `Recusei a cena #${image.seq}${image.role ? ` (${image.role})` : ''}: ${pedido}. Gere outra para a mesma vaga.`;
          // Logo não é etapa da geração: o pedido dele vai para o compositor.
          if (image.kind === 'logo') setInput(texto);
          else
            feedbackRef.current = [feedbackRef.current, texto]
              .filter(Boolean)
              .join(' ');
        }
      }
      const state = await refresh();
      if (awaitingDecision.current && !state.generation.pendingImages.length) {
        awaitingDecision.current = false;
        void generate();
      } else if (!awaitingDecision.current && feedbackRef.current) {
        // Fora da geração em etapas nada é enviado sozinho: o pedido fica no
        // compositor e o operador decide quando gastar uma nova imagem.
        setInput(feedbackRef.current);
        feedbackRef.current = '';
      }
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : 'Não foi possível atualizar a imagem.',
      );
    } finally {
      setDeciding(null);
    }
  }

  function submit(text: string) {
    if (
      (!text.trim() && attachments.length === 0) ||
      busy ||
      generating ||
      uploading
    )
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
                : 'Publicar as alterações revisadas'
            }
            className="admin-primary"
          >
            {publishing ? 'Publicando…' : 'Publicar'}
          </button>
        }
      />
      <MobileViews value={view} onChange={setView} />
      {notice ? (
        <output className="admin-notice" aria-live="polite">
          {notice}
        </output>
      ) : null}
      <div className="admin-workspace-body">
        <section className="admin-conversation" aria-label="Conversa de edição">
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-5">
            {messages.length === 0 ? (
              <div className="flex flex-col gap-3 text-sm">
                <p className="text-base font-medium">
                  O que este cliente precisa?
                </p>
                <p className="text-[var(--color-muted)]">
                  Descreva o negócio e as referências, ou continue a geração em
                  etapas: briefing e direção, cenas, composição e revisão. Cada
                  imagem aparece aqui para você aprovar, uma por vez, e no fim
                  você publica.
                </p>
              </div>
            ) : null}

            {generating ||
            (site.generation && site.generation.next !== 'pronto') ? (
              <div className="mb-4 rounded-lg border p-3 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">Geração em etapas</span>
                  {generating ? (
                    <button
                      type="button"
                      onClick={() => {
                        stopGeneration.current = true;
                        void stop();
                      }}
                      className="text-[var(--color-muted)] hover:text-[var(--color-text)]"
                    >
                      Parar
                    </button>
                  ) : awaiting ? (
                    <span className="text-[var(--color-muted)]">
                      Aguardando sua decisão
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void generate()}
                      disabled={busy}
                      className="admin-primary"
                    >
                      Continuar
                    </button>
                  )}
                </div>
                <ol className="mt-2 flex flex-col gap-1">
                  {PHASES.map((item) => {
                    const done =
                      site.generation &&
                      PHASES.indexOf(item) <
                        PHASES.indexOf(site.generation.next as Phase)
                        ? true
                        : site.generation?.next === 'pronto';
                    const active = phase === item;
                    return (
                      <li
                        key={item}
                        className={
                          active
                            ? 'text-[var(--color-text)]'
                            : done
                              ? 'text-[var(--color-muted)] line-through'
                              : 'text-[var(--color-muted)]'
                        }
                      >
                        {active ? '• ' : done ? '✓ ' : '· '}
                        {PHASE_LABEL[item]}
                      </li>
                    );
                  })}
                </ol>
                {site.generation ? (
                  <p className="mt-2 text-[var(--color-muted)]">
                    {site.generation.coveredScenes} de{' '}
                    {site.generation.targetScenes} cenas aprovadas ·{' '}
                    {site.generation.organicPages} páginas orgânicas ·{' '}
                    {site.generation.blockingErrors} erros de pre-flight
                    {awaiting ? ` · ${pending.length} aguardando decisão` : ''}
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="flex flex-col gap-5">
              {messages.map((message) => (
                <Message key={message.id} message={message} />
              ))}
              {status === 'submitted' ? (
                <p className="text-xs text-[var(--color-muted)]">Pensando</p>
              ) : null}
              {error ? (
                <p className="rounded-md border border-[var(--color-err)] px-3 py-2 text-xs text-[var(--color-err)]">
                  {chatErrorMessage(error.message)}
                </p>
              ) : null}
            </div>

            {awaiting ? (
              <SceneReview
                key={pending[0].id}
                image={pending[0]}
                queued={pending.length}
                covered={site.generation.coveredScenes}
                target={site.generation.targetScenes}
                disabled={busy || generating || Boolean(deciding)}
                onDecide={(decision) => void decide(pending[0], decision)}
              />
            ) : null}

            {!busy && site.pages.length > 0 ? (
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
                placeholder={
                  site.pages.length ? 'Peça uma mudança' : 'Descreva o site'
                }
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
                    {page
                      ? `Falando sobre /${page.slug}`
                      : 'Enter envia, Shift+Enter quebra linha'}
                  </span>
                </div>
                {busy ? (
                  <button
                    type="button"
                    onClick={() => {
                      stopGeneration.current = true;
                      void stop();
                    }}
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
                      generating
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
