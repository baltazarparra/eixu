<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Orientação do projeto

Não concorde com uma decisão apenas por conveniência. Verifique o código e os dados atuais antes de assumir informações. Quando houver dúvida relevante, pesquise ou peça contexto.

Comunique-se em português do Brasil, com objetividade. EIXU reúne o institucional
e um gerador de sites multi-tenant operado em `/admin`. O [README](README.md)
apresenta produto, setup e comandos. Leia [SOUL.md](SOUL.md) para identidade e critérios de qualidade. Este contrato é compartilhado por
Codex/GPT-6 Astra e Claude Code/Fable 5.1; `CLAUDE.md` o importa.

## Contexto sob demanda

| Ao trabalhar em                            | Leia                                                                                                          |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| Rotas, publicação, dados ou limites do MVP | [Arquitetura](docs/architecture.md) e os arquivos do fluxo afetado                                            |
| Frontend e composição visual               | [Design e aplicação das duas skills](docs/design.md)                                                          |
| Prompts, ferramentas, modelos ou contexto  | [SOUL.md](SOUL.md), [Harness e modelos](docs/harness.md)                                                      |
| Validação e release                        | [Verificação](docs/verification.md)                                                                           |
| Neon ou schema                             | `db/schema.sql`, `lib/db.ts` e a skill relevante em `.agents/skills/neon/` ou `.agents/skills/neon-postgres/` |
| APIs do Next.js                            | Guia correspondente em `node_modules/next/dist/docs/`, na versão instalada                                    |

Carregue apenas o material necessário. `.agents/skills/` contém as skills locais;
`.claude/skills/` contém os adaptadores existentes. Evite copiar políticas entre
arquivos ou criar camadas de instrução sem uma necessidade observada.

## Como executar

1. Confira `git status`, o pedido e o código atual. Preserve trabalho alheio.
2. Identifique o resultado esperado e percorra os produtores e consumidores da
   mudança. Planeje quando houver dependências, ambiguidade material ou risco.
3. Faça a menor mudança completa. Análise/revisão sem pedido de execução permanece
   leitura; implementação autorizada deve chegar à validação e à entrega.
4. Resolva escolhas rotineiras com a evidência disponível. Pergunte quando faltar
   informação que altere escopo, dados, custo ou resultado; avance no trabalho
   independente enquanto isso. Não peça novamente autorização já dada.
5. Valide conforme [o risco](docs/verification.md), revise o diff e atualize a
   documentação afetada. Relate resultado, evidências e limitações reais.

Agrupe leituras e checks independentes; serialize operações dependentes e escritas
no mesmo recurso. Use subagentes somente quando a tarefa ou o ambiente autorizar,
com uma divisão que evite edição concorrente. Não há obrigação de delegar.
Em trabalho longo, dê atualizações breves. Ao retomar após compactação, preserve
objetivo, decisões, autorização, arquivos alterados e verificações pendentes.

## Qualidade do harness

O modelo interno é Gemini 3.8 Flash; a política em `lib/ai/models.ts` usa raciocínio
`high` e orçamento de saída por tarefa. Priorize factualidade, identidade, conteúdo
útil e resultado verificado. Economizar tokens não justifica cortar evidência,
reparo ou verificação. Não confunda esse modelo com o selecionado no editor.

O chat e os runners compartilham `lib/ai/agent.ts`. Preserve metadados/assinaturas
do histórico recente e o loop ativo do SDK. A geração termina na composição das
páginas; a revisão seguinte é humana pela prévia, com ajustes pelo chat. Não abra
Conferir, não exiba revisão visual pendente nem ofereça Continuar para um site
já gerado. Uma análise visual automática depende de pedido do operador e usa
pixels como entrada multimodal do crítico, nunca base64 como texto de ferramenta.
Somente evidência atual comprova essa análise. Preserve erros e gates de publicação.

## Invariantes do produto

- Produção é Next.js na Vercel: use `dev:vercel` e `build:vercel`. Não substitua esse
  gate pelo build Vinext. Preserve o bloco de instruções gerenciado pelo Next.js.
