import type { Metadata } from 'next';
import { ArrowUpRight, Check } from 'lucide-react';
import { Footer, Header } from '@/components/eixu';

export const metadata: Metadata = {
  title: 'SaldoPix — Case EIXU',
  description: 'Como um produto financeiro saiu do zero para uma operação comercial real.',
  openGraph: {
    title: 'SaldoPix — Case EIXU',
    description: 'Do zero à produção, com cliente real pagando nas primeiras semanas.',
    images: [],
  },
  twitter: {
    card: 'summary',
    title: 'SaldoPix — Case EIXU',
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
          <p>Um produto financeiro completo, construído do zero até uma operação real.</p>
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
        <p className="section-index">O que precisava acontecer</p>
        <div className="story-body">
          <h2>Não era uma landing page. Era uma operação.</h2>
          <p className="story-lead">
            O SaldoPix precisava sair de uma ideia e se tornar um produto capaz de mover
            dinheiro, organizar clientes e sustentar uma rotina operacional real.
          </p>
          <div className="story-columns">
            <p>
              A construção cobriu webapp, painel administrativo, CMS para clientes,
              gestão de usuários e infraestrutura de operação. Produto, arquitetura,
              experiência, engenharia e deploy foram tratados como uma única entrega.
            </p>
            <p>
              O resultado não foi medido em telas ou horas consumidas. Foi medido pela
              chegada do produto à produção, pelo primeiro cliente e pelo volume que ele
              passou a movimentar.
            </p>
          </div>
        </div>
      </section>

      <section className="proof-section">
        <div className="shell proof-grid">
          <p className="section-index section-index--light">O sistema entregue</p>
          <div className="proof-list">
            {['Webapp transacional', 'Painel administrativo', 'CMS para clientes', 'Gestão de usuários', 'Infraestrutura de operação', 'Produto em produção'].map((item) => (
              <div key={item}><Check aria-hidden="true" /><span>{item}</span></div>
            ))}
          </div>
        </div>
      </section>

      <section className="case-conclusion shell">
        <p className="section-index">O que isso prova</p>
        <blockquote>
          Capacidade de sair do zero e colocar um produto comercial completo em produção.
        </blockquote>
      </section>
      <Footer />
    </main>
  );
}
