'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { TenantFields } from '@/components/admin/tenant-fields';
import { adminFetch } from '@/lib/admin/http';
import { intakeFromForm } from '@/lib/admin/tenant-input';
import type { Intake } from '@/lib/tenant-intake';

export function SettingsForm({
  tenant,
  intake,
}: {
  tenant: {
    slug: string;
    name: string;
    whatsapp: string | null;
    contactEmail: string | null;
    logoUrl?: string;
  };
  intake: Partial<Intake>;
}) {
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [logoUrl, setLogoUrl] = useState(tenant.logoUrl);
  async function save(form: FormData) {
    const parsed = intakeFromForm(form);
    if (!parsed.success) {
      setNotice(
        'Confira as referências e o limite de 160 caracteres por fato ou restrição.',
      );
      return;
    }
    setSaving(true);
    setNotice('');
    try {
      await adminFetch(`/api/admin/${tenant.slug}/settings`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: form.get('name'),
          whatsapp: form.get('whatsapp'),
          contactEmail: form.get('contactEmail'),
          intake: parsed.data,
        }),
      });
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
          <TenantFields values={tenant} intake={intake} />
          <p className="mt-5 text-xs leading-relaxed text-[var(--color-muted)]">
            Nome, contatos e logo são compartilhados com o site publicado.
            Alterar o briefing orienta novas edições; não reescreve páginas
            automaticamente.
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
            Envie o arquivo final ou escolha um logo aprovado na biblioteca.
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
      {notice ? (
        <output
          aria-live="polite"
          className="mt-6 block rounded-lg border px-4 py-3 text-sm"
        >
          {notice}
        </output>
      ) : null}
    </>
  );
}
