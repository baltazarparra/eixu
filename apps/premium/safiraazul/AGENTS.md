# Projeto Premium safiraazul

Este app pertence à EIXU e atende https://safiraazul.eixu.com.br. Leia [o contrato Premium](../AGENTS.md) e [a identidade do Creative Developer](../SOUL.md) antes de mudar a composição. O gerador não mantém mais a implementação.

- npm run typecheck
- npm run lint
- npm run build

Mantenha `content/editor.json` coerente com todo texto e imagem que o operador deve editar sem release. Mantenha EIXU_PREMIUM_TOKEN apenas no ambiente da Vercel. Leads, eventos, conteúdo e WhatsApp passam pelas rotas server-side locais para a plataforma central.
