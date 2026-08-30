import { ArrowDown, ArrowRight, ArrowUpRight, Check, Minus } from 'lucide-react';
import { Footer, Header, Mark } from '@/components/eixu';

const moments = [
  {
    quote: 'Tenho uma ideia, mas ainda preciso descobrir se vale construir.',
    path: 'Discovery',
    note: 'Reduzir incerteza antes de comprometer uma estrutura maior.',
  },
  {
    quote: 'Já validei a oportunidade. Agora preciso colocar algo real na rua.',
    path: 'MVP',
    note: 'Software funcional para encontrar usuários e produzir evidência.',
  },
  {
    quote: 'Já sabemos exatamente o que precisa ser feito.',
    path: 'Projeto fechado',
    note: 'Resultado, escopo, preço e prazo combinados antes da execução.',
  },
  {
    quote: 'Fiz funcionar. Agora a empresa precisa poder depender disso.',
    path: 'Prototype → Production',
    note: 'Arquitetura, segurança, dados, testes, observabilidade e operação.',
  },
  {
    quote: 'Nossa demo de IA funciona. Agora ela precisa virar sistema.',
    path: 'AI demo → Production',
    note: 'Evals, autorização, workflows, custo, latência e evolução de modelos.',
  },
];

const offers = [
  {
    index: '01',
    title: 'Discovery',
    question: 'Existe uma oportunidade concreta, mas a decisão ainda carrega risco demais.',
    result: 'Transformamos incerteza em uma recomendação defensável: construir, mudar, reduzir ou parar.',
    deliverables: ['Problema e hipótese', 'Riscos e viabilidade', 'Escopo e recomendação'],
  },
  {
    index: '02',
    title: 'MVP',
    question: 'A hipótese está clara o bastante para encontrar usuários reais.',
    result: 'Construímos software funcional com objetivo, prazo e critério de sucesso definidos.',
    deliverables: ['Produto funcional', 'Infraestrutura real', 'Evidência para decidir'],
  },
  {
    index: '03',
    title: 'Projeto fechado',
    question: 'Já existe um plano, protótipo, Figma, especificação ou sistema incompleto.',
    result: 'Assumimos uma entrega delimitada — inclusive hardening e productionization — e levamos até produção.',
    deliverables: ['Aplicações e features', 'Protótipo → produção', 'Demo de IA → sistema'],
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
              Uma ideia, um protótipo, uma demo ou um plano. Para iniciativas que já
              merecem investimento — mas não uma organização inteira ao redor delas.
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
        <p className="section-index">01 / O fit</p>
        <div className="opening-copy">
          <h2>O problema já merece investimento. Ainda não merece uma organização inteira.</h2>
          <div className="opening-columns">
            <p>
              A EIXU atende empresas médias, grandes, scale-ups e operações digitais maduras
              com uma iniciativa concreta: problema real, algum nível de clareza, orçamento,
              urgência e um resultado que pode ser delimitado.
            </p>
            <p>
              Entramos quando montar uma squad, contratar várias pessoas ou iniciar um
              programa longo seria desproporcional ao que precisa acontecer agora.
            </p>
          </div>
          <div className="fit-signals" aria-label="Sinais de que uma iniciativa tem fit com a EIXU">
            <span>Algo concreto</span>
            <span>Orçamento</span>
            <span>Urgência</span>
            <span>Fim delimitável</span>
          </div>
          <p className="pull-quote">
            O cargo muda. O estado do problema não. Entramos entre o que você já tem e o
            que precisa funcionar em produção.
          </p>
        </div>
      </section>

      <section className="moments" id="momentos">
        <div className="shell moments-heading">
          <p className="section-index">02 / Quando entramos</p>
          <div>
            <p className="eyebrow">O momento importa mais que o cargo</p>
            <h2>A EIXU aparece quando alguém diz:</h2>
          </div>
        </div>
        <div className="shell moment-list">
          {moments.map((moment, index) => (
            <article className="moment-row" key={moment.path}>
              <p className="moment-index">{String(index + 1).padStart(2, '0')}</p>
              <div>
                <h3>“{moment.quote}”</h3>
                <p>{moment.note}</p>
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
            <p className="eyebrow">Discovery · MVP · Projetos fechados</p>
            <h2>Uma contratação simples para uma entrega delimitada.</h2>
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
        <p className="section-index">04 / O modelo</p>
        <div className="method-body">
          <h2>A estrutura fica pequena. A responsabilidade, não.</h2>
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
            <p>Não é o nosso modelo</p>
            <div>
              <span>body shop</span>
              <span>horas</span>
              <span>squads permanentes</span>
              <span>sustentação contínua</span>
              <span>transformações gigantes</span>
            </div>
          </div>
        </div>
      </section>

      <section className="cases" id="cases">
        <div className="shell section-heading section-heading--cases">
          <p className="section-index section-index--light">05 / Trabalho em produção</p>
          <div>
            <p className="eyebrow">A tese já foi testada</p>
            <h2>Da ideia ao produto. Da IA em demo à IA em produção.</h2>
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
