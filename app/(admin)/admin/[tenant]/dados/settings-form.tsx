'use client';

import { useCallback, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { TriangleAlert, Upload } from 'lucide-react';
import { TenantFields } from '@/components/admin/tenant-fields';
import { DirectionPreview } from '@/components/admin/brand-fields';
import { DeleteTenantDialog } from '@/components/admin/delete-tenant-dialog';
import { FormSection, StatusDot } from '@/components/admin/primitives';
import { HelpHint, HelpNote } from '@/components/admin/help';
import { adminFetch } from '@/lib/admin/http';
import {
  brandColorsFromForm,
  contactsFromForm,
  intakeFromForm,
} from '@/lib/admin/tenant-input';
import { formatTokens } from '@/lib/admin/usage-summary';
import type { UsageCardSummary } from '@/lib/admin/usage-history';
import type { Contacts } from '@/lib/tenant-contacts';
import type { Intake } from '@/lib/tenant-intake';
import {
  STUDIO_DIRECTIONS,
  STUDIO_DIRECTION_HINT,
  STUDIO_DIRECTION_LABEL,
  type StudioDirection,
} from '@/lib/studio/directions';

const money = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});

type TenantSettings = {
  slug: string;
  name: string;
  status: string;
  contactEmail: string | null;
  logoUrl?: string;
  direction: StudioDirection;
  primary: string;
  secondary: string;
  highlight: string;
  pageCount: number;
  leadCount: number;
  imageCount: number;
};

function formString(data: FormData, key: string): string {
  const value = data.get(key);
  return typeof value === 'string' ? value : '';
}

