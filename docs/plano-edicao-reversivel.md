# Plano: remoção com escopo e reversão no editor de sites

Análise feita em 14/09/2026 sobre `origin/main` no SHA `ad182ff`, que é o SHA
registrado em `generation_events.payload.deployment` nas execuções de 04:25 a
04:29 UTC do mesmo dia, ou seja, o código que atendeu o incidente. O checkout
local está em `8ab02d1` (31 commits atrás) e tem alterações de outro agente
ainda sem commit; todos os caminhos e linhas citados abaixo são de
`origin/main`. Implemente a partir dele, em worktree próprio.

Leitura do Neon somente para diagnóstico. Nenhum rascunho, snapshot publicado,
imagem ou configuração do cliente `skinaosupermercado` foi alterado por esta
análise. O cliente é apenas o caso que tornou o defeito visível; toda a
correção proposta fica no editor.

**Estado:** implementado em 14/09/2026 na branch `feat/edicao-reversivel`, a
partir de `ad182ff`. O cliente `skinaosupermercado` foi somente o caso que
tornou o defeito visível; toda a mudança ficou no editor. O rascunho e o
publicado do cliente não foram alterados, a migração do Neon não foi executada
e não houve deploy. A tabela `page_revisions` é aditiva e o histórico é gravado
em melhor esforço: sem a migração, a edição continua funcionando e o desfazer
informa que não há versão anterior.

## 1. O que aconteceu, verificado nos dados

Horários em UTC, de `chat_messages` do tenant `78f9ab16` (canal `site`).

| Turno                                                                                                          | O que o agente fez                                                                                  | O que os dados mostram                                                                                                                                                                                                                                                                              |
| -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 03:38 "no bloco 'Variedade para o seu lar' … remova essa parte … 100% do width … itens em mansory logo abaixo" | Recusou: "formatos estruturados fixos da marca", sem opção de mosaico nem largura total.            | Naquele momento o SHA em produção era anterior a `91da45b` (merge às 04:23 UTC), que introduziu `featured-masonry`. A recusa era verdadeira para o código no ar; deixou de ser 45 minutos depois, sem que o pedido voltasse.                                                                        |
| 04:29 "remove esse bloco em anexo de referencia da pagina inicial"                                             | `edit_page` com `remove` do bloco inteiro. Recibo: "Em 'Variedade para o seu lar': bloco removido." | O SHA no ar já era `ad182ff`, que tem `remove_item`. A seção removida era o único `signature.composition` da home, publicado como `cexc1wuj`, com quatro itens, quatro fotos e mais de vinte campos de texto. Todos os outros IDs originais sobrevivem no rascunho, o que confirma qual bloco saiu. |
| 04:31 "nao era pra remover o bloco inteiro, apenas o card que eu mandei em imagem anexa"                       | `edit_page` com `insert`. Recibo: "Em 'Variedade para o seu lar': bloco inserido."                  | Não houve reversão: o rascunho ficou com `signature.composition#acecf893-3158-4c04-809e-d0e1fcd9c852`, um ID novo gerado por `randomUUID()`, com conteúdo reescrito pelo modelo.                                                                                                                    |

O que a reinserção perdeu, comparando o bloco atual do rascunho com o mesmo
bloco no snapshot publicado (`pages.published_blocks`), que é a única cópia
sobrevivente:

| Campo             | Publicado (`cexc1wuj`)                                      | Rascunho atual (`acecf893…`)                     |
| ----------------- | ----------------------------------------------------------- | ------------------------------------------------ |
| `title`           | "Setores completos para a sua rotina"                       | "Variedade para o seu lar"                       |
| `eyebrow`         | "Variedade para o seu lar"                                  | ausente                                          |
| `items[].label`   | quatro rótulos ("Hortifrúti fresco", "Açougue e carnes", …) | ausentes nos quatro itens                        |
| `items[].cta`     | quatro chamadas para `/setores`                             | duas, e para destinos diferentes                 |
| `items[0].image`  | `…/5b767ccb…/1.webp`                                        | `…/4e24e7b1…/1.webp`, a foto do explorer         |
| `presentation`    | `motion: stagger`, `spacing: airy`, fundo `#fff9e6`         | sem `motion`, `spacing: normal`, fundo `#fef8ee` |
| Posição na página | índice 4, depois de `feature.bento`                         | índice 3, antes de `feature.bento`               |

O rascunho imediatamente anterior à remoção não é recuperável: os turnos de
03:22 e 03:32 já tinham alterado essa seção depois da última publicação, e
`pages.blocks` é sobrescrito sem histórico.

