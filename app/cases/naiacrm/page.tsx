import type { Metadata } from 'next';
import { ArrowUpRight } from 'lucide-react';
import { Footer, Header } from '@/components/eixu';

export const metadata: Metadata = {
  title: 'naia | Projeto da EIXU',
  description: 'Como construímos a naia: uma arquitetura multiagente com gateway de IA e modelos escolhidos por tarefa.',
  openGraph: {
    title: 'naia | Projeto da EIXU',
    description: 'O modelo é detalhe. O sistema é a aposta.',
    images: [],
  },
  twitter: {
    card: 'summary',
    title: 'naia | Projeto da EIXU',
    description: 'O modelo é detalhe. O sistema é a aposta.',
    images: [],
  },
};

const lanes = [
  {
    index: '01',
    title: 'Pessoa esperando',
    copy: 'Respostas rápidas, streaming e poucas chamadas.',
  },
  {
    index: '02',
    title: 'Ação supervisionada',
    copy: 'A IA prepara. A pessoa confirma. O servidor autoriza.',
  },
  {
    index: '03',
    title: 'Trabalho em segundo plano',
    copy: 'Pesquisa, dossiê e revisão com jobs duráveis.',
  },
];

const architecture = [
  {
    index: '01',
    title: 'Entrada',
    copy: 'O pedido chega com o contexto da tela e da pessoa.',
  },
  {
    index: '02',
    title: 'Roteador',
    copy: 'A tarefa entra no caminho certo antes da primeira chamada.',
  },
  {
    index: '03',
    title: 'Agente',
    copy: 'Recebe ferramentas, limites e um resultado esperado.',
  },
  {
    index: '04',
    title: 'Gateway',
    copy: 'Escolhe provedor, modelo, esforço e fallback.',
  },
  {
    index: '05',
    title: 'Evidência',
    copy: 'Mede qualidade, tempo, custo e resultado.',
  },
];

const policies = ['Modelo', 'Raciocínio', 'Ferramentas', 'Tempo limite', 'Fallback', 'Schema'];

const engineeringProof = [
  'Contratos antes do modelo',
  'Permissões fora da IA',
  'Jobs com retry e checkpoints',
  'Qualidade, latência e custo medidos',
];

export default function NaiaCase() {
  return (
    <main className="case-page case-page--naia">
      <Header casePage />
      <section className="case-hero shell">
        <p className="eyebrow">Projeto 02 · Sistema nativo de IA</p>
        <h1>naia</h1>
        <div className="case-hero-summary">
          <p>Um CRM onde vários agentes trabalham juntos e cada tarefa usa o modelo certo.</p>
          <a href="https://naiacrm.com.br" target="_blank" rel="noreferrer">
            Visitar produto <ArrowUpRight aria-hidden="true" />
          </a>
        </div>
      </section>

      <section className="naia-statement">
        <div className="shell">
          <p>Como pensamos a arquitetura</p>
          <h2>O modelo é detalhe.<br /><span>O sistema é a aposta.</span></h2>
        </div>
      </section>

      <section className="case-story shell">
        <p className="section-index">O desafio</p>
        <div className="story-body">
          <h2>Uma demo responde. Um produto precisa funcionar.</h2>
          <p className="story-lead">
            Fazer um chat responder é simples. Difícil é unir agentes, ferramentas, contexto,
            permissões, histórico e custo sem perder o controle.
          </p>
        </div>
      </section>

      <section className="naia-architecture">
        <div className="shell architecture-heading">
          <p className="section-index section-index--light">Arquitetura multiagente</p>
          <div>
            <p className="eyebrow">Uma entrada · vários agentes · vários modelos</p>
            <h2>Cada pedido percorre um caminho pensado para ele.</h2>
          </div>
        </div>
        <div className="shell architecture-flow">
          {architecture.map((step) => (
            <article key={step.index}>
              <span>{step.index}</span>
              <h3>{step.title}</h3>
              <p>{step.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="lanes-section">
        <div className="shell lanes-heading">
          <p className="section-index section-index--light">Três caminhos</p>
          <h2>A configuração muda conforme o risco e a espera.</h2>
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

      <section className="naia-policy shell">
        <p className="section-index">Configuração por tarefa</p>
        <div className="policy-body">
          <h2>O sistema escolhe. O produto não fica preso a um modelo.</h2>
          <p>
            Modelos rápidos, modelos mais fortes e modelos abertos podem trabalhar no mesmo
            produto. A escolha muda junto com as regras de cada tarefa.
          </p>
          <div className="policy-grid" aria-label="Configurações definidas para cada tarefa">
            {policies.map((policy, index) => (
              <div key={policy}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <strong>{policy}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="naia-proof">
        <div className="shell proof-heading">
          <p className="section-index">O oposto de vibe coding</p>
          <div>
            <h2>Nada depende de um prompt mágico.</h2>
            <p>
              A/gente construiu contratos, segurança e medição em volta da IA. Assim, trocar um
              modelo é simples. Trocar o sistema inteiro não é necessário.
            </p>
          </div>
        </div>
        <div className="shell engineering-grid">
          {engineeringProof.map((proof, index) => (
            <div key={proof}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <p>{proof}</p>
            </div>
          ))}
        </div>
        <p className="shell naia-stack">
          Next.js · React · TypeScript · Vercel Workflow · AI SDK · AI Gateway · Neon/Postgres
        </p>
      </section>

      <section className="case-conclusion shell">
        <p className="section-index">O que isso prova</p>
        <blockquote>
          IA nativa não é colocar um chat no produto. É construir o produto inteiro para trabalhar
          com IA.
        </blockquote>
      </section>
      <Footer />
    </main>
  );
}
