'use client';

import { startTransition, useActionState, useCallback, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowUpRight, Plus, Search, Globe2, Trash2, X } from 'lucide-react';
import { BrandFields } from '@/components/admin/brand-fields';
import { TenantFields } from '@/components/admin/tenant-fields';
import { DeleteTenantDialog } from '@/components/admin/delete-tenant-dialog';
import type { DeletableTenant } from '@/lib/admin/tenant-delete';
import { createTenantAction } from './actions';

export type ClientSummary = {
  slug: string;
  name: string;
  status: string;
  pageCount: number;
  leadCount: number;
};

export function Clients({ tenants }: { tenants: ClientSummary[] }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('todos');
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<DeletableTenant | null>(null);
  const [error, formAction, pending] = useActionState(createTenantAction, null);
  const closeDialog = useCallback(() => setDeleting(null), []);
  const afterDelete = useCallback(() => {
    setDeleting(null);
    router.refresh();
  }, [router]);
  const published = tenants.filter(
    (tenant) => tenant.status === 'published',
  ).length;
  const visible = tenants.filter(
    (tenant) =>
      `${tenant.name} ${tenant.slug}`
        .toLocaleLowerCase('pt-BR')
        .includes(query.toLocaleLowerCase('pt-BR')) &&
      (filter === 'todos' || tenant.status === filter),
  );

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Sites dos clientes
          </h1>
          <p className="mt-3 text-sm text-[var(--color-muted)]">
            {tenants.length} clientes no painel. {published} com site publicado.
          </p>
        </div>
        <button
          className="admin-primary"
          type="button"
          onClick={() => setCreating(!creating)}
          aria-expanded={creating}
          aria-controls="new-client"
        >
          {creating ? <X size={16} /> : <Plus size={16} />}
          {creating ? 'Fechar cadastro' : 'Novo cliente'}
        </button>
      </div>
      {creating ? (
        <section
          id="new-client"
          className="mt-7 rounded-xl border bg-[var(--color-surface)] p-5 sm:p-7"
        >
          <h2 className="mb-5 text-lg font-semibold">Criar um cliente</h2>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              startTransition(() => formAction(data));
            }}
          >
            <fieldset disabled={pending}>
              <TenantFields withSlug />
              <BrandFields />
              {error ? (
                <p
                  aria-live="polite"
                  className="mt-4 text-sm text-[var(--color-err)]"
                >
                  {error}
                </p>
              ) : null}
              <div className="mt-6 flex items-center gap-4">
                <button
                  type="submit"
                  className="admin-primary"
                  disabled={pending}
                >
                  {pending ? 'Criando…' : 'Criar cliente e abrir editor'}
                </button>
                <p className="text-xs text-[var(--color-muted)]">
                  O cadastro não inicia geração nem publica o site.
                </p>
              </div>
            </fieldset>
          </form>
        </section>
      ) : null}
      <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-b pb-5">
        <label className="flex w-full items-center gap-3 rounded-lg border bg-[var(--color-surface)] px-3 sm:max-w-sm">
          <Search size={17} className="text-[var(--color-muted)]" />
          <input
            className="w-full bg-transparent py-3 text-sm outline-none"
            aria-label="Buscar clientes"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por nome ou endereço"
            type="search"
          />
        </label>
        <div className="flex gap-1" aria-label="Filtrar clientes">
          {[
            ['todos', 'Todos'],
            ['draft', 'Rascunhos'],
            ['published', 'Publicados'],
          ].map(([value, label]) => (
            <button
              className={`rounded-md px-3 py-2 text-xs ${filter === value ? 'bg-[var(--color-surface-2)]' : 'text-[var(--color-muted)]'}`}
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {visible.length ? (
        <ul className="divide-y">
          {visible.map((tenant) => (
            <li key={tenant.slug} className="flex items-center gap-3">
              <Link
                className="group flex min-w-0 flex-1 items-center gap-4 py-6 sm:gap-6"
                href={`/admin/${tenant.slug}`}
              >
                <div className="grid size-12 shrink-0 place-items-center rounded-xl border bg-[var(--color-surface)] text-[var(--color-accent)]">
                  <Globe2 size={21} />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-base font-medium group-hover:text-[var(--color-accent)]">
                    {tenant.name}
                  </h2>
                  <p className="mt-1 truncate text-xs text-[var(--color-muted)]">
                    {tenant.slug}.eixu.com.br
                  </p>
                  <p className="mt-2 text-xs text-[var(--color-muted)]">
                    {tenant.pageCount} páginas · {tenant.leadCount} contatos por
                    formulário
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs ${tenant.status === 'published' ? 'bg-[color-mix(in_oklab,var(--color-ok)_12%,transparent)] text-[var(--color-ok)]' : 'bg-[var(--color-surface-2)] text-[var(--color-muted)]'}`}
                >
                  {tenant.status === 'published' ? 'Publicado' : 'Rascunho'}
                </span>
                <ArrowUpRight
                  size={18}
                  className="hidden text-[var(--color-muted)] sm:block"
                />
              </Link>
              <button
                type="button"
                className="admin-icon-button"
                aria-label={`Excluir ${tenant.name}`}
                onClick={() =>
                  setDeleting({
                    slug: tenant.slug,
                    name: tenant.name,
                    status: tenant.status,
                    pageCount: tenant.pageCount,
                    leadCount: tenant.leadCount,
                  })
                }
              >
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="py-20 text-center">
          <Globe2
            size={30}
            className="mx-auto mb-5 text-[var(--color-muted)]"
          />
          <h2 className="text-lg font-medium">
            {tenants.length
              ? 'Nenhum cliente encontrado'
              : 'Seu primeiro site começa aqui'}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-[var(--color-muted)]">
            {tenants.length
              ? 'Tente outro nome ou mude o filtro.'
              : 'Cadastre o negócio, registre o briefing e acompanhe a criação até a publicação.'}
          </p>
        </div>
      )}
      <DeleteTenantDialog
        tenant={deleting}
        onClose={closeDialog}
        onDeleted={afterDelete}
      />
    </>
  );
}
