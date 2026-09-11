import type { ReactNode } from 'react';
import {
  Fraunces,
  Geist,
  Geist_Mono,
  Manrope,
  Newsreader,
  Space_Grotesk,
  Sora,
  Barlow_Condensed,
  Syne,
  Bodoni_Moda,
  Roboto_Slab,
  Work_Sans,
  Literata,
  Source_Sans_3,
} from 'next/font/google';
import './site.css';
import './creative.css';
import './vibes.css';
import './typography.css';
import './iconography.css';

const sans = Geist({
  subsets: ['latin'],
  variable: '--font-sans',
  preload: false,
  display: 'swap',
});
const serif = Newsreader({
  subsets: ['latin'],
  variable: '--font-serif',
  preload: false,
  style: ['normal', 'italic'],
  display: 'swap',
});
const mono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  preload: false,
  display: 'swap',
});
const geometric = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-geometric',
  preload: false,
  display: 'swap',
});
const humanist = Manrope({
  subsets: ['latin'],
  variable: '--font-humanist',
  preload: false,
  display: 'swap',
});
const displayEditorial = Fraunces({
  subsets: ['latin'],
  variable: '--font-display-editorial',
  preload: false,
  style: ['normal', 'italic'],
  display: 'swap',
});

// Catálogo disponível sem pré-carregar 14 famílias em cada visita. O navegador
// pede apenas as fontes usadas pelos dois papéis da direção daquele tenant.
const grotesk = Sora({
  subsets: ['latin'],
  variable: '--font-grotesk',
  display: 'swap',
  preload: false,
});
const condensed = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-condensed',
  display: 'swap',
  preload: false,
});
const expressive = Syne({
  subsets: ['latin'],
  variable: '--font-expressive',
  display: 'swap',
  preload: false,
});
const classic = Bodoni_Moda({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  variable: '--font-classic',
  display: 'swap',
  preload: false,
});
const slab = Roboto_Slab({
  subsets: ['latin'],
  variable: '--font-slab',
  display: 'swap',
  preload: false,
});
const work = Work_Sans({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  variable: '--font-work',
  display: 'swap',
  preload: false,
});
const literary = Literata({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  variable: '--font-literary',
  display: 'swap',
  preload: false,
});
const source = Source_Sans_3({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  variable: '--font-source',
  display: 'swap',
  preload: false,
});

export default function SitesRootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="pt-BR"
      className={`${sans.variable} ${serif.variable} ${mono.variable} ${geometric.variable} ${humanist.variable} ${displayEditorial.variable} ${grotesk.variable} ${condensed.variable} ${expressive.variable} ${classic.variable} ${slab.variable} ${work.variable} ${literary.variable} ${source.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
