'use client';

import Link from 'next/link';
import Image from 'next/image';
import {
  ExternalLink,
  FileText,
  Gem,
  ImageIcon,
  Monitor,
  Save,
  Smartphone,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { WorkspaceHeader } from '@/components/admin/navigation';
import { PagePicker } from '@/components/admin/page-picker';
import { Notice, StatusPill } from '@/components/admin/primitives';
import { useCompactLayout } from '@/components/admin/use-compact-layout';
import { AdminHttpError, adminFetch } from '@/lib/admin/http';
import type { SiteState } from '@/lib/admin/state';
import type {
  PremiumEditorContract,
  PremiumEditorField,
  PremiumEditorValues,
} from '@/lib/premium/editor';
import { PremiumPreviewFrame } from './premium-preview-frame';

type Props = { initial: SiteState };
type EditorState = NonNullable<SiteState['premium']['editor']>;
type NoticeState = {
  tone: 'ok' | 'warn' | 'err';
  title: string;
  description?: string;
};

function valuesEqual(
  left: PremiumEditorValues,
  right: PremiumEditorValues,
): boolean {
  const keys = Object.keys(left);
  return (
    keys.length === Object.keys(right).length &&
    keys.every((key) => left[key] === right[key])
  );
}

function localErrors(
  contract: PremiumEditorContract,
  values: PremiumEditorValues,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const page of contract.pages)
    for (const section of page.sections)
      for (const field of section.fields) {
        const value = values[field.key] ?? '';
        if (field.required && !value.trim())
          errors[field.key] = 'Preencha este campo.';
        else if (field.maxLength && value.length > field.maxLength)
          errors[field.key] = `Use até ${field.maxLength} caracteres.`;
      }
  return errors;
}

function unavailableHeader(initial: SiteState) {
  return (
    <WorkspaceHeader
      tenant={initial.tenant}
      conversation={
        <span className="admin-premium-mode">
          <Gem size={15} aria-hidden="true" /> Premium
        </span>
      }
      preview={
        <a
          className="admin-secondary"
          href={initial.premium.canonicalUrl}
          target="_blank"
          rel="noreferrer"
        >
          Abrir site <ExternalLink size={14} aria-hidden="true" />
        </a>
      }
      decision={null}
    />
  );
}

export function PremiumCms({ initial }: Props) {
  if (!initial.premium.editor)
    return (
      <div className="admin-workspace admin-premium-workspace">
        {unavailableHeader(initial)}
        <div className="admin-premium-unavailable">
          <Gem size={26} aria-hidden="true" />
          <p className="admin-label">PROJETO PREMIUM</p>
          <h1>O editor de conteúdo está sendo preparado.</h1>
          <p>
            O site continua publicado. Assim que o frontend Premium entregar o
            contrato editorial, os textos, imagens e a prévia aparecerão aqui.
          </p>
          <a
            className="admin-secondary"
            href={initial.premium.canonicalUrl}
            target="_blank"
            rel="noreferrer"
          >
            Ver site publicado <ExternalLink size={14} aria-hidden="true" />
          </a>
        </div>
      </div>
    );
  return <PremiumCmsEditor initial={initial} editor={initial.premium.editor} />;
}

