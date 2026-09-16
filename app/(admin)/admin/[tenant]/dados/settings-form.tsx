'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { TriangleAlert, Upload } from 'lucide-react';
import { text } from '@/lib/form-data';
import { formSnapshot, changedFields } from '@/lib/admin/form-changes';
import { FormSection, StatusDot } from '@/components/admin/primitives';
import {
  HelpArea,
  HelpButton,
  HelpHint,
  HelpNote,
} from '@/components/admin/help';
import { TenantFields } from '@/components/admin/tenant-fields';
import { VibePreview } from '@/components/admin/brand-fields';
import { DeleteTenantDialog } from '@/components/admin/delete-tenant-dialog';
import { SocialProfileCard } from './social-card';
import { adminFetch } from '@/lib/admin/http';
import { contactsFromForm, intakeFromForm } from '@/lib/admin/tenant-input';
import { formatTokens } from '@/lib/admin/usage-summary';
import type { UsageCardSummary } from '@/lib/admin/usage-history';
import type { Intake } from '@/lib/tenant-intake';
import type { Contacts } from '@/lib/tenant-contacts';
import { VIBES, VIBE_HINT, VIBE_LABEL, type Vibe } from '@/lib/design/vibes';
import type { SocialProfile } from '@/lib/social-profile';

const SECTIONS = [
  ['identificacao', '01', 'Identificação'],
  ['contato', '02', 'Contato'],
  ['historia', '03', 'História'],
  ['direcao', '04', 'Direção visual'],
  ['logo', '05', 'Logo'],
] as const;

const cardMoney = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});
const savedClock = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