- Mantenha separados os layouts e CSS de `app/(main)`, `app/(admin)` e
  `app/(sites)`. Conteúdo comercial deve usar fatos verificáveis; experiência da
  liderança não deve virar alegação de cliente da EIXU.
- Rotas administrativas e chats exigem sessão. Resolva o tenant no servidor e
  escopo de leitura/escrita pelo seu ID; UUID ou slug recebido não prova acesso.
  O admin atual é global, sem autorização individual por tenant.
- Novo bloco exige schema/catálogo, renderizador, componente e pre-flight coerentes
  em `lib/blocks/` e `lib/taste/`. Não afrouxe validação para aceitar uma geração.
- Responsividade é requisito de todas as vibes e versões. Preserve o contrato de
  `lib/design/responsive.ts` e valide navegação fechada/aberta, toque, teclado e
  telas estreitas/baixas com o CSS de produção; ausência de overflow não basta.
- Site novo sai pelo fluxo em etapas de `lib/taste/phases.ts` e cumpre o piso de
  composição de `lib/taste/metrics.ts`: seção protagonista com fotos na home,
  imagem em toda página orgânica, ritmo tonal e proporção coerente com o layout.
- Sem referência, a vibe define a silhueta em `VIBE_GRAMMAR` e o perfil v5
  escolhe uma de suas três estruturas. Com uma única referência visual
  verificada, o perfil v6 escolhe a estrutura mais próxima entre as doze e a
  fonte comanda os eixos visuais; a vibe permanece como voz e fallback. Plano
  de cenas, catálogo, pre-flight, renderer e crítica usam a mesma decisão.
  Landing Page usa perfil v7 sem estrutura multipágina: home e obrigado,
  hero stage/form, navegação mínima e uma ação. A referência mantém essa forma.
  Perfis v2-v6 publicados preservam o que está no ar.
- Preserve a separação `blocks`/`seo` e `published_blocks`/`published_seo`, com
  pre-flight nos dois caminhos de publicação. Marca e metadados fora desse snapshot
  têm limites descritos na arquitetura. Preview por query não é controle de acesso.
- Imagens ficam disponíveis com número e URL assim que são geradas, sem aprovação.
  Mantenha o acervo em `/admin/[tenant]/imagens` e alterações pelo número no chat.
  A crítica orienta ajustes. Só o estúdio paralelo ao briefing pode aplicar
  automaticamente a proposta fiel sobre upload manual: exige os gates de nota,
  grafia e fidelidade, troca condicional por URL/revisão, original numerado e
  recibo reversível no rascunho. Fora dele, aplicar logo exige pedido do operador.
  Preserve o escopo do tenant e o bloqueio de exclusão em uso; uma nova versão troca os rascunhos sem
  alterar snapshots publicados nem apagar a original.
- Regras em prompts e neste arquivo orientam agentes; garantias de acesso,
  publicação e integridade precisam de código e verificação externa.

## Ambiente, validação e entrega

Use npm e o lockfile existente. Tipos: `npx next typegen && npx tsc --noEmit`.
Código: `npm run lint`. Contratos: `npm run test:sites` e `npm run test:admin`. Produção: `npm run build:vercel`. Verifique o fluxo afetado
além da compilação; não adicione testes que só repitam uma alteração documental.
O lint global deve passar sem desligar regras. O build também verifica os arquivos
necessários à captura serverless; os registros estão em [Verificação](docs/verification.md).

Não imprima nem versione `.env*`, tokens, cookies ou dados pessoais. Antes de
migração, seed, geração paga ou escrita remota, confirme o recurso e o escopo já
autorizados. Seed e requantização sobrescrevem dados; não são checks. Para ação
destrutiva sem autorização específica, explique o impacto e peça confirmação.

Quando publicar estiver no pedido, conclua pelo fluxo Git/Vercel autorizado e
confira SHA, estado do deployment e smoke. Distinga código publicado, páginas de
clientes publicadas e comportamento efetivamente testado. Não declare avaliação
em ambos os modelos sem executá-la em ambos.
