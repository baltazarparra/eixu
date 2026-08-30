import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  metadataBase: new URL('https://eixu.com.br'),
  title: 'EIXU — Product Engineering, AI-native',
  description:
    'Discovery, MVP e projetos digitais fechados. Produto e tecnologia, do problema à produção.',
  icons: { icon: '/favicon.svg' },
  openGraph: {
    title: 'EIXU — Product Engineering, AI-native',
    description: 'Produto e tecnologia, do problema à produção.',
    type: 'website',
    locale: 'pt_BR',
    images: [{ url: '/og.png', width: 1731, height: 909, alt: 'EIXU — Product Engineering, AI-native' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'EIXU — Product Engineering, AI-native',
    description: 'Produto e tecnologia, do problema à produção.',
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
