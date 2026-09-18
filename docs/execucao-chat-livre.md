# Execução do EIXU Studio

Atualizado em 18/09/2026 (America/Fortaleza).

## Escopo entregue

A branch `codex/studio-product`, baseada em `main` `4b93bc5`, transforma o
Studio no produto interno de criação e gestão de sites da EIXU. `/studio`
passa a ser a entrada principal do operador para criar, editar, arquivar e
publicar projetos, enquanto `/admin` continua disponível para a operação
legada e para as mesmas fontes de dados.

O cadastro reúne nome, subdomínio, briefing, contatos, redes sociais, site
atual, referência visual, logo, cores e uma das três vibes: Comercial, Ousado
ou Referência. Na vibe Referência, o link visual é obrigatório e assume a
prioridade de estrutura, tipografia, ritmo e direção de arte, sem autorizar
cópia de marca, texto, imagem ou código.

Depois do cadastro, o Studio abre a área de trabalho e inicia a primeira
criação. A jornada segue contexto factual, estrutura, direção de arte,
imagens, construção, typecheck e build. A primeira versão validada solicita a
publicação automática; nos turnos seguintes, conversa e CMS atualizam apenas a
prévia e a produção muda quando o operador clica em **Publicar**.

A área de trabalho mantém conversa, preview e conteúdo no mesmo fluxo. Durante
um turno ativo, a prévia abre o diretório vivo do Sandbox com HMR; durante
typecheck ou build, ela pausa para não disputar o diretório `.next`; fora de um
turno, ela restaura o checkpoint imutável. A aba Imagens centraliza uploads e
gerações, e o CMS mantém `content/schema.json` e `content/values.json` como
contrato editorial versionado.

## Modelos e direção

A política `studio-gemini-3.8-flash-v3` usa
`google/gemini-3.8-flash` com reasoning `high`, o maior nível aceito pelo
modelo no AI Gateway, para conversa, contexto, direção, código e crítica. A
geração e a edição de imagens usam `openai/gpt-image-2.5-sunburst` por padrão.
O prompt incorpora o contrato anti-slop do Taste Skill v1 e mantém a fonte
oficial do cliente acima de qualquer referência estética.

## Agente de front-end depois da primeira criação

Decisão do usuário nesta entrega: o turno de edição continua automaticamente
enquanto avança, até 150 etapas, e as dependências do projeto do cliente
continuam fixadas em Next, React e React DOM. O executor abre um novo segmento
do agente ao esgotar os 48 passos de um segmento, registra `model.continuing` e
encerra quando dois segmentos seguidos não escrevem nem validam. Esgotar o
orçamento continua sendo falha sem checkpoint, agora informando no chat quais
arquivos ficaram alterados no rascunho.

## Falhas observadas em produção no piloto Libardi

Duas falhas reais em 18/09/2026, com causa confirmada nos registros:

O release `afb27ba1-f022-425a-a202-542fad8f9cfb` foi promovido na Vercel às
21:46:55 e o passo `verifyCanonicalStep` falhou três vezes até 21:47:01, em
menos de seis segundos, com "O host não está servindo o release esperado".
O deployment `dpl_EezrA4v893ScM8w18X26SB7FaiDJ` é o de produção do projeto
`prj_65p30W27mmDksif60jphQ118YnA9`: a publicação aconteceu e só a confirmação
no banco falhou, por tempo de propagação da borda. O workflow passou a sondar
o marcador canônico antes de confirmar, e `reconcileStudioRelease` continua
reparando releases nesse estado quando o painel é recarregado.

A captura do Minatel alternou entre `observed` (20:09, 21:23 e 21:37) e
falhas: `net::ERR_FAILED` às 19:51 e 19:56 e `The operation was aborted due to
timeout` às 21:50. O prazo único de 55 segundos cobria abertura do navegador e
os dois viewports. Agora cada viewport tem orçamento próprio e uma segunda
tentativa, e um viewport entregue já basta para o turno prosseguir declarando
o que faltou.

