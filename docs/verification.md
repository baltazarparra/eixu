# Validação e publicação

Este guia descreve os checks disponíveis no checkout. Resultados antigos estão
no [histórico](archive/verification-2026-09-13.md); não são evidência de uma
nova execução. Os scripts e dependências vêm de [package.json](../package.json).

## Verificação pelo impacto

| Mudança                            | Evidência necessária                                                                                                                                                                        |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| README, AGENTS e docs              | Links e âncoras locais, comandos existentes, fatos conferidos no código e formatação. Não exige geração, banco ou testes novos.                                                             |
| Institucional ou CSS               | Tipos, lint, build Next.js e navegador em desktop/celular; navegação, CTA, metadados e aparência.                                                                                           |
| Blocos, lint, edição ou publicação | Contratos válidos e inválidos; recusas sem escrita; concorrência; rascunho e snapshot preservados; render e fluxo no navegador.                                                             |
| Auth, tenant ou proxy              | Sessão ausente/expirada, tenant incorreto, host reservado, acesso a `/s/*`, query de prévia e conteúdo público.                                                                             |
| Formulário ou tracking             | Em ambiente de teste autorizado, envio, atribuição, consentimento, gravação e destino; duplicação de clique.                                                                                |
| Imagens ou ferramentas             | Falha parcial, disponibilidade, alteração por número, isolamento, aplicação de logo e recusa de exclusão em uso.                                                                            |
| Tokens e custos de IA              | SDK real com modelo simulado, idempotência, ausências, falhas, isolamento por cliente, datas de Brasília, paginação, migração repetível e UI responsiva.                                    |
| Schema                             | Aplicação e reaplicação em PostgreSQL descartável, com verificação dos consumidores.                                                                                                        |
| Projeto Premium                    | Snapshot público, locks, workspace isolado, contrato editorial, revisão concorrente, prévia efêmera, build, ponte por token/host, domínio canônico, release posterior e proteção de assets. |
| Pastas de sites                    | CRUD, nomes únicos, preservação ao excluir, lote atômico, conflito entre sessões, desfazer, arrasto, teclado e celular.                                                                     |
| Kanban interno                     | Sessão, rota canônica e redirecionamento, host de cliente, origem, upgrade idempotente, vínculo, filtros, arquivo, ordem, concorrência por cartão, teclado e toque.                         |
| Skills e cliente do Kanban         | Validação estrutural das skills, bearer restrito, sessão humana/Origin, host de cliente, parser, payloads/versionamento e leitura real sem escrita no destino.                              |
| Modelo ou prompt                   | Contratos e [avaliação reproduzível](harness.md#avaliação-reproduzível), com chamadas reais autorizadas e limitações registradas.                                                           |

O lint de código e o pre-flight `lintPage` são verificações diferentes.
Compilação, fixtures e crítica de IA não substituem a validação do fluxo afetado.
Não declare ensaio em navegador, banco, produção ou em dois modelos sem executá-lo.

## Comandos existentes

Use npm e o lockfile. Para mudanças de código, execute os checks aplicáveis e
observe o resultado de cada um:

```bash
npx next typegen && npx tsc --noEmit
npm run lint
npm run test:sites
npm run test:admin
npm run build:vercel
git diff --check
```

Para o fluxo AI Native e o cliente das rotas:

```bash
python /caminho/skill-creator/scripts/quick_validate.py .agents/skills/kanban-spec
python /caminho/skill-creator/scripts/quick_validate.py .agents/skills/kanban-delivery
python /caminho/skill-creator/scripts/quick_validate.py .agents/skills/kanban-pr-review
npm run kanban -- board
```

Os três validadores conferem estrutura e metadados, não a qualidade de decisão
dos modelos. `npm run kanban -- board` faz uma leitura autenticada do destino e
não cria nem altera cartões; confirme `EIXU_KANBAN_URL` antes de usar comandos de
escrita.

`next typegen` prepara tipos de rotas e `next-env.d.ts`. Consulte o guia da
versão instalada em `node_modules/next/dist/docs/01-app/03-api-reference/06-cli/next.md`
antes de alterar APIs. O build pode precisar de rede para `next/font/google`.
Não há script genérico `test` ou `verify`, nem workflow geral de CI. Conversão
e release Premium têm workflows próprios e escopo por projeto.
Os scripts Vinext não substituem o build de produção Next.js.

Para documentação:

```bash
npm run format -- --check README.md AGENTS.md SOUL.md CLAUDE.md docs
git diff --check
```

Confira também destinos e âncoras dos links locais, além de rotas, nomes de
ferramentas e comandos citados. Links a `outputs/` no histórico são evidências
locais, não dependências que devam ser recriadas com chamadas pagas.

## Navegador e artefato de produção

Depois de `build:vercel`, configure `EIXU_CHROME_PATH` com o executável local
do Chrome/Chromium e rode:

```bash
npm run test:admin:browser
npm run test:sites:browser
```

As suítes usam componentes reais e CSS emitido pelo Next.js, com dados e serviços
simulados. Cobrem o editor, geração, conversa, atualização da prévia, navegação,
pastas compartilhadas, arrasto, desfazer, contraste, referências, teclado e
movimento reduzido. Elas não comprovam latência
do modelo, persistência no Neon ou comportamento em aparelhos físicos/Safari.
Sem Chrome, os casos dependentes são pulados; informe isso no resultado.

Para Premium, valide também `.agents/skills/premium-frontend`, gere um projeto
sintético com `premium:export`, rode typecheck, lint e build do workspace e
depois `premium:validate`. `tests/admin-premium.test.mjs` cobre contrato, export e
schema; `tests/browser/admin-premium.test.mjs` percorre o CMS, o hot refresh e a
publicação em desktop/celular. O ensaio de infraestrutura
deve usar um projeto Vercel descartável: confirmar que o domínio exato passa a
servir o filho, editar texto e imagem pelo CMS, publicar e observar a mudança na
mesma URL. Remova projeto e domínio sintéticos ao terminar. A ponte de formulário,
evento e WhatsApp exige token e host corretos e deve gravar apenas em banco de
teste. A primeira ativação e uma release posterior são caminhos diferentes e
ambos precisam ser exercitados.

O Kanban tem um teste SQL com o driver Neon ligado apenas a um banco Postgres
descartável. Ele cobre upgrade e reaplicação do schema, numeração permanente dos cards
existentes, consulta por número/UUID, criação concorrente sem colisão, exclusão
sem reutilizar número, vínculo opcional com cliente, prioridade, prazo,
arquivo/restauração, ordem e concorrência. Execute
com
`EIXU_TEST_POSTGRES_URL=postgresql://127.0.0.1/eixu_pr2_test node --test tests/admin-kanban.test.mjs`.
O teste de navegador `tests/browser/admin-kanban.test.mjs` usa o componente real
e o CSS fonte compilado pelo Vite em uma fixture isolada; o build Next.js valida
separadamente a compilação do CSS de produção.

`tests/browser/site-operator-colors.test.mjs` é a regressão específica de
edição visual. Em 1440 e 390 px, percorre cinco vibes, versões `2`, `4` e
`reference`, e hero/rodapé/explorer/fatos com fundo custom. Exige cor computada
igual ao hex, nenhuma imagem de fundo herdada e contraste mínimo 4,5:1 em todo
texto visível. No mesmo processo, confere `decoration: none`, degradê local e a
paridade de cada entrada de `SECTION_SURFACE_RULES` com o CSS do build.

`tests/browser/site-hero-placement.test.mjs` cobre o alinhamento da abertura no
CSS de produção. Em 1440 e 390 px, prova texto à direita, grupo/ações/lista no
fim, exceção de um único campo à esquerda, mídia preservada e ausência de
overflow. `tests/admin-page-edit-chat.test.mjs` cobre o “desfaz” da home com
outra página em foco, sem chamada de modelo.

`tests/browser/site-element-styles.test.mjs` cobre a superfície interna
declarativa. Ele prova todos os treze alvos semânticos em Hero, FAQ e formulário,
grade e box específicos no desktop, retorno para uma coluna no mobile,
tipografia exata, regras escopadas e ausência de overflow.

`test:admin` também tem dois testes de captura que dependem de Chrome;
`test:sites` também cobre captura de referência e renderização do Site atual. A revisão solicitada do produto usa
1440 e 390 px. A matriz de navegação dos testes inclui 320, 390, 768, 1024 e
1440 px e paisagem: confira menu fechado/aberto, toque, foco, Escape, rolagem,
âncoras, redimensionamento e HTML sem JavaScript. Ausência de overflow não basta.

`site-word-breaks.test.mjs` monta uma home comercial sintética com headline de 56
caracteres, palavra de 16 letras, `service-lens` e quatro variantes de CTA. Em
320, 390, 768, 1024 e 1440 px, mede cada palavra visível com o mesmo inspetor da
captura, além de overflow, contraste, gradiente sem repetição e ausência de faixa
de 1 px. As capturas ficam em `outputs/word-breaks/` para inspeção manual e não
devem ser tratadas como evidência de conteúdo gerado pelo modelo.

Uma edição salva que toque `presentation.*` ou `textStyles.*` faz uma medição
menor nesses mesmos 1440/390 px: somente os blocos alterados, fundo/camada
computados e contraste, sem screenshot nem chamada de modelo. Para testar o
caminho desativado, use `EIXU_REVIEW_CAPTURE=0`; o resultado e o recibo precisam
declarar que a medição não ocorreu. Não confunda essa checagem com
`review_pages`, que continua sendo crítica visual opcional solicitada pelo
operador. O inspetor compõe fundos transparentes sobre seus ancestrais; se o
texto ficar diretamente sobre uma imagem sem painel opaco, a medição precisa
falhar de forma explícita porque esse caminho não lê pixels.

`build:vercel` executa [tests/build-runtime.test.mjs](../tests/build-runtime.test.mjs)
após compilar. Três checks exigem `SOUL.md` e os binários do Chromium nos manifestos serverless de `/api/chat`, `/api/admin/[tenant]/generation/step` e `/api/queues/generation`; o quarto confere os controles de apresentação no CSS compilado. O pacote instalado sozinho não comprova empacotamento.

## Integração em PostgreSQL local

`EIXU_TEST_POSTGRES_URL` habilita seis suítes opcionais em `test:admin`:
`admin-concurrency`, `admin-generation-db`, `admin-handoff`,
`admin-page-edits-db`, `admin-logo-state-db` e `admin-usage-history`. Elas
aplicam o schema e escrevem em um banco descartável. O histórico de consumo
também exercita callbacks reais do AI SDK com modelos simulados, custo ausente
e zero, operações em várias etapas e backfill idempotente.
O helper [local-postgres.mjs](../tests/helpers/local-postgres.mjs) exige nome
`eixu_pr2_test` e host local; usa o driver Neon por um proxy WebSocket local.
Banco remoto não é aceito. Blob, rede social e modelo são simulados.

Sem a variável, essas suítes são puladas. Não configure `DATABASE_URL` de
produção como substituto. Migração, seed e requantização não são checks.

## Avaliações com modelos

`eval:harness`, `eval:edits`, `eval:site-sources` e `eval:admin-cost` só chamam modelos quando
recebem `--live`; os ensaios usam I/O editorial em memória. `eval:harness` usa
fotos de fixture e executa uma revisão visual como parte do experimento, mesmo
que a geração do produto termine antes dessa revisão. `eval:site-sources` usa fontes sintéticas, Chromium e modelo reais para comparar ausência de links, Site atual, referência e ambos, sem Neon/Blob/publicação.

`eval:edits` usa `productModel('edit')`: `EIXU_EDIT_MODEL` permite testar outro
modelo sem trocar a geração. Os casos `footer-gray`, `footer-gradient` e
`hero-decoration-off` usam fixture comercial v6 com referência e nunca acessam
Neon, Blob ou publicação. Sem `--live`, o script apenas imprime instruções. Uma
comparação real tem custo e exige autorização explícita; checks de código não a
substituem nem autorizam.

`eval:site` chama modelos e escreve no banco mesmo sem `--generate`; essa flag
acrescenta geração de fotos. `--fresh` exclui o tenant `eval-*` do caso. Confira
recurso, tenant e escopo autorizado antes da execução. A
[rubrica](eval-rubric.md) distingue esse ensaio da avaliação humana.

## Publicação

Quando o pedido incluir publicar, confira o remoto Git, as regras da branch e o
projeto Vercel de destino. O arquivo `vercel.json` versiona Next.js e
`npm run build:vercel`; branch de produção, versão de Node, plano, Fluid Compute,
variáveis e aliases devem ser consultados no destino, sem presumir o estado de
um registro antigo.

1. Revise o diff e os checks. Faça commit/push apenas do escopo autorizado e
   respeite o fluxo de PR/proteções, sem force-push para contorná-las.
2. Localize o deployment e compare `meta.githubCommitSha`, branch e ambiente
   com o commit esperado. Aguarde esse mesmo deployment chegar a `READY`.
3. Confira aliases e faça smoke das rotas públicas e da barreira de autenticação.
   Mudança funcional exige também o fluxo afetado no ambiente apropriado.
4. Consulte erros desde a publicação. Registre commit, URL, estado e limitações;
   um deployment anterior em `READY` não valida o novo SHA.

O smoke mínimo cobre `/`, os dois cases, `/vibe-coding-para-producao`,
`/admin/login`, redirecionamento de `/admin` sem sessão e recusas das APIs/chat.
Mudanças de autenticação exigem ainda entrar com cada conta provisionada,
confirmar nome/login no cabeçalho, executar uma ação reversível, conferir sua
autoria em `/admin/atividade`, sair e verificar que a sessão revogada não volta.
Para servir o build local, use `npx next start --hostname 127.0.0.1 --port 3100`.
O host numérico não resolve tenant; use `cliente.localhost` ou a rota de prévia
autenticada com `__tenant` para verificar um cliente.

Deploy de código não migra banco nem publica rascunhos. Alterações de banco,
Blob, domínio e variáveis têm escopo próprio. Não exporte contatos, imprima
credenciais ou use seed/requantização como validação de release.
