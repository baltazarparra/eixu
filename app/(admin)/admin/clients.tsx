'use client';

import { startTransition, useActionState, useState } from 'react';
import Link from 'next/link';
import { BrandFields } from '@/components/admin/brand-fields';
import { TenantFields } from '@/components/admin/tenant-fields';
import {
  EmptyState,
  MetricCard,
  SegmentedControl,
  StatusDot,
  StatusPill,
} from '@/components/admin/primitives';
import { createTenantAction } from './actions';

export type ClientSummary = {
  slug: string;
  name: string;
  status: string;
  pageCount: number;
  leadCount: number;
  updatedAt: string;
};
const num = new Intl.NumberFormat('pt-BR');
const date = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  timeZone: 'America/Sao_Paulo',
});

export function Clients({
  tenants,
  summary,
}: {
  tenants: ClientSummary[];
  summary: { leads30d: number; running: number };
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('todos');
  const [creating, setCreating] = useState(false);
  const [error, formAction, pending] = useActionState(createTenantAction, null);
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
  const newClient = (
    <button
      className="admin-primary"
      type="button"
      onClick={() => setCreating(!creating)}
      aria-expanded={creating}
      aria-controls="new-client"
    >
      {creating ? 'Fechar cadastro' : '+ Novo cliente'}
    </button>
  );
  return (
    <>
      <div className="admin-page-heading">
        <div>
          <h1>Clientes</h1>
          <p>Seus sites, os contatos que chegaram e o trabalho em andamento.</p>
        </div>
        {newClient}
      </div>
      {creating ? (
        <section id="new-client" className="admin-new-client">
          <h2>Cadastrar cliente</h2>
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
                <p role="alert" className="admin-form-error">
                  {error}
                </p>
              ) : null}
              <div className="admin-form-footer">
                <button
                  type="submit"
                  className="admin-primary"
                  disabled={pending}
                >
                  {pending ? 'Criando…' : 'Criar cliente e abrir editor'}
                </button>
                <p>
                  Ao abrir o editor, o agente inicia a geração. Publicar é uma
                  ação separada.
                </p>
              </div>
            </fieldset>
          </form>
        </section>
      ) : null}
      <section
        className="admin-metrics admin-client-metrics"
        aria-label="Resumo da operação"
      >
        <MetricCard
          label="Sites no ar"
          value={String(published).padStart(2, '0')}
          qualifier={`de ${String(tenants.length).padStart(2, '0')}`}
        />
        <MetricCard
          label="Leads · 30 dias"
          value={num.format(summary.leads30d)}
          note="Contatos recebidos por formulário"
        />
        <MetricCard
          label="Gerações em curso"
          value={String(summary.running).padStart(2, '0')}
          qualifier={
            summary.running ? (
              <>
                <StatusDot tone="accent" pulse /> em andamento
              </>
            ) : (
              'nenhuma agora'
            )
          }
        />
      </section>
      <div className="admin-client-toolbar">
        <label className="admin-search">
          <span className="admin-search-glyph" aria-hidden="true" />
          <input
            aria-label="Buscar clientes"
            placeholder="Buscar por nome ou slug"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <SegmentedControl
          label="Filtrar clientes"
          value={filter}
          onChange={setFilter}
          options={[
            ['todos', 'Todos'],
            ['published', 'Publicados'],
            ['draft', 'Rascunhos'],
          ]}
        />
      </div>
      {visible.length ? (
        <section
          className="admin-client-table"
          aria-label="Clientes cadastrados"
        >
          <div className="admin-client-columns" aria-hidden="true">
            <span>Cliente</span>
            <span>Status</span>
            <span>Páginas</span>
            <span>Leads</span>
            <span>Atualizado</span>
            <span />
          </div>
          <ul>
            {visible.map((tenant) => (
              <li key={tenant.slug}>
                <Link
                  className="admin-client-row"
                  href={`/admin/${tenant.slug}`}
                >
                  <span className="admin-client-name">
                    <span className="admin-avatar">
                      {tenant.name
                        .split(/\s+/)
                        .slice(0, 2)
                        .map((word) => word[0])
                        .join('')}
                    </span>
                    <span>
                      <strong>{tenant.name}</strong>
                      <small>{tenant.slug}.eixu.com.br</small>
                    </span>
                  </span>
                  <StatusPill
                    tone={tenant.status === 'published' ? 'ok' : 'warn'}
                  >
                    {tenant.status === 'published' ? 'Publicado' : 'Rascunho'}
                  </StatusPill>
                  <span
                    className="admin-numeric"
                    aria-label={`${tenant.pageCount} páginas`}
                  >
                    {String(tenant.pageCount).padStart(2, '0')}
                  </span>
                  <span
                    className="admin-numeric"
                    aria-label={`${tenant.leadCount} leads`}
                  >
                    {tenant.leadCount ? num.format(tenant.leadCount) : '—'}
                  </span>
                  <time dateTime={tenant.updatedAt}>
                    {date.format(new Date(tenant.updatedAt))}
                  </time>
                  <span aria-hidden="true">›</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <EmptyState
          title={
            tenants.length
              ? 'Nenhum cliente encontrado'
              : 'Nenhum cliente cadastrado'
          }
          action={
            <button
              type="button"
              className="admin-secondary"
              onClick={() => {
                if (tenants.length) {
                  setQuery('');
                  setFilter('todos');
                } else setCreating(true);
              }}
            >
              {tenants.length ? 'Limpar filtros' : 'Cadastrar cliente'}
            </button>
          }
        >
          {tenants.length
            ? 'Tente outro nome ou limpe os filtros para ver todos os clientes.'
            : 'Cadastre o primeiro cliente com nome, endereço e briefing. Ao abrir o editor, o agente começa a montar o site.'}
        </EmptyState>
      )}
    </>
  );
}
