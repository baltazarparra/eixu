import type { Metadata } from 'next';
import { ArrowUpRight } from 'lucide-react';
import { Footer, Header } from '@/components/eixu';

export const metadata: Metadata = {
  title: 'NaiaCRM | Projeto da EIXU',
  description: 'Um CRM com IA feito para o trabalho comercial do dia a dia.',
  openGraph: {
    title: 'NaiaCRM | Projeto da EIXU',
    description: 'O modelo é só uma parte. O sistema inteiro precisa funcionar.',
    images: [],
  },
  twitter: {
    card: 'summary',
    title: 'NaiaCRM | Projeto da EIXU',
    description: 'O modelo é só uma parte. O sistema inteiro precisa funcionar.',
    images: [],
  },
};

const lanes = [
  { index: '01', title: 'Resposta rápida', copy: 'Quando alguém está esperando a resposta.' },
  { index: '02', title: 'Ação com revisão', copy: 'Quando a pessoa precisa confirmar antes de seguir.' },
  { index: '03', title: 'Em segundo plano', copy: 'Para pesquisas e tarefas que levam mais tempo.' },
];

export default function NaiaCase() {
  return (
    <main className="case-page case-page--naia">
      <Header casePage />
      <section className="case-hero shell">
        <p className="eyebrow">Projeto 02 · Produto com IA</p>
        <h1>NaiaCRM</h1>
        <div className="case-hero-summary">
          <p>Um CRM com IA para apoiar o trabalho comercial.</p>
          <a href="https://naiacrm.com.br" target="_blank" rel="noreferrer">
            Visitar produto <ArrowUpRight aria-hidden="true" />
          </a>
        </div>
      </section>

      <section className="naia-statement">
        <div className="shell">
          <p>Como pensamos a arquitetura</p>
          <h2>O modelo é só uma parte.<br /><span>O sistema inteiro precisa funcionar.</span></h2>
        </div>
      </section>

      <section className="case-story shell">
        <p className="section-index">O desafio</p>
        <div className="story-body">
          <h2>Uma demo com IA não basta.</h2>
          <p className="story-lead">
            No dia a dia, a IA precisa de regras, permissões, histórico e controle de custos.
          </p>
        </div>
      </section>

      <section className="lanes-section">
        <div className="shell lanes-heading">
          <p className="section-index section-index--light">Como funciona</p>
          <h2>Cada tarefa segue o caminho certo.</h2>
        </div>
        <div className="shell lanes-grid">
          {lanes.map((lane) => (
            <article key={lane.index}>
              <span>{lane.index}</span>
              <h3>{lane.title}</h3>
              <p>{lane.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="case-conclusion shell">
        <p className="section-index">O que isso prova</p>
        <blockquote>
          A Naia mostra como colocar IA em um produto usado no dia a dia, com controle e segurança.
        </blockquote>
      </section>
      <Footer />
    </main>
  );
}
