# Validação e publicação

Este guia descreve os checks disponíveis no checkout. Resultados antigos estão
no [histórico](archive/verification-2026-09-13.md); não são evidência de uma
nova execução. Os scripts e dependências vêm de [package.json](../package.json).

## Verificação pelo impacto

| Mudança                            | Evidência necessária                                                                                                              |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| README, AGENTS e docs              | Links e âncoras locais, comandos existentes, fatos conferidos no código e formatação. Não exige geração, banco ou testes novos.   |
| Institucional ou CSS               | Tipos, lint, build Next.js e navegador em desktop/celular; navegação, CTA, metadados e aparência.                                 |
| Blocos, lint, edição ou publicação | Contratos válidos e inválidos; recusas sem escrita; concorrência; rascunho e snapshot preservados; render e fluxo no navegador.   |
| Auth, tenant ou proxy              | Sessão ausente/expirada, tenant incorreto, host reservado, acesso a `/s/*`, query de prévia e conteúdo público.                   |
| Formulário ou tracking             | Em ambiente de teste autorizado, envio, atribuição, consentimento, gravação e destino; duplicação de clique.                      |
| Imagens ou ferramentas             | Falha parcial, disponibilidade, alteração por número, isolamento, aplicação de logo e recusa de exclusão em uso.                  |
| Schema                             | Aplicação e reaplicação em PostgreSQL descartável, com verificação dos consumidores.                                              |
| Modelo ou prompt                   | Contratos e [avaliação reproduzível](harness.md#avaliação-reproduzível), com chamadas reais autorizadas e limitações registradas. |

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

`next typegen` prepara tipos de rotas e `next-env.d.ts`. Consulte o guia da
versão instalada em `node_modules/next/dist/docs/01-app/03-api-reference/06-cli/next.md`
antes de alterar APIs. O build pode precisar de rede para `next/font/google`.
Não há script genérico `test` ou `verify`, nem workflow de CI versionado.
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
contraste, referências, teclado e movimento reduzido. Elas não comprovam latência
do modelo, persistência no Neon ou comportamento em aparelhos físicos/Safari.
Sem Chrome, os casos dependentes são pulados; informe isso no resultado.

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

`build:vercel` executa [tests/build-runtime.test.mjs](../tests/build-runtime.test.mjs)
após compilar. Três checks exigem `SOUL.md` e os binários do Chromium nos manifestos serverless de `/api/chat`, `/api/admin/[tenant]/generation/step` e `/api/queues/generation`; o quarto confere os controles de apresentação no CSS compilado. O pacote instalado sozinho não comprova empacotamento.

## Integração em PostgreSQL local

`EIXU_TEST_POSTGRES_URL` habilita cinco suítes opcionais em `test:admin`:
`admin-concurrency`, `admin-generation-db`, `admin-handoff`, `admin-page-edits-db` e `admin-logo-state-db`. Elas aplicam o schema e escrevem em um banco descartável.
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
Para servir o build local, use `npx next start --hostname 127.0.0.1 --port 3100`.
O host numérico não resolve tenant; use `cliente.localhost` ou a rota de prévia
autenticada com `__tenant` para verificar um cliente.

Deploy de código não migra banco nem publica rascunhos. Alterações de banco,
Blob, domínio e variáveis têm escopo próprio. Não exporte contatos, imprima
credenciais ou use seed/requantização como validação de release.
