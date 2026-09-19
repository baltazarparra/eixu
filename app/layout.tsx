import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/site';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'EIXU | Desenvolvimento de produtos e sistemas com IA',
  description: SITE_DESCRIPTION,
  icons: { icon: '/favicon.svg' },
  robots: { index: true, follow: true },
  openGraph: {
    title: 'EIXU | Desenvolvimento de produtos e sistemas com IA',
    description: SITE_DESCRIPTION,
    type: 'website',
    locale: 'pt_BR',
    siteName: SITE_NAME,
    url: SITE_URL,
    images: [{ url: '/og.png', width: 1731, height: 909, alt: 'EIXU, Estúdio de produto e desenvolvimento nativo de IA' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'EIXU | Desenvolvimento de produtos e sistemas com IA',
    description: SITE_DESCRIPTION,
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body>
    </html>
  );
}
