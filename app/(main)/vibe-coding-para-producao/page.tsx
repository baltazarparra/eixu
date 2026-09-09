import type { Metadata } from 'next';
import { ArrowUpRight } from 'lucide-react';
import { Footer, Header } from '@/components/eixu';
import { JsonLd } from '@/components/json-ld';
import { SITE_NAME, SITE_URL } from '@/lib/site';

const title = 'Do vibe coding à produção: transforme protótipo em produto | EIXU';
const description =
  'Seu protótipo com IA funcionou. Veja o que precisa mudar em código, segurança, dados e operação antes de colocar o produto em produção.';

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/vibe-coding-para-producao' },
  openGraph: {
    title,
    description,
    type: 'article',
    url: `${SITE_URL}/vibe-coding-para-producao`,
    images: [],
  },
  twitter: {
    card: 'summary',
    title,
    description,
    images: [],
  },
};

const productionSteps = [
  {
    title: 'Código que outra pessoa entende',
    copy: 'A/gente identifica o que vale manter, remove atalhos perigosos e organiza a base para o produto continuar evoluindo.',
  },
  {
    title: 'Segurança antes do acesso',
    copy: 'Login, permissões, dados e segredos precisam estar protegidos antes de abrir o produto para clientes ou para a equipe.',
  },
  {
    title: 'Dados que não se perdem',
    copy: 'É preciso definir onde cada informação fica, quem pode acessar e como recuperar tudo quando algo falha.',
  },
  {
    title: 'IA com regras claras',
    copy: 'Cada tarefa precisa de contexto, modelo, limite de custo, fallback e uma decisão clara sobre quando a pessoa revisa.',
  },
  {
    title: 'Uma operação que continua funcionando',
    copy: 'Testes, monitoramento e uma forma segura de publicar mudanças evitam que cada correção vire uma nova surpresa.',
  },
];

const questions = [
  {
    question: 'Preciso jogar o protótipo fora?',
    answer:
      'Não. Primeiro a/gente entende o que já existe. Partes boas podem continuar e os riscos são corrigidos por prioridade.',
  },
  {
    question: 'Vibe coding serve para um produto real?',
    answer:
      'Serve muito bem para aprender e validar. Para produção, ele precisa ganhar engenharia, segurança e uma operação clara.',
  },
  {
    question: 'Quando faz sentido procurar ajuda?',
    answer:
      'Quando a versão já prova a ideia, mas colocar pessoas usando ainda parece arriscado, lento ou difícil de manter.',
  },
];

const articleJsonLd = [
  {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'Vibe coding validou a ideia. E agora?',
    description,
    datePublished: '2026-08-30',
    dateModified: '2026-08-30',
    inLanguage: 'pt-BR',
    mainEntityOfPage: `${SITE_URL}/vibe-coding-para-producao`,
    author: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
    publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
  },
  {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: questions.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  },
  {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'EIXU', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Do vibe coding à produção' },
    ],
  },
];

export default function VibeCodingToProduction() {
  return (
    <main className="article-page">
      <JsonLd data={articleJsonLd} />
      <Header casePage backHref="/" backLabel="Início" />

      <article>
        <header className="article-hero shell">
          <p className="eyebrow">Vibe coding · Produto · Engenharia</p>
          <h1>Vibe coding validou a ideia. E agora?</h1>
          <p className="article-lead">
            Uma primeira versão pode nascer em um fim de semana. Para uma empresa usar, ela
            precisa continuar funcionando na segunda-feira.
          </p>
        </header>

        <section className="article-section shell">
          <p className="section-index">01 / O ponto de partida</p>
          <div className="article-section-body">
            <h2>Vibe coding não é o problema.</h2>
            <p>
              É uma forma rápida de testar uma ideia, montar uma interface e descobrir se alguém
              realmente quer usar aquilo. Essa velocidade tem valor.
            </p>
            <p>
              O problema começa quando um protótipo é tratado como produto pronto. Enquanto só
              quem criou usa, quase todo erro pode ser resolvido na hora. Quando uma equipe ou um
              cliente depende dele, cada erro vira um problema de operação.
            </p>
          </div>
        </section>

        <section className="article-turning-point">
          <div className="shell article-turning-grid">
            <p className="section-index section-index--light">02 / A mudança de fase</p>
            <div>
              <p className="eyebrow">O protótipo provou a ideia</p>
              <h2>Produção prova que o sistema aguenta.</h2>
              <p>
                Agora entram pessoas diferentes, dados reais, permissões, integrações, custos e
                situações que ninguém testou na primeira versão.
              </p>
            </div>
          </div>
        </section>

        <section className="article-checklist shell">
          <p className="section-index">03 / Antes de colocar no ar</p>
          <div className="article-step-list">
            {productionSteps.map((step, index) => (
              <article key={step.title}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <h3>{step.title}</h3>
                <p>{step.copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="article-section article-section--eixu shell">
          <p className="section-index">04 / Onde a EIXU entra</p>
          <div className="article-section-body">
            <h2>A/gente não começa do zero.</h2>
            <p>
              A/gente entende o que você já construiu, separa o que funciona do que traz risco e
              organiza o caminho até produção. O protótipo continua sendo uma vantagem, porque já
              mostrou o problema e a direção do produto.
            </p>
            <a
              className="text-link"
              href="https://wa.me/5514997127120?text=Oi%2C%20fiz%20um%20prot%C3%B3tipo%20com%20vibe%20coding%20e%20quero%20levar%20para%20produ%C3%A7%C3%A3o."
              target="_blank"
              rel="noreferrer"
            >
              Levar meu protótipo para produção <ArrowUpRight aria-hidden="true" />
            </a>
          </div>
        </section>

        <section className="article-faq shell" aria-labelledby="article-faq-title">
          <p className="section-index">Perguntas comuns</p>
          <div>
            <h2 id="article-faq-title">Sem complicar.</h2>
            <div className="article-faq-list">
              {questions.map((item) => (
                <article key={item.question}>
                  <h3>{item.question}</h3>
                  <p>{item.answer}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </article>

      <Footer />
    </main>
  );
}
