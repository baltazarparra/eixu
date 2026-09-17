/** Moldura comum aos sites, independente dos blocos e snapshots do cliente. */
export function SiteAttribution() {
  return (
    <div className="site-attribution">
      <div className="site-attribution-inner">
        <a
          className="site-attribution-link"
          href="https://eixu.com.br"
          target="_blank"
          rel="noopener noreferrer nofollow"
          aria-label="Desenvolvido e hospedado por eixu.com.br (abre em nova aba)"
        >
          <span className="site-attribution-brand" aria-hidden="true">
            <svg
              className="site-attribution-mark"
              viewBox="0 0 64 64"
              width="32"
              height="32"
              fill="none"
              stroke="currentColor"
              strokeWidth="4"
              strokeLinecap="square"
              focusable="false"
            >
              <path d="M12 23h31M17 32h31M22 41h31" />
            </svg>
            <span className="site-attribution-wordmark">EIXU</span>
          </span>
          <span className="site-attribution-copy">
            Desenvolvido e hospedado por eixu.com.br
          </span>
        </a>
      </div>
    </div>
  );
}
