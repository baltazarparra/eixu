import type { Metadata } from 'next';
import Image from 'next/image';
import { ArrowUpRight, Check } from 'lucide-react';
import { Footer, Header } from '@/components/eixu';
import { JsonLd } from '@/components/json-ld';
import { SITE_URL } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Case Saldo: produto financeiro do zero à produção | EIXU',
  description: 'Como a EIXU criou um produto financeiro do zero, chegou ao primeiro cliente pagante em poucas semanas e colocou a operação em produção.',
  alternates: { canonical: '/cases/saldopix' },
  openGraph: {
    title: 'Case Saldo: produto financeiro do zero à produção | EIXU',
    description: 'Do zero ao primeiro cliente pagante em poucas semanas.',
    type: 'article',
    url: `${SITE_URL}/cases/saldopix`,
    images: [{
      url: `${SITE_URL}/cases/saldo-home.webp`,
      width: 1440,
      height: 960,
      alt: 'Produto financeiro Saldo para organizar gastos de equipes via Pix',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Case Saldo: produto financeiro do zero à produção | EIXU',
    description: 'Do zero ao primeiro cliente pagante em poucas semanas.',
    images: [`${SITE_URL}/cases/saldo-home.webp`],
  },
};

const saldoJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'EIXU', item: SITE_URL },
    { '@type': 'ListItem', position: 2, name: 'Cases', item: `${SITE_URL}/#cases` },
    { '@type': 'ListItem', position: 3, name: 'Saldo' },
  ],
};

export default function SaldoCase() {
  return (
    <main className="case-page case-page--saldo">
      <JsonLd data={saldoJsonLd} />
      <Header casePage />
      <section className="case-hero shell">
        <p className="eyebrow">Case · Desenvolvimento de produto financeiro</p>
        <h1>Saldo</h1>
        <div className="case-hero-summary">
          <p>Um produto financeiro criado do zero e usado no dia a dia por empresas.</p>
          <a href="https://saldopix.com.br" target="_blank" rel="noreferrer">
            Visitar produto <ArrowUpRight aria-hidden="true" />
          </a>
        </div>
      </section>

      <figure className="case-hero-media case-hero-media--saldo shell-wide">
        <Image
          src="/cases/saldo-home.webp"
          alt="Página inicial da Saldo com uma visão do produto e dos gastos organizados via Pix"
          width="1440"
          height="960"
          priority
          decoding="async"
        />
        <figcaption>Produto, operação e identidade construídos como uma coisa só.</figcaption>
      </figure>

      <section className="metric-band">
        <div className="shell metrics-grid">
          <div><strong>~R$ 1 mi</strong><span>movimentado por mês</span></div>
          <div><strong>Poucas semanas</strong><span>até o primeiro cliente pagante</span></div>
          <div><strong>IA desde o início</strong><span>em todo o desenvolvimento</span></div>
        </div>
      </section>

      <section className="case-story shell">
        <p className="section-index">O desafio</p>
        <div className="story-body">
          <h2>A ideia precisava funcionar de verdade.</h2>
          <p className="story-lead">
            Criamos o aplicativo, o painel interno, a área dos clientes e a base técnica da operação.
          </p>
        </div>
      </section>

      <section className="case-gallery shell-wide" aria-label="Imagens do produto Saldo">
        <figure className="case-gallery-wide">
          <Image
            src="/cases/saldo-flow.webp"
            alt="Página da Saldo com números da plataforma e a comparação da rotina antes e depois do produto"
            width="1440"
            height="960"
            loading="lazy"
            decoding="async"
          />
          <figcaption>O produto explica o problema com números e situações reais da operação.</figcaption>
        </figure>
        <figure className="case-gallery-mobile case-gallery-mobile--saldo">
          <Image
            src="/cases/saldo-mobile.webp"
            alt="Página inicial da Saldo em um celular"
            width="390"
            height="844"
            loading="lazy"
            decoding="async"
          />
          <figcaption>A experiência funciona desde a primeira tela no celular.</figcaption>
        </figure>
        <div className="case-gallery-note">
          <p className="section-index">Da ideia à rotina</p>
          <h2>O produto nasceu para organizar o Pix antes do fim do mês.</h2>
          <p>A interface deixa o gasto, o comprovante e o responsável no mesmo fluxo.</p>
        </div>
      </section>

      <section className="proof-section">
        <div className="shell proof-grid">
          <p className="section-index section-index--light">O que foi entregue</p>
          <div className="proof-list">
            {['Aplicativo financeiro', 'Painel interno', 'Área do cliente', 'Base para operar em produção'].map((item) => (
              <div key={item}><Check aria-hidden="true" /><span>{item}</span></div>
            ))}
          </div>
        </div>
      </section>

      <section className="case-conclusion shell">
        <p className="section-index">O que isso prova</p>
        <blockquote>
          O Saldo mostra que uma equipe pequena consegue colocar um produto financeiro em produção.
        </blockquote>
      </section>
      <Footer />
    </main>
  );
}
