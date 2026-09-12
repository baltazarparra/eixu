import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import localFont from 'next/font/local';
import { LogOut } from 'lucide-react';
import { isAuthenticated } from '@/lib/auth';
import { AdminShell } from '@/components/admin/admin-shell';
import { logoutAction } from './admin/actions';
import './admin.css';

const sans = localFont({
  src: './fonts/geist-latin.woff2',
  weight: '100 900',
  variable: '--font-admin-sans',
  display: 'swap',
});
const mono = localFont({
  src: './fonts/geist-mono-latin.woff2',
  weight: '100 900',
  variable: '--font-admin-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'EIXU Sites',
  // O painel nunca deve aparecer em busca.
  robots: { index: false, follow: false, nocache: true },
};

export default async function AdminRootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const authenticated = await isAuthenticated();
  const operator = process.env.ADMIN_USER || 'admin';
  return (
    <html lang="pt-BR" className={`${sans.variable} ${mono.variable}`}>
      <body>
        {authenticated ? (
          <AdminShell
            operator={operator}
            logout={
              <form action={logoutAction}>
                <button
                  className="admin-icon-button"
                  aria-label="Sair do painel"
                  title={`Sair (${operator})`}
                >
                  <LogOut size={15} aria-hidden="true" />
                </button>
              </form>
            }
          >
            {children}
          </AdminShell>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
