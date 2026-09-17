import type { ReactNode } from 'react';
import localFont from 'next/font/local';
import './safira.css';

/*
 * Duas famílias, auto-hospedadas. Marcellus é uma romana de capitular — a
 * mesma letra gravada em metal que a joalheria usa há um século — e carrega
 * sozinha a hierarquia do site. Syne responde por corpo, rótulo e controle:
 * uma grotesca de desenho recente, que mantém a marca contemporânea sem
 * disputar com a display. Auto-hospedar tira o Google do caminho do visitante
 * e torna o build reprodutível sem rede externa.
 * Ambas sob SIL Open Font License 1.1 — ver ./fonts/LICENSE.txt.
 */
const display = localFont({
  src: './fonts/marcellus-latin.woff2',
  weight: '400',
  variable: '--font-display',
  display: 'swap',
});

const body = localFont({
  src: './fonts/syne-latin.woff2',
  weight: '400 800',
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