Efeito estrutural: a estrutura do cliente é `comercial-vitrine`
(`brand.design.version: 6`), cujo protagonista é
`signature.composition:service-lens` (`lib/design/structures.ts:154-172`). A
remoção apagou a seção protagonista da home sem nenhum bloqueio.

## 2. Causa raiz, por camada

1. **A autorização para remover é um único bit do turno inteiro.**
   `asksRemoval` (`lib/ai/edit-policy.ts:25-63`) procura um verbo de remoção no
   texto e devolve `removal: true` (`:193`, `:233`, `:235`). "remove esse bloco
   em anexo" liga exatamente o mesmo bit que autorizaria apagar qualquer coisa
   na página. Não há distinção entre item e bloco, nem limite de tamanho.

2. **Com esse bit ligado, a única proteção contra perda desliga.**
   `contentLossError` (`lib/ai/page-edits.ts:376-381`) só compara texto antes e
   depois quando `policy.removal` é falso. O `remove` de bloco inteiro
   (`:685-687`) não tem nenhuma verificação própria; o `remove_item`
   (`:699-711`) verifica o mesmo bit. Apagar um card e apagar uma seção com
   quatro cards passam pelo mesmo gate.

3. **O anexo não ancora nada.** `annotateAttachments`
   (`lib/ai/attachments.ts:10-24`) apenas escreve a URL do arquivo no texto. O
   modelo vê os pixels e adivinha o alvo. A prévia já marca os blocos com
   `data-block-id` e os campos com `data-field`
   (`lib/blocks/inline-editor.tsx:112-118`), mas o chat não recebe essa âncora.
   Quando a identificação é só uma imagem, nada obriga a confirmar o alvo antes
   de uma operação destrutiva.

4. **A escrita é irreversível por construção.** `savePageEdit`
   (`lib/sites/edits.ts:50-64`) faz um `update pages set blocks = …` comparando
   o JSONB anterior. Não existe tabela de versões em `db/schema.sql`: o único
   estado anterior guardado é `published_blocks`, e só para quem já publicou.
   Sem histórico, "reverter" só pode virar um `insert` de bloco novo, com ID
   novo e conteúdo inventado, que foi o que aconteceu.

5. **O recibo não mede o dano nem o caráter da operação.**
   `OPERATION_SUMMARIES` (`lib/ai/page-edits.ts:511-516`) produz "bloco
   removido" e "bloco inserido". O fechamento determinístico
   (`lib/ai/edit-receipt.ts:153`, `:260`, `:299`) acrescenta que as
   recomendações não impedem a publicação. O operador não recebe quantos itens
   e textos saíram, não é avisado de que não há desfazer, e no turno seguinte
   lê "bloco inserido" como se a remoção tivesse sido desfeita.

6. **O piso de composição não vale na edição.** `lintPage`
   (`lib/taste/lint.ts:77`) não importa `lib/taste/metrics.ts`; as regras
   `home-protagonista` e `protagonista-fora-da-vibe` (`metrics.ts:654`, `:774`)
   só aparecem nos caminhos de geração e de publicação, e lá já estão
   classificadas como recomendação editorial
   (`lib/sites/publication-policy.ts`). Remover o protagonista da home passou
   como "recomendação no painel".

7. **O pedido original continua sem caminho.** `featured-masonry` existe apenas
   em `feature.bento` (`lib/blocks/registry.ts:601-604`, `:1039`), e a home do
   cliente tem os dois blocos: o `feature.bento` e o `signature.composition` que
   o operador nomeou. A instrução acrescentada em `lib/taste/prompt.ts:154`
   manda usar `feature.bento` e proíbe "substituir o bloco por
   signature.composition", sem tratar o caso em que o bloco já é
   `signature.composition`. Além disso, `signature.composition` exige três a
   seis itens, exatamente um `focus` e ao menos um `support`
   (`lib/blocks/registry.ts:716-760`): remover o card de `support` de uma lista
   de quatro é recusado pelo schema. O modelo não tem instrução para explicar
   esse limite, e a saída que ele encontrou foi apagar a seção.

## 3. Decisões

- **D1. Histórico curto do rascunho e desfazer de verdade.** Guardar a versão
  anterior a cada escrita de página e expor uma reversão determinística, no
  chat e no painel. Não é versionamento geral nem histórico de publicados.
- **D2. Remoção com escopo declarado e proporcionalidade medida.** Substituir o
  bit `removal` por um escopo (`item` ou `block`) e recusar a operação cujo
  tamanho exceda o que o pedido autoriza, com uma pergunta curta em vez de
  gravar.
