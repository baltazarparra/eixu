# EIXU

Site institucional da EIXU e o gerador de sites multi-tenant que roda em `/admin`.

## O que é

Um gerador de sites focado em inbound e tráfego pago, operado por um agente. O
operador descreve o site no chat, o agente monta a árvore de blocos numa chamada
só, mostra no preview ao lado e vai aplicando cada ajuste que o operador pede. Um
lint determinístico reprova o que não atende às regras de qualidade e a página só
publica quando passa. Não há edição visual: tudo passa pelo agente.

Os sites gerados vivem em subdomínios (`cliente.eixu.com.br`) e compartilham o
mesmo código e o mesmo banco. Não existe infraestrutura por cliente.

## Como rodar

```bash
npm install
vercel env pull .env.local --yes
npm run db:migrate
npm run dev:vercel
```

O painel fica em `http://localhost:3000/admin`. Usuário e senha vêm de
`ADMIN_USER` e `ADMIN_PASSWORD`.

Para ver um site em desenvolvimento use `cliente.localhost:3000` ou
`localhost:3000/s/cliente?__tenant=cliente`.

## Arquitetura

| Camada | Onde | O que faz |
| --- | --- | --- |
| Roteamento por host | `proxy.ts` | Resolve o subdomínio e reescreve para `/s/{tenant}` |
| Biblioteca de blocos | `lib/blocks/registry.ts` | Schema Zod e família de layout de cada bloco |
| Componentes | `lib/blocks/components.tsx` | Render sem JavaScript de cliente |
| Lint de qualidade | `lib/taste/lint.ts` | Pre-flight determinístico, destilado do Taste Skill |
| Prompt | `lib/taste/prompt.ts` | Regras de julgamento passadas ao modelo |
| Ferramentas do agente | `lib/ai/tools.ts` | `build_site` monta tudo de uma vez; as demais editam bloco a bloco |
| Rastreamento | `lib/tracking.ts` | UTM, click IDs, primeiro e último toque |
| Painel | `app/(admin)` | Chat, preview, leads e tráfego |
| Sites | `app/(sites)` | Renderizador, sitemap e robots por tenant |

O site institucional fica isolado em `app/(main)`, com CSS próprio, para que os
1.500 linhas de estilo dele nunca cheguem aos sites gerados.

## Regras que o lint aplica

Um hero por página, headline em até duas linhas, subtexto em até vinte palavras,
mínimo de quatro famílias de layout em páginas com oito ou mais seções, orçamento
de um eyebrow a cada três seções, caminho de conversão obrigatório, travessão
proibido, sem texto de exemplo e sem expressões genéricas. Erro bloqueia a
publicação, aviso não.

## Modelo de IA

O modelo vem de `EIXU_MODEL`, hoje `anthropic/claude-opus-4.5` pelo AI Gateway da
Vercel. Precisa de créditos no gateway: o plano gratuito bloqueia Claude e limita
por taxa os poucos modelos que libera.

## Scripts

| Comando | Uso |
| --- | --- |
| `npm run dev:vercel` | Desenvolvimento com Next.js |
| `npm run build:vercel` | Build de produção, o mesmo que a Vercel roda |
| `npm run db:migrate` | Aplica `db/schema.sql`, idempotente |
| `npm run db:seed-demo` | Publica um site de demonstração no tenant `vertice` |
| `npm run lint` | oxlint |
