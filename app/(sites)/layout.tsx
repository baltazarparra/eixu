import type { ReactNode } from 'react';
import {
  Fraunces,
  Geist,
  Geist_Mono,
  Manrope,
  Newsreader,
  Space_Grotesk,
} from 'next/font/google';
import './site.css';
import './creative.css';

const sans = Geist({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});
const serif = Newsreader({
  subsets: ['latin'],
  variable: '--font-serif',
  display: 'swap',
});
const mono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});
const geometric = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-geometric',
  display: 'swap',
});
const humanist = Manrope({
  subsets: ['latin'],
  variable: '--font-humanist',
  display: 'swap',
});
const displayEditorial = Fraunces({
  subsets: ['latin'],
  variable: '--font-display-editorial',
  display: 'swap',
});

export default function SitesRootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="pt-BR"
      className={`${sans.variable} ${serif.variable} ${mono.variable} ${geometric.variable} ${humanist.variable} ${displayEditorial.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
