import type { Metadata } from 'next';
import Image from 'next/image';
import { ArrowUpRight } from 'lucide-react';
import { Footer, Header } from '@/components/eixu';
import { JsonLd } from '@/components/json-ld';
import { SITE_URL } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Case naia: arquitetura multiagente com AI Gateway | EIXU',
  description: 'Como a EIXU construiu uma arquitetura multiagente com AI Gateway, vários modelos, contratos, ferramentas e medição para um produto real.',
  alternates: { canonical: '/cases/naiacrm' },
  openGraph: {
    title: 'Case naia: arquitetura multiagente com AI Gateway | EIXU',
    description: 'Vários agentes. Um produto sob controle.',
    type: 'article',
    url: `${SITE_URL}/cases/naiacrm`,
    images: [{
      url: `${SITE_URL}/cases/naia-finance-mobile-iphone.webp`,
      width: 1800,
      height: 1200,
      alt: 'Seção financeira da página inicial da naia na versão mobile em um iPhone',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Case naia: arquitetura multiagente com AI Gateway | EIXU',
    description: 'Vários agentes. Um produto sob controle.',
    images: [`${SITE_URL}/cases/naia-finance-mobile-iphone.webp`],
  },
};

const naiaJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'EIXU', item: SITE_URL },
    { '@type': 'ListItem', position: 2, name: 'Cases', item: `${SITE_URL}/#cases` },
    { '@type': 'ListItem', position: 3, name: 'naia' },
  ],
};

export default function NaiaCase() {
  return (
    <main className="case-page case-page--naia case-editorial">
      <JsonLd data={naiaJsonLd} />
      <Header casePage />
      <section className="case-hero shell">
        <p className="eyebrow">Case · Arquitetura multiagente e AI Gateway</p>
        <h1>naia</h1>
      </section>

      <figure className="case-hero-media case-hero-media--naia shell-wide">
        <Image
          src="/cases/naia-finance-mobile-iphone.webp"
          alt="Seção financeira da página inicial da naia exibida na versão mobile em um iPhone"
          width="1800"
          height="1200"
          priority
          decoding="async"
        />
      </figure>

      <section className="case-intro shell">
        <h2>Vários agentes. Um produto sob controle.</h2>
        <div className="case-intro-copy">
          <p>
            naia é um sistema de operação comercial que conecta prospecção, vendas,
            relacionamento, financeiro e jurídico no mesmo contexto.
          </p>
          <p>
            A/gente construiu um gateway multiagente. Ele envia cada tarefa para o modelo certo.
            Cada caminho tem suas próprias ferramentas, limites e resultado esperado.
          </p>
          <p>
            Contratos, permissões, fallback e medição ficam fora do modelo. Assim, o modelo pode
            mudar sem desmontar o produto. É engenharia de software, não vibe coding.
          </p>
          <a href="https://naiacrm.com.br" target="_blank" rel="noreferrer">
            Visitar produto <ArrowUpRight aria-hidden="true" />
          </a>
        </div>
      </section>

      <section className="case-facts shell" aria-label="Resumo do projeto naia">
        <div>
          <span>Arquitetura</span>
          <strong>Gateway multiagente</strong>
        </div>
        <div>
          <span>Roteamento</span>
          <strong>Modelo certo por tarefa</strong>
        </div>
        <div>
          <span>Controle</span>
          <strong>Contratos, medição e fallback</strong>
        </div>
      </section>

      <section className="case-image-story shell-wide" aria-label="Imagens do produto naia">
        <figure className="case-image-wide case-image-surface--naia">
          <Image
            src="/cases/naia-context.webp"
            alt="Página da naia explicando como a pesquisa comercial ganha contexto antes da conversa"
            width="1440"
            height="960"
            loading="lazy"
            decoding="async"
          />
        </figure>
        <div className="case-image-pair case-image-pair--naia">
          <figure className="case-image-phone case-image-surface--naia">
            <Image
              src="/cases/naia-mobile.webp"
              alt="Página inicial da naia em um celular"
              width="390"
              height="844"
              loading="lazy"
              decoding="async"
            />
          </figure>
          <figure className="case-image-detail case-image-surface--naia">
            <Image
              src="/cases/naia-home.webp"
              alt="Detalhe da interface da naia reunindo contexto e próximos passos"
              width="1440"
              height="960"
              loading="lazy"
              decoding="async"
            />
          </figure>
        </div>
        <figure className="case-image-wide case-image-wide--closing case-image-surface--naia">
          <Image
            src="/cases/naia-home.webp"
            alt="Experiência completa da naia para organizar a operação comercial com IA"
            width="1440"
            height="960"
            loading="lazy"
            decoding="async"
          />
        </figure>
      </section>

      <p className="case-closing-line shell">O modelo muda. O sistema continua.</p>
      <Footer />
    </main>
  );
}
