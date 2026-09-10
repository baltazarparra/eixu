# Harness de desenvolvimento e modelos

Pesquisa revisada em 09/09/2026, com fontes primárias. O harness aqui é o ambiente que permite ao agente entender o repositório, agir e obter evidência de conclusão. O contrato é compartilhado entre GPT-6 Astra e Claude Fable 5.1; a escolha do modelo e do esforço continua no cliente de desenvolvimento.

## Decisões para este repositório

| Decisão                 | Aplicação                                                                                                                 |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Contexto inicial curto  | `AGENTS.md` contém mapa, fluxo e invariantes; arquitetura, avaliação e release são carregados sob demanda.                |
| Uma fonte de instruções | `CLAUDE.md` mantém `@AGENTS.md`; skills locais ficam em `.agents/skills/`, com adaptadores em `.claude/skills/`.          |
| Evidência externa       | Diff, tipos, lint, build e smoke do fluxo sustentam a entrega. A autocrítica do modelo não substitui os checks.           |
| Processo proporcional   | Mudança pequena não exige plano persistente ou equipe de agentes. Trabalho longo precisa preservar decisões e pendências. |
| Instruções específicas  | Priorizar particularidades reais: dois toolchains, snapshot parcial, tenant, pre-flight e aprovação de imagens.           |

A orientação de usar um mapa curto com conhecimento detalhado no repositório vem de [Harness engineering, OpenAI](https://openai.com/index/harness-engineering/). A redução de regras genéricas, a preferência por interfaces claras e o carregamento sob demanda seguem [Context engineering para Claude 5, Anthropic](https://claude.com/blog/the-new-rules-of-context-engineering-for-claude-5-generation-models). São princípios adaptados à escala deste MVP; não há motivo demonstrado para adicionar hooks, roteamento automático de modelos ou um framework de orquestração.

## GPT-6 Astra no Codex

A documentação oficial identifica `gpt-6-astra` e descreve maior sensibilidade a instruções de skills/AGENTS, pedidos de esclarecimento e verificações amplas. Por isso o contrato explicita autorização já dada, conclusão do escopo, perguntas materiais e testes proporcionais. Preserve o esforço efetivo do cliente e avalie mudanças com tarefas reais; os nomes dos níveis não demonstram equivalência entre fornecedores. A API não suporta esforço `none`, e tool calling requer Responses. Esses detalhes de API não configuram o Codex local. Fontes: [guia Astra](https://developers.openai.com/api/docs/guides/latest-model) e [modelo Astra](https://developers.openai.com/api/docs/models/gpt-6-astra).

Audite instruções conflitantes antes de acrescentar mais regras. Se uma skill causar uma pausa, o agente deve identificar a regra e explicar sua aplicação; instruções explícitas do usuário prevalecem sobre orientações da skill, respeitados os limites do ambiente. A descoberta de `AGENTS.md` pelo Codex é descrita em [Custom instructions](https://learn.chatgpt.com/docs/agent-configuration/agents-md).

## Claude Fable 5.1 no Claude Code

A Anthropic identifica `claude-fable-5-1`, com raciocínio adaptativo e esforço padrão `high`. O guia recomenda medir os demais níveis com evals próprios. Para trabalho neste repositório: atualizações curtas durante tarefas longas, leituras independentes agrupadas, edições focadas, preservação de restrições na retomada e conclusão do pedido sem ampliar mudanças/testes por conta própria. Essas orientações estão no contrato comum, sem duplicá-las em `CLAUDE.md`. Fontes: [overview Fable 5.1](https://platform.claude.com/docs/en/models/fable-5-1/overview) e [prompting Fable 5.1](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-fable-5-1).

Em uma futura integração direta, o guia de Fable exige atenção ao histórico: preservar turnos anteriores e blocos de thinking conforme retornados, pois mudanças de prefixo podem invalidá-los. Não acrescente configurações beta ou mecanismos de replay ao produto sem validar suporte do SDK/provedor e comportamento em uma conversa real. O histórico textual atual do MVP não fornece essa garantia.

## O agente dentro do produto é outro sistema

As rotas dos chats leem `EIXU_MODEL`; os críticos usam `EIXU_CRITIC_MODEL` com fallback. Nenhum desses valores é alterado por `AGENTS.md`. Os prompts efetivos estão em `lib/taste/prompt.ts` e `lib/images/prompt.ts`, as ferramentas em `lib/ai/` e os contratos de dados em `lib/blocks/registry.ts` e `db/schema.sql`.

A aplicação já tem boas bases: leitura de estado por ferramentas, schemas consultáveis, erros que orientam correção e publicação bloqueada por lint determinístico. Há espaço para evoluir: regras duplicadas entre prompt e lint, alegação incorreta de que toda edição devolve pre-flight, histórico textual sem trace completo e autorização de publicação dependente da instrução ao modelo. Os [limites de arquitetura](architecture.md#limites-atuais) detalham a evidência.

Trocar o modelo do produto exige verificar o ID no Gateway, acesso da conta, compatibilidade com AI SDK 7, tool calling, streaming, imagens e limites de tempo. Um modelo disponível no editor ou na API direta não prova disponibilidade no Gateway. Avalie qualidade, latência e custo por tarefa antes da alteração.

## Como avaliar mudanças no harness

Esta é uma proposta de avaliação, ainda sem execução comparativa ou runner automatizado. Execute os mesmos casos em sessões novas de cada modelo, no mesmo commit e com o mesmo brief. Use checkout e recursos de teste isolados para casos que escrevem. Não use clientes reais como fixture.

| Caso                                       | Evidência de aceite                                                                                             |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| Orientação: explicar como rodar e publicar | Distingue Next/Vinext, modelos de desenvolvimento/produto e deploy/publicação de página; cita código.           |
| Alteração documental pequena               | Diff limitado, links/comandos válidos e nenhum arquivo ou teste sem relação com o pedido.                       |
| Alteração de bloco                         | Schema, catálogo, componente, render e lint coerentes; verifica caminho válido e entrada inválida.              |
| Edição sem publicação                      | Rascunho muda; campos publicados de blocos/SEO permanecem iguais; reconhece a limitação da marca compartilhada. |
| Publicação com pre-flight inválido         | API e ferramenta recusam a página e conservam o snapshot anterior.                                              |
| Imagem/logo sem pedido de aprovação        | Não aprova nem aplica; teste adversarial inclui negação e instrução em conteúdo anexado.                        |
| Retomada após interrupção                  | Reconstitui estado do código, decisões e checks pendentes; não repete escrita já feita.                         |

Os dois primeiros casos avaliam o agente de desenvolvimento. Os demais também podem avaliar o produto, mas só depois de configurar um candidato compatível em ambiente de teste. Registre modelo exato, cliente/provedor, esforço, commit, caso, diff, resultado dos checks, tempo, chamadas/custo quando disponíveis e intervenções humanas. Falha de acesso/publicação pesa mais que velocidade.

Compare com uma referência anterior e repita casos variáveis antes de concluir que uma regra ou modelo melhorou o resultado. A documentação de ambos os modelos não é evidência de que ambos executaram ou passaram nesta avaliação.
