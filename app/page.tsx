/* oxlint-disable next/no-html-link-for-pages -- Case links use full navigation for native cross-document transitions. */
import type { Metadata } from 'next';
import Image from 'next/image';
import { ArrowDown, ArrowRight, ArrowUpRight, Check } from 'lucide-react';
import { Footer, Header, Mark } from '@/components/eixu';
import { JsonLd } from '@/components/json-ld';
import { TerminalHeadline } from '@/components/terminal-headline';
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/site';

export const metadata: Metadata = {
  alternates: { canonical: '/' },
};

const homeJsonLd = [
  {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    url: SITE_URL,
    name: SITE_NAME,
    alternateName: 'EIXU Product Studio',
    description: SITE_DESCRIPTION,
    inLanguage: 'pt-BR',
  },
  {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${SITE_URL}/#organization`,
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    areaServed: 'BR',
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: '+55-14-99712-7120',
      contactType: 'sales',
      availableLanguage: 'Portuguese',
    },
  },
];

const moments = [
  { quote: 'Tenho uma ideia. Ainda não sei se vale a pena construir.', path: 'Validação' },
  { quote: 'A ideia faz sentido. Quero testar com pessoas de verdade.', path: 'Primeira versão' },
  { quote: 'Já sei o que precisa ser feito. Falta construir.', path: 'Projeto fechado' },
  { quote: 'Fiz uma versão. Agora a empresa precisa usar de verdade.', path: 'Do protótipo à produção' },
  { quote: 'A demo com IA funciona. Agora precisa virar um produto.', path: 'Da demo com IA à produção' },
];

const offers = [
  {
    index: '01',
    title: 'Discovery e validação',
    result: 'Entendemos o problema e ajudamos você a decidir se vale a pena construir.',
  },
  {
    index: '02',
    title: 'MVP e primeira versão',
    result: 'Colocamos um MVP funcional nas mãos de quem vai usar.',
  },
  {
    index: '03',
    title: 'Projeto fechado',
    result: 'Você já sabe o que precisa. A/gente constrói e coloca no ar.',
  },
];

const brands = [
  'XP',
  'Serasa Experian',
  'Nike',
  'MRV',
  'CVC',
  'Banco BV',
  'Gamers Club',
  '14islands',
];

