import type { Metadata } from 'next';
import Image from 'next/image';
import { ArrowUpRight } from 'lucide-react';
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
    <main className="case-page case-page--saldo case-editorial">
      <JsonLd data={saldoJsonLd} />
      <Header casePage />
      <section className="case-hero shell">
        <p className="eyebrow">Case · Desenvolvimento de produto financeiro</p>
        <h1>Saldo</h1>
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
      </figure>

      <section className="case-intro shell">
        <h2>O Pix entrou na rotina. A bagunça saiu.</h2>
        <div className="case-intro-copy">
          <p>
            Saldo organiza os gastos de equipes desde o pagamento. Valor, responsável e
            comprovante nascem juntos, sem deixar a conferência para o fim do mês.
          </p>
          <p>
            A/gente criou o produto, o aplicativo, o painel interno e a operação. Em poucas
            semanas, a primeira versão já tinha cliente pagante.
          </p>
          <p>
            Hoje, a plataforma movimenta cerca de R$ 1 milhão por mês e continua evoluindo como
            um produto financeiro completo.
          </p>
          <a href="https://saldopix.com.br" target="_blank" rel="noreferrer">
            Visitar produto <ArrowUpRight aria-hidden="true" />
          </a>
        </div>
      </section>

      <section className="case-facts shell" aria-label="Resumo do projeto Saldo">
        <div>
          <span>Produto</span>
          <strong>Do zero à produção</strong>
        </div>
        <div>
          <span>Primeiro cliente</span>
          <strong>Em poucas semanas</strong>
        </div>
        <div>
          <span>Operação</span>
          <strong>~R$ 1 mi por mês</strong>
        </div>
      </section>

      <section className="case-image-story shell-wide" aria-label="Imagens do produto Saldo">
        <figure className="case-image-wide case-image-surface--saldo">
          <Image
            src="/cases/saldo-flow.webp"
            alt="Página da Saldo com números da plataforma e a comparação da rotina antes e depois do produto"
            width="1440"
            height="960"
            loading="lazy"
            decoding="async"
          />
        </figure>
        <div className="case-image-pair case-image-pair--saldo">
          <figure className="case-image-phone case-image-surface--saldo">
            <Image
              src="/cases/saldo-mobile.webp"
              alt="Página inicial da Saldo em um celular"
              width="390"
              height="844"
              loading="lazy"
              decoding="async"
            />
          </figure>
          <figure className="case-image-detail case-image-surface--saldo">
            <Image
              src="/cases/saldo-home.webp"
              alt="Detalhe da interface da Saldo mostrando saldo disponível e pagamentos via Pix"
              width="1440"
              height="960"
              loading="lazy"
              decoding="async"
            />
          </figure>
        </div>
        <figure className="case-image-wide case-image-wide--closing case-image-surface--saldo">
          <Image
            src="/cases/saldo-home.webp"
            alt="Experiência completa da Saldo para organizar gastos de equipes via Pix"
            width="1440"
            height="960"
            loading="lazy"
            decoding="async"
          />
        </figure>
      </section>

      <p className="case-closing-line shell">O gasto já nasce organizado.</p>
      <Footer />
    </main>
  );
}
