'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { AdminSession } from './session';

export function AdminShell({
  operator,
  login,
  logout,
  children,
}: {
  operator: string;
  login: string;
  logout: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const session = useMemo(
    () => ({ operator, login, logout }),
    [operator, login, logout],
  );
  const shellRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const shell = shellRef.current;
    const viewport = window.visualViewport;
    if (!shell || !viewport) return;
    // Safari mantém a viewport de layout quando abre o teclado. O painel
    // acompanha a área visível; o zoom da pessoa continua livre.
    const update = () => {
      if (viewport.scale !== 1) return;
      shell.style.setProperty(
        '--admin-viewport-height',
        `${viewport.height}px`,
      );
      shell.style.setProperty(
        '--admin-viewport-top',
        `${viewport.offsetTop}px`,
      );
    };
    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
    };
  }, [pathname]);
  if (pathname === '/admin/login') return children;
  return (
    <AdminSession.Provider value={session}>
      <div ref={shellRef} className="admin-shell">
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
