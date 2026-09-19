# EIXU

Site institucional da EIXU, estúdio de produto e desenvolvimento nativo de IA. Quatro páginas estáticas, sem banco, API, autenticação ou painel.

| Rota                         | Conteúdo                                            |
| ---------------------------- | --------------------------------------------------- |
| `/`                          | Home: quando faz sentido, momentos, ofertas e cases |
| `/vibe-coding-para-producao` | Artigo                                              |
| `/cases/saldopix`            | Case Saldo                                          |
| `/cases/naiacrm`             | Case NAIA                                           |

Além delas, `/robots.txt` e `/sitemap.xml` são gerados por `app/robots.ts` e `app/sitemap.ts`.

## Stack

Next.js 16 (App Router), React 19, Tailwind CSS 4, three.js no hero e nas imagens dos cases, `lucide-react`, oxlint e oxfmt.

## Desenvolvimento

Requer Node.js `>=22.17.0`.

```bash
npm ci
npm run dev
```

Nenhuma variável de ambiente é necessária. O build baixa as fontes Geist pelo `next/font/google`, então precisa de acesso a `fonts.googleapis.com`.

## Verificação

```bash
npx next typegen && npx tsc --noEmit
npm run lint
npm run build
```

O build deve gerar as quatro páginas como estáticas, mais `robots.txt`, `sitemap.xml` e o proxy.

## Domínio

`SITE_URL` em [lib/site.ts](lib/site.ts) é a fonte única do domínio: dele saem o canonical de cada página, OpenGraph, Twitter card, JSON-LD, sitemap e robots.

O projeto da Vercel tem o domínio wildcard `*.eixu.com.br` atribuído. Por isso [proxy.ts](proxy.ts) mantém uma allowlist de hosts e responde 404 real para qualquer outro, em vez de servir o institucional em um subdomínio sem projeto próprio.