O catálogo ganhou `edit_project_file`, para substituir um trecho exato sem
reescrever o arquivo, e `delete_project_file`, para retirar páginas e
componentes que saíram da composição; arquivos de integração e o contrato
editorial continuam protegidos. A captura da referência passou a entregar a
sequência real das faixas, com geometria, grid, tipografia e paleta, além dos
screenshots. Nenhuma chamada paga de modelo, geração de imagem, publicação ou
escrita remota foi executada nesta entrega.

## Dados, acesso e efeitos externos

O piloto continua restrito aos operadores globais da EIXU. O schema agora
possui `studio_workspaces` e liga cada tenant a um workspace estável; o painel
filtra explicitamente o workspace interno da EIXU. Essa fronteira prepara a
separação futura por agência, mas ainda não introduz papéis por tenant.

Slug, projeto, histórico e autorização continuam resolvidos no servidor. O
cliente envia somente a mensagem nova; a API valida a `UIMessage`, lê o
histórico canônico e decide se aquele turno realmente é a primeira criação.
Assim, repetir `autoPublish` no navegador não publica uma alteração posterior.
Publicação, preview, comandos e imagens continuam protegidos por steps, leases,
chaves idempotentes, checkpoints privados e tokens efêmeros.

## Migração aplicada

O schema aditivo foi ensaiado num branch Neon temporário e aplicado ao projeto
`odd-art-94996868`, branch primário `main`
(`br-lively-thunder-awgxwa42`), database `neondb`.

A migração de base do Studio continua registrada como
`c1025692-c4a4-40b5-9b5c-b0425a80a60a`. Para a fronteira de workspace, foi
criado o snapshot de recuperação `snap-patient-leaf-aw80gwrr`, nome
`before-studio-workspace-2026-09-18`, e aplicada a migração
`8f8bbc11-8c5b-4abc-8c14-2430e9c13213`. A verificação no branch principal
confirmou um workspace EIXU, três tenants ligados a ele, zero tenants sem
workspace e o índice `tenants_workspace_idx`. O branch de ensaio foi removido
após a aplicação.

## Validação

No estado final antes do release:

| Gate                                   | Resultado                                                                                         |
| -------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `npx next typegen && npx tsc --noEmit` | passou; 126 steps e 2 workflows compilados                                                        |
| `npm run lint`                         | passou sem avisos                                                                                 |
| `npm run test:studio`                  | 53/53 testes passaram                                                                             |
| `npm run test:admin`                   | 52 passaram e 3 integrações sem PostgreSQL local foram puladas                                    |
| `npm run build:vercel`                 | passou com Next.js 16.3.3 e runtime do Workflow validado                                          |
| `node --check` nos scripts de reset    | passou; nenhum reset foi executado                                                                |
| `npm audit --audit-level=moderate`     | zero vulnerabilidades                                                                             |
| navegador desktop e mobile             | login protegido, lista, cadastro, workspace, dados e imagens verificados; sem overflow horizontal |
| `git diff --check`                     | passou                                                                                            |

O teste de navegador encontrou e corrigiu uma regressão de altura no workspace
mobile que escondia a conversa e o compositor. Também confirmou que a vibe
Referência torna o link visual obrigatório no HTML e no servidor. Nenhuma
chamada paga de modelo ou imagem e nenhum site sintético de cliente foram
criados nesta validação; os contratos, serialização do Workflow, rotas e
efeitos determinísticos foram exercitados localmente.

## Release da plataforma

O projeto raiz conferido pela CLI é `rvnn/eixu`, ID
`prj_xVeSzlAAalV8xBD9NixqpSxLWXKk`, com build `npm run build:vercel` e Node.js
24.x. O commit funcional `4c319c4db9ede99d7e139b4e63f157a53efb1462` foi
publicado em produção no deployment `dpl_Gy8xS1jfnmmftXeuFEkmkLNpKa3y`, que
chegou a `READY` e recebeu os aliases `eixu.com.br`, `*.eixu.com.br` e
`eixu.vercel.app`. O smoke anônimo confirmou que `/studio` responde no domínio
canônico e redireciona para `/admin/login?returnTo=/studio` sem cache público.
