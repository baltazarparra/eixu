import type { Metadata } from 'next';
import { ArrowUpRight, Check } from 'lucide-react';
import { Footer, Header } from '@/components/eixu';

export const metadata: Metadata = {
  title: 'SaldoPix | Case EIXU',
  description: 'Um produto financeiro criado do zero e usado por clientes reais.',
  openGraph: {
    title: 'SaldoPix | Case EIXU',
    description: 'Do zero à produção, com cliente real pagando nas primeiras semanas.',
    images: [],
  },
  twitter: {
    card: 'summary',
    title: 'SaldoPix | Case EIXU',
    description: 'Do zero à produção, com cliente real pagando nas primeiras semanas.',
    images: [],
  },
};

export default function SaldoPixCase() {
  return (
    <main className="case-page case-page--saldo">
      <Header casePage />
      <section className="case-hero shell">
        <p className="eyebrow">Case 01 · Fintech B2B</p>
        <h1>SaldoPix</h1>
        <div className="case-hero-summary">
          <p>Um produto financeiro criado do zero e usado por clientes reais.</p>
          <a href="https://saldopix.com.br" target="_blank" rel="noreferrer">
            Visitar produto <ArrowUpRight aria-hidden="true" />
          </a>
        </div>
      </section>

      <section className="metric-band">
        <div className="shell metrics-grid">
          <div><strong>~R$ 1 mi</strong><span>movimentado por mês</span></div>
          <div><strong>Semanas</strong><span>até o primeiro cliente pagante</span></div>
          <div><strong>100%</strong><span>desenvolvimento AI-native</span></div>
        </div>
      </section>

      <section className="case-story shell">
        <p className="section-index">O desafio</p>
        <div className="story-body">
          <h2>A ideia precisava virar produto.</h2>
          <p className="story-lead">
            Criamos o app, o painel interno, a área dos clientes e a estrutura usada na operação.
          </p>
        </div>
      </section>

      <section className="proof-section">
        <div className="shell proof-grid">
          <p className="section-index section-index--light">O sistema entregue</p>
          <div className="proof-list">
            {['App financeiro', 'Painel interno', 'Área do cliente', 'Estrutura de produção'].map((item) => (
              <div key={item}><Check aria-hidden="true" /><span>{item}</span></div>
            ))}
          </div>
        </div>
      </section>

      <section className="case-conclusion shell">
        <p className="section-index">O que isso prova</p>
        <blockquote>
          O SaldoPix mostra que uma equipe pequena pode colocar um produto financeiro real no ar.
        </blockquote>
      </section>
      <Footer />
    </main>
  );
}
