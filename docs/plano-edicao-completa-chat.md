# Plano de implementação: edição completa e precisa pelo chat

**Data:** 14/09/2026. **Base reconciliada:** `origin/main` em `80aea87`.
**Branch de execução:** `codex/chat-complete`.

## Objetivo

Um pedido simples deve gerar uma mutação simples, fiel e verificável. O chat
precisa alterar texto, apresentação, mídia, ordem e estrutura de um site
existente sem regenerar a página, inventar conteúdo ou propor uma alternativa
diferente quando a intenção já está clara.

“Qualquer coisa no site” significa toda superfície editorial e funcional que o
renderer versionado consegue publicar com segurança. Isso não autoriza CSS,
JavaScript, React ou SQL arbitrário produzido pelo modelo dentro do ambiente
multi-tenant. Capacidade realmente nova continua sendo trabalho de engenharia
com schema, renderer, teste e release; o chat deve identificar essa dependência
com precisão e nunca fingir que a executou.

## Incidente reproduzido

O caso do Supermercado Ravagio expôs dois defeitos independentes:

1. o catálogo oferecia `presentation.align` apenas como escolha de silhueta
   (`left`, `center`, `offset`), sem `text-align: right` e sem um controle próprio
   para alinhar o grupo, as ações e os selos;
2. o atalho de “desfaz” usava a página em foco. Depois de editar `/` e abrir
   `/nossa-historia`, ele tentava restaurar a página errada.

A URL administrativa fornecida não foi usada para escrita. A reprodução usa
dados sintéticos equivalentes e os mesmos schemas, executores, rota e CSS de
produção.

## Contrato implementado

### Alinhamento

| Intenção                      | Caminho                                                | Efeito                                                             |
| ----------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------ |
| Só um título ou parágrafo     | `textStyles[].align`                                   | Alinha somente o campo identificado.                               |
| Todo o texto da seção         | `presentation.textAlign`                               | Alinha títulos, parágrafos, listas e legendas, sem mover mídia.    |
| Texto e todo o conteúdo/grupo | `presentation.textAlign` + `presentation.contentAlign` | Também alinha grupo, ações e listas em `start`, `center` ou `end`. |

Os controles são opcionais e aceitam `unset`; sites existentes mantêm o visual
anterior. A camada `operator.css`, importada por último, faz a escolha explícita
vencer a vibe. Um campo com alinhamento próprio vence a escolha da seção.

O renderer expõe os valores como atributos validados. A captura determinística
mede o `text-align`, `align-items` e `justify-content` computados em 1440 e 390
px. Uma divergência vira problema no recibo; contraste continua sendo medido
separadamente.

### Resolução do alvo

- página explicitamente nomeada vence a página aberta;
- “Início”, “página inicial” e “home” resolvem para `/`;
- Hero/banner/abertura restringe o escopo à família `hero`;
- texto entre aspas pode identificar o bloco por qualquer campo textual, não
  apenas `title` ou `eyebrow`;
- o snapshot e a revisão já carregados entram no contexto, inclusive os alvos
  compactos de outra página, sem uma leitura redundante;
- a política visual permite somente caminhos de apresentação do alvo encontrado.

### Desfazer

O chat consulta a revisão reversível mais recente do tenant e restaura sua
página, independentemente do foco atual. A restauração continua transacional e
otimista: trava a página, compara o rascunho, restaura os mesmos blocos, IDs,
textos e posições e preserva o snapshot publicado. Um segundo “desfaz” retorna
ao estado que saiu.

O botão acima da prévia permanece deliberadamente local à página aberta. O chat
e o botão têm descrições diferentes na interface e na documentação.

## Cobertura do gerador atual

O executor `edit_page` continua sendo o caminho comum para sites existentes. Em
uma única gravação por página ele oferece:

- substituição literal e `set`/`unset` de qualquer prop aceita pelo schema;
- inserção, troca, remoção e movimentação de blocos por ID;
- remoção e edição de itens por caminho;
- layouts, mídia, carrossel, fit, foco, apresentação local e SEO já registrados;
- edição por campo na prévia com texto, tamanho, cor e alinhamento;
- comparação de revisão, pre-flight, histórico e atualização imediata da prévia.

