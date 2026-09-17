import Link from 'next/link';
import type { ComponentProps } from 'react';

/**
 * Um link do site.
 *
 * Navegação entre páginas usa `next/link`, que troca o documento sem recarregar
 * e pré-carrega o destino. O redirecionador do WhatsApp fica em `<a>` de
 * propósito: ele não é uma página, responde com um 302 para fora do site e
 * precisa do marcador que o script de atribuição procura para reescrever o
 * endereço com a origem da visita.
 */
export function isWhatsApp(href: string): boolean {
  return href.startsWith('/go/wa');
}

function isInternalPage(href: string): boolean {
  return href.startsWith('/') && !isWhatsApp(href) && !href.startsWith('//');
}

type AnchorProps = Omit<ComponentProps<'a'>, 'href' | 'ref'>;

export function SiteLink({
  href,
  children,
  ...rest
}: AnchorProps & { href: string }) {
  if (isInternalPage(href))
    return (
      <Link href={href} {...rest}>
        {children}
      </Link>
    );
  return (
    <a
      href={href}
      rel="noreferrer"
      {...(isWhatsApp(href) ? { 'data-track': 'whatsapp' } : {})}
      {...rest}
    >
      {children}
    </a>
  );
}