- **D3. Âncora explícita quando a identificação é uma imagem.** Permitir apontar
  o elemento na prévia e enviar `blockId` e índice do item com a mensagem.
  Enquanto não houver âncora, um pedido com anexo não autoriza remover bloco.
- **D4. Recibo que declara a perda e a reversibilidade.** Dizer o que saiu, em
  itens e textos, e que existe desfazer. Nunca chamar de "bloco inserido" a
  tentativa de reverter uma remoção.
- **D5. Piso de composição visível na edição.** Antes de remover uma seção,
  avaliar protagonista e fotos da página e exigir confirmação quando a remoção
  derruba o piso.
- **D6. Atender o pedido de largura total e mosaico onde o operador pediu.** Um
  arranjo `focus` em largura total com os demais em colunas abaixo dentro de
  `signature.composition`, preservando tipo e layout, e corrigir a instrução do
  prompt.

Fora de escopo: interpretar linguagem natural em geral por regex; versionar
snapshots publicados; afrouxar schema, papéis semânticos ou pre-flight para
aceitar uma edição.

## 4. Implementação

### Etapa 1 — Histórico do rascunho e reversão

Contrato de dados, em `db/schema.sql` (idempotente, como o resto do arquivo):

```sql
create table if not exists page_revisions (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete cascade,
  page_id    uuid not null references pages(id) on delete cascade,
  blocks     jsonb not null,
  revision   text not null,
  origin     text not null default 'chat',
  summary    text,
  created_at timestamptz not null default now()
);
create index if not exists page_revisions_page_time_idx
  on page_revisions (page_id, created_at desc);
```

- `lib/sites/edits.ts`: dentro da mesma transação do `update`, inserir a versão
  **anterior** com `revision` igual a `pageRevision(page)` e o `summary` do
  lote. Manter as vinte últimas por página, apagando as mais antigas na mesma
  escrita. O caminho da prévia (`inline-editor`) usa o mesmo `savePageEdit` e
  ganha o histórico junto; `origin` distingue `chat`, `previa` e `geracao`.
- `lib/ai/tools.ts`: nova ferramenta `undo_page_edit({ page })`, que restaura a
  versão anterior mais recente, grava a versão atual antes de restaurar (para
  que o desfazer seja também refazer) e devolve o mesmo recibo de `edit_page`,
  com `changed` e pre-flight. Incluir em `VISUAL_EDIT_TOOLS` e na lista de
  `NAVIGATION_TOOLS` não; é uma ferramenta de edição geral.
- `app/api/chat/route.ts`: um pedido curto e direto de reversão ("desfaz",
  "desfazer", "reverte", "volta como estava", "não era pra …") resolve pelo
  servidor, no mesmo padrão de `isResumeRequest`, sem chamar o modelo. Se não
  houver versão anterior, responder isso, sem inventar conteúdo.
- `app/(admin)/admin/[tenant]/workspace.tsx`: botão **Desfazer** ao lado dos
  controles da prévia, habilitado quando a página em foco tem versão anterior,
  com o texto do que será desfeito. Usa a mesma rota da ferramenta.
- Retenção e custo: vinte versões por página, apenas rascunho. Nenhum snapshot
  publicado é tocado.

### Etapa 2 — Escopo da remoção

- `lib/ai/edit-policy.ts`: trocar `removal?: boolean` por
  `removal?: { scope: 'item' | 'block'; targets?: string[] }`. `asksRemoval`
  passa a classificar: "card", "item", "foto", "botão", "link", "esse aqui" com
  anexo, e o nome citado de um item existente indicam `item`; "seção", "bloco
  inteiro", "essa faixa", "a parte de cima da página" e o título citado de um
  bloco indicam `block`. Sem evidência para `block`, o escopo é `item`.
- `lib/ai/page-edits.ts`: nova verificação `removalScaleError(policy, before,
after)`, aplicada depois de `contentLossError`. Recusa quando a operação
  apaga um bloco inteiro sob escopo `item`, quando apaga mais de um bloco no
  mesmo lote, ou quando o texto perdido excede o do alvo declarado. A mensagem
  nomeia a seção, a quantidade de itens e textos e pede confirmação explícita.
  O `remove` de bloco passa a exigir `scope: 'block'`, como o `remove_item` já
  exige autorização.
- Confirmação entre turnos: a recusa é persistida como pergunta pendente do
  turno anterior (última mensagem do assistente em `chat_messages`); uma
  resposta afirmativa curta no turno seguinte eleva o escopo para `block`
  apenas para o alvo nomeado naquela pergunta. Sem pergunta pendente, uma
  afirmação isolada não autoriza nada.
