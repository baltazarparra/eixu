import type { Metadata } from 'next';
import { ArrowUpRight } from 'lucide-react';
import { Footer, Header } from '@/components/eixu';

export const metadata: Metadata = {
  title: 'NaiaCRM — Case EIXU',
  description: 'Engenharia AI-native aplicada a um sistema comercial complexo e operacional.',
  openGraph: {
    title: 'NaiaCRM — Case EIXU',
    description: 'Modelo é detalhe. O sistema é a aposta.',
    images: [],
  },
  twitter: {
    card: 'summary',
    title: 'NaiaCRM — Case EIXU',
    description: 'Modelo é detalhe. O sistema é a aposta.',
    images: [],
  },
};

const lanes = [
  { index: '01', title: 'Pessoa esperando', copy: 'Baixa latência, streaming, poucos round-trips e um orçamento curto de ferramentas.' },
  { index: '02', title: 'Efeito supervisionado', copy: 'Ações relevantes com autorização determinística, confirmação humana e trilha de auditoria.' },
  { index: '03', title: 'Background', copy: 'Pesquisa, síntese e dossiês em workflows duráveis, com qualidade, custo e tempo medidos.' },
];

export default function NaiaCase() {
  return (
    <main className="case-page case-page--naia">
      <Header casePage />
      <section className="case-hero shell">
        <p className="eyebrow">Case 02 · AI systems</p>
        <h1>NaiaCRM</h1>
        <div className="case-hero-summary">
          <p>Inteligência comercial com IA integrada à jornada — da prospecção ao pós-venda.</p>
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
        <p className="section-index">O problema de engenharia</p>
        <div className="story-body">
          <h2>IA em produção exige mais do que um bom prompt.</h2>
          <p className="story-lead">
            A Naia trata IA como parte de um sistema operacional: com consequência,
            autorização, persistência, custo, latência, avaliação e evolução de modelos.
          </p>
          <div className="story-columns">
            <p>
              As tarefas declaram capacidade, schema, ferramentas, orçamento, timeout e
              fallback. O consumidor pede um resultado sem precisar conhecer catálogo,
              provedor ou configuração específica de modelo.
            </p>
            <p>
              Decisões probabilísticas permanecem dentro de limites determinísticos.
              Permissões, idempotência e efeitos externos continuam sob controle do sistema.
            </p>
          </div>
        </div>
      </section>

      <section className="lanes-section">
        <div className="shell lanes-heading">
          <p className="section-index section-index--light">Três lanes operacionais</p>
          <h2>A experiência define a arquitetura.</h2>
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
          Profundidade de Product Engineering AI-native em um produto complexo e operacional.
        </blockquote>
      </section>
      <Footer />
    </main>
  );
}
