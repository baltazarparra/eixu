'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, getToolName, isToolUIPart } from 'ai';
import { ChatActivity, Message, chatErrorMessage } from './chat-parts';
import { GenerationPanel } from './generation-panel';
import { isRunning, useGeneration } from './use-generation';

import { ImagePlus } from 'lucide-react';
import {
  WorkspaceHeader,
  MobileViews,
  useRefreshTenant,
} from '@/components/admin/navigation';
import { ChatUsageDetails } from '@/components/admin/chat-usage';
import { GenerationDiamond } from '@/components/admin/generation-diamond';
import { adminFetch } from '@/lib/admin/http';
import { mergeSavedMessages } from '@/lib/admin/chat-messages';
import type { SiteState } from '@/lib/admin/state';
import type { ChatMessage } from '@/lib/ai/usage';
import { creationProgress } from '@/lib/generation/progress';
import type { PublishResult } from '@/lib/sites/publish';

type Props = {
  initial: SiteState;
  history: ChatMessage[];
  /** Último id gravado: o painel busca daí em diante o que a geração escrever. */
  lastMessageId: number;
  imageRequest?: string;
};

/**
 * Caminhos recusados e o primeiro motivo, sem o prefixo técnico da regra. O
 * aviso dizia só "Bloqueado em /, /": uma entrada por regra e nenhum porquê.
 */
