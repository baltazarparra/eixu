import Image from 'next/image';
import Link from 'next/link';
import { RaizenCardMobileNav } from './raizen-card-mobile-nav';

const assets = {
  logo: 'https://ymqzywawtrbgbpti.public.blob.vercel-storage.com/tenants/raizencard/logo/1789359930166-logo-green.svg',
  hero: 'https://ymqzywawtrbgbpti.public.blob.vercel-storage.com/tenants/raizencard/gerado/0560077e-35ee-4a2b-9891-b7f29866066d/1.webp',
  product: 'https://ymqzywawtrbgbpti.public.blob.vercel-storage.com/tenants/raizencard/gerado/6845bf36-4184-4b6f-8615-92e79f6c4ffa/1.webp',
  portrait: 'https://ymqzywawtrbgbpti.public.blob.vercel-storage.com/tenants/raizencard/gerado/7c0f4794-630f-497f-8f2c-50c522458842/1.webp',
  app: 'https://ymqzywawtrbgbpti.public.blob.vercel-storage.com/tenants/raizencard/gerado/af343b21-c636-49b2-95e6-d720902a5b95/1.webp',
  security: 'https://ymqzywawtrbgbpti.public.blob.vercel-storage.com/tenants/raizencard/gerado/733efb50-9137-4400-a32b-fe8c342a19d7/1.webp',
} as const;

const benefits = [
  {
    value: '0,8%',
    label: 'de cashback em todas as compras no crédito',
  },
  {
    value: '5%',
    label: 'de cashback em assinaturas em 28 plataformas',
  },
  {
    value: 'R$ 15 mil',
    label: 'de cobertura contra fraudes e roubos',
  },
  {
    value: 'sem custo',
    label: 'para o cartão adicional',
  },
] as const;

const faqs = [
  {
    question: 'Como funciona o cashback do Raizen Card?',
    answer:
      'Você recebe 0,8% de cashback nas compras no crédito. Em 28 assinaturas mensais, você ganha 5% de volta. O valor fica liberado na hora para resgate ou milhas.',
  },
  {
    question: 'O cartão adicional tem alguma mensalidade ou taxa extra?',
    answer:
      'Não. Você pode solicitar um cartão adicional e compartilhar os benefícios do Raizen Card sem pagar anuidade ou mensalidade extra por ele.',
  },
  {
    question: 'Como funciona o Raizen Limite Garantido?',
    answer:
      'Você pode transformar o dinheiro guardado ou investido no Raizen Bank em limite de crédito no cartão, mantendo o rendimento normal.',
  },
  {
    question: 'Posso pagar Pix e boletos usando o cartão?',
    answer:
      'Sim. Você pode usar o limite de crédito do cartão para pagar Pix e boletos, com opções de parcelamento pelo aplicativo.',
  },
  {
    question: 'Quais são as coberturas do Raizen Card Protegido?',
    answer:
      'Ao contratar o Croma Protegido, você conta com cobertura de até R$ 15 mil contra golpes, fraudes e roubos, além de até R$ 2.500 para bolsa e pertences.',
  },
  {
    question: 'Quais benefícios Mastercard Platinum acompanham o cartão?',
    answer:
      'O cartão conta com concierge, assistência em viagens, proteção de compras e acesso ao programa Mastercard Surpreenda.',
  },
] as const;

function Arrow() {
  return <span aria-hidden="true">&#8599;</span>;
}

function LeadForm() {
  return (
    <form method="post" action="/api/form" className="rc-lead-form">
      <input type="hidden" name="tenant" value="raizencard" />
      <input type="hidden" name="page" value="/" />
      <input type="hidden" name="redirect" value="/obrigado" />
      <input type="hidden" name="attribution" data-attribution="1" />
      <p className="rc-honeypot" aria-hidden="true">
        <label>
          Não preencha este campo
          <input
            type="text"
            name="company_website"
            tabIndex={-1}
            autoComplete="off"
          />
        </label>
      </p>

      <div className="rc-form-heading">
        <p>Raizen Card Platinum</p>
        <h2>Peça seu cartão</h2>
      </div>

      <label className="rc-field">
        <span>Nome completo</span>
        <input name="nome" type="text" autoComplete="name" required />
      </label>
      <label className="rc-field">
        <span>Seu melhor e-mail</span>
        <input name="email" type="email" autoComplete="email" required />
      </label>
      <label className="rc-field">
        <span>WhatsApp ou celular</span>
        <input name="telefone" type="tel" autoComplete="tel" required />
      </label>

      <label className="rc-check">
        <input type="checkbox" name="consent" required />
        <span>
          Concordo em ser contatado e com o uso dos meus dados conforme a
          política de privacidade.
        </span>
      </label>
      <label className="rc-check">
        <input type="checkbox" name="whatsapp_optin" />
        <span>Quero receber contato por WhatsApp.</span>
      </label>

      <button type="submit" className="rc-button rc-button-dark">
        Solicitar cartão <Arrow />
      </button>
      <p className="rc-form-note">Benefícios sujeitos à análise de crédito.</p>
    </form>
  );
}

