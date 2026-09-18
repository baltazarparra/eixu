# Harness e modelos do EIXU Studio

## Decisão

O Studio usa AI SDK 7 como protocolo de modelo, ferramentas, mensagens e streaming. `WorkflowAgent` executa o loop em Vercel Workflow; Vercel Sandbox executa o projeto; AI Gateway entrega os modelos. A EIXU mantém os contratos de produto, autorização, arquivos, conteúdo, checkpoint e release.

As dependências estão fixadas no lockfile: `ai 7.0.105`, `@ai-sdk/react 4.0.108`, `@ai-sdk/gateway 4.0.85`, `@ai-sdk/workflow 2.0.36`, `workflow 5.0.0-beta.53` e `@vercel/sandbox 3.3.0`. Workflow 5 permanece beta; upgrade exige repetir build, retomada e cancelamento.

Documentação oficial relevante: [WorkflowAgent](https://ai-sdk.dev/docs/agents/workflow-agent), [loop control](https://ai-sdk.dev/docs/agents/loop-control), [persistência de chat](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-message-persistence) e [tools](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling).

## Política de modelos

`lib/studio/models.ts` é a fonte única da política `studio-gemini-3.8-flash-v3`.

| Papel           | Modelo                  | Reasoning | Segmento | Turno | Uso                                  |
| --------------- | ----------------------- | --------- | -------- | ----- | ------------------------------------ |
| `assistant`     | google/gemini-3.8-flash | high      | 12       | 12    | Conversa e pedido geral.             |
| `batch`         | google/gemini-3.8-flash | high      | 4        | 4     | Extração/classificação curta.        |
| `context`       | google/gemini-3.8-flash | high      | 12       | 12    | Fontes, fatos, tom e lacunas.        |
| `art_direction` | google/gemini-3.8-flash | high      | 16       | 16    | Leitura visual e direção de arte.    |
| `build`         | google/gemini-3.8-flash | high      | 32       | 32    | Primeiro projeto, sem checkpoint.    |
| `edit`          | google/gemini-3.8-flash | high      | 48       | 150   | Agente de front-end após a criação.  |
| `refine`        | google/gemini-3.8-flash | high      | 24       | 24    | Responsividade, motion e acabamento. |
| `critic`        | google/gemini-3.8-flash | high      | 12       | 12    | Crítica vinculada a evidência atual. |
| `diagnostic`    | google/gemini-3.8-flash | high      | 20       | 20    | Falhas complexas de código/build.    |

CMS e publicação são determinísticos e não consomem inferência. O servidor escolhe `build` quando não há checkpoint e `edit` depois da primeira versão, sem classificar o texto por palavras-chave. O agente interpreta livremente se o pedido é conversa, análise, ajuste ou reconstrução ampla. `edit` tem o mesmo limite de saída do build (49.152 tokens). Os demais papéis continuam disponíveis para recuperação e recibos históricos. O papel, modelo efetivamente servido, reasoning, tokens, cache, custo e `generationId` são armazenados por passo.

## Orçamento do turno e continuação

`maxSteps` limita um segmento do agente; `maxTotalSteps` limita o turno inteiro. Copiar um layout completo não cabe em 48 passos, então o executor continua sozinho: ao terminar um segmento ainda em `tool-calls`, ele reaproveita as mensagens e os resultados de ferramentas, registra `model.continuing` e abre o segmento seguinte dentro do mesmo run, até 150 passos na edição. O pedido de continuação diz quantas etapas já foram usadas e manda priorizar escrita e validação.

Continuar exige progresso: um segmento sem escrita, remoção, imagem ou comando é ocioso, e dois ociosos seguidos encerram o turno sem gastar o resto do orçamento. Cancelamento interrompe a continuação antes do próximo segmento. Retomada por interrupção do provedor continua limitada a duas tentativas seguidas e soma no mesmo orçamento; um segmento que produziu efeito antes de cair devolve essa cota, senão um turno longo morreria por soma de falhas transitórias.

O Sandbox do projeto é persistente: uma sessão que expira no meio de um turno longo suspende a máquina sem descartar o rascunho, e a chamada seguinte retoma o mesmo disco. O checkpoint só é restaurado quando a estrutura do projeto não está mais lá.

Esgotar o orçamento é falha, não conclusão: não há checkpoint nem publicação. A mensagem de erro lista os arquivos que o turno alterou; eles permanecem no diretório vivo do Sandbox, e o pedido seguinte continua de lá.

## Ordem do primeiro build

`prepareStep` impõe pré-condições em vez de depender apenas do prompt:

1. força `read_project_context` com Gemini/high;
2. força `read_official_site` com Gemini/high;
3. força `record_artifact(kind=context)`;
4. força `inspect_visual_reference` com Gemini/high;
5. força `record_artifact(kind=art_direction)`;
6. libera as ferramentas de projeto.

O checkpoint de um `build` recusa ausência dos dois artefatos. Assim, o agente não pode pular diretamente para código. Edições posteriores recebem os artefatos mais recentes e a evidência acumulada no contexto.

O WorkflowAgent mantém os overrides de `prepareStep` entre passos. Ao sair do contexto, restauramos explicitamente o orçamento do build; depois da direção de arte, restauramos o catálogo completo e `toolChoice: auto`. Retornar `{}` nessa transição mantém `record_artifact` forçado e impede o agente de escrever o projeto. O teste do loop usa o SDK real com modelo e efeitos simulados para provar a passagem até escrita/checks e a recuperação de uma chamada inválida.

## Ferramentas

Após a primeira criação, o catálogo inteiro fica disponível desde o início e não há repetição obrigatória do onboarding. O pedido atual prevalece sobre artefatos e vibe anteriores. O agente pode reconstruir componentes e CSS, criar e remover arquivos, inspecionar uma URL nova, gerar imagens e atualizar o contrato editorial. Perguntas e análises não exigem escrita. Alterações continuam sujeitas a checkpoint e publicação manual.

| Ferramenta                                 | Responsabilidade                                                          |
| ------------------------------------------ | ------------------------------------------------------------------------- |
| `read_project_context`                     | Dados, contatos, marca, logo e evidências existentes.                     |
| `read_official_site`                       | Crawl limitado da fonte factual cadastrada.                               |
| `inspect_visual_reference`                 | Screenshots e leitura estrutural da URL do chat ou, sem URL, do cadastro. |
| `list_project_files` / `read_project_file` | Inspeção dentro da raiz autorizada.                                       |
| `write_project_file`                       | Escrita de arquivo completo após política de path e tamanho.              |
| `edit_project_file`                        | Substituição de um trecho exato e único, preservando o resto do arquivo.  |
| `delete_project_file`                      | Remoção de página ou componente que saiu da composição.                   |
| `write_content_contract`                   | Validação e gravação atômica de schema/valores.                           |
| `generate_project_image`                   | Geração com referências autorizadas, recibo e acervo numerado.            |
| `run_project_check`                        | Comando permitido, como typecheck ou build.                               |
| `record_artifact`                          | Contexto, direção de arte e validação tipados e versionados.              |

`edit_project_file` recusa um trecho ausente e, sem `replaceAll`, um trecho repetido: reescrever o arquivo inteiro a cada ajuste consumia saída e etapas sem necessidade. `delete_project_file` usa a mesma política de path da escrita — arquivos de integração continuam reservados — e recusa `content/schema.json` e `content/values.json`, atualizados como unidade por `write_content_contract`. Remoção conta como mutação do turno para o checkpoint, e o gate de build continua sendo quem prova que a página retirada não era necessária. O agente escreve os formatos textuais enumerados, incluindo `.svg`; dependências, lockfile e `package.json` seguem fora do seu alcance.

As ferramentas revalidam o run e o vínculo projeto/tenant antes do efeito. `activeTools` e `toolChoice` reduzem o catálogo do passo; autorização continua no executor.

## Contexto e fontes

A captura entrega screenshots e uma leitura estrutural da página: sequência das faixas de primeiro nível com geometria, grid, espaçamento, cor e densidade de imagens, links e botões, mais navegação, escala tipográfica e paleta ordenada por uso. A extração desce wrappers de framework antes de listar as faixas. O seletor anterior só olhava `main > section` e `main > article`: em um layout montado com divs, o modelo recebia pouco além de `body` e dois títulos, e nenhuma sequência para reproduzir. `lib/references/outline.ts` roda dentro da página por `page.evaluate` e por isso não pode depender de nada do módulo.

`inspect_visual_reference({ url })` aceita uma referência pública nova sem alterar `/dados`. O executor revalida o input, resolve o acesso ao projeto e usa a mesma captura sem credenciais, com DNS/IP fixado ao socket e bloqueio de redes privadas em cada requisição. IPv4 e IPv6 usam listas separadas: bloquear IPv4 mapeado em uma lista única também bloquearia os IPv4 públicos. Screenshots de URLs diferentes no mesmo run recebem chaves privadas diferentes e chegam ao modelo como imagens. Falha na URL pedida retorna `unavailable`, sem substituir silenciosamente pelo cadastro.

O prompt recebe uma visão reduzida da conversa, dados do projeto, artefatos atuais e evidências. Credenciais, handles do Sandbox e conexões não entram em estado serializado.

Logo, uploads e screenshots são enviados como partes de arquivo/imagem compatíveis com o modelo. URLs externas são consultadas com limites de tamanho, tempo e redirects. Referências de imagem para geração precisam pertencer ao Vercel Blob autorizado.

O `WorkflowAgent` usa `experimental_download` com um downloader `use step` para converter URLs de imagens em bytes, tanto nas mensagens quanto nos resultados das ferramentas. Essa conversão ocorre fora dos steps do modelo no SDK; usar seu downloader padrão ali tenta acessar o `fetch` global proibido no Workflow. O step preserva as validações de URL, redirects e tamanho do downloader do AI SDK.

A leitura oficial e cada screenshot registram identidade e digest do conteúdo capturado. `/dados` e logo preservam sua procedência no projeto. Falha de leitura aparece como lacuna. O site oficial fornece fatos; a referência visual fornece decisões de design.

Os artefatos não aceitam um objeto livre. `context` separa fatos com procedência, inferências com base e lacunas com impacto; `art_direction` descreve referência, logo, layout, tipografia, paleta, imagem, ritmo, motion e mobile; `validation` exige typecheck e build. O servidor compara cada check de comando com o evento e o exit code do run antes de persistir o relatório.

`record_artifact` expõe ao modelo um schema com raiz `object` e omite somente `maxItems` das listas: a união na raiz e os limites combinados das listas são recusados pelo Gemini via Gateway com HTTP 400. O formato das mensagens continua `{ kind, payload }`. O contrato canônico em `artifact-contract.ts` preserva os limites e a correspondência entre tipo e payload; o executor o revalida antes da gravação, inclusive depois que o Workflow serializa o schema e substitui seu validador por Ajv.

Os literais do schema enviado ao Gemini usam `enum` de um valor, preservando os discriminadores. Checks de validação usam somente `kind: command` ou `kind: manual`; marca, mobile e conteúdo são nomes de verificações manuais. Uma chamada inválida continua sendo recusada e volta ao modelo pelo mecanismo de correção do SDK, sem aprovar comandos que não foram executados. O chat apresenta uma mensagem legível e distingue contexto, direção de arte e verificações.

## Mensagens e streaming

O navegador usa `useChat<StudioMessage>` com `WorkflowChatTransport`. Envia somente a última mensagem e pode retomar um workflow existente. O servidor limita o stream de entrada sem confiar em `Content-Length` e valida tipos, texto, quantidade de anexos e prefixo Blob do tenant.

`chat_messages.parts` conserva as partes tipadas. `convertToModelMessages` ocorre somente na fronteira do agente. O stream do run exige um operador ativo e um Workflow registrado; o admin continua global. O step final recompõe a mensagem do assistente a partir do stream durável, persiste metadata e registra recibos de uso.

Antes da primeira mensagem, o histórico canônico é `[]`: o painel abre normalmente e o primeiro envio acrescenta a mensagem do operador. A leitura só chama `validateUIMessages` quando há registros, pois o AI SDK rejeita uma lista vazia. Mensagens existentes e novas continuam validadas; falhas de leitura não viram histórico vazio.

Escrita e fechamento do stream acontecem somente em steps. O stream do modelo fecha para permitir sua leitura canônica; a resposta HTTP continua aberta até o Workflow persistir mensagem e estado terminal. O mesmo contrato vale para retomada, evitando anunciar conclusão e pedir prévia enquanto o run ainda está ativo. Falha de persistência também chega ao cliente.

O SDK pode retornar uma resposta interrompida (`finishReason: error`, `length`, `other` ou `unknown`) sem lançar exceção. O Studio retoma até duas vezes usando as mensagens e resultados anteriores, sem forçar novamente as pré-condições já concluídas. A orientação de retomada preserva o escopo original e pede reutilização dos efeitos confirmados. O limite de passos vale para o conjunto das tentativas; índices e uso são acumulados sem sobrescrever recibos anteriores. Cancelamento e filtro de conteúdo impedem retomada. Erros lançados ou emitidos explicitamente pelo stream continuam falhando; esgotar a recuperação informa a interrupção do modelo antes de tentar checkpoint.

Se o typecheck ou build final recusar o código, o checkpoint devolve a saída real ao Workflow, sem repetir automaticamente o mesmo comando inválido como retry de infraestrutura. Há uma única rodada adicional de correção com o papel `diagnostic`, limitada aos seus 20 passos e às ferramentas de arquivos, contrato editorial, checks e artefatos. Ela reutiliza as mensagens anteriores e não pode pesquisar fontes nem gerar imagens. O uso mantém índices únicos depois da rodada original. O checkpoint completo roda novamente após a correção; nova falha encerra o turno sem publicar. Cancelamento impede iniciar essa recuperação. Erros de infraestrutura e de isolamento continuam falhando, sem virar instruções de reparo.

Falha ou cancelamento também retira o projeto de `building`: restaura `published` quando há release, `ready` quando há checkpoint, ou `failed` quando a primeira criação ainda não produziu checkpoint. Essa atualização não sobrescreve um projeto arquivado nem outro run ativo.

## Durabilidade e idempotência

- Um projeto aceita um run ativo por vez.
- Tool leases têm operação e TTL, evitando efeitos concorrentes.
- Artefatos alocam versão no servidor e têm unicidade por run/tipo.
- Checkpoints recebem digest do arquivo compactado.
- Imagens usam chave derivada de run, modelo, prompt, proporção e referências, também enviada ao Gateway como idempotency key.
- Conteúdo usa revisão esperada e hash do contrato.
- Releases congelam revisão e têm um único workflow em voo por projeto.
- APIs externas são reconciliadas antes de repetir promoção ou gravação.

Cancelar marca o run, cancela o Workflow quando disponível e impede ferramentas futuras. Efeitos já confirmados não são desfeitos silenciosamente.

## Checkpoint e conclusão

`finishReason: tool-calls` no teto do turno indica uma execução incompleta, não sucesso. O Workflow encerra com erro e não passa ao checkpoint nem publica. Isso evita registrar como concluído um pedido que gastou o orçamento apenas lendo arquivos. A execução só segue para validação final após uma conclusão normal do agente; continuações e retomadas permanecem dentro do orçamento global.

O agente pode terminar texto antes de cumprir um trabalho. O Workflow só cria checkpoint automático quando o run continua válido e os gates do papel permitem. O checkpoint:

- recusa symlinks;
- valida os arquivos protegidos, inclusive o `package.json` fixo;
- impede escrita do lockfile pelo agente, instala o conjunto fixo sem lifecycle scripts e exclui arquivos gerados do digest;
- exige contrato editorial válido;
- exige artefatos obrigatórios no primeiro build;
- executa typecheck e build;
- arquiva a revisão em Blob privado;
- atualiza `draft_code_revision` somente no sucesso.

A resposta deve relatar o que realmente foi concluído. Publicação nunca é uma ferramenta do modelo. No primeiro build, o servidor inicia a release depois do checkpoint por um step durável; nos turnos seguintes, somente uma ação explícita do operador inicia publicação.

## Anti-slop no harness

O prompt carrega [SOUL.md](../SOUL.md) e a [Taste Skill v1](https://github.com/Leonxlnx/taste-skill/blob/main/skills/taste-skill-v1/SKILL.md) em forma operacional: conteúdo específico, hierarquia real, uso intencional de imagem, mobile deliberado e motion com função. Proíbe métricas e depoimentos inventados e defaults visuais recorrentes sem vínculo com a marca.

Geração e edição visual usam `openai/gpt-image-2.5-sunburst` por padrão. A ferramenta aceita referências visuais autorizadas, registra modelo, prompt e recibo e guarda o resultado no acervo do tenant. Trocar `EIXU_IMAGE_MODEL` exige repetir os testes reais de geração, edição, proporção, custo e idempotência.

Prompt não basta. O fluxo exige leitura de fontes, artefatos, contrato editável, build e preview. A crítica visual só vale para screenshots da revisão atual e não substitui o julgamento do operador.

## Evolução

Antes de alterar SDK, modelos ou efforts:

1. fixe a nova versão;
2. confira tipos e documentação da versão instalada;
3. rode os testes de contrato e o build;
4. valide stream, retomada e cancelamento em ambiente Vercel isolado;
5. compare qualidade e custo em casos congelados;
6. mude a versão da política e preserve os recibos antigos.

Não reintroduza um catálogo de blocos para facilitar avaliação. Avalie resultado observável, contrato de conteúdo e gates externos.
