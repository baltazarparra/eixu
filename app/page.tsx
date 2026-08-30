import { ArrowDown, ArrowRight, ArrowUpRight, Check } from 'lucide-react';
import { Footer, Header, Mark } from '@/components/eixu';

const moments = [
  { quote: 'Tenho uma ideia. Ainda não sei se vale construir.', path: 'Discovery' },
  { quote: 'A ideia faz sentido. Preciso testar com usuários.', path: 'MVP' },
  { quote: 'Já sei o que preciso. Falta construir.', path: 'Projeto fechado' },
  { quote: 'Fiz uma versão. Agora a empresa quer usar de verdade.', path: 'Protótipo para produção' },
  { quote: 'Minha demo com IA funciona. Agora precisa virar produto.', path: 'IA para produção' },
];

const offers = [
  {
    index: '01',
    title: 'Discovery',
    result: 'Entendemos o problema e ajudamos você a decidir o que vale construir.',
  },
  {
    index: '02',
    title: 'MVP',
    result: 'Criamos uma primeira versão real para testar com usuários.',
  },
  {
    index: '03',
    title: 'Projeto fechado',
    result: 'Você já sabe o que precisa. Nós construímos e colocamos no ar.',
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
          <p className="eyebrow reveal delay-1">Product Engineering, AI-native.</p>
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
          <div className="fit-signals" aria-label="Sinais de que uma iniciativa tem fit com a EIXU">
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
            <h2>A EIXU entra em cinco momentos.</h2>
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
            <p className="eyebrow">Discovery · MVP · Projeto fechado</p>
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
          <p className="section-index section-index--light">04 / Trabalho real</p>
          <div>
            <p className="eyebrow">Já fizemos isso na prática</p>
            <h2>Produtos que chegaram à produção.</h2>
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
              <h3>Produto criado do zero. Cliente pagando nas primeiras semanas.</h3>
              <p>Cerca de R$ 1 milhão movimentado por mês.</p>
              <span className="case-link">
                Ver case <ArrowUpRight aria-hidden="true" />
              </span>
            </div>
          </a>

          <a className="case-card case-card--naia" href="/cases/naiacrm">
            <div className="case-meta">
              <p>NaiaCRM</p>
              <span>AI systems · 2026</span>
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
              <h3>IA que funciona dentro de um produto real.</h3>
              <p>Não é só um chat. É um sistema feito para produção.</p>
              <span className="case-link">
                Ver case <ArrowUpRight aria-hidden="true" />
              </span>
            </div>
          </a>
        </div>
      </section>

      <section className="experience">
        <div className="shell experience-intro">
          <p className="section-index">Experiência anterior</p>
          <div>
            <h2>A EIXU é nova.<br />A experiência não é.</h2>
            <p>A liderança da EIXU já escreveu código para estas marcas.</p>
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
