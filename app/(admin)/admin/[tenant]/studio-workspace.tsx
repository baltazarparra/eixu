'use client';

import { useChat } from '@ai-sdk/react';
import { WorkflowChatTransport } from '@ai-sdk/workflow/client';
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  ImagePlus,
  Loader2,
  Monitor,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  RotateCcw,
  Save,
  Smartphone,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  WorkspaceHeader,
  useRefreshTenant,
} from '@/components/admin/navigation';
import { useCompactLayout } from '@/components/admin/use-compact-layout';
import { adminFetch, AdminHttpError } from '@/lib/admin/http';
import {
  studioOperationErrorMessage,
  type StudioOperation,
} from '@/lib/admin/studio-feedback';
import type { StudioEditorField } from '@/lib/studio/editor';
import type { StudioMessage, StudioEditorState } from '@/lib/studio/types';
import { ChatActivity, Message, chatErrorMessage } from './chat-parts';

type StudioView = 'chat' | 'preview' | 'content';
type ProjectStatus =
  | 'draft'
  | 'building'
  | 'ready'
  | 'published'
  | 'archived'
  | 'failed';
type ReleaseStatus =
  | 'preparing'
  | 'validating'
  | 'ready'
  | 'active'
  | 'failed'
  | 'rolled_back';

type ActiveRun = {
  id: string;
  workflowRunId: string | null;
  status: 'queued' | 'running' | 'cancel_requested';
} | null;

type StudioImage = {
  seq: number;
  url: string;
  alt: string | null;
};

type Props = {
  tenant: { slug: string; name: string; status: string };
  initialMessages: StudioMessage[];
  initialEditor: StudioEditorState | null;
  initialRun: ActiveRun;
  initialProject: {
    status: ProjectStatus;
    canonicalHost: string;
    draftCodeRevision: string | null;
    dirty: boolean;
  } | null;
  initialRelease: {
    id: string;
    status: ReleaseStatus;
    url: string | null;
    error: string | null;
  } | null;
  rollbackCandidate: { id: string; activatedAt: string | null } | null;
  images: StudioImage[];
  imageRequest?: string;
  basePath?: '/admin' | '/studio';
  autoStartPrompt?: string;
  autoPublishFirst?: boolean;
};

type PreviewResponse = {
  url: string;
  codeRevision: string | null;
  status: ProjectStatus;
  dirty: boolean;
};

type ContentResponse = { editor: StudioEditorState | null };
type ImagesResponse = { images: StudioImage[] };
type PublishResponse = {
  release: {
    id: string;
    status: ReleaseStatus;
    url: string | null;
    error: string | null;
  } | null;
  dirty: boolean;
  rollbackCandidate: { id: string; activatedAt: string | null } | null;
};

const SUGGESTIONS = [
  'Crie o site completo usando os dados, o logo e as referências cadastradas.',
  'Analise o material do cliente e proponha uma direção de arte antes de construir.',
  'Refine a experiência mobile, o ritmo de leitura e as animações do projeto.',
];