export function SettingsForm({
  tenant,
  intake,
  contacts,
  usage,
  basePath = '/admin',
}: {
  tenant: TenantSettings;
  intake: Partial<Intake>;
  contacts: Contacts;
  usage: UsageCardSummary;
  basePath?: '/admin' | '/studio';
}) {
  const router = useRouter();
  const [saved, setSaved] = useState({ tenant, intake, contacts });
  const [version, setVersion] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [logoUrl, setLogoUrl] = useState(tenant.logoUrl);
  const [deleting, setDeleting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function save(form: HTMLFormElement) {
    const data = new FormData(form);
    const nextContacts = contactsFromForm(data);
    const nextIntake = intakeFromForm(data);
    const nextColors = brandColorsFromForm(data);
    if (!nextContacts.success || !nextIntake.success || !nextColors.success) {
      setNotice(
        nextContacts.error?.issues[0]?.message ??
          nextIntake.error?.issues[0]?.message ??
          nextColors.error?.issues[0]?.message ??
          'Confira os dados do cliente.',
      );
      return;
    }
    setSaving(true);
    setNotice('');
    try {
      const direction = formString(data, 'direction') as StudioDirection;
      const name = formString(data, 'name');
      const contactEmail = formString(data, 'contactEmail');
      await adminFetch(`/api/admin/${tenant.slug}/settings`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name,
          contactEmail,
          contacts: nextContacts.data,
          intake: nextIntake.data,
          direction,
          colors: nextColors.data,
        }),
      });
      setSaved({
        tenant: {
          ...saved.tenant,
          name: name.trim(),
          contactEmail: contactEmail.trim() || null,
          direction,
          primary: nextColors.data.primary,
          secondary: nextColors.data.secondary,
          highlight: nextColors.data.highlight,
        },
        intake: nextIntake.data,
        contacts: nextContacts.data,
      });
      setVersion((current) => current + 1);
      setDirty(false);
      setNotice(
        'Dados salvos. O próximo turno do chat usa este contexto; o site no ar só muda ao publicar.',
      );
      router.refresh();
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : 'Não foi possível salvar.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function uploadLogo(file?: File) {
    if (!file) return;
    setSaving(true);
    setNotice('');
    try {
      const body = new FormData();
      body.append('file', file);
      body.append('kind', 'logo');
      const uploaded = await adminFetch<{ url: string }>(
        `/api/admin/${tenant.slug}/upload`,
        { method: 'POST', body },
      );
      await adminFetch(`/api/admin/${tenant.slug}/settings`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ logoUrl: uploaded.url }),
      });
      setLogoUrl(uploaded.url);
      setNotice(
        'Logo salvo no contexto do projeto. Peça no chat para aplicá-lo ou refinar seu uso.',
      );
      router.refresh();
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : 'Não foi possível enviar o logo.',
      );
    } finally {
      setSaving(false);
    }
  }

  const closeDelete = useCallback(() => setDeleting(false), []);
  const afterDelete = useCallback(
    () => router.push(basePath),
    [basePath, router],
  );

  return (
    <>
      <div className="admin-page-heading admin-settings-heading">
        <div>
          <p className="admin-eyebrow">Fonte do projeto</p>
          <h1>Dados</h1>
          <p>
            História, contatos, marca e referências formam o contexto oficial
            que o Studio lê antes de criar ou editar o site.
          </p>
        </div>
      </div>

      <div className="admin-settings-layout">
        <aside className="admin-settings-rail">
          <nav className="admin-settings-nav" aria-label="Seções do cadastro">
            {[
              ['identificacao', '01', 'Identificação'],
              ['contato', '02', 'Contato'],
              ['historia', '03', 'História'],
              ['direcao', '04', 'Direção visual'],
              ['logo', '05', 'Logo'],
            ].map(([id, ordinal, label]) => (
              <a key={id} href={`#${id}`}>
                <span>{ordinal}</span>
                {label}
              </a>
            ))}
          </nav>
          {basePath === '/admin' ? (
            <Link
              className="admin-consumo-card"
              href={`/admin/${tenant.slug}/consumo`}
            >
              <span>Consumo · {usage.days} dias →</span>
              <span>
                <strong>
                  {usage.costUsd === null ? '—' : money.format(usage.costUsd)}
                </strong>
                <span>{formatTokens(usage.totalTokens ?? undefined)}</span>
              </span>
            </Link>
          ) : null}
        </aside>

        <div className="admin-settings-body">
          <form
            id="tenant-settings"
            key={version}
            onChange={() => setDirty(true)}
            onSubmit={(event) => {
              event.preventDefault();
              void save(event.currentTarget);
            }}
          >
            <fieldset disabled={saving}>
              <TenantFields
                values={saved.tenant}
                intake={saved.intake}
                contacts={saved.contacts}
              />
              <FormSection
                id="direcao"
                ordinal="04"
                title="Direção visual"
                status={STUDIO_DIRECTION_LABEL[saved.tenant.direction]}
                tone="accent"
              >
                <HelpNote>
                  A referência visual cadastrada comanda layout, tipografia e
                  ritmo. Esta direção funciona como repertório principal quando
                  não há referência e como apoio quando há lacunas.
                </HelpNote>
                <div className="admin-vibe-grid">
                  {STUDIO_DIRECTIONS.map((direction) => (
                    <label key={direction} className="admin-vibe-card">
                      <DirectionPreview direction={direction} />
                      <span className="admin-vibe-choice">
                        <input
                          type="radio"
                          name="direction"
                          value={direction}
                          defaultChecked={saved.tenant.direction === direction}
                        />
                        <strong>{STUDIO_DIRECTION_LABEL[direction]}</strong>
                      </span>
                      <HelpHint>{STUDIO_DIRECTION_HINT[direction]}</HelpHint>
                    </label>
                  ))}
                </div>
                <div className="admin-field-grid mt-5">
                  <label className="admin-field">
                    <span>Cor primária</span>
                    <span className="flex items-center gap-3">
                      <input
                        type="color"
                        className="admin-color"
                        aria-label="Escolher cor primária"
                        defaultValue={saved.tenant.primary}
                        onChange={(event) => {
                          const field = event.currentTarget.nextElementSibling;
                          if (field instanceof HTMLInputElement)
                            field.value = event.currentTarget.value;
                          setDirty(true);
                        }}
                      />
                      <input
                        name="primary"
                        className="admin-input admin-numeric"
                        defaultValue={saved.tenant.primary}
                        pattern="#[0-9A-Fa-f]{6}"
                        maxLength={7}
                        required
                      />
                    </span>
                  </label>
                  <label className="admin-field">
                    <span>Cor secundária</span>
                    <span className="flex items-center gap-3">
                      <input
                        type="color"
                        className="admin-color"
                        aria-label="Escolher cor secundária"
                        defaultValue={saved.tenant.secondary}
                        onChange={(event) => {
                          const field = event.currentTarget.nextElementSibling;
                          if (field instanceof HTMLInputElement)
                            field.value = event.currentTarget.value;
                          setDirty(true);
                        }}
                      />
                      <input
                        name="secondary"
                        className="admin-input admin-numeric"
                        defaultValue={saved.tenant.secondary}
                        pattern="#[0-9A-Fa-f]{6}"
                        maxLength={7}
                        required
                      />
                    </span>
                  </label>
                  <input
                    type="hidden"
                    name="highlight"
                    value={saved.tenant.highlight}
                  />
                </div>
              </FormSection>

              <FormSection
                id="logo"
                ordinal="05"
                title="Logo"
                status={logoUrl ? 'cadastrado' : 'opcional'}
              >
                <div className="admin-logo-row">
                  {logoUrl ? (
                    <Image
                      src={logoUrl}
                      alt={`Logo de ${tenant.name}`}
                      width={160}
                      height={92}
                      unoptimized
                    />
                  ) : (
                    <div className="admin-logo-placeholder">Sem logo</div>
                  )}
                  <div className="admin-logo-actions">
                    <input
                      ref={fileRef}
                      type="file"
                      hidden
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      onChange={(event) => {
                        void uploadLogo(event.target.files?.[0]);
                        event.target.value = '';
                      }}
                    />
                    <button
                      type="button"
                      className="admin-file-button"
                      onClick={() => fileRef.current?.click()}
                    >
                      <Upload size={14} aria-hidden="true" />
                      Enviar arquivo
                    </button>
                    <Link
                      className="admin-compact-button"
                      href={`${basePath}/${tenant.slug}/imagens`}
                    >
                      Escolher no acervo
                    </Link>
                  </div>
                </div>
                <HelpNote>
                  O arquivo original entra como contexto multimodal. O agente
                  decide escala, contraste e versões de uso dentro do projeto.
                </HelpNote>
              </FormSection>
            </fieldset>
          </form>

          <div className="admin-settings-footer">
            <p>
              Salvar atualiza a fonte do próximo turno. Alterações já publicadas
              continuam intactas até uma nova publicação.
            </p>
            <details className="admin-risk-drawer">
              <summary>
                <TriangleAlert size={14} aria-hidden="true" />
                Zona de risco
              </summary>
              <div>
                <p>
                  Exclui projeto, releases, conversas, conteúdo, leads, métricas
                  e arquivos deste cliente.
                </p>
                <button
                  type="button"
                  className="admin-danger"
                  onClick={() => setDeleting(true)}
                >
                  Excluir {tenant.name}
                </button>
              </div>
            </details>
          </div>

          {notice ? (
            <output className="admin-notice" aria-live="polite">
              {notice}
            </output>
          ) : null}
          <div className="admin-save-bar">
            <output>
              <StatusDot tone={dirty ? 'warn' : 'ok'} />
              {dirty ? 'Alterações não salvas' : 'Tudo salvo'}
            </output>
            <div>
              <button
                className="admin-secondary"
                type="button"
                disabled={!dirty || saving}
                onClick={() => {
                  setVersion((current) => current + 1);
                  setDirty(false);
                  setNotice('Alterações descartadas.');
                }}
              >
                Descartar
              </button>
              <button
                className="admin-primary"
                type="submit"
                form="tenant-settings"
                disabled={!dirty || saving}
              >
                {saving ? 'Salvando…' : 'Salvar dados'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <DeleteTenantDialog
        tenant={
          deleting
            ? {
                slug: tenant.slug,
                name: tenant.name,
                status: tenant.status,
                pageCount: tenant.pageCount,
                leadCount: tenant.leadCount,
                imageCount: tenant.imageCount,
              }
            : null
        }
        onClose={closeDelete}
        onDeleted={afterDelete}
      />
    </>
  );
}
