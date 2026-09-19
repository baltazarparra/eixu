<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Orientação do projeto

Não concorde por conveniência. Verifique código e comportamento antes de assumir. Comunique-se em português do Brasil, com objetividade.

Este repositório é o site institucional da EIXU: quatro páginas estáticas, `robots.txt` e `sitemap.xml`. Não há banco, API, autenticação, admin nem IA. O domínio canônico é `https://eixu.com.br`.

## Mapa

| Arquivo                                         | Papel                                                                    |
| ----------------------------------------------- | ------------------------------------------------------------------------ |
| `app/(main)/layout.tsx`                         | Único root layout: metadata, OG, Geist por `next/font/google`            |
| `app/(main)/globals.css`                        | Tailwind 4, tokens e componentes do site                                 |
| `app/(main)/page.tsx`                           | Home; conteúdo declarado em arrays no próprio arquivo                    |
| `app/(main)/vibe-coding-para-producao/page.tsx` | Artigo                                                                   |
| `app/(main)/cases/*/page.tsx`                   | Cases Saldo e NAIA                                                       |
| `app/robots.ts`, `app/sitemap.ts`               | Metadata routes; leem `lib/site.ts`                                      |
| `lib/site.ts`                                   | `SITE_URL`, `SITE_NAME`, `SITE_DESCRIPTION` — fonte única do domínio     |
| `components/*.tsx`                              | Header e footer, three.js do hero e dos cases, JSON-LD, headline animada |
| `proxy.ts`                                      | 404 real para host fora da allowlist                                     |

`app/(main)` é um route group: o layout dentro dele é o root layout e a home vive no grupo, conforme `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route-groups.md`. Não existe `app/layout.tsx`.

O projeto raiz na Vercel tem o domínio wildcard `*.eixu.com.br` atribuído. Qualquer subdomínio sem projeto próprio chega neste site, e o `proxy.ts` responde 404 para não servir conteúdo nem gerar soft 404. Ao mexer no `matcher`, lembre que sem exclusões o proxy também intercepta `_next/static`, `_next/image` e os arquivos de `public/`.

## Direção visual

Identidade específica, hierarquia intencional, texto concreto e refinamento que serve à leitura. Evite defaults genéricos sem relação com a marca: hero centralizado, gradiente violeta, cards arredondados em toda seção, glassmorphism, bento grid decorativo, ícones aleatórios, métricas e depoimentos inventados. Use cards apenas quando agrupamento ou interação exigirem. Preserve nomes, grafia, telefones, links e alegações verificadas.

Requisitos, não preferências: conteúdo essencial renderizado no servidor, navegação por teclado e toque, foco visível, alvos de toque adequados, sem overflow em telas estreitas, `prefers-reduced-motion` respeitado, `alt` coerente e nada de conteúdo revelado somente por animação.

## Validação

```bash
npx next typegen && npx tsc --noEmit
npm run lint
npm run build
```

`next/font/google` busca as fontes durante o build: em rede sem acesso a `fonts.googleapis.com` o build falha por isso, não pelo código.

Use npm e o lockfile existente. Alterou `package.json`? Rode `npm install` e commite o `package-lock.json` no mesmo commit — a Vercel usa `npm ci` e falha com lockfile fora de sincronia.

Não imprima nem versione segredos, cookies ou `.env*`.
