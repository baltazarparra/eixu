import Image from 'next/image';
import Link from 'next/link';
import type { PremiumEditorValues } from '@/lib/premium-content';
import { RaizenCardMobileNav } from './raizen-card-mobile-nav';

const defaults = {
  logo: 'https://ymqzywawtrbgbpti.public.blob.vercel-storage.com/tenants/raizencard/logo/1789359930166-logo-green.svg',
  hero: 'https://ymqzywawtrbgbpti.public.blob.vercel-storage.com/tenants/raizencard/gerado/0560077e-35ee-4a2b-9891-b7f29866066d/1.webp',
  product:
    'https://ymqzywawtrbgbpti.public.blob.vercel-storage.com/tenants/raizencard/gerado/6845bf36-4184-4b6f-8615-92e79f6c4ffa/1.webp',
  portrait:
    'https://ymqzywawtrbgbpti.public.blob.vercel-storage.com/tenants/raizencard/gerado/7c0f4794-630f-497f-8f2c-50c522458842/1.webp',
  app: 'https://ymqzywawtrbgbpti.public.blob.vercel-storage.com/tenants/raizencard/gerado/af343b21-c636-49b2-95e6-d720902a5b95/1.webp',
  security:
    'https://ymqzywawtrbgbpti.public.blob.vercel-storage.com/tenants/raizencard/gerado/733efb50-9137-4400-a32b-fe8c342a19d7/1.webp',
} as const;

const defaultBenefits = [
  ['0,8%', 'de cashback em todas as compras no crédito'],
  ['5%', 'de cashback em assinaturas em 28 plataformas'],
  ['R$ 15 mil', 'de cobertura contra fraudes e roubos'],
  ['sem custo', 'para o cartão adicional'],
] as const;

const defaultFaqs = [
  [
    'Como funciona o cashback do Raizen Card?',
    'Você recebe 0,8% de cashback nas compras no crédito. Em 28 assinaturas mensais, você ganha 5% de volta. O valor fica liberado na hora para resgate ou milhas.',
  ],
  [
    'O cartão adicional tem alguma mensalidade ou taxa extra?',
    'Não. Você pode solicitar um cartão adicional e compartilhar os benefícios do Raizen Card sem pagar anuidade ou mensalidade extra por ele.',
  ],
  [
    'Como funciona o Raizen Limite Garantido?',
    'Você pode transformar o dinheiro guardado ou investido no Raizen Bank em limite de crédito no cartão, mantendo o rendimento normal.',
  ],
  [
    'Posso pagar Pix e boletos usando o cartão?',
    'Sim. Você pode usar o limite de crédito do cartão para pagar Pix e boletos, com opções de parcelamento pelo aplicativo.',
  ],
  [
    'Quais são as coberturas do Raizen Card Protegido?',
    'Ao contratar o Croma Protegido, você conta com cobertura de até R$ 15 mil contra golpes, fraudes e roubos, além de até R$ 2.500 para bolsa e pertences.',
  ],
  [
    'Quais benefícios Mastercard Platinum acompanham o cartão?',
    'O cartão conta com concierge, assistência em viagens, proteção de compras e acesso ao programa Mastercard Surpreenda.',
  ],
] as const;

function value(
  values: PremiumEditorValues,
  key: string,
  fallback: string,
): string {
  return values[key] || fallback;
}

function Arrow() {
  return <span aria-hidden="true">&#8599;</span>;
}

function LeadForm({ values }: { values: PremiumEditorValues }) {
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
        <p>{value(values, 'form.eyebrow', 'Raizen Card Platinum')}</p>
        <h2>{value(values, 'form.title', 'Peça seu cartão')}</h2>
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
          {value(
            values,
            'form.consent',
            'Concordo em ser contatado e com o uso dos meus dados conforme a política de privacidade.',
          )}
        </span>
      </label>
      <label className="rc-check">
        <input type="checkbox" name="whatsapp_optin" />
        <span>Quero receber contato por WhatsApp.</span>
      </label>
      <button type="submit" className="rc-button rc-button-dark">
        {value(values, 'form.button', 'Solicitar cartão')} <Arrow />
      </button>
      <p className="rc-form-note">
        {value(
          values,
          'form.note',
          'Benefícios sujeitos à análise de crédito.',
        )}
      </p>
    </form>
  );
}

