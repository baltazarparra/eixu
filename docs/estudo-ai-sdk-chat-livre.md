# AI SDK 7 aplicado ao chat de criação de sites

**Natureza:** estudo técnico datado que orientou o
[plano de substituição do gerador](plano-chat-livre.md). A implementação está
registrada em [Execução do chat livre](execucao-chat-livre.md). Consulta inicial
em 17/09/2026, horário de Fortaleza.

Foram examinados documentação oficial online, guias e código-fonte distribuídos
com o pacote instalado, integração atual da EIXU e metadados públicos dos pacotes.
Os exemplos de documentação não foram tratados como prova de execução na conta.
Nenhum modelo pago, Workflow ou Sandbox remoto foi iniciado neste estudo.

## 1. Conclusão de arquitetura

O AI SDK deve ser a base do novo harness. A EIXU precisa definir o comportamento
do produto, as ferramentas, as fontes, os contratos de projeto e os critérios
de qualidade; streaming, protocolo de mensagens e loop de ferramentas devem
usar as implementações do SDK.

Há três responsabilidades diferentes:

1. **Interação e raciocínio:** AI SDK UI/Core, Gateway e política Sol/Terra/Luna.
2. **Continuidade do trabalho:** Workflow, estado persistido e efeitos idempotentes.
3. **Execução do código:** Sandbox de um projeto, com checkpoints externos.

Um chat livre não exige que a publicação, o acesso ao banco e as credenciais
também sejam livres. Esses serviços continuam com contratos determinísticos.
A interface pode ser única enquanto o servidor aplica essas fronteiras.

Recomendação: preservar o padrão `ToolLoopAgent` para agentes controlados pela
EIXU e avaliar **`WorkflowAgent` como executor dos trabalhos longos** em G0.
Ele oferece durabilidade nativa, mas exige uma dependência beta. Adoção somente
após a prova técnica descrita abaixo, com versões fixadas. O fallback é executar
etapas curtas de `ToolLoopAgent` em Workflow, com checkpoints e idempotência
explícitos, não reconstruir o executor de filas antigo.

`HarnessAgent` com Codex merece um experimento posterior como motor de código,
mas não será a escolha inicial apenas por conter a palavra “harness”. Sua API
experimental e as diferenças de autorização, modelos e sessões precisam ser
avaliadas no contrato do produto.

## 2. Versões e significado das APIs

| Pacote                  | Evidência encontrada                                                              | Decisão                                                                |
| ----------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `ai`                    | Implementado com `7.0.105`                                                        | Usar documentação e tipos de v7.                                       |
| `@ai-sdk/react`         | Implementado com `4.0.108`                                                        | Preservar `useChat` e a abstração de transporte.                       |
| `@ai-sdk/gateway`       | Implementado com `4.0.85`                                                         | Gateway continua sendo a entrada dos modelos.                          |
| `@ai-sdk/provider`      | Instalado `4.0.13`                                                                | Considerar as capacidades/tipos reais, inclusive `reasoning`.          |
| `@ai-sdk/workflow`      | Fixado em `2.0.36`                                                                | Implementado com `WorkflowAgent`; integração remota continua pendente. |
| `workflow`              | Fixado em `5.0.0-beta.53`                                                         | Manter a versão beta presa e repetir os gates em upgrades.             |
| `@ai-sdk/harness-codex` | Registro público: `1.0.117`; documentação classifica harnesses como experimentais | Não está instalado nem foi validado em runtime.                        |

Os rótulos do npm são móveis. Fixar o conjunto escolhido no lockfile e registrar
o resultado do ensaio; não adicionar `@latest` ou `@beta` flutuante à execução
de projetos de clientes.