function fieldInputId(field: StudioEditorField): string {
  return `studio-field-${field.key.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
}

export function StudioWorkspace({
  tenant,
  initialMessages,
  initialEditor,
  initialRun,
  initialProject,
  initialRelease,
  rollbackCandidate: initialRollbackCandidate,
  images: initialImages,
  imageRequest = '',
  basePath = '/admin',
  autoStartPrompt = '',
  autoPublishFirst = false,
}: Props) {
  const refreshTenant = useRefreshTenant();
  const compact = useCompactLayout();
  const [view, setView] = useState<StudioView>('chat');
  const [rightView, setRightView] = useState<'preview' | 'content'>('preview');
  const [collapsed, setCollapsed] = useState(false);
  const [deviceChoice, setDevice] = useState<'desktop' | 'mobile' | null>(null);
  const device = deviceChoice ?? (compact ? 'mobile' : 'desktop');
  const [input, setInput] = useState(imageRequest);
  const [attachments, setAttachments] = useState<
    { url: string; name: string; type: string }[]
  >([]);
  const [uploading, setUploading] = useState(false);
  const [activeRun, setActiveRun] = useState<ActiveRun>(initialRun);
  const [projectStatus, setProjectStatus] = useState<ProjectStatus>(
    initialProject?.status ?? 'draft',
  );
  const [hasProject, setHasProject] = useState(Boolean(initialProject));
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewProblem, setPreviewProblem] = useState<string | null>(
    initialProject?.status === 'failed'
      ? 'A última geração não foi concluída. Peça ao agente para continuar.'
      : null,
  );
  const [previewNonce, setPreviewNonce] = useState(0);
  const [editor, setEditor] = useState<StudioEditorState | null>(initialEditor);
  const [editorValues, setEditorValues] = useState<Record<string, string>>(
    initialEditor?.values ?? {},
  );
  const [images, setImages] = useState(initialImages);
  const [editorErrors, setEditorErrors] = useState<Record<string, string>>({});
  const [savingContent, setSavingContent] = useState(false);
  const [dirty, setDirty] = useState(initialProject?.dirty ?? false);
  const [releaseId, setReleaseId] = useState(initialRelease?.id ?? null);
  const [rollbackCandidate, setRollbackCandidate] = useState(
    initialRollbackCandidate,
  );
  const [publishing, setPublishing] = useState(
    autoPublishFirst ||
      (initialRelease
        ? ['preparing', 'validating', 'ready'].includes(initialRelease.status)
        : false),
  );
  const [notice, setNotice] = useState<{
    tone: 'info' | 'ok' | 'warn' | 'err';
    text: string;
    source?: StudioOperation;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const autoStartSent = useRef(false);
  const automaticPublicationPending = useRef(false);
  const previewRequest = useRef(0);

  const fail = useCallback((message: string, source: StudioOperation) => {
    setNotice({
      tone: 'err',
      text: studioOperationErrorMessage(message, source),
      source,
    });
  }, []);

  const loadEditor = useCallback(async () => {
    const response = await adminFetch<ContentResponse>(
      `/api/admin/${tenant.slug}/studio/content`,
    );
    setEditor(response.editor);
    setEditorValues(response.editor?.values ?? {});
    setEditorErrors({});
  }, [tenant.slug]);

  const loadImages = useCallback(async () => {
    const response = await adminFetch<ImagesResponse>(
      `/api/admin/${tenant.slug}/images`,
    );
    setImages(
      response.images.map((image) => ({
        seq: image.seq,
        url: image.url,
        alt: image.alt,
      })),
    );
  }, [tenant.slug]);

  const loadPreview = useCallback(
    async (reload = false, quiet = false) => {
      if (!hasProject && !reload) return;
      const requestId = ++previewRequest.current;
      setPreviewLoading(true);
      try {
        let response: PreviewResponse | null = null;
        const attempts = reload ? 20 : 1;
        for (let attempt = 0; attempt < attempts; attempt += 1) {
          if (requestId !== previewRequest.current) return;
          try {
            response = await adminFetch<PreviewResponse>(
              `/api/admin/${tenant.slug}/studio/preview`,
              { method: 'POST' },
            );
            break;
          } catch (error) {
            if (
              !(error instanceof AdminHttpError) ||
              error.status !== 409 ||
              attempt === attempts - 1
            )
              throw error;
            await new Promise((resolve) => window.setTimeout(resolve, 750));
          }
        }
        if (requestId !== previewRequest.current) return;
        if (!response) throw new Error('A prévia ainda não está disponível.');
        setPreviewUrl(response.url);
        setPreviewProblem(null);
        setNotice((current) =>
          current?.source === 'preview' ? null : current,
        );
        setProjectStatus(response.status);
        setDirty(response.dirty);
        if (reload) setPreviewNonce((value) => value + 1);
      } catch (error) {
        if (requestId !== previewRequest.current) return;
        setPreviewUrl(null);
        setPreviewProblem(
          error instanceof AdminHttpError && error.status === 409
            ? 'A prévia está pausada enquanto o projeto é validado.'
            : 'A prévia ainda não está disponível. Ela volta quando o projeto puder ser exibido.',
        );
        if (!quiet)
          fail(
            error instanceof Error ? error.message : 'Falha ao abrir a prévia.',
            'preview',
          );
      } finally {
        if (requestId === previewRequest.current) setPreviewLoading(false);
      }
    },
    [fail, hasProject, tenant.slug],
  );

  const finishTurn = useCallback(
    ({
      isAbort,
      isDisconnect,
      isError,
    }: {
      isAbort: boolean;
      isDisconnect: boolean;
      isError: boolean;
    }) => {
      if (!isDisconnect) setActiveRun(null);
      setHasProject(true);
      const succeeded = !isAbort && !isDisconnect && !isError;
      if (isAbort || isError) {
        // Uma consulta de prévia iniciada antes da falha não pode recolocar
        // no iframe o servidor que o gate acabou de parar.
        previewRequest.current += 1;
        setPreviewUrl(null);
        setPreviewLoading(false);
        setPreviewProblem(
          isAbort
            ? 'A geração foi interrompida. Envie uma mensagem para continuar.'
            : 'A geração não passou na validação. Peça ao agente para corrigir e continuar.',
        );
      }
      if (!succeeded && automaticPublicationPending.current) {
        automaticPublicationPending.current = false;
        setPublishing(false);
      }
      const updates = succeeded
        ? [loadPreview(true), loadEditor(), loadImages()]
        : [];
      void Promise.allSettled(updates).then(() => {
        refreshTenant?.();
      });
    },
    [loadEditor, loadImages, loadPreview, refreshTenant],
  );

  const transport = useMemo(() => {
    return new WorkflowChatTransport<StudioMessage>({
      api: '/api/chat',
      initialStartIndex: 0,
      prepareSendMessagesRequest: ({ messages }) => ({
        body: {
          tenant: tenant.slug,
          messages: messages.slice(-1),
          ...(autoPublishFirst ? { autoPublish: true } : {}),
        },
        headers: { 'content-type': 'application/json' },
      }),
      onChatSendMessage: (response) => {
        const workflowRunId = response.headers.get('x-workflow-run-id');
        const studioRunId = response.headers.get('x-studio-run-id');
        if (studioRunId) {
          setHasProject(true);
          setActiveRun({
            id: studioRunId,
            workflowRunId,
            status: 'running',
          });
        }
      },
    });
  }, [autoPublishFirst, tenant.slug]);

  const { messages, sendMessage, status, error, stop } = useChat<StudioMessage>(
    {
      id: initialRun?.workflowRunId ?? `studio-${tenant.slug}`,
      messages: initialMessages,
      transport,
      resume: Boolean(initialRun?.workflowRunId),
      onFinish: finishTurn,
    },
  );
  const busy =
    status === 'submitted' ||
    status === 'streaming' ||
    activeRun?.status === 'queued' ||
    activeRun?.status === 'running' ||
    activeRun?.status === 'cancel_requested';
  const writeBlocked = projectStatus === 'archived';

  useEffect(() => {
    if (
      !autoStartPrompt ||
      autoStartSent.current ||
      initialMessages.length > 0 ||
      initialRun ||
      busy ||
      writeBlocked
    )
      return;
    const timer = window.setTimeout(() => {
      if (autoStartSent.current) return;
      autoStartSent.current = true;
      automaticPublicationPending.current = autoPublishFirst;
      setNotice({
        tone: 'info',
        text: autoPublishFirst
          ? 'Criação iniciada. A primeira versão será publicada automaticamente depois dos gates.'
          : 'Criação iniciada com os dados do projeto.',
      });
      void sendMessage({ text: autoStartPrompt });
      window.history.replaceState(null, '', `${basePath}/${tenant.slug}`);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [
    autoPublishFirst,
    autoStartPrompt,
    basePath,
    busy,
    initialMessages.length,
    initialRun,
    sendMessage,
    tenant.slug,
    writeBlocked,
  ]);

  useEffect(() => {
    if (busy || !hasProject || !initialProject?.draftCodeRevision) return;
    const timer = window.setTimeout(() => void loadPreview(), 0);
    return () => window.clearTimeout(timer);
  }, [busy, hasProject, initialProject?.draftCodeRevision, loadPreview]);

  useEffect(() => {
    if (!busy || !hasProject || writeBlocked) return;
    let inFlight = false;
    const tick = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        await loadPreview(false, true);
      } finally {
        inFlight = false;
      }
    };
    const first = window.setTimeout(() => void tick(), 700);
    const interval = window.setInterval(() => void tick(), 4_000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(interval);
    };
  }, [busy, hasProject, loadPreview, writeBlocked]);

  useEffect(() => {
    const thread = threadRef.current;
    if (thread) thread.scrollTop = thread.scrollHeight;
  }, [messages, busy]);

  useEffect(() => {
    if (!publishing) return;
    let cancelled = false;
    let timer: number | undefined;
    let emptyPolls = 0;
    const poll = async () => {
      try {
        const result = await adminFetch<PublishResponse>(
          releaseId
            ? `/api/admin/${tenant.slug}/studio/publish?release=${encodeURIComponent(releaseId)}`
            : `/api/admin/${tenant.slug}/studio/publish`,
        );
        if (cancelled) return;
        setDirty(result.dirty);
        setRollbackCandidate(result.rollbackCandidate);
        const release = result.release;
        if (!release) {
          emptyPolls += 1;
          if (emptyPolls >= 300) {
            setPublishing(false);
            automaticPublicationPending.current = false;
            fail(
              'A publicação automática não foi iniciada após a criação.',
              'publish',
            );
            return;
          }
          timer = window.setTimeout(poll, 3_000);
          return;
        }
        if (!releaseId) setReleaseId(release.id);
        if (release?.status === 'active') {
          setPublishing(false);
          automaticPublicationPending.current = false;
          setProjectStatus('published');
          setNotice({
            tone: 'ok',
            text: `Publicado em ${release.url ?? `https://${tenant.slug}.eixu.com.br`}`,
          });
          refreshTenant?.();
          return;
        }
        if (release?.status === 'failed') {
          setPublishing(false);
          automaticPublicationPending.current = false;
          fail(release.error ?? 'A publicação falhou.', 'publish');
          return;
        }
        timer = window.setTimeout(poll, 3_000);
      } catch (failure) {
        if (cancelled) return;
        setPublishing(false);
        fail(
          failure instanceof Error
            ? failure.message
            : 'Falha ao acompanhar a publicação.',
          'publish',
        );
      }
    };
    timer = window.setTimeout(poll, 1_000);
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [fail, publishing, refreshTenant, releaseId, tenant.slug]);

  async function attach(files: FileList | File[] | null) {
    if (!files?.length || busy || writeBlocked) return;
    setUploading(true);
    setNotice(null);
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) continue;
        const form = new FormData();
        form.append('file', file);
        const response = await fetch(`/api/admin/${tenant.slug}/images`, {
          method: 'POST',
          body: form,
        });
        const result = (await response.json().catch(() => null)) as {
          image?: StudioImage;
          error?: string;
        } | null;
        if (!response.ok || !result?.image?.url)
          throw new Error(result?.error ?? 'Falha no upload.');
        const image = result.image;
        setImages((current) => [
          image,
          ...current.filter((item) => item.url !== image.url),
        ]);
        setAttachments((current) => [
          ...current,
          { url: image.url, name: file.name, type: 'image/webp' },
        ]);
      }
    } catch (failure) {
      fail(
        failure instanceof Error ? failure.message : 'Falha no upload.',
        'upload',
      );
    } finally {
      setUploading(false);
    }
  }

  function submit() {
    const text = input.trim();
    if ((!text && !attachments.length) || busy || writeBlocked || uploading)
      return;
    const files = attachments.map((item) => ({
      type: 'file' as const,
      mediaType: item.type,
      url: item.url,
      filename: item.name,
    }));
    setNotice(null);
    setPreviewProblem(null);
    void sendMessage({
      text: text || 'Analise e use a imagem anexada no projeto.',
      files,
    });
    setInput('');
    setAttachments([]);
  }

  async function cancelRun() {
    void stop();
    if (!activeRun?.id) return;
    try {
      await adminFetch(`/api/chat/${activeRun.id}/cancel`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tenant: tenant.slug }),
      });
      setActiveRun(null);
      setNotice({ tone: 'info', text: 'Turno cancelado.' });
    } catch (failure) {
      fail(
        failure instanceof Error ? failure.message : 'Falha ao cancelar.',
        'cancel',
      );
    }
  }

  async function saveContent() {
    if (!editor || savingContent || busy || writeBlocked) return;
    setSavingContent(true);
    setEditorErrors({});
    setNotice(null);
    try {
      const response = await adminFetch<ContentResponse>(
        `/api/admin/${tenant.slug}/studio/content`,
        {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            expectedRevision: editor.revision,
            contractHash: editor.contractHash,
            values: editorValues,
          }),
        },
      );
      setEditor(response.editor);
      setEditorValues(response.editor?.values ?? {});
      setDirty(true);
      setNotice({ tone: 'ok', text: 'Conteúdo salvo e aplicado à prévia.' });
      await loadPreview(true);
    } catch (failure) {
      if (failure instanceof AdminHttpError && failure.fields)
        setEditorErrors(failure.fields);
      fail(
        failure instanceof Error ? failure.message : 'Falha ao salvar.',
        'content',
      );
      if (failure instanceof AdminHttpError && failure.status === 409)
        void loadEditor();
    } finally {
      setSavingContent(false);
    }
  }

  async function publish() {
    if (
      busy ||
      publishing ||
      !dirty ||
      (projectStatus !== 'ready' && projectStatus !== 'published')
    )
      return;
    setPublishing(true);
    setNotice(null);
    try {
      const result = await adminFetch<PublishResponse>(
        `/api/admin/${tenant.slug}/studio/publish`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{}',
        },
      );
      if (!result.release)
        throw new Error('A publicação não retornou um recibo.');
      setReleaseId(result.release.id);
      setDirty(result.dirty);
      setRollbackCandidate(result.rollbackCandidate);
      setNotice({
        tone: 'info',
        text: 'Publicação iniciada. O build e os smokes continuam no servidor.',
      });
    } catch (failure) {
      setPublishing(false);
      fail(
        failure instanceof Error ? failure.message : 'Falha ao publicar.',
        'publish',
      );
    }
  }

  async function rollback() {
    if (busy || publishing || writeBlocked || !rollbackCandidate) return;
    setPublishing(true);
    setNotice(null);
    try {
      const result = await adminFetch<PublishResponse>(
        `/api/admin/${tenant.slug}/studio/publish`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ rollbackReleaseId: rollbackCandidate.id }),
        },
      );
      if (!result.release)
        throw new Error('O rollback não retornou um recibo.');
      setReleaseId(result.release.id);
      setNotice({
        tone: 'info',
        text: 'Rollback iniciado. A versão anterior passará pelos mesmos gates e smokes.',
      });
    } catch (failure) {
      setPublishing(false);
      fail(
        failure instanceof Error ? failure.message : 'Falha no rollback.',
        'rollback',
      );
    }
  }

  const previewControls = (
    <div className="admin-bar-group" aria-label="Controles da prévia">
      <span className="admin-label">Prévia</span>
      <span className="admin-segmented">
        <button
          type="button"
          aria-pressed={device === 'desktop'}
          onClick={() => setDevice('desktop')}
          title="Desktop"
        >
          <Monitor size={14} aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-pressed={device === 'mobile'}
          onClick={() => setDevice('mobile')}
          title="Celular"
        >
          <Smartphone size={14} aria-hidden="true" />
        </button>
      </span>
      <button
        type="button"
        className="admin-icon-button"
        onClick={() => void loadPreview(true)}
        disabled={!hasProject || previewLoading || busy}
        aria-label="Recarregar prévia"
        title="Recarregar prévia"
      >
        <RefreshCw size={14} aria-hidden="true" />
      </button>
      {previewUrl ? (
        <a
          className="admin-icon-button"
          href={previewUrl}
          target="_blank"
          rel="noreferrer"
          aria-label="Abrir prévia em outra aba"
          title="Abrir em outra aba"
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
    </button>
  );

  return (
    <div
      className="admin-workspace admin-studio-workspace"
      data-view={view}
      data-conversation={collapsed ? 'collapsed' : undefined}
    >
      <WorkspaceHeader
        tenant={{
          ...tenant,
          status:
            projectStatus === 'archived'
              ? 'archived'
              : projectStatus === 'published'
                ? 'published'
                : 'draft',
        }}
        conversation={conversationToggle}
        preview={previewControls}
        decision={
          <div className="admin-bar-group">
            {rollbackCandidate ? (
              <button
                type="button"
                className="admin-secondary"
                disabled={busy || publishing || writeBlocked}
                onClick={() => void rollback()}
                title="Republicar a versão anterior com os mesmos gates"
              >
                <RotateCcw size={14} aria-hidden="true" />
                Voltar versão
              </button>
            ) : null}
            <button
              type="button"
              className="admin-primary"
              disabled={
                busy ||
                publishing ||
                !dirty ||
                (projectStatus !== 'ready' && projectStatus !== 'published')
              }
              onClick={() => void publish()}
              title={
                dirty &&
                (projectStatus === 'ready' || projectStatus === 'published')
                  ? 'Publicar a revisão validada'
                  : dirty
                    ? 'Conclua e valide o projeto antes de publicar'
                    : 'O site publicado já corresponde ao rascunho'
              }
            >
              {publishing ? 'Publicando…' : 'Publicar'}
            </button>
          </div>
        }
      />

      {notice ? (
        <output className="admin-notice" data-tone={notice.tone}>
          <span>{notice.text}</span>
          <button
            type="button"
            aria-label="Fechar aviso"
            onClick={() => setNotice(null)}
          >
            ×
          </button>
        </output>
      ) : null}

      <fieldset className="admin-mobile-views admin-studio-mobile-views">
        <legend className="sr-only">Área de trabalho</legend>
        {(
          [
            ['chat', 'Conversa'],
            ['preview', 'Prévia'],
            ['content', 'Conteúdo'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={view === value}
            onClick={() => setView(value)}
          >
            {label}
          </button>
        ))}
      </fieldset>

      <div className="admin-workspace-body">
        <section
          id="admin-conversation"
          className="admin-conversation"
          aria-label="Conversa do projeto"
        >
          <div className="admin-thread-wrap">
            <div className="admin-thread" ref={threadRef}>
              {messages.length ? (
                <div className="admin-thread-list">
                  {messages.map((message) => (
                    <Message key={message.id} message={message} />
                  ))}
                </div>
              ) : (
                <div className="admin-studio-intro">
                  <span>Estúdio EIXU</span>
                  <h1>O que vamos criar?</h1>
                  <p>
                    Descreva o projeto. O agente começa pelos dados e pela marca
                    do cliente, verifica as fontes e constrói o site completo.
                  </p>
                  <div className="admin-suggestions">
                    {SUGGESTIONS.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        disabled={writeBlocked}
                        onClick={() => {
                          setInput(suggestion);
                          inputRef.current?.focus();
                        }}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {error ? (
                <p className="admin-thread-error">
                  {chatErrorMessage(error.message)}
                </p>
              ) : null}
            </div>
          </div>
          {busy ? <ChatActivity messages={messages} /> : null}
          <form
            className="admin-composer"
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <div className="admin-composer-box">
              {attachments.length ? (
                <ul className="admin-composer-files">
                  {attachments.map((item) => (
                    <li key={item.url}>
                      {/* oxlint-disable-next-line next/no-img-element */}
                      <img src={item.url} alt={item.name} />
                      <button
                        type="button"
                        aria-label={`Remover ${item.name}`}
                        onClick={() =>
                          setAttachments((current) =>
                            current.filter((entry) => entry.url !== item.url),
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
                ref={inputRef}
                className="admin-composer-input"
                rows={2}
                value={input}
                disabled={busy || writeBlocked}
                placeholder={
                  busy
                    ? 'O agente está trabalhando neste pedido'
                    : writeBlocked
                      ? 'Reative o cliente para editar o projeto'
                      : 'Descreva o site ou peça um ajuste'
                }
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
                    !event.nativeEvent.isComposing &&
                    !window.matchMedia('(pointer: coarse)').matches
                  ) {
                    event.preventDefault();
                    submit();
                  }
                }}
              />
              <div className="admin-composer-foot">
                <div className="admin-composer-tools">
                  <button
                    type="button"
                    className="admin-composer-attach"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={busy || writeBlocked || uploading}
                  >
                    <ImagePlus size={14} aria-hidden="true" />
                    {uploading ? 'Enviando' : 'Imagem'}
                  </button>
                  <input
                    ref={fileInputRef}
                    className="hidden"
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(event) => {
                      void attach(event.target.files);
                      event.target.value = '';
                    }}
                  />
                  <span className="admin-composer-hint">
                    {busy
                      ? 'Você pode sair: o trabalho continua no servidor'
                      : 'Enter envia, Shift+Enter quebra linha'}
                  </span>
                </div>
                {busy ? (
                  <button
                    type="button"
                    className="admin-secondary admin-composer-stop"
                    onClick={() => void cancelRun()}
                  >
                    Parar
                  </button>
                ) : (
                  <button
                    type="submit"
                    className="admin-composer-send"
                    disabled={
                      writeBlocked ||
                      uploading ||
                      (!input.trim() && !attachments.length)
                    }
                  >
                    Enviar
                  </button>
                )}
              </div>
            </div>
          </form>
        </section>

        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          className="admin-conversation-edge-toggle"
          aria-controls="admin-conversation"
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expandir a conversa' : 'Recolher a conversa'}
        >
          {collapsed ? (
            <ChevronRight size={16} aria-hidden="true" />
          ) : (
            <ChevronLeft size={16} aria-hidden="true" />
          )}
        </button>

        <section
          id="admin-preview"
          className="admin-content"
          aria-label="Projeto"
        >
          {previewControls}
          <div
            className="admin-studio-tabs"
            role="tablist"
            aria-label="Projeto"
          >
            <button
              type="button"
              role="tab"
              aria-selected={rightView === 'preview'}
              onClick={() => setRightView('preview')}
            >
              Prévia
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={rightView === 'content'}
              onClick={() => setRightView('content')}
            >
              Conteúdo
            </button>
            <span>
              {busy ? 'Atualizando a prévia ao vivo' : null}
              {busy ? ' · ' : null}
              {initialProject?.canonicalHost ?? `${tenant.slug}.eixu.com.br`}
            </span>
          </div>

          <div
            className="admin-studio-preview"
            data-active={
              rightView === 'preview' || view === 'preview' || undefined
            }
          >
            <div className="admin-preview-canvas">
              <div className="admin-preview-surface" data-device={device}>
                <div className="admin-preview-stage">
                  {previewUrl ? (
                    <iframe
                      key={`${previewUrl}-${previewNonce}`}
                      src={previewUrl}
                      className="admin-preview-frame"
                      data-device={device}
                      title={`Prévia de ${tenant.name}`}
                      sandbox="allow-forms allow-modals allow-popups allow-same-origin allow-scripts"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="admin-preview-empty">
                      <div>
                        {previewLoading ? (
                          <Loader2 className="admin-studio-spin" size={22} />
                        ) : null}
                        <strong>
                          {previewProblem
                            ? 'Prévia indisponível'
                            : previewLoading || busy
                              ? 'Preparando a prévia'
                              : hasProject
                                ? 'Ainda não há uma prévia'
                                : 'O projeto começa na conversa'}
                        </strong>
                        <p>
                          {previewProblem
                            ? previewProblem
                            : previewLoading || busy
                              ? 'A primeira compilação pode levar alguns instantes.'
                              : hasProject
                                ? 'Peça uma nova versão na conversa para criar o site.'
                                : 'Envie o briefing livre. O agente usa os dados já cadastrados.'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div
            className="admin-studio-cms"
            data-active={
              rightView === 'content' || view === 'content' || undefined
            }
          >
            {editor ? (
              <div className="admin-studio-cms-inner">
                <header>
                  <div>
                    <span>CMS lite</span>
                    <h2>Conteúdo do projeto</h2>
                    <p>
                      Altere textos e imagens sem mudar a composição criada pelo
                      agente.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="admin-primary"
                    disabled={savingContent || busy || writeBlocked}
                    onClick={() => void saveContent()}
                  >
                    <Save size={14} aria-hidden="true" />
                    {savingContent ? 'Salvando…' : 'Salvar'}
                  </button>
                </header>
                {editor.contract.pages.map((page) => (
                  <section
                    key={page.slug || 'home'}
                    className="admin-studio-cms-page"
                  >
                    <h3>{page.label}</h3>
                    <span>/{page.slug}</span>
                    {page.sections.map((section) => (
                      <fieldset
                        key={section.id}
                        disabled={savingContent || busy || writeBlocked}
                      >
                        <legend>{section.label}</legend>
                        {section.fields.map((field) => {
                          const id = fieldInputId(field);
                          const value = editorValues[field.key] ?? '';
                          return (
                            <label key={field.key} htmlFor={id}>
                              <span>{field.label}</span>
                              {field.type === 'textarea' ? (
                                <textarea
                                  id={id}
                                  rows={4}
                                  value={value}
                                  maxLength={field.maxLength}
                                  onChange={(event) =>
                                    setEditorValues((current) => ({
                                      ...current,
                                      [field.key]: event.target.value,
                                    }))
                                  }
                                />
                              ) : field.type === 'image' ? (
                                <>
                                  {value ? (
                                    // oxlint-disable-next-line next/no-img-element
                                    <img
                                      src={value}
                                      alt=""
                                      className="admin-studio-cms-image"
                                    />
                                  ) : null}
                                  <select
                                    id={id}
                                    value={value}
                                    onChange={(event) =>
                                      setEditorValues((current) => ({
                                        ...current,
                                        [field.key]: event.target.value,
                                      }))
                                    }
                                  >
                                    {!field.required ? (
                                      <option value="">Sem imagem</option>
                                    ) : null}
                                    {value &&
                                    !images.some(
                                      (image) => image.url === value,
                                    ) ? (
                                      <option value={value}>
                                        Imagem atual
                                      </option>
                                    ) : null}
                                    {images.map((image) => (
                                      <option key={image.url} value={image.url}>
                                        #{image.seq}{' '}
                                        {image.alt ?? 'Imagem do acervo'}
                                      </option>
                                    ))}
                                  </select>
                                  <Link
                                    href={`${basePath}/${tenant.slug}/imagens`}
                                  >
                                    Gerenciar imagens
                                  </Link>
                                </>
                              ) : (
                                <input
                                  id={id}
                                  value={value}
                                  maxLength={field.maxLength}
                                  onChange={(event) =>
                                    setEditorValues((current) => ({
                                      ...current,
                                      [field.key]: event.target.value,
                                    }))
                                  }
                                />
                              )}
                              {field.help ? <small>{field.help}</small> : null}
                              {editorErrors[field.key] ? (
                                <small data-tone="err">
                                  {editorErrors[field.key]}
                                </small>
                              ) : null}
                            </label>
                          );
                        })}
                      </fieldset>
                    ))}
                  </section>
                ))}
              </div>
            ) : (
              <div className="admin-preview-empty">
                <div>
                  <strong>O conteúdo editável nasce com o projeto</strong>
                  <p>
                    Ao construir o site, o agente registra os textos e imagens
                    que poderão ser mantidos por aqui.
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
