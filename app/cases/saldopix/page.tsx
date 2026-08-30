import type { Metadata } from 'next';
import { ArrowUpRight, Check } from 'lucide-react';
import { Footer, Header } from '@/components/eixu';

export const metadata: Metadata = {
  title: 'SaldoPix | Projeto da EIXU',
  description: 'Um produto financeiro criado do zero e usado no dia a dia por empresas.',
  openGraph: {
    title: 'SaldoPix | Projeto da EIXU',
    description: 'Do zero à produção, com o primeiro cliente pagante em poucas semanas.',
    images: [],
  },
  twitter: {
    card: 'summary',
    title: 'SaldoPix | Projeto da EIXU',
    description: 'Do zero à produção, com o primeiro cliente pagante em poucas semanas.',
    images: [],
  },
};

export default function SaldoPixCase() {
  return (
    <main className="case-page case-page--saldo">
      <Header casePage />
      <section className="case-hero shell">
        <p className="eyebrow">Projeto 01 · Produto financeiro para empresas</p>
        <h1>SaldoPix</h1>
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
          O SaldoPix mostra que uma equipe pequena consegue colocar um produto financeiro em produção.
        </blockquote>
      </section>
      <Footer />
    </main>
  );
}
