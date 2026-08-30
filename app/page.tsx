import { ArrowDown, ArrowRight, ArrowUpRight, Check } from 'lucide-react';
import { Footer, Header, Mark } from '@/components/eixu';

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
    title: 'Validação',
    result: 'Entendemos o problema e ajudamos você a decidir se vale a pena construir.',
  },
  {
    index: '02',
    title: 'Primeira versão',
    result: 'Colocamos uma versão funcional nas mãos de quem vai usar.',
  },
  {
    index: '03',
    title: 'Projeto fechado',
    result: 'Você já sabe o que precisa. A gente constrói e coloca no ar.',
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
      <section className="hero" id="inicio">
        <Header />

        <div className="hero-grid shell">
          <p className="eyebrow reveal delay-1">Estúdio de produto e desenvolvimento nativo de IA</p>
          <h1 className="hero-title reveal delay-2">
            Você já tem alguma coisa.
            <br />
            <span>A EIXU leva até produção.</span>
          </h1>

          <div className="hero-bottom reveal delay-3">
            <p className="hero-copy">
              Pode ser uma ideia, um protótipo, uma demo ou um plano. Você não precisa
              montar uma equipe inteira para começar.
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
            <p className="eyebrow">Validação · Primeira versão · Projeto fechado</p>
            <h2>Três formas simples de trabalhar com a gente.</h2>
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
          <p className="section-index section-index--light">04 / Projetos reais</p>
          <div>
            <p className="eyebrow">Já colocamos produtos no ar</p>
            <h2>Dois produtos que já estão em uso.</h2>
          </div>
        </div>

        <div className="case-list shell">
          <a className="case-card case-card--saldo" href="/cases/saldopix">
            <div className="case-meta">
              <p>SaldoPix</p>
              <span>Produto financeiro · 2026</span>
            </div>
            <div className="case-visual" aria-hidden="true">
              <div className="saldo-orbit">
                <span>R$</span>
                <i />
                <i />
              </div>
              <p>~R$ 1 mi / mês</p>
            </div>
            <div className="case-copy">
              <h3>Criado do zero. Primeiro cliente pagante em poucas semanas.</h3>
              <p>Cerca de R$ 1 milhão movimentado por mês.</p>
              <span className="case-link">
                Ver projeto <ArrowUpRight aria-hidden="true" />
              </span>
            </div>
          </a>

          <a className="case-card case-card--naia" href="/cases/naiacrm">
            <div className="case-meta">
              <p>NaiaCRM</p>
              <span>Sistemas de IA · 2026</span>
            </div>
            <div className="case-visual naia-system" aria-hidden="true">
              <div className="system-node system-node--main">Naia</div>
              <div className="system-node system-node--one">01</div>
              <div className="system-node system-node--two">02</div>
              <div className="system-node system-node--three">03</div>
              <i className="system-line line-one" />
              <i className="system-line line-two" />
              <i className="system-line line-three" />
            </div>
            <div className="case-copy">
              <h3>IA dentro de um produto usado no dia a dia.</h3>
              <p>Não é só um chat. É um sistema preparado para produção.</p>
              <span className="case-link">
                Ver projeto <ArrowUpRight aria-hidden="true" />
              </span>
            </div>
          </a>
        </div>
      </section>

      <section className="experience">
        <div className="shell experience-intro">
          <p className="section-index">Experiência anterior</p>
          <div>
            <h2>A EIXU é nova.<br />Nossa experiência não.</h2>
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
