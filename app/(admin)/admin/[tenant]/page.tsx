import { notFound, redirect } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import { db } from '@/lib/db';
import { lintPage } from '@/lib/taste/lint';
import { getTenantBySlug, listPages } from '@/lib/tenant-queries';
import { publishPageAction } from '../actions';
import { Workspace } from './workspace';

export const dynamic = 'force-dynamic';

export default async function TenantWorkspace({ params }: { params: Promise<{ tenant: string }> }) {
  if (!(await isAuthenticated())) redirect('/admin/login');
  const { tenant: slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();

  const pages = await listPages(tenant.id);
  const history = (await db()`
    select role, content from chat_messages
    where tenant_id = ${tenant.id} order by created_at asc limit 40
  `) as { role: string; content: string }[];

  return (
    <>
      <Workspace
        tenantSlug={tenant.slug}
        tenantName={tenant.name}
        pages={pages.map((page) => ({
          slug: page.slug,
          type: page.type,
          title: page.title,
          blocks: page.blocks.length,
          published: Boolean(page.publishedBlocks),
        }))}
        history={history}
      />
      {pages.length > 0 ? (
        <aside className="border-t px-6 py-6">
          <h2 className="mb-4 text-sm font-medium uppercase tracking-[0.14em] text-[var(--color-muted)]">
            Pre-flight e publicação
          </h2>
          <ul className="flex flex-col gap-3">
            {pages.map((page) => {
              const findings = lintPage(page);
              const errors = findings.filter((finding) => finding.level === 'error');
              const warnings = findings.filter((finding) => finding.level === 'warn');
              return (
                <li key={page.id} className="rounded-lg border bg-[var(--color-surface)] p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-mono text-sm">/{page.slug}</span>
                    <span className="text-xs text-[var(--color-muted)]">
                      {page.type} · {page.blocks.length} blocos
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[0.7rem] font-medium ${
                        errors.length
                          ? 'bg-[color-mix(in_oklab,var(--color-err)_20%,transparent)] text-[var(--color-err)]'
                          : 'bg-[color-mix(in_oklab,var(--color-ok)_20%,transparent)] text-[var(--color-ok)]'
                      }`}
                    >
                      {errors.length ? `${errors.length} erros` : 'aprovado'}
                      {warnings.length ? ` · ${warnings.length} avisos` : ''}
                    </span>
                    <form action={publishPageAction} className="ml-auto">
                      <input type="hidden" name="tenant" value={tenant.slug} />
                      <input type="hidden" name="page" value={page.slug} />
                      <button
                        disabled={errors.length > 0}
                        className="rounded-md bg-[var(--color-accent)] px-3.5 py-2 text-xs font-medium text-[var(--color-accent-ink)] disabled:opacity-40"
                      >
                        {page.publishedBlocks ? 'Republicar' : 'Publicar'}
                      </button>
                    </form>
                  </div>
                  {findings.length ? (
                    <ul className="mt-3 flex flex-col gap-1">
                      {findings.map((finding, index) => (
                        <li key={index} className="font-mono text-[0.72rem] text-[var(--color-muted)]">
                          <span className={finding.level === 'error' ? 'text-[var(--color-err)]' : 'text-[var(--color-warn)]'}>
                            {finding.level === 'error' ? 'ERRO' : 'aviso'}
                          </span>{' '}
                          [{finding.rule}] {finding.message}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </aside>
      ) : null}
    </>
  );
}