export function RaizenCardHome({ values }: { values: PremiumEditorValues }) {
  const assets = {
    logo: defaults.logo,
    hero: value(values, 'assets.hero', defaults.hero),
    product: value(values, 'assets.product', defaults.product),
    portrait: value(values, 'assets.portrait', defaults.portrait),
    app: value(values, 'assets.app', defaults.app),
    security: value(values, 'assets.security', defaults.security),
  };
  const benefits = defaultBenefits.map(
    ([fallbackValue, fallbackLabel], index) => ({
      value: value(values, `stats.${index}.value`, fallbackValue),
      label: value(values, `stats.${index}.label`, fallbackLabel),
    }),
  );
  const faqs = defaultFaqs.map(([question, answer], index) => ({
    question: value(values, `faq.${index}.question`, question),
    answer: value(values, `faq.${index}.answer`, answer),
  }));
  const steps = [
    [
      'Preencha seus dados',
      'Informe nome, e-mail e telefone para iniciar o atendimento.',
    ],
    [
      'Aguarde a análise',
      'Sua solicitação passa pela análise cadastral e de crédito.',
    ],
    [
      'Aproveite as vantagens',
      'Use o cartão e acompanhe cashback, limite e pagamentos no app.',
    ],
  ].map(([title, body], index) => ({
    title: value(values, `steps.${index}.title`, title),
    body: value(values, `steps.${index}.body`, body),
  }));

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
              alt={value(
                values,
                'alt.hero',
                'Cartão Raizen Platinum em destaque sobre terminal de pagamento.',
              )}
              fill
              sizes="100vw"
              loading="eager"
            />
            <div className="rc-hero-scrim" />
            <div className="rc-hero-copy">
              <p>{value(values, 'hero.eyebrow', 'Raizen Card Platinum')}</p>
              <h1>
                {value(
                  values,
                  'hero.title',
                  'Um cartão para o seu dinheiro render mais.',
                )}
              </h1>
              <a className="rc-text-link rc-text-link-light" href="#beneficios">
                {value(values, 'hero.link', 'Conheça as vantagens')} <Arrow />
              </a>
            </div>
            <a
              className="rc-scroll-cue"
              href="#vantagens"
              aria-label="Ir para as vantagens"
            >
              &#8595;
            </a>
          </div>
          <div className="rc-hero-form" id="contato">
            <LeadForm values={values} />
          </div>
        </section>

        <section className="rc-immersive" id="vantagens">
          <Image
            src={assets.portrait}
            alt={value(
              values,
              'alt.portrait',
              'Cartão Raizen Platinum com smartphone e terminal ao fundo.',
            )}
            fill
            sizes="100vw"
          />
          <div className="rc-immersive-scrim" />
          <div className="rc-immersive-copy">
            <h2>
              {value(
                values,
                'advantages.title',
                'Vantagens que acompanham todos os seus momentos.',
              )}
            </h2>
            <p>
              {value(
                values,
                'advantages.body',
                'Cashback liberado na hora, limite garantido que continua rendendo e um cartão adicional sem custo extra.',
              )}
            </p>
          </div>
        </section>

        <section className="rc-split rc-section" id="beneficios">
          <div className="rc-split-copy">
            <p className="rc-kicker">
              {value(values, 'cashback.eyebrow', 'Cashback imediato')}
            </p>
            <h2>
              {value(
                values,
                'cashback.title',
                'Seu dinheiro volta. Você escolhe o próximo destino.',
              )}
            </h2>
            <p>
              {value(
                values,
                'cashback.body',
                'Receba 0,8% de volta em todas as compras no crédito e 5% em 28 plataformas de assinatura. Resgate direto na conta ou transforme em pontos Smiles, LATAM Pass e Azul Fidelidade.',
              )}
            </p>
            <a className="rc-button rc-button-dark" href="#contato">
              {value(values, 'cashback.button', 'Quero meu Raizen Card')}{' '}
              <Arrow />
            </a>
          </div>
          <figure className="rc-split-media">
            <Image
              src={assets.app}
              alt={value(
                values,
                'alt.app',
                'Aplicativo financeiro, cartão Raizen Platinum e terminal de pagamento.',
              )}
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
              alt={value(
                values,
                'alt.product',
                'Cartão Raizen Platinum com acabamento metálico sobre bancada.',
              )}
              width={1536}
              height={1024}
              sizes="(max-width: 900px) 100vw, 74vw"
            />
          </div>
          <div className="rc-product-copy">
            <h2>
              {value(
                values,
                'product.title',
                'Raizen Card Platinum: vantagens reais para o dia a dia.',
              )}
            </h2>
            <p>
              {value(
                values,
                'product.body',
                'Use no crédito, pague Pix e boletos com o limite do cartão e acompanhe tudo pelo aplicativo.',
              )}
            </p>
            <a className="rc-button rc-button-dark" href="#contato">
              {value(values, 'product.button', 'Pedir cartão')} <Arrow />
            </a>
          </div>
        </section>

        <section className="rc-stats" aria-label="Principais vantagens">
          {benefits.map((benefit, index) => (
            <article key={index}>
              <strong>{benefit.value}</strong>
              <p>{benefit.label}</p>
            </article>
          ))}
        </section>

        <section className="rc-security" id="seguranca">
          <Image
            src={assets.security}
            alt={value(
              values,
              'alt.security',
              'Cartão Raizen Platinum protegido por um escudo translúcido.',
            )}
            fill
            sizes="100vw"
          />
          <div className="rc-security-title">
            <h2>
              {value(
                values,
                'security.title',
                'Proteção para usar seu cartão com tranquilidade.',
              )}
            </h2>
          </div>
          <div className="rc-security-card">
            <p>
              {value(
                values,
                'security.body',
                'Com o Croma Protegido, você pode contar com até R$ 15 mil de cobertura contra golpes, fraudes e roubos, além de até R$ 2.500 para bolsa e pertences.',
              )}
            </p>
            <a href="#contato" className="rc-text-link">
              {value(values, 'security.link', 'Solicitar meu cartão')} <Arrow />
            </a>
          </div>
        </section>

        <section className="rc-mosaic rc-section">
          <div className="rc-mosaic-copy">
            <p className="rc-kicker">
              {value(values, 'possibilities.eyebrow', 'Mais possibilidades')}
            </p>
            <h2>
              {value(
                values,
                'possibilities.title',
                'Um cartão pensado para valorizar cada escolha.',
              )}
            </h2>
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
              <h3>
                {value(
                  values,
                  'possibilities.0.title',
                  'Cashback liberado na hora',
                )}
              </h3>
              <p>
                {value(
                  values,
                  'possibilities.0.body',
                  'Use na conta ou transforme em pontos para viajar.',
                )}
              </p>
            </article>
            <article>
              <Image
                src={assets.app}
                alt="Aplicativo do cartão e terminal de pagamento."
                width={1536}
                height={1024}
                sizes="(max-width: 560px) 100vw, 25vw"
              />
              <h3>
                {value(
                  values,
                  'possibilities.1.title',
                  'Pix e boletos no crédito',
                )}
              </h3>
            </article>
            <article>
              <Image
                src={assets.portrait}
                alt="Cartão Raizen Platinum em primeiro plano."
                width={1024}
                height={1536}
                sizes="(max-width: 560px) 100vw, 25vw"
              />
              <h3>
                {value(
                  values,
                  'possibilities.2.title',
                  'Adicional sem custo extra',
                )}
              </h3>
            </article>
          </div>
        </section>

        <section className="rc-limits">
          <div className="rc-orbit" aria-hidden="true">
            <span />
            <span />
          </div>
          <div>
            <p className="rc-kicker">
              {value(values, 'limit.eyebrow', 'Raizen Limite Garantido')}
            </p>
            <h2>
              {value(
                values,
                'limit.title',
                'Seu dinheiro guardado vira limite e continua rendendo.',
              )}
            </h2>
            <p>
              {value(
                values,
                'limit.body',
                'Transforme o saldo guardado ou investido no Raizen Bank em limite de crédito sem interromper o rendimento normal.',
              )}
            </p>
            <a className="rc-button rc-button-dark" href="#contato">
              {value(values, 'limit.button', 'Quero saber mais')} <Arrow />
            </a>
          </div>
        </section>

        <section className="rc-how rc-section" id="como-funciona">
          <div className="rc-how-heading">
            <p className="rc-kicker">
              {value(values, 'steps.eyebrow', 'Comece agora')}
            </p>
            <h2>
              {value(values, 'steps.title', 'Seu Raizen Card em três passos.')}
            </h2>
          </div>
          <ol>
            {steps.map((step, index) => (
              <li key={index}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="rc-final-cta">
          <div className="rc-final-copy">
            <p className="rc-kicker">
              {value(values, 'closing.eyebrow', 'Raizen Card Platinum')}
            </p>
            <h2>
              {value(
                values,
                'closing.title',
                'Cashback para usar do seu jeito.',
              )}
            </h2>
            <p>
              {value(
                values,
                'closing.body',
                'Peça seu cartão e aproveite vantagens que acompanham suas compras, assinaturas e planos.',
              )}
            </p>
            <a className="rc-button rc-button-light" href="#contato">
              {value(values, 'closing.button', 'Pedir cartão')} <Arrow />
            </a>
          </div>
          <Image
            src={assets.product}
            alt={value(
              values,
              'alt.product',
              'Cartão Raizen Platinum sobre bancada de mármore.',
            )}
            width={1536}
            height={1024}
            sizes="(max-width: 900px) 100vw, 50vw"
          />
        </section>

        <section className="rc-faq rc-section" id="duvidas">
          <div className="rc-faq-heading">
            <h2>{value(values, 'faq.title', 'Ficou alguma dúvida?')}</h2>
            <p>
              {value(
                values,
                'faq.body',
                'Encontre respostas para as principais perguntas sobre o cartão.',
              )}
            </p>
            <a className="rc-button rc-button-dark" href="#contato">
              {value(values, 'faq.button', 'Pedir meu cartão')} <Arrow />
            </a>
          </div>
          <div className="rc-faq-list">
            {faqs.map((faq, index) => (
              <details key={index}>
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
          <h2>
            {value(
              values,
              'footer.title',
              'Seu dinheiro em movimento. Suas vantagens também.',
            )}
          </h2>
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
          {value(
            values,
            'footer.legal',
            '© 2026 Raizen Card. Benefícios sujeitos à análise de crédito.',
          )}
        </p>
      </footer>
    </div>
  );
}
