import Link from 'next/link';
import {
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  ImageIcon,
  PanelsTopLeft,
  Settings2,
} from 'lucide-react';
import type { ReactNode } from 'react';

export function AdminHeader({
  tenant,
  active,
  actions,
}: {
  tenant: { slug: string; name: string };
  active: 'site' | 'imagens' | 'trafego' | 'dados';
  actions?: ReactNode;
}) {
  const root = `/admin/${tenant.slug}`;
  return (
    <header className="admin-header">
      <div className="admin-client">
        <Link
          href="/admin"
          className="admin-back"
          aria-label="Todos os clientes"
        >
          <ArrowLeft size={17} />
        </Link>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{tenant.name}</p>
          <a
            href={`https://${tenant.slug}.eixu.com.br`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-xs text-[var(--color-muted)]"
          >
            <span className="truncate">{tenant.slug}.eixu.com.br</span>
            <ArrowUpRight size={12} className="shrink-0" />
          </a>
        </div>
      </div>
      <nav aria-label="Área do cliente" className="admin-nav">
        {(
          [
            ['site', '', 'Site', PanelsTopLeft],
            ['imagens', '/imagens', 'Imagens', ImageIcon],
            ['trafego', '/trafego', 'Tráfego', BarChart3],
            ['dados', '/dados', 'Dados', Settings2],
          ] as const
        ).map(([key, suffix, label, Icon]) => (
          <Link
            key={key}
            href={`${root}${suffix}`}
            aria-current={active === key ? 'page' : undefined}
          >
            <Icon size={15} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
      {actions ? <div className="admin-header-actions">{actions}</div> : null}
    </header>
  );
}

export function MobileViews({
  value,
  onChange,
  second = 'Prévia',
}: {
  value: 'chat' | 'content';
  onChange: (value: 'chat' | 'content') => void;
  second?: string;
}) {
  return (
    <div className="admin-mobile-views" aria-label="Área de trabalho">
      <button
        type="button"
        aria-pressed={value === 'chat'}
        onClick={() => onChange('chat')}
      >
        Conversa
      </button>
      <button
        type="button"
        aria-pressed={value === 'content'}
        onClick={() => onChange('content')}
      >
        {second}
      </button>
    </div>
  );
}