function PremiumCmsEditor({
  initial,
  editor,
}: Props & { editor: EditorState }) {
  const tenantSlug = initial.tenant.slug;
  const compact = useCompactLayout();
  const [current, setCurrent] = useState(editor.contract.pages[0]?.slug ?? '');
  const [view, setView] = useState<'editor' | 'preview'>('editor');
  const [deviceChoice, setDevice] = useState<'desktop' | 'mobile' | null>(null);
  const device = deviceChoice ?? (compact ? 'mobile' : 'desktop');
  const [values, setValues] = useState(editor.content.values);
  const [publishedValues, setPublishedValues] = useState(editor.content.values);
  const [revision, setRevision] = useState(editor.content.revision);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewToken, setPreviewToken] = useState<string | null>(null);
  const [previewNonce, setPreviewNonce] = useState(0);
  const [confirmedPreviewRevision, setConfirmedPreviewRevision] = useState(0);
  const [previewReloadScroll, setPreviewReloadScroll] = useState(0);
  const [previewState, setPreviewState] = useState<
    'starting' | 'syncing' | 'ready' | 'error'
  >('starting');
  const [draftVersion, setDraftVersion] = useState(0);
  const [imageField, setImageField] = useState<PremiumEditorField | null>(null);
  const imageDialog = useRef<HTMLDialogElement>(null);
  const previewVersion = useRef(0);
  const previewScroll = useRef(0);
  const edited = useRef(false);

  const currentPage =
    editor.contract.pages.find((page) => page.slug === current) ??
    editor.contract.pages[0];
  const changed = !valuesEqual(values, publishedValues);
  const validationErrors = useMemo(
    () => ({ ...serverErrors, ...localErrors(editor.contract, values) }),
    [editor.contract, serverErrors, values],
  );
  const changedCount = useMemo(
    () =>
      Object.keys(values).filter((key) => values[key] !== publishedValues[key])
        .length,
    [publishedValues, values],
  );
  const pageOptions = useMemo(
    () =>
      editor.contract.pages.map((page) => ({
        slug: page.slug,
        title: page.label,
        dirty: page.sections.some((section) =>
          section.fields.some(
            (field) => values[field.key] !== publishedValues[field.key],
          ),
        ),
      })),
    [editor.contract.pages, publishedValues, values],
  );

  useEffect(() => {
    const preventLoss = (event: BeforeUnloadEvent) => {
      if (!changed) return;
      event.preventDefault();
    };
    window.addEventListener('beforeunload', preventLoss);
    return () => window.removeEventListener('beforeunload', preventLoss);
  }, [changed]);

  useEffect(() => {
    let active = true;
    void adminFetch<{
      token: string;
      expiresAt: string;
      contractHash: string;
      content: EditorState['content'];
    }>(`/api/admin/${tenantSlug}/premium/preview`, { method: 'POST' })
      .then((session) => {
        if (!active) return;
        if (session.contractHash !== editor.contractHash)
          throw new Error(
            'O frontend Premium mudou. Recarregue esta página para abrir o contrato atual.',
          );
        setPreviewToken(session.token);
        setPreviewState('ready');
        if (!edited.current) {
          setValues(session.content.values);
          setPublishedValues(session.content.values);
          setRevision(session.content.revision);
        }
      })
      .catch((error: Error) => {
        if (!active) return;
        setPreviewState('error');
        setNotice({
          tone: 'err',
          title: 'A prévia Premium não pôde ser aberta.',
          description: error.message,
        });
      });
    return () => {
      active = false;
    };
  }, [editor.contractHash, tenantSlug]);

  useEffect(() => {
    if (!previewToken || draftVersion === 0) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      const version = ++previewVersion.current;
      setPreviewState('syncing');
      void adminFetch<{ version: number }>(
        `/api/admin/${tenantSlug}/premium/preview`,
        {
          method: 'PATCH',
          signal: controller.signal,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            token: previewToken,
            contractHash: editor.contractHash,
            version,
            values,
          }),
        },
      )
        .then((result) => {
          if (result.version !== version) return;
          setServerErrors({});
          setPreviewState('ready');
          setConfirmedPreviewRevision(result.version);
          setPreviewReloadScroll(previewScroll.current);
          setPreviewNonce((value) => value + 1);
        })
        .catch((error: Error) => {
          if (error.name === 'AbortError') return;
          if (error instanceof AdminHttpError && error.fields)
            setServerErrors(error.fields);
          setPreviewState('error');
          setNotice({
            tone: 'err',
            title: 'A prévia não recebeu esta alteração.',
            description: error.message,
          });
        });
    }, 320);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [draftVersion, editor.contractHash, previewToken, tenantSlug, values]);

  useEffect(() => {
    const dialog = imageDialog.current;
    if (!dialog) return;
    if (imageField && !dialog.open) dialog.showModal();
    if (!imageField && dialog.open) dialog.close();
  }, [imageField]);

  const rememberScroll = useCallback((y: number) => {
    previewScroll.current = y;
  }, []);

  const previewOrigin = useMemo(
    () => new URL(initial.premium.canonicalUrl).origin,
    [initial.premium.canonicalUrl],
  );
  const previewUrl = useMemo(() => {
    if (!previewToken) return null;
    const base = new URL(
      current ? `/${current}` : '/',
      initial.premium.canonicalUrl,
    );
    base.searchParams.set('eixu_preview', previewToken);
    base.searchParams.set('eixu_v', String(previewNonce));
    base.searchParams.set('eixu_request', `${current}:${previewNonce}`);
    if (previewReloadScroll > 0)
      base.searchParams.set('eixu_scroll', String(previewReloadScroll));
    return base.toString();
  }, [
    current,
    initial.premium.canonicalUrl,
    previewNonce,
    previewReloadScroll,
    previewToken,
  ]);

  function updateField(field: PremiumEditorField, value: string) {
    edited.current = true;
    setValues((currentValues) => ({
      ...currentValues,
      [field.key]: value,
    }));
    setServerErrors((currentErrors) => {
      if (!currentErrors[field.key]) return currentErrors;
      const next = { ...currentErrors };
      delete next[field.key];
      return next;
    });
    setDraftVersion((version) => version + 1);
    setNotice(null);
  }

  async function publish() {
    if (!changed || saving || Object.keys(validationErrors).length) return;
    setSaving(true);
    setNotice(null);
    try {
      const result = await adminFetch<{ content: EditorState['content'] }>(
        `/api/admin/${tenantSlug}/premium/content`,
        {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            expectedRevision: revision,
            schemaVersion: editor.contract.version,
            contractHash: editor.contractHash,
            values,
          }),
        },
      );
      setValues(result.content.values);
      setPublishedValues(result.content.values);
      setRevision(result.content.revision);
      setServerErrors({});
      setNotice({
        tone: 'ok',
        title: `Revisão ${result.content.revision} publicada.`,
        description:
          'O site canônico já lê este conteúdo. A prévia continua no mesmo ponto para sua conferência.',
      });
      setPreviewReloadScroll(previewScroll.current);
      setPreviewNonce((value) => value + 1);
    } catch (error) {
      if (error instanceof AdminHttpError && error.fields)
        setServerErrors(error.fields);
      setNotice({
        tone: 'err',
        title: 'Nenhuma alteração foi publicada.',
        description:
          error instanceof Error
            ? error.message
            : 'Não foi possível publicar o conteúdo.',
      });
    } finally {
      setSaving(false);
    }
  }

  const previewControls = (
    <div className="admin-bar-group" aria-label="Controles da prévia Premium">
      <span className="admin-label">PRÉVIA PREMIUM</span>
      <PagePicker
        pages={pageOptions}
        value={current}
        onChange={(slug) => {
          previewScroll.current = 0;
          setPreviewReloadScroll(0);
          setCurrent(slug);
        }}
      />
      <fieldset
        className="admin-segmented admin-device-picker"
        aria-label="Largura da prévia"
      >
        <button
          type="button"
          aria-pressed={device === 'desktop'}
          onClick={() => setDevice('desktop')}
        >
          <Monitor size={14} aria-hidden="true" /> <span>Desktop</span>
        </button>
        <button
          type="button"
          aria-pressed={device === 'mobile'}
          onClick={() => setDevice('mobile')}
        >
          <Smartphone size={14} aria-hidden="true" /> <span>Celular</span>
        </button>
      </fieldset>
      <a
        className="admin-icon-button"
        href={new URL(
          current ? `/${current}` : '/',
          initial.premium.canonicalUrl,
        ).toString()}
        target="_blank"
        rel="noreferrer"
        title="Abrir página publicada"
        aria-label="Abrir página publicada"
      >
        <ExternalLink size={15} aria-hidden="true" />
      </a>
    </div>
  );

  return (
    <div
      className="admin-workspace admin-premium-workspace"
      data-view={view === 'editor' ? 'chat' : 'content'}
    >
      <WorkspaceHeader
        tenant={initial.tenant}
        conversation={
          <span className="admin-premium-mode">
            <Gem size={15} aria-hidden="true" /> Premium
          </span>
        }
        preview={previewControls}
        decision={
          <button
            type="button"
            className="admin-primary"
            onClick={() => void publish()}
            disabled={
              !changed || saving || Object.keys(validationErrors).length > 0
            }
          >
            <Save size={15} aria-hidden="true" />
            {saving ? (
              'Publicando…'
            ) : (
              <>
                <span className="admin-preview-link-desktop">
                  Salvar e publicar
                </span>
                <span className="admin-preview-link-mobile">Publicar</span>
              </>
            )}
          </button>
        }
      />
      {notice ? (
        <Notice tone={notice.tone} title={notice.title}>
          {notice.description}
        </Notice>
      ) : null}
      <div className="admin-workspace-body admin-premium-body">
        <section
          id="admin-conversation"
          className="admin-conversation admin-premium-editor"
          aria-label="Conteúdo da página"
        >
          <header className="admin-premium-editor-head">
            <div>
              <p className="admin-label">CONTEÚDO · /{current}</p>
              <h1>{currentPage.label}</h1>
            </div>
            <StatusPill tone={changed ? 'warn' : 'ok'}>
              {changed
                ? `${changedCount} ${changedCount === 1 ? 'alteração' : 'alterações'}`
                : `publicado · r${revision}`}
            </StatusPill>
            <p>
              Edite textos e imagens sem alterar o layout e os componentes do
              projeto. A prévia ao lado usa o frontend Premium real.
            </p>
          </header>

          <div className="admin-premium-sections">
            {currentPage.sections.map((section, sectionIndex) => (
              <section className="admin-premium-section" key={section.id}>
                <div className="admin-premium-section-head">
                  <span>{String(sectionIndex + 1).padStart(2, '0')}</span>
                  <h2>{section.label}</h2>
                </div>
                <div className="admin-premium-fields">
                  {section.fields.map((field) => {
                    const error = validationErrors[field.key];
                    const value = values[field.key] ?? '';
                    return (
                      <label
                        className="admin-field admin-premium-field"
                        data-invalid={Boolean(error) || undefined}
                        key={field.key}
                      >
                        <span>
                          {field.label}
                          {field.maxLength ? (
                            <em>
                              {value.length}/{field.maxLength}
                            </em>
                          ) : null}
                        </span>
                        {field.type === 'image' ? (
                          <button
                            type="button"
                            className="admin-premium-image-field"
                            onClick={() => setImageField(field)}
                          >
                            <Image
                              className="admin-premium-image-thumb"
                              src={value}
                              alt=""
                              width={58}
                              height={56}
                              unoptimized
                            />
                            <span>
                              <strong>Trocar imagem</strong>
                              <small>Escolher no acervo do projeto</small>
                            </span>
                            <ImageIcon size={17} aria-hidden="true" />
                          </button>
                        ) : field.type === 'textarea' ? (
                          <textarea
                            className="admin-input"
                            rows={4}
                            value={value}
                            maxLength={field.maxLength}
                            aria-invalid={Boolean(error)}
                            onChange={(event) =>
                              updateField(field, event.target.value)
                            }
                          />
                        ) : (
                          <input
                            className="admin-input"
                            value={value}
                            maxLength={field.maxLength}
                            aria-invalid={Boolean(error)}
                            onChange={(event) =>
                              updateField(field, event.target.value)
                            }
                          />
                        )}
                        {field.help ? <small>{field.help}</small> : null}
                        {error ? (
                          <small className="admin-premium-field-error">
                            {error}
                          </small>
                        ) : null}
                      </label>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </section>

        <section
          id="admin-preview"
          className="admin-content admin-premium-preview"
          aria-label="Prévia Premium"
        >
          {previewControls}
          <div className="admin-premium-preview-meta">
            <span data-state={previewState}>
              {previewState === 'starting'
                ? 'Abrindo sessão segura…'
                : previewState === 'syncing'
                  ? 'Aplicando conteúdo…'
                  : previewState === 'error'
                    ? 'Prévia interrompida'
                    : 'Alterações em tempo real'}
            </span>
          </div>
          <div className="admin-preview-canvas">
            {previewUrl ? (
              <PremiumPreviewFrame
                src={previewUrl}
                device={device}
                origin={previewOrigin}
                expectedRevision={confirmedPreviewRevision}
                requestId={`${current}:${previewNonce}`}
                onScroll={rememberScroll}
              />
            ) : (
              <div className="admin-preview-empty">
                Preparando o frontend Premium…
              </div>
            )}
          </div>
        </section>
      </div>

      <fieldset className="admin-mobile-views" aria-label="Área de trabalho">
        <button
          type="button"
          aria-pressed={view === 'editor'}
          aria-controls="admin-conversation"
          onClick={() => setView('editor')}
        >
          <FileText size={18} aria-hidden="true" /> Conteúdo
        </button>
        <button
          type="button"
          aria-pressed={view === 'preview'}
          aria-controls="admin-preview"
          onClick={() => setView('preview')}
        >
          <Smartphone size={18} aria-hidden="true" /> Prévia
        </button>
      </fieldset>

      <dialog
        ref={imageDialog}
        className="admin-dialog admin-premium-image-dialog"
        aria-labelledby="premium-image-title"
        onClose={() => setImageField(null)}
        onCancel={() => setImageField(null)}
      >
        <header>
          <div>
            <p className="admin-label">ACERVO DO PROJETO</p>
            <h2 id="premium-image-title">
              {imageField ? imageField.label : 'Escolher imagem'}
            </h2>
          </div>
          <button
            type="button"
            className="admin-icon-button"
            onClick={() => setImageField(null)}
            aria-label="Fechar"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </header>
        {initial.media.length ? (
          <div className="admin-premium-image-grid">
            {initial.media.map((image) => (
              <button
                type="button"
                key={image.id}
                aria-pressed={
                  imageField ? values[imageField.key] === image.url : false
                }
                onClick={() => {
                  if (imageField) updateField(imageField, image.url);
                  setImageField(null);
                }}
              >
                <Image
                  src={image.url}
                  alt={image.alt || image.description || `Imagem ${image.seq}`}
                  loading="lazy"
                  fill
                  sizes="(max-width: 640px) 40vw, 170px"
                  unoptimized
                />
                <small>#{image.seq}</small>
              </button>
            ))}
          </div>
        ) : (
          <p className="admin-dialog-copy">
            Este projeto ainda não tem imagens disponíveis no acervo.
          </p>
        )}
        <footer className="admin-dialog-footer">
          <Link
            className="admin-secondary"
            href={`/admin/${tenantSlug}/imagens`}
          >
            Gerenciar acervo
          </Link>
          <button
            type="button"
            className="admin-primary"
            onClick={() => setImageField(null)}
          >
            Fechar
          </button>
        </footer>
      </dialog>
    </div>
  );
}
