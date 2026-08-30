import { ArrowLeft, ArrowUpRight } from 'lucide-react';

export function Mark({ small = false }: { small?: boolean }) {
  return (
    <span className={small ? 'mark mark--small' : 'mark'} aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}

export function Brand({ inverted = false }: { inverted?: boolean }) {
  return (
    <a className={`brand${inverted ? ' brand--dark' : ''}`} href="/" aria-label="EIXU, início">
      <Mark small />
      <span>EIXU</span>
    </a>
  );
}

export function Header({ casePage = false }: { casePage?: boolean }) {
  return (
    <header className={`site-nav shell${casePage ? ' site-nav--light' : ''}`}>
      <Brand inverted={casePage} />
      {casePage ? (
        <a className="nav-back" href="/#cases">
          <ArrowLeft aria-hidden="true" />
          Projetos
        </a>
      ) : (
        <nav className="nav-links" aria-label="Navegação principal">
          <a href="#momentos">Quando entramos</a>
          <a href="#ofertas">Como contratar</a>
          <a href="#cases">Projetos</a>
        </nav>
      )}
    </header>
  );
}

export function Footer() {
  return (
    <footer className="site-footer" id="contato">
      <div className="shell footer-top">
        <p className="section-index section-index--light">Vamos conversar</p>
        <div>
          <h2>O que você já tem hoje?</h2>
          <p>
            Pode ser uma ideia, um protótipo, uma demo ou um plano. Conte para a gente.
          </p>
          <a
            className="cta-link"
            href="mailto:contato@eixu.com.br?subject=Quero%20falar%20sobre%20um%20projeto"
            aria-label="Enviar um e-mail para a EIXU"
          >
            Vamos conversar
            <ArrowUpRight aria-hidden="true" />
          </a>
        </div>
      </div>
      <div className="shell footer-bottom">
        <Brand />
        <p>Estúdio de produto e desenvolvimento nativo de IA</p>
        <p>Brasil · 2026</p>
      </div>
    </footer>
  );
}
