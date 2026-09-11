'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { TenantFields } from '@/components/admin/tenant-fields';
import { DeleteTenantDialog } from '@/components/admin/delete-tenant-dialog';
import { SocialProfileCard } from './social-card';
import { adminFetch } from '@/lib/admin/http';
import { contactsFromForm, intakeFromForm } from '@/lib/admin/tenant-input';
import type { Intake } from '@/lib/tenant-intake';
import type { Contacts } from '@/lib/tenant-contacts';
import { VIBE_HINT, VIBE_LABEL, type Vibe } from '@/lib/design/vibes';
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
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [logoUrl, setLogoUrl] = useState(tenant.logoUrl);
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
          'Confira as referências e o limite de 160 caracteres por fato ou restrição.',
      );
      return;
    }
    setSaving(true);
    setNotice('');
    try {
      const { social: next } = await adminFetch<{
        social: SocialProfile | null;
      }>(`/api/admin/${tenant.slug}/settings`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: form.get('name'),
          contacts: nextContacts.data,
          contactEmail: form.get('contactEmail'),
          intake: parsed.data,
        }),
      });
      setProfile(next);
      setSocialUrl(parsed.data.socialUrl);
      setNotice(
        'Dados salvos. O briefing será usado nas próximas edições do site.',
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
      setNotice('Logo enviado e aplicado no site.');
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
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void save(new FormData(event.currentTarget));
        }}
      >
        <fieldset disabled={saving}>
          <TenantFields values={tenant} intake={intake} contacts={contacts} />
          <p className="mt-5 text-xs leading-relaxed text-[var(--color-muted)]">
            Nome, contatos e logo são compartilhados com o site publicado.
            Alterar o briefing orienta novas edições; não reescreve páginas
            automaticamente.
          </p>
          <p className="mt-3 text-xs leading-relaxed text-[var(--color-muted)]">
            Vibe do site: <strong>{VIBE_LABEL[tenant.vibe]}</strong>.{' '}
            {VIBE_HINT[tenant.vibe]} Ela é definida no cadastro; mudar exige
            reconstruir as páginas na conversa do site.
          </p>
          <div className="mt-6 flex gap-3">
            <button className="admin-primary" type="submit">
              {saving ? 'Salvando…' : 'Salvar dados'}
            </button>
            <Link className="admin-secondary" href={`/admin/${tenant.slug}`}>
              Voltar ao site
            </Link>
          </div>
        </fieldset>
      </form>
      <section className="mt-10 flex flex-wrap items-center gap-5 border-t pt-7">
        {logoUrl ? (
          <Image
            src={logoUrl}
            alt={`Logo de ${tenant.name}`}
            width={112}
            height={80}
            unoptimized
            className="h-20 w-28 rounded-lg border bg-white p-3 object-contain"
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold">Logo do site</h2>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Envie o arquivo final ou escolha um logo na biblioteca.
          </p>
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
      <section className="mt-10 border-t pt-7">
        <h2 className="text-base font-semibold">Excluir cliente</h2>
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
    </>
  );
}
