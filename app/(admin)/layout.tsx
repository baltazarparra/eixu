import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Geist, Geist_Mono } from 'next/font/google';
import './admin.css';

const sans = Geist({ subsets: ['latin'], variable: '--font-admin-sans', display: 'swap' });
const mono = Geist_Mono({ subsets: ['latin'], variable: '--font-admin-mono', display: 'swap' });

export const metadata: Metadata = {
  title: 'EIXU Sites',
  // O painel nunca deve aparecer em busca.
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminRootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className={`${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
