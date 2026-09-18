# Execução do chat livre

Atualizado em 18/09/2026 (America/Fortaleza).

## Resultado desta branch

A branch `codex/chat-livre`, baseada em `origin/main` `669c4f3`, substitui o domínio do gerador de blocos pelo EIXU Studio. O primeiro commit `e21983d` preservou o plano e o estudo; a implementação seguinte entrega uma jornada única de chat, preview, CMS leve, imagens e publicação por projeto.

Implementado:

- `WorkflowAgent` durável com streaming retomável e cancelamento;
- roteamento auditável GPT-5.6 Terra, Sol e Luna por papel/effort;
- primeira criação em contexto factual → direção de arte → código → refinamento;
- ferramentas tipadas e tenant-safe para fontes, arquivos, comandos, imagens e artefatos;
- Vercel Sandbox com egress restrito, paths protegidos e checkpoints privados;
- preview autenticado por token efêmero sem persistir segredo na URL;
- `content/schema.json` e `content/values.json` com revisões imutáveis e CMS;
- um projeto Vercel por cliente, preview protegido, bypass de smoke derivado por projeto, upload por digest, promoção e rollback;
- formulário, eventos e WhatsApp centrais vinculados à release ativa;
- recibos de modelo, tokens, reasoning, cache, custo e geração;
- reset por manifesto de produção ou preview, preservando institucional, operadores e Kanban;
- remoção do renderer de blocos, filas do gerador, conversão Premium, projetos Premium versionados, documentação e testes legados.

## Limites da execução

Nenhuma chamada paga de modelo/imagem, Sandbox remoto, deployment de produção ou limpeza de banco/Blob/Vercel foi executada. A migração aditiva foi aplicada depois da abertura da PR, com o recibo abaixo. Reset e ensaio funcional remoto continuam separados da migração.

A consulta ao MCP da Vercel em 18/09/2026 encontrou uma divergência de acesso: o arquivo local `.vercel/project.json` identifica o projeto raiz da EIXU, mas o conector retornou 404 para ele, listou somente outro projeto no time e retornou 403 ao listar deployments. Por isso, IDs não foram fixados no código. `EIXU_VERCEL_TEAM_ID` e `EIXU_VERCEL_ROOT_PROJECT_ID` são obrigatórios e a prova de integração real continua pendente até o token/conector enxergar os recursos da EIXU.

## Migração aplicada

Em 18/09/2026, o schema foi aplicado ao projeto Neon
`odd-art-94996868`, branch primário `main`
(`br-lively-thunder-awgxwa42`), database `neondb`:

- snapshot de recuperação `snap-silent-frog-aws4az3n`, nome
  `before-eixu-studio-2026-09-18`;
- ensaio em branch temporário antes de escrever no branch principal;
- correção do alias SQL reservado `column`, encontrada no primeiro ensaio;
- migração `c1025692-c4a4-40b5-9b5c-b0425a80a60a` aplicada com sucesso;
- branch temporário removido automaticamente depois da aplicação;
- nove tabelas `studio_*` e os novos campos confirmados no branch principal;
- 565 mensagens compatibilizadas, sem `message_uid` ou `parts` nulos;
- contagens preservadas: 37 tenants, 3 operadores, 20 cards, 478 eventos e
  399 imagens;
- tabelas do gerador e Premium continuam presentes até o reset controlado.

Os ambientes Vercel `preview` e `production` ainda apontam para esse mesmo
branch Neon principal. A migração, portanto, atende ambos hoje, mas a falta de
isolamento precisa ser resolvida antes dos ensaios destrutivos de preview.
Também faltam nos dois ambientes `EIXU_VERCEL_TOKEN`,
`EIXU_VERCEL_TEAM_ID`, `EIXU_VERCEL_ROOT_PROJECT_ID` e
`EIXU_VERCEL_BYPASS_MASTER_SECRET`; sem eles, a publicação de projetos de
clientes permanece bloqueada.

## Validação local

Executada em 18/09/2026 sobre o estado final da implementação:

| Gate                                                | Resultado                                                                                      |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `npx next typegen && npx tsc --noEmit`              | passou; 123 steps e 2 workflows compilados                                                     |
| `npm run lint`                                      | passou sem avisos                                                                              |
| `npm run test:sites`                                | 15/15 testes passaram                                                                          |
| `npm run test:studio`                               | 20/20 testes passaram                                                                          |
| `npm run test:admin`                                | 50 testes passaram; 3 integrações PostgreSQL foram puladas sem banco local                     |
| `npm run build:vercel`                              | passou com Next.js 16.3.3 e Workflow compilado                                                 |
| scaffold independente                               | `next typegen`, TypeScript e build passaram; a home foi pré-renderizada como conteúdo estático |
| `node --check scripts/reset-sites.mjs` e biblioteca | passaram; nenhum reset foi executado                                                           |
| `npm audit --audit-level=moderate`                  | zero vulnerabilidades                                                                          |
| `git diff --check`                                  | passou                                                                                         |
| varredura dos 118 paths alterados ou novos          | nenhum valor com formato de credencial encontrado                                              |

O scaffold foi validado com o executável Linux do Node apontando diretamente
para os binários instalados na raiz. O wrapper `npm` dentro do diretório
sintético resolveu um executável Windows e reportou WSL 1, embora o ambiente
seja WSL 2; isso é uma particularidade do PATH local, não uma falha do projeto
gerado.

## Ações posteriores à PR

1. Criar um branch Neon dedicado a preview e apontar somente o ambiente Vercel Preview para ele.
2. Configurar os segredos e IDs novos da publicação por projeto na Vercel.
3. Corrigir/confirmar o acesso da integração Vercel e executar o ensaio remoto em recursos descartáveis.
4. Gerar e revisar os manifestos de reset de preview e produção.
5. Executar o reset somente após confirmação explícita dos manifestos frescos.
6. Fazer smoke do institucional, login e Kanban preservados.
7. Criar um tenant sintético, rodar chat, preview, CMS, publicação e rollback ponta a ponta.
8. Revisar e fazer merge da PR; depois promover a plataforma para produção e repetir o smoke no commit exato.

## PR

A branch passou pelos gates locais e está pronta para revisão. A URL da PR fica
registrada no resumo desta entrega.
