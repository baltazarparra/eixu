# Projeto Premium goodbom

Este app pertence à EIXU e atende https://goodbom.eixu.com.br. Leia [o contrato Premium](../AGENTS.md) e [a identidade do Creative Developer](../SOUL.md) antes de mudar a composição. O gerador não mantém mais a implementação.

- npm run typecheck
- npm run lint
- npm run build

Mantenha `content/editor.json` coerente com todo texto e imagem que o operador deve editar sem release. Mantenha EIXU_PREMIUM_TOKEN apenas no ambiente da Vercel. Leads, eventos, conteúdo e WhatsApp passam pelas rotas server-side locais para a plataforma central.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
