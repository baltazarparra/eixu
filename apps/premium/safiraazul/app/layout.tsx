import type { ReactNode } from 'react';
import localFont from 'next/font/local';
import './safira.css';

/*
 * Duas famílias, auto-hospedadas. A direção do projeto usa display expressivo
 * e corpo neutro; o catálogo de catorze famílias que veio do gerador pesava em
 * toda visita sem aparecer em nenhuma. Auto-hospedar também tira o Google do
 * caminho do visitante e torna o build reprodutível sem rede externa.
 * Ambas sob SIL Open Font License 1.1 — ver ./fonts/LICENSE.txt.
 */
const display = localFont({
  src: './fonts/syne-latin.woff2',
  weight: '400 800',
  variable: '--font-display',
  display: 'swap',
});

const body = localFont({
  src: './fonts/geist-latin.woff2',
  weight: '100 900',
  variable: '--font-body',
  display: 'swap',
});

export default function SitesRootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