- `lib/taste/prompt.ts`: na seção `EDIT`, instruir que um pedido de remover um
  card usa `remove_item`; que remover a seção inteira exige o operador ter dito
  seção, faixa ou bloco inteiro; e que, quando o schema impedir a remoção do
  item (papéis de `signature.composition`, mínimo de itens), a resposta correta
  é explicar o limite e propor a alternativa, nunca apagar o bloco.

### Etapa 3 — Âncora vinda da prévia

- `lib/blocks/render.tsx` e os componentes de lista: emitir `data-item-index`
  nos itens renderizados, ao lado do `data-block-id` que já existe.
- `lib/blocks/edit-protocol.ts`: nova ação `anchor` no protocolo
  `eixu-edit/1`, com `page`, `revision`, `blockId`, `itemIndex` opcional e um
  rótulo legível (título do item).
- `app/(admin)/admin/[tenant]/preview-frame.tsx` e `workspace.tsx`: modo
  "apontar" que destaca o elemento sob o cursor e anexa a âncora escolhida à
  próxima mensagem, exibida como uma etiqueta removível no compositor.
- `app/api/chat/route.ts` e `lib/ai/context.ts`: transportar a âncora até o
  contexto do turno e até `EditPolicy.removal.targets`. Com âncora, o alvo é
  determinístico; sem âncora e com anexo, vale a regra da Etapa 2, que recusa
  remover bloco.

### Etapa 4 — Recibo honesto

- `lib/ai/page-edits.ts`: o resumo de `remove` passa a informar seção, itens e
  textos removidos; o de `remove_item` informa o título do item; o de `insert`
  distingue bloco novo de restauração.
- `lib/ai/edit-receipt.ts`: acrescentar, em todo lote que removeu conteúdo, uma
  linha dizendo que é possível desfazer, e qual alteração o desfazer alcança.
- `lib/ai/tools.ts`: a descrição de `edit_page` declara que `remove` exige
  escopo de bloco confirmado.

### Etapa 5 — Piso de composição na remoção

- `lib/taste/lint.ts` ou um módulo próprio consumido por `savePageEdit`:
  calcular, apenas para lotes que removem blocos, as regras
  `home-protagonista`, `protagonista-fora-da-vibe` e `pagina-sem-foto` de
  `lib/taste/metrics.ts`. Se a remoção derruba o piso, recusar com a mesma
  pergunta de confirmação da Etapa 2, citando a estrutura e o que a página
  perde. Confirmado, grava e registra a pendência no recibo.
- Não alterar a classificação dessas regras na publicação; elas continuam
  recomendações em `lib/sites/publication-policy.ts`.

### Etapa 6 — Largura total e mosaico onde o operador pediu

- `lib/blocks/registry.ts`: em `signature.composition`, um campo opcional de
  arranjo (por exemplo `arrangement: 'focus-full'`) que não troca `layout` nem
  `type`, preservando a assinatura `signature.composition:service-lens` que a
  gramática exige.
- `app/(sites)/creative.css`: o arranjo coloca o item `focus` em
  `grid-column: 1 / -1` e distribui os demais em colunas abaixo, no mesmo
  padrão já usado por `visual-selector` (`creative.css:448-455`), com
  verificação em telas estreitas.
- `lib/ai/page-edits.ts`: entrada em `VISUAL_SUMMARIES` para o novo arranjo.
- `lib/taste/prompt.ts:154`: reescrever a instrução para cobrir os dois blocos,
  dizendo qual controle usar em cada um e removendo a proibição que não se
  aplica quando o bloco já é `signature.composition`.

## 5. Verificação executada

Resultado em 14/09/2026, no worktree desta branch:

- `npx next typegen && npx tsc --noEmit` e `npm run lint` sem erros.
- `npm run test:admin`: 250 testes, nenhuma falha, incluindo
  `tests/admin-remocao-escopo.test.mjs` e `tests/admin-desfazer.test.mjs`.
- `npm run test:sites`: 303 testes, nenhuma falha, incluindo
  `tests/site-signature-arranjo.test.mjs`.
- `EIXU_CHROME_PATH=… node --test --test-concurrency=1
tests/browser/admin-desfazer-apontar.test.mjs`: o botão Desfazer restaura o
  rascunho pela versão guardada e o modo apontar leva bloco e item até o corpo
  do pedido. `tests/browser/admin-chat-edits.test.mjs` continua passando.