function publishBlockedNotice(blocked: PublishResult['blocked']): string {
  const pages = blocked.map((item) => item.page).join(', ');
  const reason = blocked[0].preflight
    .split('\n')[0]
    .replace(/^ERRO \[[^\]]+\] /, '');
  return `Publicação bloqueada em ${pages}: ${reason} Confira as pendências ao lado da prévia ou peça ao agente para corrigir.`;
}

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
  const refreshTenant = useRefreshTenant();
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
  const { start: startRun, ready, everRan } = generation;
  const runPhase = running ? (generation.run?.phase ?? null) : null;
  // Só a geração move o diamante. Um turno livre do chat também trava a
  // prévia, mas anunciar etapa em execução ali contradiz o painel ao lado,
  // que nesse momento mostra a execução como parada.
  const generating = running || generation.starting;
  // O diamante da prévia lê o mesmo estado que o painel: etapas feitas e
  // unidades medidas, nunca uma porcentagem estimada pelo tempo.
  const creation = useMemo(
    () => creationProgress(site, runPhase, generation.events),
    [site, runPhase, generation.events],
  );

  const startGeneration = useCallback(
    async (focus = true) => {
      setNotice(null);
      if (focus) setView('chat');
      try {
        await startRun();
      } catch (failure) {
        fail(failure instanceof Error ? failure.message : 'Falha na geração.');
      }
    },
    [startRun, fail],
  );

  /**
   * Cliente novo não precisa pedir a geração: chegou aqui pelo cadastro, e o
   * botão "Gerar site" era só um passo a mais entre o operador e o resultado.
   * A condição é estreita de propósito — nenhuma execução anterior, nenhuma
   * página e a primeira etapa pendente —, porque retomar sozinho um rascunho
   * antigo gastaria geração paga que ninguém pediu.
   */
  const autoStarted = useRef(false);
  useEffect(() => {
    if (
      autoStarted.current ||
      !ready ||
      everRan !== false ||
      running ||
      busy ||
      site.generation.next !== 'briefing' ||
      site.pages.length > 0
    )
      return;
    autoStarted.current = true;
    void startGeneration(false);
  }, [
    ready,
    everRan,
    running,
    busy,
    site.generation.next,
    site.pages.length,
    startGeneration,
  ]);

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
  // Durante um deploy, o cliente novo pode receber por instantes o payload
  // anterior do endpoint, que ainda não tinha o relatório detalhado.
  const reviewState = site.review ?? {
    current: false,
    complete: false,
    findings: [],
  };
  const reviewFindings = reviewState.findings.filter(
    (finding) => finding.status !== 'resolved',
  );
  const reviewSuggestions = reviewFindings.filter(
    (finding) => finding.level !== 'error',
  ).length;
  // Pendência não significa execução ativa: pausas, falhas e edições manuais
  // precisam mostrar os motivos que ainda bloqueiam a publicação.
  const showReview =
    site.pages.length > 0 &&
    !running &&
    (totalErrors > 0 ||
      reviewState.current ||
      reviewFindings.length > 0 ||
      site.warnings.length > 0 ||
      (page?.warnings.length ?? 0) > 0);
  const publishable =
    site.pages.length > 0 &&
    totalErrors === 0 &&
    !locked &&
    (site.tenant.dirty || site.pages.some((item) => item.dirty));
  // Publicação manual vale pelo pre-flight; a revisão visual é outra garantia.
  const reviewPending =
    site.pages.length > 0 && !site.generation.reviewComplete;

  async function publishAll() {
    setPublishing(true);
    setNotice(null);
    try {
      const result = await adminFetch<PublishResult>(
        `/api/admin/${tenantSlug}/publish`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{}',
        },
      );
      setNotice(
        result.blocked.length
          ? { tone: 'warn', text: publishBlockedNotice(result.blocked) }
          : { tone: 'ok', text: `Publicado. ${result.url}` },
      );
      await refresh();
      if (result.published.length) refreshTenant?.();
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
      <WorkspaceHeader
        tenant={site.tenant}
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
      <div className="admin-workspace-body">
        <section className="admin-conversation" aria-label="Conversa de edição">
          <div className="admin-conversation-heading">
            <span className="admin-label">Conversa com o agente</span>
            <span>{messages.length} turnos</span>
          </div>
          <GenerationPanel
            run={generation.run}
            events={generation.events}
            state={site}
            clockOffsetMs={generation.clockOffsetMs}
            error={generation.error}
            busy={busy}
            starting={generation.starting}
            onStart={() => void startGeneration()}
            onStop={() => void stopGeneration()}
          />
          <div ref={scrollRef} className="admin-thread">
            {!messages.length && locked ? (
              <p className="admin-thread-empty">
                O agente responde aqui ao terminar cada etapa.
              </p>
            ) : null}
            <div className="admin-thread-list">
              {messages.map((message) => (
                <Message key={message.id} message={message} />
              ))}
              {busy ? <ChatActivity messages={messages} /> : null}
              {error ? (
                <p className="admin-thread-error">
                  {chatErrorMessage(error.message)}
                </p>
              ) : null}
            </div>

            {!locked && site.pages.length > 0 ? (
              <div className="admin-suggestions">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => setInput(suggestion)}
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
            className="admin-composer"
          >
            <div
              className="admin-composer-box"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                void attach(event.dataTransfer.files);
              }}
            >
              {attachments.length ? (
                <ul className="admin-composer-files">
                  {attachments.map((item) => (
                    <li key={item.url}>
                      {/* Miniatura de arquivo recém-enviado ao Blob; o otimizador não agrega nada aqui. */}
                      {/* oxlint-disable-next-line next/no-img-element */}
                      <img src={item.url} alt={item.name} />
                      <button
                        type="button"
                        aria-label={`Remover ${item.name}`}
                        onClick={() =>
                          setAttachments((list) =>
                            list.filter((entry) => entry.url !== item.url),
                          )
                        }
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
                    ? 'A conversa reabre quando a geração terminar'
                    : site.pages.length
                      ? 'Peça uma mudança'
                      : 'Descreva o site'
                }
                className="admin-composer-input"
              />
              <div className="admin-composer-foot">
                <div className="admin-composer-tools">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading || locked}
                    className="admin-composer-attach"
                  >
                    <ImagePlus size={14} aria-hidden="true" />
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
                  <span className="admin-composer-hint">
                    {running
                      ? 'Roda no servidor'
                      : page
                        ? `Falando sobre /${page.slug}`
                        : 'Enter envia, Shift+Enter quebra linha'}
                  </span>
                </div>
                {busy ? (
                  <button
                    type="button"
                    onClick={() => void stop()}
                    className="admin-secondary admin-composer-stop"
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
                    className="admin-composer-send"
                  >
                    Enviar
                  </button>
                )}
              </div>
            </div>
          </form>
          <ChatUsageDetails messages={messages} events={generation.events} />
        </section>

        <section className="admin-content" aria-label="Prévia e revisão">
          <div className="admin-preview-controls">
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
            <fieldset
              className="admin-segmented"
              aria-label="Dispositivo da prévia"
            >
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
            </fieldset>
            {running && site.pages.length > 0 ? (
              <GenerationDiamond compact progress={creation} active={generating} />
            ) : null}
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
                  : reviewState.complete
                    ? `Pronto para sua conferência${reviewSuggestions ? ` · ${reviewSuggestions} sugestão(ões)` : ''}`
                    : !reviewState.current
                      ? 'Revisão visual do rascunho atual pendente'
                      : site.pages.length
                        ? site.pages.some((item) => item.dirty)
                          ? 'Rascunho pronto para sua revisão'
                          : 'Páginas publicadas e atualizadas'
                        : 'Crie as páginas para começar'}
              </summary>
              <p className="mt-2 text-[var(--color-muted)]">
                {reviewState.complete
                  ? 'Desktop e celular têm evidência da versão atual. Sugestões estéticas não bloqueiam a publicação.'
                  : 'Confira a prévia e as imagens antes de publicar. Os ajustes feitos pelo chat são salvos no rascunho.'}
              </p>
              <ul>
                {reviewFindings.map((finding) => {
                  const slug = finding.page.replace(/^\//, '');
                  const canOpen = site.pages.some((item) => item.slug === slug);
                  return (
                    <li
                      key={finding.id}
                      className={
                        finding.level === 'error'
                          ? 'text-[var(--color-err)]'
                          : 'text-[var(--color-muted)]'
                      }
                    >
                      {canOpen ? (
                        <button
                          type="button"
                          onClick={() => setCurrent(slug)}
                          className="mr-2 underline"
                        >
                          {finding.page}
                        </button>
                      ) : (
                        <strong className="mr-2">{finding.page}</strong>
                      )}
                      <span>{finding.correction}</span>
                      {finding.evidence ? (
                        <small className="mt-1 block">
                          Evidência: {finding.evidence}
                        </small>
                      ) : null}
                    </li>
                  );
                })}
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
          <div className="admin-preview-canvas">
            {site.pages.length > 0 ? (
              <iframe
                key={`${current}-${nonce}`}
                src={previewUrl}
                title="Preview do site"
                className="admin-preview-frame"
                data-device={device}
              />
            ) : (
              locked || generating ? (
                <GenerationDiamond
                  progress={creation}
                  active={generating}
                  message="A prévia aparece quando a composição gravar a primeira página."
                />
              ) : (
                <div className="admin-preview-empty">
                  Nenhuma página em rascunho ainda.
                </div>
              )
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
