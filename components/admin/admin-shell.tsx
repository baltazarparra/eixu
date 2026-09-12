'use client';

import { usePathname } from 'next/navigation';
import { useMemo, type ReactNode } from 'react';
import { AdminSession } from './session';

export function AdminShell({
  operator,
  logout,
  children,
}: {
  operator: string;
  logout: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const session = useMemo(() => ({ operator, logout }), [operator, logout]);
  if (pathname === '/admin/login') return children;
  return (
    <AdminSession.Provider value={session}>
      <div className="admin-shell">
        <a href="#admin-main" className="admin-skip">
          Ir ao conteúdo
        </a>
        <div className="admin-shell-content" id="admin-main" tabIndex={-1}>
          {children}
        </div>
      </div>
    </AdminSession.Provider>
  );
}