O catálogo usado pelo modelo é derivado de `blockSchemas`. Assim uma prop nova
só é anunciada depois de existir no schema; `validateEditedBlock` impede gravar
um valor que o renderer não conhece. Contatos, localização, marca e SEO seguem
suas ferramentas próprias porque não pertencem a `pages.blocks`.

## Sequência executada

1. **Reconciliação:** worktree limpo criado a partir de `origin/main`; as
   implementações atuais de edição, carrossel, composição de assinatura,
   histórico e medição foram reaproveitadas.
2. **Reprodução:** fixtures cobrem os dois pedidos de alinhamento e “desfaz” com
   outra página em foco.
3. **Contrato:** schema, catálogo, prompt, executor, renderer, CSS, editor direto
   e recibos receberam os três alcances de alinhamento.
4. **Alvo:** política reconhece alinhamento, página Início e texto citado.
5. **Reversão:** a rota direta resolve a última página realmente editada antes
   de restaurar.
6. **Verificação:** tipos, lint, suites de contrato, build Vercel e navegador com
   CSS de produção são os gates obrigatórios desta entrega.
7. **Documentação:** arquitetura, design, harness, admin, manual, edição e
   verificação descrevem o comportamento realmente disponível.

## Matriz de aceite

| Cenário                                                          | Resultado obrigatório                                                                     |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| “Na página Início, text-align à direita” com outra página aberta | Só os textos do Hero de `/` ficam à direita; mídia, conteúdo e demais páginas permanecem. |
| “Todo o bloco à direita, texto e layout, todo conteúdo”          | Texto, grupo, botões e lista ficam no fim da região sem trocar a ordem de leitura.        |
| “Só esse parágrafo à direita”                                    | Apenas o campo recebe `textStyles.align`; título e controles permanecem.                  |
| Campo à esquerda dentro de seção à direita                       | A escolha do campo prevalece no CSS computado.                                            |
| “Desfaz” depois de abrir outra página                            | A página da última revisão é restaurada; a página em foco não é tocada.                   |
| Estado já satisfaz o pedido                                      | Nenhuma escrita nem histórico fictício.                                                   |
| CSS da vibe vence uma escolha explícita                          | A medição reprova o resultado.                                                            |
| Captura indisponível                                             | O recibo informa somente a gravação, sem alegar efeito medido.                            |
| Publicado seguido de edição                                      | Apenas o rascunho muda.                                                                   |

## Limites e próximos incrementos

A edição é ampla dentro do catálogo executável, mas não é correto prometer que
um modelo consegue criar qualquer primitiva inédita em produção durante um
turno de cliente. Uma árvore universal ou um serviço de engenharia autônomo
precisaria de isolamento, versionamento, rollout e autorização próprios. Esse
trabalho não deve ser embutido no chat multi-tenant como execução de código
arbitrário.

Pedidos entre várias páginas ainda são atômicos por página. O mesmo turno
preserva resultados individuais e informa falhas; uma transação agrupada exige
um identificador durável da operação e migração anterior ao deploy. Essa
evolução deve ser feita quando houver requisito de reversão conjunta, sem mudar
o comportamento verificado deste incidente.

## Gates

```bash
npx next typegen && npx tsc --noEmit
npm run lint
npm run test:sites
npm run test:admin
npm run build:vercel
EIXU_CHROME_PATH=/usr/bin/google-chrome node --test \
  tests/browser/site-hero-placement.test.mjs \
  tests/browser/site-inline-edit.test.mjs \
  tests/browser/admin-desfazer-apontar.test.mjs
git diff --check
```

Teste PostgreSQL usa `EIXU_TEST_POSTGRES_URL`; sem essa variável ele é pulado e
não deve ser declarado como executado. Nenhuma validação local autoriza migrar
banco, alterar o cliente de referência, publicar páginas ou fazer deploy.
