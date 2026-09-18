# Harness e modelos do EIXU Studio

## Decisão

O Studio usa AI SDK 7 como protocolo de modelo, ferramentas, mensagens e streaming. `WorkflowAgent` executa o loop em Vercel Workflow; Vercel Sandbox executa o projeto; AI Gateway entrega os modelos. A EIXU mantém os contratos de produto, autorização, arquivos, conteúdo, checkpoint e release.

As dependências estão fixadas no lockfile: `ai 7.0.105`, `@ai-sdk/react 4.0.108`, `@ai-sdk/gateway 4.0.85`, `@ai-sdk/workflow 2.0.36`, `workflow 5.0.0-beta.53` e `@vercel/sandbox 3.3.0`. Workflow 5 permanece beta; upgrade exige repetir build, retomada e cancelamento.

Documentação oficial relevante: [WorkflowAgent](https://ai-sdk.dev/docs/agents/workflow-agent), [loop control](https://ai-sdk.dev/docs/agents/loop-control), [persistência de chat](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-message-persistence) e [tools](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling).

## Política de modelos

`lib/studio/models.ts` é a fonte única da política `studio-gemini-3.8-flash-v1`.

| Papel           | Modelo                  | Reasoning | Passos máx. | Uso                                    |
| --------------- | ----------------------- | --------- | ----------- | -------------------------------------- |
| `assistant`     | google/gemini-3.8-flash | high      | 12          | Conversa e pedido geral.               |
| `batch`         | google/gemini-3.8-flash | high      | 4           | Extração/classificação curta.          |
| `context`       | google/gemini-3.8-flash | high      | 12          | Fontes, fatos, tom e lacunas.          |
| `art_direction` | google/gemini-3.8-flash | high      | 16          | Leitura visual e direção de arte.      |
| `build`         | google/gemini-3.8-flash | high      | 32          | Primeiro projeto e recomposição ampla. |
| `edit`          | google/gemini-3.8-flash | high      | 20          | Alteração localizada.                  |
| `refine`        | google/gemini-3.8-flash | high      | 24          | Responsividade, motion e acabamento.   |
| `critic`        | google/gemini-3.8-flash | high      | 12          | Crítica vinculada a evidência atual.   |
| `diagnostic`    | google/gemini-3.8-flash | high      | 20          | Falhas complexas de código/build.      |

CMS e publicação são determinísticos e não consomem inferência. O role nasce do classificador de intenção do servidor e fica registrado no run. O modelo efetivamente servido, reasoning, tokens, cache, custo e `generationId` são armazenados por passo.

## Ordem do primeiro build

`prepareStep` impõe pré-condições em vez de depender apenas do prompt:

1. força `read_project_context` com Gemini/high;
2. força `read_official_site` com Gemini/high;
3. força `record_artifact(kind=context)`;
4. força `inspect_visual_reference` com Gemini/high;
5. força `record_artifact(kind=art_direction)`;
6. libera as ferramentas de projeto.

O checkpoint de um `build` recusa ausência dos dois artefatos. Assim, o agente não pode pular diretamente para código. Edições posteriores recebem os artefatos mais recentes e a evidência acumulada no contexto.

## Ferramentas

| Ferramenta                                 | Responsabilidade                                               |
| ------------------------------------------ | -------------------------------------------------------------- |
| `read_project_context`                     | Dados, contatos, marca, logo e evidências existentes.          |
| `read_official_site`                       | Crawl limitado da fonte factual cadastrada.                    |
| `inspect_visual_reference`                 | Screenshots desktop/mobile e leitura multimodal da referência. |
| `list_project_files` / `read_project_file` | Inspeção dentro da raiz autorizada.                            |
| `write_project_file`                       | Escrita de arquivo completo após política de path e tamanho.   |
| `write_content_contract`                   | Validação e gravação atômica de schema/valores.                |
| `generate_project_image`                   | Geração com referências autorizadas, recibo e acervo numerado. |
| `run_project_check`                        | Comando permitido, como typecheck ou build.                    |
| `record_artifact`                          | Contexto, direção de arte e validação tipados e versionados.   |

As ferramentas revalidam o run e o vínculo projeto/tenant antes do efeito. `activeTools` e `toolChoice` reduzem o catálogo do passo; autorização continua no executor.

## Contexto e fontes

O prompt recebe uma visão reduzida da conversa, dados do projeto, artefatos atuais e evidências. Credenciais, handles do Sandbox e conexões não entram em estado serializado.

Logo, uploads e screenshots são enviados como partes de arquivo/imagem compatíveis com o modelo. URLs externas são consultadas com limites de tamanho, tempo e redirects. Referências de imagem para geração precisam pertencer ao Vercel Blob autorizado.

O `WorkflowAgent` usa `experimental_download` com um downloader `use step` para converter URLs de imagens em bytes, tanto nas mensagens quanto nos resultados das ferramentas. Essa conversão ocorre fora dos steps do modelo no SDK; usar seu downloader padrão ali tenta acessar o `fetch` global proibido no Workflow. O step preserva as validações de URL, redirects e tamanho do downloader do AI SDK.

A leitura oficial e cada screenshot registram identidade e digest do conteúdo capturado. `/dados` e logo preservam sua procedência no projeto. Falha de leitura aparece como lacuna. O site oficial fornece fatos; a referência visual fornece decisões de design.

Os artefatos não aceitam um objeto livre. `context` separa fatos com procedência, inferências com base e lacunas com impacto; `art_direction` descreve referência, logo, layout, tipografia, paleta, imagem, ritmo, motion e mobile; `validation` exige typecheck e build. O servidor compara cada check de comando com o evento e o exit code do run antes de persistir o relatório.

## Mensagens e streaming

O navegador usa `useChat<StudioMessage>` com `WorkflowChatTransport`. Envia somente a última mensagem e pode retomar um workflow existente. O servidor limita o stream de entrada sem confiar em `Content-Length` e valida tipos, texto, quantidade de anexos e prefixo Blob do tenant.

`chat_messages.parts` conserva as partes tipadas. `convertToModelMessages` ocorre somente na fronteira do agente. O stream do run exige um operador ativo e um Workflow registrado; o admin continua global. O step final recompõe a mensagem do assistente a partir do stream durável, persiste metadata e registra recibos de uso.

Antes da primeira mensagem, o histórico canônico é `[]`: o painel abre normalmente e o primeiro envio acrescenta a mensagem do operador. A leitura só chama `validateUIMessages` quando há registros, pois o AI SDK rejeita uma lista vazia. Mensagens existentes e novas continuam validadas; falhas de leitura não viram histórico vazio.

Escrita e fechamento do stream acontecem somente em steps. O stream do modelo fecha para permitir sua leitura canônica; a resposta HTTP continua aberta até o Workflow persistir mensagem e estado terminal. O mesmo contrato vale para retomada, evitando anunciar conclusão e pedir prévia enquanto o run ainda está ativo. Falha de persistência também chega ao cliente.

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
