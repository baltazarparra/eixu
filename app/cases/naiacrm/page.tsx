import type { Metadata } from 'next';
import { ArrowUpRight } from 'lucide-react';
import { Footer, Header } from '@/components/eixu';

export const metadata: Metadata = {
  title: 'NaiaCRM | Case EIXU',
  description: 'Um CRM com IA feito para uso real.',
  openGraph: {
    title: 'NaiaCRM | Case EIXU',
    description: 'Modelo é detalhe. O sistema é a aposta.',
    images: [],
  },
  twitter: {
    card: 'summary',
    title: 'NaiaCRM | Case EIXU',
    description: 'Modelo é detalhe. O sistema é a aposta.',
    images: [],
  },
};

const lanes = [
  { index: '01', title: 'Resposta rápida', copy: 'Para tarefas em que a pessoa está esperando.' },
  { index: '02', title: 'Ação com revisão', copy: 'Para ações que precisam de confirmação.' },
  { index: '03', title: 'Segundo plano', copy: 'Para pesquisas e tarefas mais longas.' },
];

export default function NaiaCase() {
  return (
    <main className="case-page case-page--naia">
      <Header casePage />
      <section className="case-hero shell">
        <p className="eyebrow">Case 02 · Sistemas de IA</p>
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
          <p>Princípio de arquitetura</p>
          <h2>Modelo é detalhe.<br /><span>O sistema é a aposta.</span></h2>
        </div>
      </section>

      <section className="case-story shell">
        <p className="section-index">O desafio</p>
        <div className="story-body">
          <h2>Uma demo de IA não basta.</h2>
          <p className="story-lead">
            Para funcionar no dia a dia, a IA precisa ter regras, permissões, histórico e controle de custo.
          </p>
        </div>
      </section>

      <section className="lanes-section">
        <div className="shell lanes-heading">
          <p className="section-index section-index--light">Três caminhos</p>
          <h2>Cada tarefa segue um caminho.</h2>
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
          A Naia mostra como levar IA para um produto real, com controle e segurança.
        </blockquote>
      </section>
      <Footer />
    </main>
  );
}