- `npm run build:vercel` concluído, com os quatro testes de artefato.
- Medição do arranjo `focus-full` no Chrome, com o CSS de produção: em 1440 px
  o item `focus` passa de 952 px para a largura inteira do container e os
  demais descem em colunas; em 390 px tudo empilha. Nenhum overflow horizontal
  nos dois casos.

- SQL do histórico exercitado em Postgres real fora do repositório, com PGlite
  e o mesmo contrato de template do driver Neon: `db/schema.sql` aplicado, vinte
  e cinco escritas seguidas, retenção parando em vinte versões, desfazer e
  refazer alternando os dois estados, e a escrita concorrente recusando o
  desfazer sem perder a alteração da outra aba. `tests/admin-desfazer-db.test.mjs`
  repete essas checagens com o driver Neon e um PostgreSQL local descartável;
  ele fica pulado onde não houver `EIXU_TEST_POSTGRES_URL`, como nesta máquina.

Não executado: a migração no Neon, o ensaio pago `npm run eval:edits --live` e
qualquer publicação.

### Verificação prevista no plano

- `npx next typegen && npx tsc --noEmit` e `npm run lint`.
- `node --test tests/admin-page-edits.test.mjs tests/admin-edit-guard.test.mjs
tests/admin-edit-scope.test.mjs`, com casos novos: remoção de card sob escopo
  `item`; recusa de `remove` de bloco sob escopo `item`; confirmação entre
  turnos; recusa quando o schema impede tirar o item; desfazer restaurando IDs,
  props e posição idênticos.
- `EIXU_TEST_POSTGRES_URL=… node --test tests/admin-page-edits-db.test.mjs`
  ampliado: a versão anterior é gravada na mesma transação, a retenção corta a
  vigésima primeira e o desfazer respeita a comparação de concorrência.
- `EIXU_CHROME_PATH=… node --test tests/browser/admin-chat-edits.test.mjs` e
  `tests/browser/admin-inline-edit.test.mjs`: botão Desfazer, âncora escolhida
  na prévia e recibo exibido.
- `npm run test:sites` e `npm run test:admin`; `npm run build:vercel`.
- `npm run eval:edits -- --case=remove` sobre páginas sintéticas, comparando o
  comportamento antes e depois em pedidos ambíguos de remoção.
- Responsividade do arranjo novo em 1440 e 390 px com o CSS de produção, pelo
  caminho de captura já usado em `tests/browser/site-visual-system.test.mjs`.

## 6. Riscos e limites

- A classificação de escopo é textual e vai errar em formulações que ninguém
  previu. O desenho aceita isso: errar para `item` só custa uma pergunta, e o
  desfazer cobre o resto. Nenhum teste determinístico prova cobertura de
  linguagem natural.
- O histórico aumenta a escrita por edição e o tamanho da tabela; vinte versões
  de páginas de até vinte blocos é o teto proposto e deve ser medido depois de
  uma semana de uso.
- Desfazer não alcança snapshot publicado, imagens geradas nem alterações de
  marca; é reversão do rascunho da página.
- A confirmação entre turnos depende do histórico do chat do tenant. Se o
  operador abrir outra aba e escrever em paralelo, a pergunta pendente pode não
  ser a última mensagem; nesse caso o escopo permanece `item`.

## 7. Estado do cliente afetado

O rascunho de `/` de `skinaosupermercado` está hoje com a seção recriada
(`acecf893…`), fora da posição original e sem os rótulos e chamadas do
original. A versão anterior à remoção não existe em lugar nenhum. O snapshot
publicado ainda tem o bloco `cexc1wuj` completo, e o site no ar não foi
afetado.

Três saídas, todas dependentes de decisão do operador e nenhuma executada por
esta análise:

1. Manter o rascunho como está e ajustar a seção pelo chat.
2. Restaurar no rascunho o bloco do snapshot publicado, recuperando rótulos,
   chamadas, fotos e posição, e reaplicar por cima as alterações desejadas.
3. Refazer a seção com o arranjo da Etapa 6, já com o card indesejado fora.

A opção 2 é a única que recupera conteúdo perdido e depende apenas de uma
escrita no rascunho da home.

## 8. Perguntas em aberto

- Quantas versões por página guardar, e por quanto tempo.
- O desfazer deve alcançar também as edições feitas direto na prévia e o lote
  da geração, ou apenas as edições do chat.
- Remover uma seção deve exigir confirmação sempre, ou apenas quando derruba o
  piso de composição ou passa de um limite de conteúdo.
