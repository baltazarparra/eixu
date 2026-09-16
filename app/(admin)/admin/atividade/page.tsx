import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { listActivity } from '@/lib/admin/activity';

export const dynamic = 'force-dynamic';

const date = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'America/Fortaleza',
});

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string | string[] }>;
}) {
  const user = await currentUser();
  if (!user) redirect('/admin/login?returnTo=/admin/atividade');
  const asked = (await searchParams).tenant;
  const tenantSlug =
    typeof asked === 'string' && /^[a-z0-9-]{1,80}$/.test(asked)
      ? asked
      : undefined;
  const activity = await listActivity({ tenantSlug });
  return (
    <main className="admin-page admin-audit-page">
      <div className="admin-page-heading">
        <div>
          <p className="admin-label">Operação EIXU</p>
          <h1>Atividade{tenantSlug ? ` · ${tenantSlug}` : ''}</h1>
          <p>Quem fez cada ação e quando ela aconteceu.</p>
        </div>
        <div className="admin-page-actions">
          {tenantSlug ? (
            <Link className="admin-secondary" href="/admin/atividade">
              Ver todos
            </Link>
          ) : null}
          <Link className="admin-primary" href="/admin">
            Voltar aos clientes
          </Link>
        </div>
      </div>
      {activity.length ? (
        <ol className="admin-audit-list">
          {activity.map((item) => {
            const actor =
              item.actorType === 'agent'
                ? `Agente · a pedido de ${item.actorName ?? item.actorLogin ?? 'operador anterior'}`
                : item.actorType === 'system'
                  ? 'Sistema'
                  : (item.actorName ?? item.actorLogin ?? 'Operador anterior');
            return (
              <li key={item.id} data-result={item.result}>
                <div>
                  <strong>{item.summary}</strong>
                  <span>{actor}</span>
                </div>
                <div>
                  {item.tenantSlug && item.tenantId ? (
                    <Link href={`/admin/${item.tenantSlug}`}>
                      {item.tenantName ?? item.tenantSlug}
                    </Link>
                  ) : (
                    <span>Operação geral</span>
                  )}
                  <time dateTime={item.createdAt}>
                    {date.format(new Date(item.createdAt))}
                  </time>
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <section className="admin-audit-empty">
          <h2>Nenhuma atividade registrada</h2>
          <p>As próximas ações dos usuários aparecerão aqui.</p>
        </section>
      )}
    </main>
  );
}