Na v7, priorizar `instructions`, `isStepCount`, `onStepEnd`, `onEnd`,
`result.stream` e `output: Output.object(...)`. Não copiar exemplos de versões
antigas com APIs renomeadas. `useChat` possui seu próprio contrato de callbacks;
a troca de `onFinish` por `onEnd` no Core não autoriza substituição textual global.
Referência: [migração para AI SDK 7](https://ai-sdk.dev/docs/migration-guides/migration-guide-7-0).

## 3. O que aproveitar da EIXU atual

| Superfície                | Estado observado                                                                                               | Mudança necessária                                                                                                                 |
| ------------------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `lib/ai/agent.ts`         | Já usa `ToolLoopAgent`, `prepareStep`, `activeTools`, limites e callbacks.                                     | Reaproveitar o padrão; substituir regras de fases/blocos e ferramentas.                                                            |
| `app/api/chat/route.ts`   | Mistura conversa, geração, edição de blocos, publicação, recibos e contexto; passa `request.signal` ao agente. | Rota fina: autenticar, validar, persistir pedido e iniciar/acompanhar execução. Desconexão HTTP não deve cancelar criação durável. |
| `lib/ai/history.ts`       | Reconstitui cada mensagem como uma única parte de texto.                                                       | Armazenar `UIMessage` tipada e versionada, incluindo parts, anexos, resultados e metadados necessários.                            |
| `lib/ai/chat-stream.ts`   | Intercepta chunks, monta recibos e persiste texto.                                                             | Usar o protocolo/transformações oficiais; recibos de domínio viram dados tipados e persistidos.                                    |
| `lib/ai/context.ts`       | Preserva parte do histórico recente, mas resume ferramentas antigas como texto.                                | Manter o histórico canônico inteiro no servidor e aplicar redução só à visão de contexto enviada ao modelo.                        |
| `generator-workspace.tsx` | Já tem `useChat`, `DefaultChatTransport` e evento de atualização do preview.                                   | Separar a nova workspace das regras do gerador; adicionar reconexão, cancelamento real e tipos de eventos.                         |
| `lib/ai/usage-ledger.ts`  | Recibos por chamada/passo com cache e reasoning; distingue total agregado.                                     | Preservar a contabilidade e adicionar `generationId`, reconciliação e modelo efetivamente servido.                                 |

Portanto, a limpeza deve remover o **domínio do gerador antigo**, preservando
os padrões do SDK e as garantias que já servem ao produto. Uma reescrita cega
perderia capacidades úteis sem resolver os acoplamentos.

## 4. Comparação dos três caminhos de agente

| Caminho         | Resolve                                                                       | Não entrega sozinho                                                                      | Adequação à EIXU                                                               |
| --------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `ToolLoopAgent` | Loop de modelo/ferramentas, contexto, controle por passo e streaming.         | Persistência entre processos, workspace, autorização e publicação.                       | Base controlável e já conhecida no código.                                     |
| `WorkflowAgent` | Loop durável, ferramentas como steps, retomada e integração com streams.      | Regras do produto, arquivos duráveis fora do Sandbox e idempotência de efeitos externos. | Candidato prioritário para criação e edição longa; validar a dependência beta. |
| `HarnessAgent`  | Integra runtime pronto com ferramentas de código, histórico nativo e sessões. | Contratos específicos da EIXU e equivalência de permissões entre adapters.               | Alternativa para o motor de código, dependente de avaliação própria.           |

O `ToolLoopAgent` tem limite padrão de 20 passos; isso não é um critério de
“site concluído”. Usar limites explícitos e confirmar artefatos/validações de
domínio ao encerrar. O modelo pode terminar com texto antes de cumprir a tarefa;
o produto precisa reconhecer um resultado parcial.
Fontes: [agentes](https://ai-sdk.dev/docs/agents/overview),
[construção](https://ai-sdk.dev/docs/agents/building-agents) e
[controle do loop](https://ai-sdk.dev/docs/agents/loop-control).

### WorkflowAgent: os detalhes que alteram o plano

O executor usa `stream()`, com saída durável de `ModelCallStreamPart`. As
ferramentas devem executar em funções `'use step'` para terem durabilidade;
colocá-las apenas dentro de um workflow não torna qualquer efeito persistente.
Não há limite padrão de passos: configurar parada por passos, orçamento e cancelamento.

O contexto entre steps deve conter identificadores e dados serializáveis.
Clientes de banco, handles do Sandbox e segredos não são estado durável:
reconstruir os recursos dentro do step. Não iniciar um `ToolLoopAgent` enorme
dentro de uma única Function e considerar a duração resolvida.

Na adoção proposta, o fluxo externo controla os checkpoints de produto; o
executor controla os passos do agente. Há uma só execução autoritativa, com
uma projeção no Neon para acompanhamento pelo operador.
Fonte: [WorkflowAgent](https://ai-sdk.dev/docs/agents/workflow-agent).

### HarnessAgent/Codex: vantagens e limites concretos

O adapter aceita autenticação explícita `ai-gateway`, effort e skills. O ID de
modelo pertence ao runtime do harness; não assumir o mesmo formato
`openai/...` usado pelo Core. O Codex executa dentro do Sandbox com uma ponte
de rede. Atualmente o adapter não oferece filtro/aprovação das ferramentas
nativas e documenta `permissionMode: 'allow-all'`; permissões de ferramentas
executadas pela plataforma são um controle separado.

Isso exige isolamento real de arquivos, rede e credenciais. Não autoriza acesso
administrativo à Vercel, Neon ou Git. O modo automático de autenticação também
pode recorrer a outra credencial: selecionar Gateway explicitamente no ensaio.
Fonte: [adapter Codex](https://ai-sdk.dev/providers/ai-sdk-harnesses/codex).

Uma sessão Harness conserva histórico nativo; enviar todas as mensagens não
recria esse histórico. Persistir o estado opaco de retomada. Mudar instructions,
skills ou catálogo de ferramentas no adapter Codex pode iniciar outra thread
nativa. Precisaríamos testar a continuidade antes de conectar direção de arte
e edição incremental a esse runtime.
Fontes: [HarnessAgent](https://ai-sdk.dev/docs/ai-sdk-harnesses/harness-agent) e
[Workflow para harnesses](https://ai-sdk.dev/docs/ai-sdk-harnesses/workflow-utilities).

## 5. Modelo, effort e contexto por tarefa

Usar um registro de papéis para Sol/Terra/Luna. `prepareCall` resolve a configuração
do pedido; `prepareStep` ajusta ferramentas, contexto ou modelo quando houver
razão objetiva. Evitar roteamento baseado somente em tamanho da mensagem ou
número de passos: um pedido curto de redesenho pode exigir Sol/high.

No Core, mudanças de configuração de chamada retornadas em `prepareStep` valem
para aquele passo, enquanto overrides de mensagens/instruções se propagam.
Não presumir que selecionar Sol em um passo manterá o modelo nos próximos:
recalcular a política explicitamente quando necessário. Preservar pares de
tool call/result e metadados do provider ao reduzir histórico.
Fonte: [controle por passo](https://ai-sdk.dev/docs/agents/loop-control).

O tipo unificado instalado de `reasoning` não aceita `max`, embora o catálogo
dos modelos o anuncie. Manter low/medium/high/xhigh no plano inicial. Configuração
específica do provider pode prevalecer sobre a unificada; não enviar duas
políticas divergentes. A configuração do Codex editor não comprova nada sobre
a chamada pelo Gateway.
Fonte: [reasoning](https://ai-sdk.dev/docs/ai-sdk-core/reasoning) e tipos instalados
em `node_modules/@ai-sdk/provider/dist/index.d.ts`.

Separar três contextos: informações que o modelo deve ler; `runtimeContext`
com estado operacional; `toolsContext` validado por `contextSchema` para cada
ferramenta. O tenant autorizado nasce da sessão do servidor, nunca de um
argumento do modelo. Não transformar esses contextos em depósito de credenciais
persistidas, especialmente em workflows.
Fonte: [runtime e tools context](https://ai-sdk.dev/docs/ai-sdk-core/runtime-and-tool-context).

## 6. Saídas estruturadas sem recriar o catálogo de blocos

Usar `generateText`/`streamText` com `Output.object` e schemas para briefing,
evidências, perfil visual e relatório de validação. Schemas validam o formato,
não provam verdade ou qualidade estética. Uma citação precisa apontar a uma
fonte efetivamente lida; uma revisão positiva precisa se vincular a screenshots.

Saída parcial pode informar progresso; somente o resultado final validado
atualiza o artefato canônico. O código do site é composto em arquivos próprios,
não em um JSON de seções predefinidas. Quando um loop combina ferramentas e
saída estruturada, reservar espaço para o passo de conclusão.
Fonte: [saídas estruturadas](https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data).

## 7. Ferramentas e visão

Definir ferramentas tipadas e pequenas para contexto, assets, arquivos,
comandos, preview e validação. Filtrar o catálogo por tarefa com `activeTools`.
Esse filtro reduz a superfície enviada ao modelo, mas a autorização continua
na implementação da ferramenta. Validar paths e revisões também no servidor.

Screenshots destinados ao crítico precisam ser conteúdo multimodal. Quando
vierem de ferramenta, `toModelOutput` faz a tradução para partes de imagem;
armazenar a referência e enviar pixels por um caminho suportado. Base64 dentro
de uma string JSON de resultado não é prova de visão. Ensaiar esse percurso
específico com o modelo e provider escolhidos.

`repairToolCall` deve corrigir formato/argumentos recuperáveis. Não pode
converter acesso negado em permitido, mudar o alvo ou flexibilizar o schema
para aceitar uma resposta. Uma ferramenta de escrita deve validar o conteúdo
completo antes do efeito e retornar um recibo da revisão realmente salva.
Fonte: [ferramentas](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling).

`experimental_sandbox` é uma interface de delegação: passá-la ao agente não
isola automaticamente o corpo de `execute`. Comandos e builds precisam chamar
de fato o Sandbox remoto. A ferramenta hospedeira continua rodando na aplicação.
Fonte: [interface de Sandbox](https://ai-sdk.dev/docs/reference/ai-sdk-core/sandbox).

## 8. Persistência e protocolo do chat

Armazenar a mensagem como `UIMessage` validada e versionada, com IDs estáveis,
autoria, estado, parts e referências de anexos. O servidor carrega o histórico
canônico e acrescenta a nova mensagem; não aceitar histórico completo do cliente
como prova de ações, autorização ou fatos confirmados.

Aplicar `validateUIMessages` aos dados carregados e `convertToModelMessages`
somente na fronteira do modelo. Migrações de schemas de ferramenta devem manter
o histórico legível; não descartar a conversa inteira porque uma versão antiga
de uma ferramenta mudou. Anexos apontam a assets autorizados e persistidos,
nunca apenas a URLs temporárias de upload.

Salvar no servidor durante a execução e ao encerrar. `onEnd` sozinho não cobre
crash anterior à conclusão. Guardar tanto o estado do trabalho quanto o estado
exibido da mensagem, mantendo a associação entre run e conversa.
Fonte: [persistência](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-message-persistence).

`useChat<InferAgentUIMessage<...>>` pode conservar os tipos das ferramentas.
Dados de negócio adicionais usam tipos explícitos de mensagem. Informações como
`run-status`, `preview-ready`, `artifact` e `release-result` podem usar partes
de dados; o servidor emite o evento quando há evidência correspondente.

Partes transitórias servem a animação/aviso momentâneo e não entram no histórico.
Por isso o evento atual de recarregar preview pode ser transitório, mas a revisão
pronta e seu estado precisam estar persistidos. Reutilizar os helpers oficiais
do protocolo; evitar parser SSE próprio ou remontagem manual de tool parts.
Fonte: [streaming de dados](https://ai-sdk.dev/docs/ai-sdk-ui/streaming-data).

## 9. Reconectar, retomar e cancelar

São operações diferentes:

| Operação          | Resultado esperado                                                       |
| ----------------- | ------------------------------------------------------------------------ |
| Reconectar o chat | O navegador volta a acompanhar mensagens/eventos existentes.             |
| Retomar execução  | O servidor continua do checkpoint após interrupção do worker.            |
| Retomar workspace | Arquivos e estado de trabalho são recuperados após encerrar Sandbox.     |
| Cancelar          | Um comando autenticado persiste a intenção e interrompe trabalho futuro. |

A receita de `resume: true` usa armazenamento de streams, por exemplo Redis;
ela não cria sozinha durabilidade do agente. `consumeStream` mantém consumo no
servidor após desconexão, mas não elimina timeout/crash de Function. `stop()`
no cliente encerra a conexão; criar uma rota de cancelamento real e idempotente.
Fonte: [retomada de streams](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-resume-streams).

Se adotarmos WorkflowAgent, usar `WorkflowChatTransport` e os streams do Workflow,
evitando adicionar Redis para resolver a mesma retomada. A rota de reconexão
precisa autenticar e vincular run à conversa/tenant. Validar cursor e deduplicação;
os índices dos chunks crus e da UI não são equivalentes. O transform oficial
trata a projeção e os resets de passos repetidos.
Fonte: [WorkflowChatTransport](https://ai-sdk.dev/docs/reference/ai-sdk-workflow/workflow-chat-transport).

Retries precisam ser contabilizados em conjunto: Gateway/provider, SDK,
Workflow e ferramentas não podem multiplicar tentativas sem limite. Uma falha
de rede depois de um efeito exige reconciliação por chave, não repetição cega.
Permitir que o operador acompanhe o chat durante um trabalho não significa
permitir dois agentes escrevendo simultaneamente no mesmo projeto.

## 10. Publicação e aprovações

O pedido explícito de publicação chama o serviço da EIXU. Não é necessário
inserir uma segunda aprovação do modelo para uma ação já autorizada. Leituras,
builds, previews e edições reversíveis dentro do pedido não devem gerar uma
cascata de confirmações na UI.

Quando existir uma aprovação realmente necessária, `ToolLoopAgent`/Core usam
`toolApproval`; na versão de `WorkflowAgent` estudada, o contrato documentado
usa `needsApproval`. Não assumir equivalência total entre as classes. Vincular
aprovação à versão, argumentos, operador e projeto; validação de esquema não
autentica uma decisão. A publicação final sempre revalida o estado técnico.
Fontes: [aprovações](https://ai-sdk.dev/docs/agents/tool-approvals) e
[referência WorkflowAgent](https://ai-sdk.dev/docs/reference/ai-sdk-workflow/workflow-agent).

## 11. Gateway, custos e observabilidade

Usar Gateway como provider explícito dos papéis, preferindo credenciais do
ambiente Vercel. Separar fallback de provedor de fallback de modelo: outro
provedor do mesmo modelo não equivale a trocar Sol por Luna. Registrar a
capacidade efetivamente usada e a versão da política.

Capturar `providerMetadata.gateway.generationId` assim que disponível. O Gateway
oferece consulta posterior por ID para reconciliar uso/custo após interrupção.
Preservar a intenção de gasto antes da chamada e deduplicar o lançamento por
operação/passo; não somar de novo o agregado da execução. Retenção e disponibilidade
da consulta precisam ser verificadas na conta.
Fonte: [provider AI Gateway](https://ai-sdk.dev/providers/ai-sdk-providers/ai-gateway).

Na v7, telemetria registrada pode coletar entradas e saídas por padrão. Em
produção, desativar gravação integral de prompts/resultados e permitir somente
metadados necessários, com correlação entre tenant, run, chamada, Sandbox e
deployment. Filtragem de contexto em telemetria não protege callbacks que
imprimam o objeto inteiro.

DevTools é útil em desenvolvimento com dados sintéticos, não como painel de
produção. O ledger do produto e os recibos de release continuam persistidos
mesmo que a exportação de tracing esteja indisponível.
Fontes: [telemetria](https://ai-sdk.dev/docs/ai-sdk-core/telemetry) e
[DevTools](https://ai-sdk.dev/docs/ai-sdk-core/devtools).

## 12. O que não adicionar agora

- **Vector database/memória externa:** o contexto inicial é pequeno e estruturado;
  Neon, arquivos e ferramentas de leitura bastam. Avaliar busca semântica só com
  evidência de necessidade. [Opções de memória](https://ai-sdk.dev/docs/agents/memory).
- **MCP administrativo dentro do agente do site:** o MCP foi útil para esta
  auditoria. O runtime do produto deve chamar ferramentas restritas da plataforma,
  sem herdar acesso geral ao time Vercel. [Integração MCP](https://ai-sdk.dev/docs/ai-sdk-core/mcp-tools).
- **Code Mode como substituto do Sandbox:** sua execução QuickJS organiza chamadas
  a ferramentas; não fornece um ambiente Next.js com browser e dev server.
  É experimental e não atende ao fluxo de aprovação aninhado.
  [Code Mode](https://ai-sdk.dev/docs/ai-sdk-core/code-mode).
- **OPA, vários frameworks de agentes ou uma rede permanente de subagentes:**
  o primeiro produto precisa de poucas regras claras e papéis avaliados.
  Adicionar infraestrutura somente quando reduzir uma limitação observada.
- **Geração da própria interface administrativa:** o chat tem UI estável;
  a liberdade de código pertence ao site do cliente.

## 13. Prova técnica e critérios para G0/G3

Antes de depender de `WorkflowAgent`, produzir um ensaio isolado que use versões
fixadas compatíveis com Node/Next/AI SDK instalados. O ensaio não cria uma segunda
arquitetura de produção. Deve demonstrar:

1. Sol, Terra e Luna pelo Gateway com effort registrado, ferramenta e imagem
   multimodal; orçamento pequeno e explícito para as chamadas reais.
2. Dois passos duráveis, interrupção de worker e retomada com um único efeito
   externo confirmado. Não confundir cache de resultado com execução exatamente uma vez.
3. Chat fechado/reaberto, cursor de stream, mensagens sem duplicação e estado
   correto de um passo reexecutado.
4. Cancelamento no servidor, preservação parcial e nenhuma continuação paga
   iniciada depois de reconhecer o cancelamento.
5. Sandbox encerrado e reconstruído a partir do checkpoint; nenhum segredo
   ou handle de processo persistido no contexto.
6. Negativa de acesso a outro tenant no POST, GET de stream, ferramentas e preview.
7. Custo reconciliável mesmo sem chunk final e falha de telemetria sem perda dos
   recibos de domínio.

Usar `MockLanguageModelV4` e streams simulados nos testes de protocolo,
concorrência e erros. São baratos e determinísticos; não provam qualidade
criativa nem suporte real do provider. Reservar chamadas reais para as
capacidades e avaliações que o mock não verifica.
Fonte: [testes do SDK](https://ai-sdk.dev/docs/ai-sdk-core/testing).

Se a dependência beta passar, adotar WorkflowAgent para a execução longa e
retirar o executor antigo. Se falhar, registrar a limitação e seguir com Core
em etapas duráveis delimitadas; não bloquear o produto por adoção de uma API
específica. Nenhum dos dois caminhos altera a jornada única do operador.

## 14. Consequências para o plano principal

- G2 preserva a base útil do SDK enquanto remove o catálogo/runner antigo.
- G3 inclui persistência completa de `UIMessage`, transporte e cancelamento,
  além de arquivos e Workflow; esses itens não ficam para um polimento final.
- G4 usa schemas para contexto e evidências, e entrada multimodal comprovada.
- G6 verifica a versão exata do site e a imagem efetivamente enviada ao crítico.
- G7 mantém publicação fora da execução livre, com code/content snapshot e recibos.
- O harness da EIXU permanece pequeno: política, contexto, ferramentas e gates;
  SDK e Vercel fornecem os mecanismos reutilizáveis.
