'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { ChatActivity, Message, chatErrorMessage } from './chat-parts';
import { PreviewFrame } from './preview-frame';
import { GenerationPanel } from './generation-panel';
import { isRunning, useGeneration } from './use-generation';

import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  ImagePlus,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import {
  WorkspaceHeader,
  MobileViews,
  useRefreshTenant,
} from '@/components/admin/navigation';
import { ChatUsageDetails } from '@/components/admin/chat-usage';
import { GenerationDiamond } from '@/components/admin/generation-diamond';
import { PagePicker } from '@/components/admin/page-picker';
import { SegmentedControl, StatusDot } from '@/components/admin/primitives';
import { adminFetch } from '@/lib/admin/http';
import { mergeSavedMessages } from '@/lib/admin/chat-messages';
import type { SiteState } from '@/lib/admin/state';
import type { ChatMessage } from '@/lib/ai/usage';
import { creationProgress } from '@/lib/generation/progress';
import {
  EDIT_PROTOCOL,
  type EditChanges,
  type EditorMessage,
} from '@/lib/blocks/edit-protocol';
import type { FieldError } from '@/lib/blocks/fields';
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
  // Recolher a conversa deixa só uma faixa estreita com o controle de reabertura:
  // entre 1024 e 1440 px a coluna de 42% deixava o desktop apertado. Abaixo de
  // 1024 px as vistas já alternam pelos botões e este estado não se aplica.
  const [collapsed, setCollapsed] = useState(false);
  const [nonce, setNonce] = useState(0);
  const [publishing, setPublishing] = useState(false);
  const [editing, setEditing] = useState<'off' | 'on' | 'saving'>('off');
  const [editingReady, setEditingReady] = useState(false);
  const [editChanged, setEditChanged] = useState(false);
  const [editInvalid, setEditInvalid] = useState<FieldError[]>([]);
  const [editConflict, setEditConflict] = useState(false);
  const [previewChanged, setPreviewChanged] = useState(false);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const editSession = useRef({
    active: false,
    page: '',
    revision: '',
    changed: false,
    invalid: false,
    conflict: false,
    requested: false,
  });
  const collectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  const previewUpdatePending = useRef(false);
  const refreshSeq = useRef(0);
  const previewRevision = useRef(initial.previewRevision);

  const { messages, setMessages, sendMessage, status, error, stop } =
    useChat<ChatMessage>({
      messages: history,
      onData: (part) => {
        if (part.type !== 'data-preview-update') return;
        // A escrita já terminou: a prévia pode buscar o rascunho enquanto o
        // painel consulta validação e o agente prepara a resposta final.
        if (editSession.current.active) setPreviewChanged(true);
        else {
          previewUpdatePending.current = true;
          setNonce((value) => value + 1);
        }
        void refresh().catch((failure: Error) => fail(failure.message));
      },
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
    if (!editSession.current.active)
      setCurrent((slug) =>
        next.pages.some((page) => page.slug === slug)
          ? slug
          : (next.pages[0]?.slug ?? ''),
      );
    // O feed resume blocos por quantidade. A revisão detecta também mudanças
    // de texto/props com a mesma quantidade, sem recarregar a cada consulta.
    if (previewRevision.current !== next.previewRevision) {
      previewRevision.current = next.previewRevision;
      if (editSession.current.active) setPreviewChanged(true);
      else if (!previewUpdatePending.current) setNonce((value) => value + 1);
    }
    previewUpdatePending.current = false;
  }, []);

  const refresh = useCallback(async () => {
    const ticket = ++refreshSeq.current;
    try {
      const next = await adminFetch<SiteState>(
        `/api/admin/${tenantSlug}/state`,
        {
          signal: AbortSignal.timeout(20_000),
        },
      );
      // A ferramenta concluída e o laço da geração atualizam em paralelo: uma
      // resposta atrasada não pode sobrescrever a leitura mais nova.
      if (ticket !== refreshSeq.current) return next;
      applySite(next);
      return next;
    } catch (error) {
      // Sem reconciliação, a próxima leitura deve poder recarregar a prévia.
      // Uma falha antiga não interfere numa edição mais recente.
      if (ticket === refreshSeq.current) previewUpdatePending.current = false;
      throw error;
    }
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
      if (editSession.current.active) return;
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

  // Reabrir a conversa também rola ao fim: o painel recolhido perde a rolagem.
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages, status, collapsed]);

  // Conversa livre e geração disputariam as mesmas páginas: enquanto uma roda,
  // a outra espera, e a tela diz por quê.
  const locked = busy || running || editing !== 'off';
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
      reviewFindings.length > 0 ||
      site.warnings.length > 0 ||
      (page?.warnings.length ?? 0) > 0);
  const publishable =
    site.pages.length > 0 &&
    totalErrors === 0 &&
    !locked &&
    (site.tenant.dirty || site.pages.some((item) => item.dirty));

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
    if (locked || !files?.length) return;
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

  function postEditor(message: object) {
    frameRef.current?.contentWindow?.postMessage(
      { type: EDIT_PROTOCOL, ...message },
      location.origin,
    );
  }
  function beginEditing() {
    if (
      locked ||
      generating ||
      publishing ||
      uploading ||
      !page ||
      site.tenant.status !== 'published'
    )
      return;
    editSession.current = {
      active: true,
      page: current,
      revision: '',
      changed: false,
      invalid: false,
      conflict: false,
      requested: false,
    };
    setEditing('on');
    setEditingReady(false);
    setEditChanged(false);
    setEditInvalid([]);
    setEditConflict(false);
    setPreviewChanged(false);
    setNotice(null);
    setView('content');
  }
  function endEditing() {
    editSession.current.active = false;
    editSession.current.requested = false;
    setEditing('off');
    setEditingReady(false);
    setEditChanged(false);
    setEditInvalid([]);
    setEditConflict(false);
    setPreviewChanged(false);
    setNonce((value) => value + 1);
  }
  function cancelEditing() {
    if (editSession.current.requested) return;
    if (
      editSession.current.changed &&
      !window.confirm('Descartar as alterações não salvas na prévia?')
    )
      return;
    postEditor({ action: 'discard' });
    endEditing();
  }
  const saveEditing = useCallback(() => {
    const session = editSession.current;
    if (
      !session.active ||
      !session.revision ||
      !session.changed ||
      session.invalid ||
      session.conflict ||
      session.requested
    )
      return;
    session.requested = true;
    setEditing('saving');
    frameRef.current?.contentWindow?.postMessage(
      { type: EDIT_PROTOCOL, action: 'collect' },
      location.origin,
    );
    collectTimer.current = setTimeout(() => {
      session.requested = false;
      setEditing('on');
      frameRef.current?.contentWindow?.postMessage(
        { type: EDIT_PROTOCOL, action: 'resume' },
        location.origin,
      );
      setNotice({
        tone: 'err',
        text: 'A prévia não respondeu. Tente salvar novamente.',
      });
    }, 10_000);
  }, []);
  useEffect(() => {
    const receive = async (event: MessageEvent<EditorMessage>) => {
      const session = editSession.current;
      if (
        !session.active ||
        event.origin !== location.origin ||
        event.source !== frameRef.current?.contentWindow ||
        event.data?.type !== EDIT_PROTOCOL
      )
        return;
      const data = event.data;
      if (
        data.action === 'ready' &&
        data.page === session.page &&
        typeof data.revision === 'string'
      ) {
        session.revision = data.revision;
        setEditingReady(true);
      } else if (data.action === 'state' && Array.isArray(data.invalid)) {
        session.changed = data.changed === true;
        session.invalid = data.invalid.length > 0;
        setEditChanged(session.changed);
        setEditInvalid(data.invalid);
      } else if (data.action === 'save') saveEditing();
      else if (
        data.action === 'changes' &&
        session.requested &&
        data.page === session.page &&
        data.revision === session.revision &&
        Array.isArray(data.blocks)
      ) {
        if (collectTimer.current) clearTimeout(collectTimer.current);
        try {
          const payload: EditChanges = {
            page: data.page,
            revision: data.revision,
            blocks: data.blocks,
          };
          const response = await fetch(`/api/admin/${tenantSlug}/edit`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(25_000),
          });
          const result = (await response.json().catch(() => null)) as {
            error?: string;
            fields?: FieldError[];
            ok?: boolean;
          } | null;
          if (!response.ok || !result?.ok) {
            setEditing('on');
            session.requested = false;
            if (response.status === 409) {
              session.conflict = true;
              setEditConflict(true);
            }
            frameRef.current?.contentWindow?.postMessage(
              {
                type: EDIT_PROTOCOL,
                action: response.status === 422 ? 'errors' : 'resume',
                fields: result?.fields ?? [],
              },
              location.origin,
            );
            setNotice({
              tone: 'err',
              text:
                response.status === 401
                  ? 'Sua sessão expirou. Entre novamente no painel.'
                  : (result?.error ??
                    'Não foi possível salvar. Suas alterações continuam na prévia.'),
            });
            return;
          }
          session.active = false;
          session.requested = false;
          setEditing('off');
          setEditingReady(false);
          setEditChanged(false);
          setEditInvalid([]);
          setEditConflict(false);
          setPreviewChanged(false);
          setNonce((value) => value + 1);
          setNotice({
            tone: 'ok',
            text: 'Alterações salvas no rascunho. Publique para levar ao site no ar.',
          });
          await refresh().catch(() =>
            setNotice({
              tone: 'warn',
              text: 'Alterações salvas no rascunho. Não foi possível atualizar o painel; recarregue antes de publicar.',
            }),
          );
        } catch {
          session.requested = false;
          setEditing('on');
          frameRef.current?.contentWindow?.postMessage(
            { type: EDIT_PROTOCOL, action: 'resume' },
            location.origin,
          );
          setNotice({
            tone: 'err',
            text: 'Não foi possível confirmar o salvamento. Suas alterações continuam na prévia. Tente novamente.',
          });
        }
      }
    };
    const unload = (event: BeforeUnloadEvent) => {
      if (editSession.current.active && editSession.current.changed)
        event.preventDefault();
    };
    const key = (event: KeyboardEvent) => {
      if (
        editSession.current.active &&
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === 's'
      ) {
        event.preventDefault();
        saveEditing();
      }
    };
    const leave = (event: MouseEvent) => {
      if (
        !editSession.current.active ||
        !editSession.current.changed ||
        event.defaultPrevented ||
        event.button !== 0 ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const link = (event.target as Element).closest<HTMLAnchorElement>(
        'a[href]',
      );
      if (
        !link ||
        link.target === '_blank' ||
        link.hasAttribute('download') ||
        link.href === location.href ||
        (link.hash && link.pathname === location.pathname)
      )
        return;
      if (
        !window.confirm('Sair e descartar as alterações não salvas na prévia?')
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    document.addEventListener('click', leave, true);
    window.addEventListener('message', receive);
    window.addEventListener('beforeunload', unload);
    window.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('click', leave, true);
      window.removeEventListener('message', receive);
      window.removeEventListener('beforeunload', unload);
      window.removeEventListener('keydown', key);
      if (collectTimer.current) clearTimeout(collectTimer.current);
    };
  }, [tenantSlug, refresh, saveEditing]);

  // O mesmo grupo vive na barra em telas largas e no topo da coluna da prévia
  // abaixo de 1280 px; o CSS mostra uma cópia por largura.
  const previewControls = (
    <div className="admin-bar-group">
      <span className="admin-label">Prévia</span>
      <PagePicker
        pages={site.pages}
        value={current}
        onChange={setCurrent}
        disabled={editing !== 'off'}
      />
      {editing !== 'off' && (
        <span className="admin-edit-status">
          {editingReady ? `editando /${current}` : 'Abrindo edição…'}
        </span>
      )}
      <SegmentedControl
        label="Largura da prévia"
        value={device}
        options={
          [
            ['desktop', 'Desktop'],
            ['mobile', 'Celular'],
          ] as const
        }
        onChange={setDevice}
      />
      {page ? (
        <a
          href={previewUrl}
          target="_blank"
          rel="noreferrer"
          className="admin-icon-button admin-bar-open"
          title={`Abrir /${page.slug} em outra aba`}
          aria-label="Abrir a página em outra aba"
        >
          <ExternalLink size={14} aria-hidden="true" />
        </a>
      ) : null}
    </div>
  );

  const conversationToggle = (
    <button
      type="button"
      onClick={() => setCollapsed((value) => !value)}
      className="admin-primary admin-conversation-toggle"
      aria-expanded={!collapsed}
      aria-controls="admin-conversation"
      title={collapsed ? 'Mostrar a conversa' : 'Recolher a conversa'}
      aria-label={collapsed ? 'Mostrar a conversa' : 'Recolher a conversa'}
    >
      {collapsed ? (
        <PanelLeftOpen size={15} aria-hidden="true" />
      ) : (
        <PanelLeftClose size={15} aria-hidden="true" />
      )}
      {collapsed && locked ? <StatusDot tone="accent" pulse /> : null}
    </button>
  );

  return (
    <div
      className="admin-workspace"
      data-view={view}
      data-conversation={collapsed ? 'collapsed' : undefined}
    >
      <WorkspaceHeader
        tenant={site.tenant}
        conversation={conversationToggle}
        preview={previewControls}
        decision={
          <>
            {running && site.pages.length > 0 ? (
              <GenerationDiamond
                compact
                progress={creation}
                active={generating}
              />
            ) : null}
            {editing !== 'off' ? (
              <>
                <button
                  type="button"
                  className="admin-primary"
                  onClick={saveEditing}
                  disabled={
                    !editingReady ||
                    !editChanged ||
                    editInvalid.length > 0 ||
                    editConflict ||
                    editing === 'saving'
                  }
                >
                  {editing === 'saving' ? 'Salvando…' : 'Salvar'}
                </button>
                <button
                  type="button"
                  className="admin-secondary"
                  onClick={cancelEditing}
                  disabled={editing === 'saving'}
                >
                  Cancelar
                </button>
              </>
            ) : (
              <>
                {site.tenant.status === 'published' &&
                  page &&
                  !locked &&
                  !generating && (
                    <button
                      type="button"
                      className="admin-secondary"
                      disabled={publishing || uploading}
                      onClick={beginEditing}
                    >
                      Editar
                    </button>
                  )}
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
              </>
            )}
          </>
        }
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
      {editing !== 'off' &&
        (previewChanged || editConflict || editInvalid.length > 0) && (
          <output className="admin-notice" data-tone="warn">
            <span>
              {editConflict
                ? 'A página mudou. Recarregar descarta as alterações não salvas.'
                : previewChanged
                  ? 'O site mudou em outra operação. Sua edição foi preservada; o servidor verificará a versão ao salvar.'
                  : `Confira ${editInvalid.length} campo(s) destacado(s) na prévia.`}
            </span>
            {editConflict && (
              <button
                type="button"
                className="admin-secondary"
                onClick={() => {
                  if (
                    window.confirm(
                      'Recarregar a prévia e descartar suas alterações não salvas?',
                    )
                  ) {
                    endEditing();
                    void refresh();
                  }
                }}
              >
                Recarregar a prévia
              </button>
            )}
          </output>
        )}
      <div className="admin-workspace-body">
        <section
          id="admin-conversation"
          className="admin-conversation"
          aria-label="Conversa de edição"
        >
          <GenerationPanel
            run={generation.run}
            events={generation.events}
            state={site}
            clockOffsetMs={generation.clockOffsetMs}
            error={generation.error}
            busy={busy || editing !== 'off'}
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

          {busy ? <ChatActivity messages={messages} /> : null}
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
                disabled={running || editing !== 'off'}
                placeholder={
                  editing !== 'off'
                    ? 'Salve ou cancele a edição na prévia para usar a conversa'
                    : running
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
                    {` · ${messages.length} ${messages.length === 1 ? 'turno' : 'turnos'}`}
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
                      locked
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

        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          className="admin-conversation-edge-toggle"
          aria-controls="admin-conversation"
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expandir a conversa' : 'Recolher a conversa'}
          title={collapsed ? 'Expandir a conversa' : 'Recolher a conversa'}
        >
          {collapsed ? (
            <ChevronRight size={16} aria-hidden="true" />
          ) : (
            <ChevronLeft size={16} aria-hidden="true" />
          )}
        </button>

        <section className="admin-content" aria-label="Prévia e revisão">
          {previewControls}
          {busy ? <ChatActivity messages={messages} compact /> : null}

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
                  : `Confira antes de publicar${reviewSuggestions ? ` · ${reviewSuggestions} sugestão(ões)` : ''}`}
              </summary>
              <p className="mt-2 text-[var(--color-muted)]">
                Confira a prévia e as imagens antes de publicar. Os ajustes
                feitos pelo chat são salvos no rascunho.
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
                          disabled={editing !== 'off'}
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
                        disabled={editing !== 'off'}
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
              <PreviewFrame
                frameRef={frameRef}
                key={`${current}-${editing === 'off' ? 'preview' : 'edit'}`}
                src={`${previewUrl}${editing !== 'off' ? '&edit=1' : ''}`}
                device={device}
              />
            ) : locked || generating ? (
              <GenerationDiamond
                progress={creation}
                active={generating}
                message="A prévia aparece quando a composição gravar a primeira página."
              />
            ) : (
              <div className="admin-preview-empty">
                Nenhuma página em rascunho ainda.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
