'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { text } from '@/lib/form-data';
import { formSnapshot, changedFields } from '@/lib/admin/form-changes';
import { StatusDot } from '@/components/admin/primitives';
import { TenantFields } from '@/components/admin/tenant-fields';
import { VibePreview } from '@/components/admin/brand-fields';
import { DeleteTenantDialog } from '@/components/admin/delete-tenant-dialog';
import { SocialProfileCard } from './social-card';
import { adminFetch } from '@/lib/admin/http';
import { contactsFromForm, intakeFromForm } from '@/lib/admin/tenant-input';
import type { Intake } from '@/lib/tenant-intake';
import type { Contacts } from '@/lib/tenant-contacts';
import { VIBES, VIBE_HINT, VIBE_LABEL, type Vibe } from '@/lib/design/vibes';
import type { SocialProfile } from '@/lib/social-profile';

export function SettingsForm({
  tenant,
  intake,
  contacts,
  social,
}: {
  tenant: {
    slug: string;
    name: string;
    status: string;
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
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [saved, setSaved] = useState({ tenant, intake, contacts });
  const [version, setVersion] = useState(0);
  const [dirty, setDirty] = useState(0);
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
        url
          ? 'Versão para fundo escuro aplicada ao rascunho.'
          : 'Versão para fundo escuro removida do rascunho.',
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
      router.refresh();
      setProfile(next);
      setSocialUrl(parsed.data.socialUrl);
      setNotice(
        regenerationRequired
          ? 'Direção salva no rascunho. Volte ao Site e peça "Refaça o site" pelo chat para aplicar a nova direção; a versão publicada foi preservada.'
          : 'Dados salvos no rascunho. A história será usada nas próximas edições do site.',
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
        'Logo aplicado ao rascunho. A versão para fundo escuro é preparada em seguida; recarregue para conferir. O site no ar muda na próxima publicação.',
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
    <div className="admin-settings-layout">
      <nav className="admin-settings-nav" aria-label="Seções dos dados">
        {[
          ['identificacao', 'Identificação'],
          ['contato', 'Contato'],
          ['briefing', 'História'],
          ['direcao', 'Direção visual'],
          ['marca', 'Logo'],
          ['risco', 'Zona de risco'],
        ].map(([id, label]) => (
          <a
            key={id}
            href={`#${id}`}
            aria-current={section === id ? 'location' : undefined}
            onClick={() => setSection(id)}
          >
            {label}
          </a>
        ))}
      </nav>
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
            />
            <section id="direcao" className="admin-form-section">
              <h2 className="text-base font-semibold">Direção visual</h2>
              <p className="mt-1 mb-5 max-w-2xl text-sm text-[var(--color-muted)]">
                Uma troca abre uma nova direção no rascunho e preserva a versão
                publicada. Depois de salvar, volte ao Site e peça “Refaça o
                site” pelo chat para aplicar a nova direção. Landing Page usa
                uma única página. Ao trocar de um site com páginas internas,
                elas continuam salvas e impedem a publicação da landing até você
                pedir a remoção ou voltar à direção anterior.
              </p>
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
                    <small>{VIBE_HINT[vibe]}</small>
                  </label>
                ))}
              </div>
            </section>
            <p className="mt-5 text-xs leading-relaxed text-[var(--color-muted)]">
              Nome, contatos, logo e direção alteram o rascunho. O site no ar
              continua no snapshot anterior até Publicar. Alterar a história ou
              a referência orienta uma reconstrução; não reescreve páginas
              automaticamente. A referência visual verificada tem prioridade na
              geração; na ausência dela, vale o contrato da vibe escolhida.
            </p>
          </fieldset>
        </form>
        <section id="marca" className="admin-form-section admin-brand-section">
          {logoUrl ? (
            // Duas prévias: sobre o papel da marca e sobre um papel escuro. A
            // placa branca de um PNG sem alfa só aparece na segunda.
            <div className="admin-logo-previews">
              <Image
                src={
                  logoUrl === tenant.logoUrl
                    ? (tenant.logoPreviewUrl ?? logoUrl)
                    : logoUrl
                }
                alt={`Logo de ${tenant.name} sobre o papel da marca`}
                width={112}
                height={80}
                unoptimized
                className="h-20 w-28 rounded-lg border p-3 object-contain"
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
                width={112}
                height={80}
                unoptimized
                className="h-20 w-28 rounded-lg border p-3 object-contain"
                style={{ background: '#0b0e14' }}
              />
            </div>
          ) : (
            <div className="admin-logo-placeholder">Sem logo</div>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold">Logo do site</h2>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              Envie o arquivo final ou escolha um logo na biblioteca. Ao
              aplicar, as margens são recortadas e o fundo uniforme é removido
              quando possível. A versão para fundo escuro, os ícones e a imagem
              de compartilhamento são preparados em seguida.
            </p>
            {tenant.logoStudioSummary ? (
              <p className="mt-2 text-sm">
                {tenant.logoStudioSummary}.{' '}
                <a className="underline" href={`/admin/${tenant.slug}/imagens`}>
                  Escolher ou voltar ao original
                </a>
              </p>
            ) : null}
            {tenant.logoSvgUrl && logoUrl === tenant.logoUrl ? (
              <a
                className="mt-2 inline-block text-sm underline"
                href={tenant.logoSvgUrl}
                target="_blank"
                rel="noreferrer"
              >
                Abrir logo em SVG
              </a>
            ) : null}
            {logoDarkUrl ? (
              <p className="mt-2 text-sm text-[var(--color-muted)]">
                Versão para fundo escuro aplicada.{' '}
                <button
                  type="button"
                  className="underline"
                  disabled={saving}
                  onClick={() => void setDarkLogo(null)}
                >
                  Remover
                </button>
              </p>
            ) : tenant.logoIssue ? (
              <p className="mt-2 text-sm" data-tone="warn">
                Sobre o papel da marca, {tenant.logoIssue}. Envie um PNG com
                fundo transparente ou escolha a versão para fundo escuro na
                biblioteca.
              </p>
            ) : null}
            <label className="admin-field mt-4">
              <span>Enviar e aplicar logo</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                disabled={saving}
                onChange={(event) => {
                  void upload(event.target.files?.[0]);
                  event.target.value = '';
                }}
                className="admin-input"
              />
            </label>
          </div>
        </section>
        <SocialProfileCard
          slug={tenant.slug}
          social={profile}
          hasSocialUrl={Boolean(socialUrl)}
          onChange={setProfile}
        />
        <section id="risco" className="admin-form-section admin-risk">
          <h2>Zona de risco</h2>
          <p className="mt-1 max-w-2xl text-sm text-[var(--color-muted)]">
            Apaga o cadastro, as páginas, os contatos recebidos, as conversas e
            todos os arquivos deste cliente. Não há como desfazer.
          </p>
          <button
            type="button"
            className="admin-danger mt-4"
            onClick={() => setDeleting(true)}
          >
            Excluir {tenant.name}
          </button>
        </section>
        {notice ? (
          <output
            aria-live="polite"
            className="mt-6 block rounded-lg border px-4 py-3 text-sm"
          >
            {notice}
          </output>
        ) : null}
        <div className="admin-save-bar">
          <output>
            <StatusDot tone={dirty ? 'warn' : 'ok'} />
            {dirty
              ? `${dirty} ${dirty === 1 ? 'alteração não salva' : 'alterações não salvas'}`
              : 'Dados salvos'}
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
    </div>
  );
}
