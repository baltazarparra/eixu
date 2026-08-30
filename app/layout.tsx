import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  metadataBase: new URL('https://eixu.com.br'),
  title: 'EIXU | Estúdio de produto e desenvolvimento nativo de IA',
  description:
    'A/gente tira sua ideia, protótipo, demo ou plano do papel e coloca em produção.',
  icons: { icon: '/favicon.svg' },
  openGraph: {
    title: 'EIXU | Estúdio de produto e desenvolvimento nativo de IA',
    description: 'A/gente tira sua ideia, protótipo, demo ou plano do papel e coloca em produção.',
    type: 'website',
    locale: 'pt_BR',
    images: [{ url: '/og.png', width: 1731, height: 909, alt: 'EIXU, Estúdio de produto e desenvolvimento nativo de IA' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'EIXU | Estúdio de produto e desenvolvimento nativo de IA',
    description: 'A/gente tira sua ideia, protótipo, demo ou plano do papel e coloca em produção.',
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
