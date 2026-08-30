import { ArrowDown, ArrowUpRight, Check, Minus } from 'lucide-react';
import { Footer, Header, Mark } from '@/components/eixu';

const offers = [
  {
    index: '01',
    title: 'Discovery',
    question: 'Ainda não está claro se vale a pena construir.',
    result: 'Reduzimos o risco até existir uma decisão defensável: construir, mudar ou parar.',
    deliverables: ['Hipótese e problema', 'Riscos e viabilidade', 'Escopo e recomendação'],
  },
  {
    index: '02',
    title: 'MVP',
    question: 'A hipótese faz sentido. Agora ela precisa encontrar usuários reais.',
    result: 'Construímos software funcional com objetivo, prazo e critério de sucesso definidos.',
    deliverables: ['Produto funcional', 'Infraestrutura real', 'Evidência para decidir'],
  },
  {
    index: '03',
    title: 'Projeto fechado',
    question: 'Você já sabe o que precisa. Falta colocar em produção.',
    result: 'Fechamos resultado, escopo, preço e prazo. Construímos, entregamos e encerramos.',
    deliverables: ['Aplicações e features', 'Integrações e automações', 'Soluções com IA'],
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
            Produto e tecnologia,
            <br />
            <span>do problema à produção.</span>
          </h1>

          <div className="hero-bottom reveal delay-3">
            <p className="hero-copy">
              Discovery, MVP e projetos fechados para quem precisa transformar uma
              oportunidade em evidência — ou em software real.
            </p>
            <a className="round-link" href="#contexto" aria-label="Conhecer a EIXU">
              <ArrowDown strokeWidth={1.5} />
            </a>
          </div>
        </div>

        <div className="hero-signal" aria-hidden="true">
          <Mark />
        </div>
      </section>

      <section className="opening shell" id="contexto">
        <p className="section-index">01 / O problema</p>
        <div className="opening-copy">
          <h2>Nem toda ideia precisa começar com um squad.</h2>
          <div className="opening-columns">
            <p>
              Você acabou de assumir mais responsabilidade técnica. A ideia é importante,
              a pressão é real — mas ainda não existe clareza suficiente para mobilizar uma
              operação inteira.
            </p>
            <p>
              A EIXU entra antes da estrutura crescer. Concentra produto, engenharia e
              sistemas de IA para reduzir o caminho entre uma oportunidade e uma decisão
              que você consegue sustentar.
            </p>
          </div>
          <p className="pull-quote">
            Existem problemas que precisam de uma grande consultoria. E existem problemas
            que nunca deveriam precisar de uma.
          </p>
        </div>
      </section>

      <section className="offers" id="ofertas">
        <div className="shell section-heading">
          <p className="section-index section-index--light">02 / Como contratar</p>
          <div>
            <p className="eyebrow">Discovery · MVP · Projetos fechados</p>
            <h2>Comece pelo tamanho real da decisão.</h2>
          </div>
        </div>
        <div className="shell offer-list">
          {offers.map((offer) => (
            <article className="offer-row" key={offer.title}>
              <p className="offer-index">{offer.index}</p>
              <div>
                <h3>{offer.title}</h3>
                <p className="offer-question">{offer.question}</p>
              </div>
              <div className="offer-result">
                <p>{offer.result}</p>
                <ul>
                  {offer.deliverables.map((item) => (
                    <li key={item}>
                      <Minus aria-hidden="true" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="method shell">
        <p className="section-index">03 / O modelo</p>
        <div className="method-body">
          <h2>Pouca gente. Muita engenharia. Produto em produção.</h2>
          <div className="method-grid">
            <div>
              <span>01</span>
              <h3>Senioridade concentrada</h3>
              <p>Quem entende o problema permanece perto das decisões e da implementação.</p>
            </div>
            <div>
              <span>02</span>
              <h3>AI-native de verdade</h3>
              <p>IA atravessa planejamento, arquitetura, código, testes, revisão e operação.</p>
            </div>
            <div>
              <span>03</span>
              <h3>Escopo disciplinado</h3>
              <p>Resultado, prazo e critério de sucesso são combinados antes da construção.</p>
            </div>
            <div>
              <span>04</span>
              <h3>Responsabilidade direta</h3>
              <p>Menos handoffs, menos cerimônia e uma linha clara entre decisão e entrega.</p>
            </div>
          </div>
          <div className="not-list">
            <p>A EIXU não vende</p>
            <div>
              <span>squads</span>
              <span>horas</span>
              <span>headcount</span>
              <span>vibe coding</span>
            </div>
          </div>
        </div>
      </section>

      <section className="cases" id="cases">
        <div className="shell section-heading section-heading--cases">
          <p className="section-index section-index--light">04 / Trabalho em produção</p>
          <div>
            <p className="eyebrow">A tese já foi testada</p>
            <h2>Dois produtos. Duas provas complementares.</h2>
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
              <h3>Do zero à produção — e a um cliente real pagando nas primeiras semanas.</h3>
              <p>Produto completo, operação real e aproximadamente R$ 1 milhão movimentado por mês.</p>
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
              <h3>IA desenhada como sistema de produção, não como uma feature isolada.</h3>
              <p>Produto, engenharia e AI systems operando como uma disciplina única.</p>
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
            <p>
              Marcas onde a liderança tecnológica da EIXU já escreveu código, em produtos e
              projetos realizados durante experiências profissionais anteriores.
            </p>
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
          As marcas acima não são apresentadas como clientes da EIXU. São experiências anteriores da liderança.
        </p>
      </section>

      <Footer />
    </main>
  );
}