export function RaizenCardHome() {
  return (
    <div className="rc-site">
      <header className="rc-header">
        <a className="rc-logo" href="#inicio" aria-label="Raizen Card — início">
          <Image src={assets.logo} alt="Raizen Card" width={86} height={36} />
        </a>
        <nav className="rc-desktop-nav" aria-label="Navegação principal">
          <a href="#vantagens">Vantagens</a>
          <a href="#beneficios">Benefícios</a>
          <a href="#seguranca">Segurança</a>
          <a href="#duvidas">Dúvidas</a>
        </nav>
        <a className="rc-button rc-button-dark rc-header-cta" href="#contato">
          Pedir cartão <Arrow />
        </a>
        <RaizenCardMobileNav />
      </header>

      <main>
        <section className="rc-hero" id="inicio">
          <div className="rc-hero-visual">
            <Image
              className="rc-hero-media"
              src={assets.hero}
              alt="Cartão Raizen Platinum em destaque sobre terminal de pagamento."
              fill
              sizes="100vw"
              loading="eager"
            />
            <div className="rc-hero-scrim" />
            <div className="rc-hero-copy">
              <p>Raizen Card Platinum</p>
              <h1>Um cartão para o seu dinheiro render mais.</h1>
              <a className="rc-text-link rc-text-link-light" href="#beneficios">
                Conheça as vantagens <Arrow />
              </a>
            </div>
            <a className="rc-scroll-cue" href="#vantagens" aria-label="Ir para as vantagens">
              &#8595;
            </a>
          </div>
          <div className="rc-hero-form" id="contato">
            <LeadForm />
          </div>
        </section>

        <section className="rc-immersive" id="vantagens">
          <Image
            src={assets.portrait}
            alt="Cartão Raizen Platinum com smartphone e terminal ao fundo."
            fill
            sizes="100vw"
          />
          <div className="rc-immersive-scrim" />
          <div className="rc-immersive-copy">
            <h2>Vantagens que acompanham todos os seus momentos.</h2>
            <p>
              Cashback liberado na hora, limite garantido que continua rendendo
              e um cartão adicional sem custo extra.
            </p>
          </div>
        </section>

        <section className="rc-split rc-section" id="beneficios">
          <div className="rc-split-copy">
            <p className="rc-kicker">Cashback imediato</p>
            <h2>Seu dinheiro volta. Você escolhe o próximo destino.</h2>
            <p>
              Receba 0,8% de volta em todas as compras no crédito e 5% em 28
              plataformas de assinatura. Resgate direto na conta ou transforme
              em pontos Smiles, LATAM Pass e Azul Fidelidade.
            </p>
            <a className="rc-button rc-button-dark" href="#contato">
              Quero meu Raizen Card <Arrow />
            </a>
          </div>
          <figure className="rc-split-media">
            <Image
              src={assets.app}
              alt="Aplicativo financeiro, cartão Raizen Platinum e terminal de pagamento."
              width={1536}
              height={1024}
              sizes="(max-width: 900px) 100vw, 55vw"
            />
          </figure>
        </section>

        <section className="rc-product-stage">
          <div className="rc-product-frame">
            <Image
              src={assets.product}
              alt="Cartão Raizen Platinum com acabamento metálico sobre bancada."
              width={1536}
              height={1024}
              sizes="(max-width: 900px) 100vw, 74vw"
            />
          </div>
          <div className="rc-product-copy">
            <h2>Raizen Card Platinum: vantagens reais para o dia a dia.</h2>
            <p>
              Use no crédito, pague Pix e boletos com o limite do cartão e
              acompanhe tudo pelo aplicativo.
            </p>
            <a className="rc-button rc-button-dark" href="#contato">
              Pedir cartão <Arrow />
            </a>
          </div>
        </section>

        <section className="rc-stats" aria-label="Principais vantagens">
          {benefits.map((benefit) => (
            <article key={benefit.value}>
              <strong>{benefit.value}</strong>
              <p>{benefit.label}</p>
            </article>
          ))}
        </section>

        <section className="rc-security" id="seguranca">
          <Image
            src={assets.security}
            alt="Cartão Raizen Platinum protegido por um escudo translúcido."
            fill
            sizes="100vw"
          />
          <div className="rc-security-title">
            <h2>Proteção para usar seu cartão com tranquilidade.</h2>
          </div>
          <div className="rc-security-card">
            <p>
              Com o Croma Protegido, você pode contar com até R$ 15 mil de
              cobertura contra golpes, fraudes e roubos, além de até R$ 2.500
              para bolsa e pertences.
            </p>
            <a href="#contato" className="rc-text-link">
              Solicitar meu cartão <Arrow />
            </a>
          </div>
        </section>

        <section className="rc-mosaic rc-section">
          <div className="rc-mosaic-copy">
            <p className="rc-kicker">Mais possibilidades</p>
            <h2>Um cartão pensado para valorizar cada escolha.</h2>
          </div>
          <div className="rc-mosaic-grid">
            <article className="rc-mosaic-feature">
              <Image
                src={assets.hero}
                alt="Detalhe do cartão Raizen Platinum."
                width={1536}
                height={1024}
                sizes="(max-width: 900px) 100vw, 50vw"
              />
              <h3>Cashback liberado na hora</h3>
              <p>Use na conta ou transforme em pontos para viajar.</p>
            </article>
            <article>
              <Image
                src={assets.app}
                alt="Aplicativo do cartão e terminal de pagamento."
                width={1536}
                height={1024}
                sizes="(max-width: 560px) 100vw, 25vw"
              />
              <h3>Pix e boletos no crédito</h3>
            </article>
            <article>
              <Image
                src={assets.portrait}
                alt="Cartão Raizen Platinum em primeiro plano."
                width={1024}
                height={1536}
                sizes="(max-width: 560px) 100vw, 25vw"
              />
              <h3>Adicional sem custo extra</h3>
            </article>
          </div>
        </section>

        <section className="rc-limits">
          <div className="rc-orbit" aria-hidden="true">
            <span />
          </div>
          <div>
            <p className="rc-kicker">Raizen Limite Garantido</p>
            <h2>Seu dinheiro guardado vira limite e continua rendendo.</h2>
            <p>
              Transforme o saldo guardado ou investido no Raizen Bank em limite
              de crédito sem interromper o rendimento normal.
            </p>
            <a className="rc-button rc-button-dark" href="#contato">
              Quero saber mais <Arrow />
            </a>
          </div>
        </section>

        <section className="rc-how rc-section" id="como-funciona">
          <div className="rc-how-heading">
            <p className="rc-kicker">Comece agora</p>
            <h2>Seu Raizen Card em três passos.</h2>
          </div>
          <ol>
            <li>
              <span>01</span>
              <h3>Preencha seus dados</h3>
              <p>Informe nome, e-mail e telefone para iniciar o atendimento.</p>
            </li>
            <li>
              <span>02</span>
              <h3>Aguarde a análise</h3>
              <p>Sua solicitação passa pela análise cadastral e de crédito.</p>
            </li>
            <li>
              <span>03</span>
              <h3>Aproveite as vantagens</h3>
              <p>Use o cartão e acompanhe cashback, limite e pagamentos no app.</p>
            </li>
          </ol>
        </section>

        <section className="rc-final-cta">
          <div className="rc-final-copy">
            <p className="rc-kicker">Raizen Card Platinum</p>
            <h2>Cashback para usar do seu jeito.</h2>
            <p>
              Peça seu cartão e aproveite vantagens que acompanham suas compras,
              assinaturas e planos.
            </p>
            <a className="rc-button rc-button-light" href="#contato">
              Pedir cartão <Arrow />
            </a>
          </div>
          <Image
            src={assets.product}
            alt="Cartão Raizen Platinum sobre bancada de mármore."
            width={1536}
            height={1024}
            sizes="(max-width: 900px) 100vw, 50vw"
          />
        </section>

        <section className="rc-faq rc-section" id="duvidas">
          <div className="rc-faq-heading">
            <h2>Ficou alguma dúvida?</h2>
            <p>Encontre respostas para as principais perguntas sobre o cartão.</p>
            <a className="rc-button rc-button-dark" href="#contato">
              Pedir meu cartão <Arrow />
            </a>
          </div>
          <div className="rc-faq-list">
            {faqs.map((faq) => (
              <details key={faq.question}>
                <summary>{faq.question}</summary>
                <p>{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <footer className="rc-footer">
        <div className="rc-footer-statement">
          <Image src={assets.logo} alt="Raizen Card" width={86} height={36} />
          <h2>Seu dinheiro em movimento. Suas vantagens também.</h2>
        </div>
        <div className="rc-footer-links">
          <div>
            <h3>Explore</h3>
            <a href="#vantagens">Vantagens</a>
            <a href="#beneficios">Benefícios</a>
            <a href="#seguranca">Segurança</a>
            <a href="#duvidas">Dúvidas</a>
          </div>
          <div>
            <h3>Atendimento</h3>
            <Link
              href="/go/wa?from=/"
              data-track="whatsapp"
              rel="noreferrer"
              prefetch={false}
              suppressHydrationWarning
            >
              WhatsApp: (11) 99888-2277
            </Link>
            <a href="mailto:mail@mail.com">mail@mail.com</a>
          </div>
        </div>
        <p className="rc-footer-legal">
          © 2026 Raizen Card. Benefícios sujeitos à análise de crédito.
        </p>
      </footer>

    </div>
  );
}