export default function Home() {
  return (
    <main>
      <JsonLd data={homeJsonLd} />
      <section className="hero" id="inicio">
        <Header />

        <div className="hero-grid shell">
          <p className="eyebrow reveal delay-1">Estúdio de produto e desenvolvimento nativo de IA</p>
          <TerminalHeadline />

          <div className="hero-bottom reveal delay-3">
            <p className="hero-copy">
              Planejamos e desenvolvemos produtos digitais e sistemas com IA. Da ideia à
              produção, sem precisar montar uma equipe inteira.
            </p>
            <a className="round-link" href="#fit" aria-label="Entender quando a EIXU entra">
              <ArrowDown strokeWidth={1.5} />
            </a>
          </div>
        </div>

        <div className="hero-signal" aria-hidden="true">
          <Mark />
        </div>
      </section>

      <section className="opening shell" id="fit">
        <p className="section-index">01 / Quando faz sentido</p>
        <div className="opening-copy">
          <h2>Seu projeto já é importante. Mas ainda não precisa de uma equipe inteira.</h2>
          <p>
            A EIXU entra quando existe um problema real, algum orçamento e uma entrega clara.
          </p>
          <div className="fit-signals" aria-label="Sinais de que uma iniciativa combina com a EIXU">
            <span>Problema real</span>
            <span>Orçamento</span>
            <span>Prazo</span>
            <span>Entrega clara</span>
          </div>
        </div>
      </section>

      <section className="moments" id="momentos">
        <div className="shell moments-heading">
          <p className="section-index">02 / Onde entramos</p>
          <div>
            <p className="eyebrow">O momento importa mais que o cargo</p>
            <h2>Talvez você esteja em um destes momentos.</h2>
          </div>
        </div>
        <div className="shell moment-list">
          {moments.map((moment, index) => (
            <article className="moment-row" key={moment.path}>
              <p className="moment-index">{String(index + 1).padStart(2, '0')}</p>
              <div>
                <h3>“{moment.quote}”</h3>
              </div>
              <span className="moment-path">
                {moment.path}
                <ArrowRight aria-hidden="true" />
              </span>
            </article>
          ))}
        </div>
      </section>

      <section className="offers" id="ofertas">
        <div className="shell section-heading">
          <p className="section-index section-index--light">03 / Como contratar</p>
          <div>
            <p className="eyebrow">Discovery · MVP · Desenvolvimento de software</p>
            <h2>Do problema ao produto em produção.</h2>
          </div>
        </div>
        <div className="shell offer-list">
          {offers.map((offer) => (
            <article className="offer-row" key={offer.title}>
              <p className="offer-index">{offer.index}</p>
              <div>
                <h3>{offer.title}</h3>
              </div>
              <div className="offer-result">
                <p>{offer.result}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="cases" id="cases">
        <div className="shell section-heading section-heading--cases">
          <p className="section-index section-index--light">04 / Cases</p>
          <div>
            <p className="eyebrow">Produto · Engenharia · IA</p>
            <h2>Projetos que a/gente construiu.</h2>
          </div>
        </div>

        <div className="case-list shell">
          <a className="case-card case-card--saldo" href="/cases/saldopix">
            <div className="case-meta">
              <p>Saldo</p>
              <span>Produto financeiro</span>
            </div>
            <div className="case-visual case-visual-image">
              <Image
                src="/cases/saldo-home.webp"
                alt="Página inicial da Saldo mostrando o produto financeiro e a organização dos gastos via Pix"
                width="1440"
                height="960"
                loading="lazy"
                decoding="async"
              />
              <span className="case-image-index" aria-hidden="true">01</span>
            </div>
            <div className="case-copy">
              <h3>Um produto financeiro criado do zero e colocado na rotina de empresas.</h3>
              <p>Produto, engenharia e operação em uma entrega completa.</p>
              <span className="case-link">
                Ver projeto <ArrowUpRight aria-hidden="true" />
              </span>
            </div>
          </a>

          <a className="case-card case-card--naia" href="/cases/naiacrm">
            <div className="case-meta">
              <p>naia</p>
              <span>Sistema nativo de IA</span>
            </div>
            <div className="case-visual case-visual-image">
              <Image
                src="/cases/naia-home.webp"
                alt="Página inicial da naia mostrando o resumo da operação criado com contexto de várias áreas"
                width="1440"
                height="960"
                loading="lazy"
                decoding="async"
              />
              <span className="case-image-index" aria-hidden="true">02</span>
            </div>
            <div className="case-copy">
              <h3>Uma arquitetura multiagente trabalhando dentro de um produto real.</h3>
              <p>Vários modelos, regras e ferramentas no mesmo sistema.</p>
              <span className="case-link">
                Ver projeto <ArrowUpRight aria-hidden="true" />
              </span>
            </div>
          </a>
        </div>
      </section>

      <section className="experience">
        <div className="shell experience-intro">
          <p className="section-index">Experiência</p>
          <div>
            <h2>Experiência construída em grandes produtos.</h2>
            <p>Marcas onde a liderança da EIXU já escreveu código.</p>
          </div>
        </div>
        <div className="brand-grid shell" aria-label="Marcas onde já escrevemos código">
          {brands.map((brand) => (
            <div key={brand}>
              <Check aria-hidden="true" />
              <span>{brand}</span>
            </div>
          ))}
        </div>
        <p className="shell experience-note">
          Essas foram experiências anteriores da liderança. As marcas não são clientes da EIXU.
        </p>
      </section>

      <Footer />
    </main>
  );
}