export function SettingsForm({
  tenant,
  intake,
  contacts,
  social,
  usage,
}: {
  tenant: {
    slug: string;
    name: string;
    status: string;
    maintenanceMode: 'generator' | 'converting' | 'premium';
    contactEmail: string | null;
    logoUrl?: string;
    logoDarkUrl?: string;
    logoPreviewUrl?: string;
    logoDarkPreviewUrl?: string;
    logoSvgUrl?: string;
    logoStudioSummary?: string;
    paper?: string;
    /** Problema medido do logo sobre o papel da marca, ou null. */
    logoIssue?: string | null;
    vibe: Vibe;
    pageCount: number;
    leadCount: number;
    imageCount: number;
  };
  intake: Partial<Intake>;
  contacts: Contacts;
  social: SocialProfile | null;
  /** Só o resumo curto: o histórico inteiro mora em /consumo. */
  usage: UsageCardSummary;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [saved, setSaved] = useState({ tenant, intake, contacts });
  const [version, setVersion] = useState(0);
  const [dirty, setDirty] = useState(0);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [section, setSection] = useState('identificacao');
  useLayoutEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const baseline = formSnapshot(form);
    setDirty(0);
    const measure = () => setDirty(changedFields(baseline, formSnapshot(form)));
    form.addEventListener('input', measure);
    form.addEventListener('change', measure);
    // Chips e listas de contatos alteram o FormData também por adicionar/remover controles.
    const observer = new MutationObserver(measure);
    observer.observe(form, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['value'],
    });
    return () => {
      observer.disconnect();
      form.removeEventListener('input', measure);
      form.removeEventListener('change', measure);
    };
  }, [version]);
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    const followLink = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest('a[href]');
      if (!link || event.defaultPrevented) return;
      const url = new URL((link as HTMLAnchorElement).href, location.href);
      if (url.pathname === location.pathname && url.search === location.search)
        return;
      if (
        !window.confirm('Há alterações não salvas. Deseja sair e descartá-las?')
      )
        event.preventDefault();
    };
    window.addEventListener('beforeunload', beforeUnload);
    document.addEventListener('click', followLink, true);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      document.removeEventListener('click', followLink, true);
    };
  }, [dirty]);
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [logoUrl, setLogoUrl] = useState(tenant.logoUrl);
  const [logoDarkUrl, setLogoDarkUrl] = useState(tenant.logoDarkUrl);
  async function setDarkLogo(url: string | null) {
    setSaving(true);
    setNotice('');
    try {
      await adminFetch(`/api/admin/${tenant.slug}/settings`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ logoDarkUrl: url }),
      });
      setLogoDarkUrl(url ?? undefined);
      setNotice(
        tenant.maintenanceMode === 'generator'
          ? url
            ? 'Versão para fundo escuro aplicada ao rascunho.'
            : 'Versão para fundo escuro removida do rascunho.'
          : 'Cadastro atualizado. Para mudar o logo visível, edite e publique o projeto Premium.',
      );
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : 'Não foi possível salvar.',
      );
    } finally {
      setSaving(false);
    }
  }
  const [profile, setProfile] = useState(social);
  const [socialUrl, setSocialUrl] = useState(intake.socialUrl ?? '');
  const [deleting, setDeleting] = useState(false);
  const closeDialog = useCallback(() => setDeleting(false), []);
  const afterDelete = useCallback(() => {
    setDeleting(false);
    router.push('/admin');
  }, [router]);
  async function save(form: FormData) {
    const nextContacts = contactsFromForm(form);
    if (!nextContacts.success) {
      setNotice(
        nextContacts.error.issues[0]?.message ?? 'Confira os contatos.',
      );
      return;
    }
    const parsed = intakeFromForm(form);
    if (!parsed.success) {
      setNotice(
        parsed.error.issues[0]?.message ??
          'Confira a história, a referência e o limite de 160 caracteres por fato ou restrição.',
      );
      return;
    }
    setSaving(true);
    setNotice('');
    try {
      const { social: next, regenerationRequired } = await adminFetch<{
        social: SocialProfile | null;
        regenerationRequired: boolean;
      }>(`/api/admin/${tenant.slug}/settings`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: form.get('name'),
          contacts: nextContacts.data,
          contactEmail: form.get('contactEmail'),
          intake: parsed.data,
          vibe: form.get('vibe'),
        }),
      });
      setSaved({
        tenant: {
          ...tenant,
          name: text(form, 'name').trim(),
          contactEmail: text(form, 'contactEmail').trim(),
          vibe: text(form, 'vibe') as Vibe,
        },
        intake: parsed.data,
        contacts: nextContacts.data,
      });
      setVersion((value) => value + 1);
      setSavedAt(new Date());
      router.refresh();
      setProfile(next);
      setSocialUrl(parsed.data.socialUrl);
      setNotice(
        tenant.maintenanceMode === 'generator'
          ? regenerationRequired
            ? 'Direção salva no rascunho. Volte ao Site e peça "Refaça o site" pelo chat para aplicar a nova direção; a versão publicada foi preservada.'
            : 'Dados salvos no rascunho. A história será usada nas próximas edições do site.'
          : 'Dados operacionais salvos na EIXU. A apresentação pública só muda por uma nova release do projeto Premium.',
      );
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : 'Não foi possível salvar.',
      );
    } finally {
      setSaving(false);
    }
  }
  async function upload(file?: File) {
    if (!file) return;
    setSaving(true);
    setNotice('');
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('kind', 'logo');
      const { url } = await adminFetch<{ url: string }>(
        `/api/admin/${tenant.slug}/upload`,
        { method: 'POST', body: form },
      );
      await adminFetch(`/api/admin/${tenant.slug}/settings`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ logoUrl: url }),
      });
      setLogoUrl(url);
      // A versão escura do logo anterior sai junto; a do novo chega depois.
      setLogoDarkUrl(undefined);
      setNotice(
        tenant.maintenanceMode === 'generator'
          ? 'Logo aplicado ao rascunho. A versão para fundo escuro é preparada em seguida; recarregue para conferir. O site no ar muda na próxima publicação.'
          : 'Logo salvo no cadastro. Para aplicá-lo ao site, edite e publique o projeto Premium.',
      );
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
  return (
    <>
      <div className="admin-page-heading admin-settings-heading">
        <div>
          <p className="admin-eyebrow">Cadastro do cliente</p>
          <h1>Dados</h1>
          <p>
            {tenant.maintenanceMode === 'generator'
              ? 'O que você grava aqui alimenta as próximas edições do site. O rascunho muda ao salvar; o site no ar só muda ao publicar.'
              : 'O cadastro continua centralizado na EIXU. A apresentação do site é mantida no código e só muda por uma release Premium.'}
          </p>
        </div>
        <HelpButton />
      </div>
      <div className="admin-settings-layout">
        <div className="admin-settings-rail">
          <nav className="admin-settings-nav" aria-label="Seções do cadastro">
            {SECTIONS.map(([id, ordinal, label]) => (
              <a
                key={id}
                href={`#${id}`}
                aria-current={section === id ? 'location' : undefined}
                onClick={() => setSection(id)}
              >
                <span>{ordinal}</span>
                {label}
              </a>
            ))}
          </nav>
          <Link
            className="admin-consumo-card"
            href={`/admin/${tenant.slug}/consumo`}
          >
            <span>
              Consumo · {usage.days} dias <span aria-hidden="true">→</span>
            </span>
            <span>
              <strong>
                {usage.costUsd === null ? '—' : cardMoney.format(usage.costUsd)}
              </strong>
              <span>{formatTokens(usage.totalTokens ?? undefined)}</span>
            </span>
          </Link>
        </div>
        <HelpArea>
          <div className="admin-settings-body">
            <form
              ref={formRef}
              id="tenant-settings"
              onSubmit={(event) => {
                event.preventDefault();
                void save(new FormData(event.currentTarget));
              }}
            >
              <fieldset disabled={saving}>
                <TenantFields
                  key={version}
                  values={saved.tenant}
                  intake={saved.intake}
                  contacts={saved.contacts}
                  socialCard={
                    <SocialProfileCard
                      slug={tenant.slug}
                      social={profile}
                      hasSocialUrl={Boolean(socialUrl)}
                      onChange={setProfile}
                    />
                  }
                />
                <FormSection
                  id="direcao"
                  ordinal="04"
                  title="Direção visual"
                  status={VIBE_LABEL[saved.tenant.vibe]}
                  tone="accent"
                >
                  <HelpNote>
                    Trocar abre uma nova direção no rascunho e preserva a versão
                    publicada. Depois de salvar, volte ao Site e peça “Refaça o
                    site” no chat. Landing Page usa uma única página: páginas
                    internas existentes continuam salvas e impedem a publicação
                    até você pedir a remoção ou voltar à direção anterior.
                  </HelpNote>
                  <div className="admin-vibe-grid">
                    {VIBES.map((vibe) => (
                      <label key={vibe} className="admin-vibe-card">
                        <VibePreview vibe={vibe} />
                        <span className="admin-vibe-choice">
                          <input
                            type="radio"
                            name="vibe"
                            value={vibe}
                            defaultChecked={saved.tenant.vibe === vibe}
                          />
                          <strong>{VIBE_LABEL[vibe]}</strong>
                        </span>
                        <HelpHint>{VIBE_HINT[vibe]}</HelpHint>
                      </label>
                    ))}
                  </div>
                </FormSection>
                <FormSection
                  id="logo"
                  ordinal="05"
                  title="Logo"
                  status={logoUrl ? undefined : 'sem logo aplicado'}
                  tone="warn"
                >
                  <div className="admin-logo-row">
                    {logoUrl ? (
                      // Duas prévias: sobre o papel da marca e sobre um papel
                      // escuro. A placa branca de um PNG sem alfa só aparece na
                      // segunda.
                      <div className="admin-logo-previews">
                        <Image
                          src={
                            logoUrl === tenant.logoUrl
                              ? (tenant.logoPreviewUrl ?? logoUrl)
                              : logoUrl
                          }
                          alt={`Logo de ${tenant.name} sobre o papel da marca`}
                          width={124}
                          height={74}
                          unoptimized
                          style={{ background: tenant.paper ?? '#ffffff' }}
                        />
                        <Image
                          src={
                            logoDarkUrl === tenant.logoDarkUrl && logoDarkUrl
                              ? (tenant.logoDarkPreviewUrl ?? logoDarkUrl)
                              : (logoDarkUrl ??
                                (logoUrl === tenant.logoUrl
                                  ? (tenant.logoPreviewUrl ?? logoUrl)
                                  : logoUrl))
                          }
                          alt={`Logo de ${tenant.name} sobre fundo escuro`}
                          width={124}
                          height={74}
                          unoptimized
                          style={{ background: '#0b0e14' }}
                        />
                      </div>
                    ) : (
                      <div className="admin-logo-placeholder">Sem logo</div>
                    )}
                    <div className="admin-logo-actions">
                      <label className="admin-file-button">
                        <Upload size={14} aria-hidden="true" />
                        Enviar arquivo
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/svg+xml"
                          disabled={saving}
                          onChange={(event) => {
                            void upload(event.target.files?.[0]);
                            event.target.value = '';
                          }}
                        />
                      </label>
                      <Link
                        className="admin-compact-button"
                        href={`/admin/${tenant.slug}/imagens`}
                      >
                        Escolher na biblioteca
                      </Link>
                    </div>
                  </div>
                  {tenant.logoStudioSummary ? (
                    <p className="admin-logo-line">
                      {tenant.logoStudioSummary}.
                    </p>
                  ) : null}
                  {tenant.logoSvgUrl && logoUrl === tenant.logoUrl ? (
                    <p className="admin-logo-line">
                      <a
                        href={tenant.logoSvgUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Abrir logo em SVG
                      </a>
                    </p>
                  ) : null}
                  {logoDarkUrl ? (
                    <p className="admin-logo-line">
                      Versão para fundo escuro aplicada.{' '}
                      <button
                        type="button"
                        className="admin-inline-action"
                        disabled={saving}
                        onClick={() => void setDarkLogo(null)}
                      >
                        Remover
                      </button>
                    </p>
                  ) : tenant.logoIssue ? (
                    <p className="admin-logo-line" data-tone="warn">
                      Sobre o papel da marca, {tenant.logoIssue}. Envie um PNG
                      com fundo transparente ou escolha a versão para fundo
                      escuro na biblioteca.
                    </p>
                  ) : null}
                  <HelpNote>
                    Ao aplicar, as margens são recortadas e o fundo uniforme é
                    removido quando possível. A versão para fundo escuro, os
                    ícones e a imagem de compartilhamento são preparados em
                    seguida.
                  </HelpNote>
                </FormSection>
              </fieldset>
            </form>
            <div className="admin-settings-footer">
              <p>
                {tenant.maintenanceMode === 'generator'
                  ? 'Nome, contatos, logo e direção alteram o rascunho. Alterar a história ou a referência orienta uma reconstrução; não reescreve páginas automaticamente.'
                  : 'Nome, contatos e histórico operacional continuam na EIXU. Mudanças visuais, páginas e novas integrações pertencem ao código Premium.'}
              </p>
              <details className="admin-risk-drawer">
                <summary>
                  <TriangleAlert size={14} aria-hidden="true" />
                  Zona de risco
                </summary>
                <div>
                  <p>
                    {tenant.maintenanceMode === 'generator'
                      ? 'Apaga o cadastro, as páginas, os contatos recebidos, as conversas e todos os arquivos deste cliente. Não há como desfazer.'
                      : 'Este projeto tem código e releases próprios. A exclusão fica bloqueada até o domínio e o histórico Premium serem tratados pelo fluxo específico.'}
                  </p>
                  <button
                    type="button"
                    className="admin-danger"
                    disabled={tenant.maintenanceMode !== 'generator'}
                    onClick={() => setDeleting(true)}
                  >
                    {tenant.maintenanceMode === 'generator'
                      ? `Excluir ${tenant.name}`
                      : 'Exclusão protegida'}
                  </button>
                </div>
              </details>
            </div>
            {notice ? (
              <output
                aria-live="polite"
                className="mt-2 block rounded-lg border px-4 py-3 text-sm"
              >
                {notice}
              </output>
            ) : null}
            <div className="admin-save-bar">
              <output>
                <StatusDot tone={dirty ? 'warn' : 'ok'} />
                {dirty
                  ? `${dirty} ${dirty === 1 ? 'alteração não salva' : 'alterações não salvas'}`
                  : `Tudo salvo${savedAt ? ` · ${savedClock.format(savedAt)}` : ''}`}
              </output>
              <div>
                <button
                  className="admin-secondary"
                  type="button"
                  disabled={!dirty || saving}
                  onClick={() => {
                    setVersion((value) => value + 1);
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
            <DeleteTenantDialog
              tenant={
                deleting
                  ? {
                      slug: tenant.slug,
                      name: tenant.name,
                      status: tenant.status,
                      maintenanceMode: tenant.maintenanceMode,
                      pageCount: tenant.pageCount,
                      leadCount: tenant.leadCount,
                      imageCount: tenant.imageCount,
                    }
                  : null
              }
              onClose={closeDialog}
              onDeleted={afterDelete}
            />
          </div>
        </HelpArea>
      </div>
    </>
  );
}
