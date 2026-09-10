import { redirect } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import { listTenants } from '@/lib/tenant-queries';
import { createTenantAction, logoutAction } from './actions';

export const dynamic = 'force-dynamic';

export default async function AdminHome() {
  if (!(await isAuthenticated())) redirect('/admin/login');
  const tenants = await listTenants();

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-14">
      <header className="mb-12 flex items-end justify-between gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.02em]">
            Clientes
          </h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            {tenants.length} {tenants.length === 1 ? 'site' : 'sites'} no
            painel.
          </p>
        </div>
        <form action={logoutAction}>
          <button className="text-sm text-[var(--color-muted)] hover:text-[var(--color-text)]">
            Sair
          </button>
        </form>
      </header>

      <section className="mb-14">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-[0.14em] text-[var(--color-muted)]">
          Novo cliente
        </h2>
        <form action={createTenantAction} className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-4">
            <input
              name="name"
              placeholder="Nome do cliente"
              required
              className="rounded-md border bg-[var(--color-surface)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--color-accent)]"
            />
            <input
              name="slug"
              placeholder="subdominio"
              required
              pattern="[a-z0-9-]+"
              className="rounded-md border bg-[var(--color-surface)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--color-accent)] font-mono"
            />
            <input
              name="whatsapp"
              placeholder="WhatsApp (5514...)"
              className="rounded-md border bg-[var(--color-surface)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--color-accent)]"
            />
            <input
              name="email"
              type="email"
              placeholder="E-mail de contato"
              className="rounded-md border bg-[var(--color-surface)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--color-accent)]"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              name="segment"
              placeholder="Segmento (ex.: oficina mecânica)"
              className="rounded-md border bg-[var(--color-surface)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--color-accent)]"
            />
            <input
              name="region"
              placeholder="Cidade ou região atendida"
              className="rounded-md border bg-[var(--color-surface)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--color-accent)]"
            />
            <input
              name="audience"
              placeholder="Para quem vende"
              className="rounded-md border bg-[var(--color-surface)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--color-accent)]"
            />
            <input
              name="offer"
              placeholder="O que oferece"
              className="rounded-md border bg-[var(--color-surface)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--color-accent)]"
            />
            <input
              name="goal"
              placeholder="O que o visitante deve fazer"
              className="rounded-md border bg-[var(--color-surface)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--color-accent)]"
            />
            <textarea
              name="references"
              rows={2}
              placeholder="Referências, uma URL por linha"
              className="rounded-md border bg-[var(--color-surface)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--color-accent)] font-mono"
            />
            <textarea
              name="evidence"
              rows={3}
              placeholder="Fatos confirmados, um por linha. O agente só afirma o que está aqui ou numa referência que ele conseguiu ler."
              className="rounded-md border bg-[var(--color-surface)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--color-accent)]"
            />
            <textarea
              name="constraints"
              rows={3}
              placeholder="Restrições, uma por linha. Ex.: não afirmar prazos, não mencionar peças de marca."
              className="rounded-md border bg-[var(--color-surface)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--color-accent)]"
            />
          </div>
          <button className="self-start rounded-md bg-[var(--color-accent)] px-4 py-2.5 text-sm font-medium text-[var(--color-accent-ink)]">
            Criar
          </button>
        </form>
      </section>

      {tenants.length === 0 ? (
        <p className="rounded-lg border border-dashed px-6 py-12 text-center text-sm text-[var(--color-muted)]">
          Nenhum cliente ainda. Crie o primeiro acima.
        </p>
      ) : (
        <ul className="grid gap-px overflow-hidden rounded-lg border bg-[var(--color-line)] sm:grid-cols-2">
          {tenants.map((tenant) => (
            <li key={tenant.id} className="bg-[var(--color-surface)]">
              <a
                href={`/admin/${tenant.slug}`}
                className="flex flex-col gap-3 p-6 hover:bg-[var(--color-surface-2)]"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-base font-medium">{tenant.name}</span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[0.7rem] font-medium ${
                      tenant.status === 'published'
                        ? 'bg-[color-mix(in_oklab,var(--color-ok)_22%,transparent)] text-[var(--color-ok)]'
                        : 'bg-[var(--color-surface-2)] text-[var(--color-muted)]'
                    }`}
                  >
                    {tenant.status === 'published' ? 'publicado' : 'rascunho'}
                  </span>
                </div>
                <span className="font-mono text-xs text-[var(--color-muted)]">
                  {tenant.slug}.eixu.com.br
                </span>
                <span className="text-xs text-[var(--color-muted)]">
                  {tenant.pageCount} páginas · {tenant.leadCount} contatos
                  recebidos
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
