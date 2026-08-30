import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';

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
    <Link className={`brand${inverted ? ' brand--dark' : ''}`} href="/" aria-label="EIXU, início">
      <Mark small />
      <span>EIXU</span>
    </Link>
  );
}

export function Header({
  casePage = false,
  backHref = '/#cases',
  backLabel = 'Projetos',
}: {
  casePage?: boolean;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <header className={`site-nav shell${casePage ? ' site-nav--light' : ''}`}>
      <Brand inverted={casePage} />
      {casePage ? (
        <Link className="nav-back" href={backHref}>
          <ArrowLeft aria-hidden="true" />
          {backLabel}
        </Link>
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
            Pode ser uma ideia, um protótipo, uma demo ou um plano. Conte para a/gente.
          </p>
          <a
            className="cta-link"
            href="https://wa.me/5514997127120?text=Oi%2C%20quero%20falar%20sobre%20um%20projeto%20com%20a%20EIXU."
            target="_blank"
            rel="noreferrer"
            aria-label="Abrir uma conversa com a EIXU no WhatsApp"
          >
            WhatsApp · +55 14 99712-7120
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
