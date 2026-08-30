import type { Metadata } from 'next';
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
    images: [],
  },
  twitter: {
    card: 'summary',
    title: 'Case Saldo: produto financeiro do zero à produção | EIXU',
    description: 'Do zero ao primeiro cliente pagante em poucas semanas.',
    images: [],
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

export default function SaldoPixCase() {
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
