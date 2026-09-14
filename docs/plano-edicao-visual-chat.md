# Plano: edições visuais fiéis pelo chat

Análise feita em 13/09/2026 sobre `origin/main` no SHA `f9d5918` (merge do
PR #60, 17:34). A geração do cliente, às 19:18, registrou `143d313` nos
eventos; os turnos de edição das 21:19 e 21:22 não registram SHA, mas o
degradê visto na captura só existe a partir de `f9d5918`. O checkout local
estava 47 commits atrás desse SHA e com alterações de outro agente ainda sem
commit; caminhos e linhas abaixo são de `origin/main`. Implemente a partir
dele, em worktree próprio.

**Estado:** implementado localmente em 14/09/2026, na branch
`codex/edicao-visual-chat`, a partir do SHA `f9d5918`. O cliente
`uptaxconsultoriatributaria` foi somente o caso que tornou o defeito visível;
toda mudança ficou no gerador. O rascunho e o publicado do cliente não foram
alterados, o ensaio pago não foi executado e não houve deploy nem troca de
modelo em produção.

## 1. O que aconteceu, verificado nos dados

Estado lido no Neon (somente leitura) e reproduzido no Chrome com o CSS de
`origin/main`. O cliente é `vibe: moderno`, perfil `design.version: 6`,
`structure: comercial-atendimento`, com `referenceDirection` gravada.

| Turno                                                                                | O que o agente fez                                                                                                                      | O que os dados mostram                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "quero um degradê mais elegante no footer, esta ruim a qualidade do bg atual"        | `set_brand` com `accentAlt: #18181b` e respondeu ter criado "uma transição suave e profunda em direção ao preto no rodapé".             | `brand.accentAlt` mudou para `#18181b`; o rodapé continuou `{ tone: ink }`. O degradê do rodapé usa `--wash` (papel misturado com `accent` em 7%) e `--paper`; `accentAlt` não entra nele. A resposta descreveu um efeito que a ferramenta não produz. Não existe controle para esse degradê em nenhum bloco.                                                                                  |
| "o componente footer anexado em imagem de referencia, deixa ele inteiro na cor gray" | 4 `get_page` e 5 `edit_page`, um por página, gravando `presentation.background: #27272a` no `footer.compact` e preservando `tone: ink`. | As cinco páginas têm `{ tone: ink, background: #27272a }` no rodapé; o publicado segue `{ tone: ink }`. O renderer marca o bloco como `data-tone="custom"` e emite `--paper: #27272a`, `--ink: #ffffff`. O CSS da vibe comercial pinta por cima: `linear-gradient(160deg, #f6f2e9, #27272a 68%)`, com `--muted` trocado para `#5a5751`. Texto branco sobre creme e apoio escuro sobre grafite. |
| Recibo final                                                                         | "Alterações salvas no rascunho de /. Em “seção”: ajuste salvo." repetido cinco vezes.                                                   | O resumo chama o rodapé de "seção" porque ele não tem `title`/`eyebrow` (`lib/ai/page-edits.ts:566-603`) e não diz qual cor foi gravada. O operador não recebe o hex, a cor de texto calculada nem a razão de contraste.                                                                                                                                                                       |

Contrastes medidos na reprodução, nas duas extremidades do degradê que o
operador viu:

| Par                                         | Razão   |
| ------------------------------------------- | ------- |
| "Contato" `#ffffff` sobre o creme `#f6f2e9` | 1,12:1  |
| Apoio `#5a5751` sobre o grafite `#27272a`   | 2,07:1  |
| Par pretendido `#ffffff` sobre `#27272a`    | 14,89:1 |

O servidor considerou o par pretendido; o navegador pintou os dois primeiros.

## 2. Causa raiz, por camada

1. **Cascata do CSS.** A escolha local do operador é aplicada por
   `.site-theme .site-block[data-block][data-tone='custom'] > *`
   (`app/(sites)/site.css:306-314`, especificidade 0,4,0), que zera o fundo do
   filho direto. O PR #60 acrescentou
   `.site-theme:is([data-design-version='3'],[data-design-version='4'])[data-vibe='comercial'] .site-footer`
   (`app/(sites)/vibes.css:296-303`), com a mesma especificidade, num arquivo
   importado depois (`app/(sites)/layout.tsx:18-23`). Empate de especificidade
   é decidido pela ordem, e o degradê vence. A mesma regra ainda impõe
   `--muted: var(--muted-wash)`, calculado contra o papel da marca, não contra
   o papel escolhido. O mesmo padrão existe no hero comercial
   (`vibes.css:288-295`), no painel do explorer (`vibes.css:311-318`) e no
   ledger de fatos (`vibes.css:344-352`). As lavagens artísticas
   (`vibes.css:145`, `186`) têm 0,3,0 e perdem corretamente.
2. **Por que atinge um cliente "moderno".** `renderingVibeOf`
   (`lib/design/vibes.ts:74-86`) devolve a vibe da estrutura quando o perfil é
   v6 com referência, e `comercial-atendimento` é comercial
   (`lib/design/structures.ts:112-114`). A página mapeia v5/v6 para
   `data-design-version="4"` (`app/(sites)/s/[tenant]/[[...slug]]/page.tsx:209-215`).
   Portanto o contrato CSS v3/v4 da comercial vale para todo perfil novo guiado
   por referência com estrutura comercial.
3. **O servidor não conhece a decoração da vibe.** `sectionBackgrounds` e
   `sectionColorVars` (`lib/blocks/section-colors.ts:11-59`) tratam o fundo da
   seção como um hex único; `lib/blocks/text-style-lint.ts:11-28` mede
   contraste contra esse hex. Nenhuma dessas funções sabe que a comercial pinta
   lavagem no hero e no rodapé. O pre-flight aprova o que o CSS não pinta.
4. **Faltava o controle e sobrava o errado.** O catálogo não tem campo para
   degradê ou para desligar a lavagem da vibe. Na edição geral `set_brand`
   continua disponível (`lib/ai/edit-policy.ts:193-205`), então a única alavanca
   que o modelo encontrou para "degradê no footer" foi a marca inteira, contra a
   regra do prompt (`lib/taste/prompt.ts:148`). O prompt orienta explicar limites
   só para reposicionamento dentro do bloco (`prompt.ts:147`), não para
   decoração de fundo.
5. **Nenhuma evidência renderizada depois da edição.** O recibo de `edit_page`
   traz mudanças, revisão e pre-flight (`lib/ai/tools.ts:1790-1834`); a
   captura em Chromium só existe em `review_pages`, por pedido explícito e para
   o site inteiro. O turno termina com "confira a prévia" mesmo quando os
   pixels contradizem o pre-flight.
6. **Rótulos e fechamento.** `page-edits.ts:566-603` usa `seção` como nome
   padrão e `ajuste salvo` para qualquer `set` sem entrada em
   `VISUAL_SUMMARIES` (`page-edits.ts:411`). O rótulo de atividade em
   `lib/generation/labels.ts:168` não identifica o bloco. Cinco frases iguais
   não dizem que a mesma cor foi aplicada ao mesmo componente em cinco páginas.

O rodapé é um bloco por página, então "o footer" são cinco blocos. Ler quatro
páginas e gravar cinco vezes está correto no contrato atual; o custo é de
contexto e latência, não de exatidão.

## 3. Princípios

- **Escolha do operador prevalece sobre decoração da vibe, em código.** Um
  `presentation.background` gravado pelo operador nunca é repintado por CSS de
  vibe, motivo ou versão. A garantia fica no CSS e no teste de navegador, não
  no prompt.
- **O servidor só afirma contraste de um fundo que o CSS pinta.** Uma única
  fonte descreve a superfície efetiva de cada seção e alimenta renderer, lint de
  texto e recibo.
- **Todo efeito que o operador consegue nomear tem um campo validado.** O
  contrato continua sendo blocos e `presentation`, sem HTML ou CSS livre: o
  catálogo cresce, a validação não afrouxa. Efeitos sem campo recebem uma
  resposta honesta com a alternativa real, nunca uma mudança de marca.
- **Edição visual termina com medição.** Depois de gravar um fundo ou uma cor
  de texto, o turno mede o resultado renderizado da página editada e informa
  números. A crítica por modelo continua opcional e só por pedido.
- **Sem afrouxar gates.** Nenhuma regra é relaxada para aceitar uma edição.
  Recusas continuam recusando o lote inteiro.

## 4. Frentes

### Frente 1: a cor local vence qualquer decoração da vibe

- Mover a regra de `data-tone='custom'` de `site.css:306-314` para um arquivo
  `app/(sites)/operator.css`, importado por último em `layout.tsx`, com
  `background-image: none` além de `background-color: transparent`, e com
  `--muted`, `--line` e `--highlight-text` herdados do wrapper. Cobrir também as
  superfícies internas que as vibes pintam com variáveis próprias
  (`.site-explorer-panel`, `.site-facts-ledger`) quando estiverem dentro de um
  bloco `custom`, usando o mesmo prefixo de seletor. Ordem, não `!important`,
  decide o empate.
- Em `vibes.css`, as regras de lavagem da comercial (hero, rodapé, explorer,
  ledger) passam a excluir o bloco custom explicitamente
  (`.site-block:not([data-tone='custom'])` no seletor), para que a intenção
  fique legível no próprio arquivo e não dependa só do arquivo final.
- Teste de navegador novo, `tests/browser/site-operator-colors.test.mjs`,
  com o CSS emitido pelo build (mesmo padrão de
  `tests/browser/site-visual-system.test.mjs:1-50`): para cada vibe, versão
  (`2`, `4`, `reference`) e família com decoração (hero, footer, explorer,
  facts), renderizar um bloco com `presentation.background` e verificar
  `background-image === 'none'`, `background-color` igual ao hex, e contraste
  medido de cada texto visível com `lib/review/text.ts` (`inspectText`) igual ou
  acima de 4,5:1. O caso `comercial` + `4` + `footer` reproduz este incidente e
  deve falhar antes da correção.

Efeito em sites publicados: qualquer seção já publicada com fundo custom sob a
comercial v3+ passa a mostrar a cor gravada, sem degradê. É a correção
pretendida, não regressão; registrar em [Design](design.md).

### Frente 2: superfície efetiva como fonte única

- `sectionBackgrounds` (`section-colors.ts:11-22`) passa a devolver as
  superfícies que o CSS realmente pinta para o par vibe renderizada, versão,
  família e tom: para a comercial v3+, hero e rodapé sem custom devolvem
  `[--wash, --paper]`; o explorer devolve `--wash-2`; a moderna com `ink`
  devolve o papel elevado que `surfaceOf` já calcula. Com `background`
  gravado, devolve só o hex (garantido pela Frente 1).
- `text-style-lint.ts` e `sectionColorVars` consomem essa lista e medem contra
  a pior superfície. `themeVars` continua emitindo as variáveis; o que muda é
  que a lista de decorações vira uma tabela em `lib/blocks/theme.ts`
  consultada pelos três consumidores, com comentário apontando o seletor CSS
  correspondente.
- Teste de paridade em `tests/site-visual-system.test.mjs`: para cada
  combinação da tabela, o `background` computado no navegador (Frente 1) deve
  bater com o que `sectionBackgrounds` prevê. Esse teste teria acusado o PR #60.

### Frente 3: controles de superfície que o operador pede

Novos campos opcionais em `presentation` (`lib/blocks/registry.ts:69`),
com schema, catálogo, renderer, lint e pre-flight coerentes, conforme o
invariante de novo campo em [AGENTS.md](../AGENTS.md):

- `decoration: 'vibe' | 'none'`. `none` desliga lavagem, degradê de CTA e
  motivo na seção sem escolher um hex, para pedidos como "tira o degradê,
  deixa liso". Renderiza como `data-decoration="none"` e o CSS da vibe respeita
  o atributo pelo mesmo mecanismo da Frente 1.
- `backgroundEnd` (hex) e `gradient: 'down' | 'diagonal' | 'right'`, válidos
  só com `background` hex. O renderer emite
  `background-image: linear-gradient(<ângulo>, background, backgroundEnd)` no
  wrapper e `sectionColorVars` calcula a tinta contra as duas extremidades:
  a tinta automática precisa passar em AA nas duas; se nenhuma passar, o schema
  recusa com a extremidade mais próxima que passa, no mesmo padrão de
  `accessibleAccent`. `foreground` explícito exige 4,5:1 nas duas.
- Resumo do catálogo (`registry.ts:1112`) e `describe_block` descrevem os
  três campos com o exemplo de uso. `VISUAL_SUMMARIES` ganha entradas para
  `background`, `backgroundEnd`, `gradient` e `decoration`.
- `lint.ts` continua contando `presentation` como decisão de composição; os
  campos novos entram na contagem sem regra adicional.

Com isso, "um degradê mais elegante no rodapé" tem uma operação real: `set`
de `background`, `backgroundEnd` e `gradient` no rodapé de cada página, com
duas cores derivadas da marca e texto medido. O que continuar sem campo
recebe a resposta prevista na seção "Pedido que não cabe no bloco" de
[Edição pelo chat](chat-edits.md), presente na versão de `origin/main`.

### Frente 4: intenção visual vira a operação certa, sem tocar a marca

- `editPolicyFor` (`edit-policy.ts:97`) reconhece pedido visual por família
  além do bloco nomeado entre aspas (`namedVisualScope`, `edit-policy.ts:63`):
  `rodapé|footer` → `footer.*`, `cabeçalho|header|menu` → `nav.bar`,
  `abertura|banner|hero` → `hero.*`, combinados com fundo, cor, degradê, bg,
  lavagem, texto claro/escuro. O resultado é `visualOnly` com alvos em todas
  as páginas onde a família existe, salvo menção a uma página. `editTools`
  já remove `set_brand` nesse modo (`edit-policy.ts:182-205`); o executor
  recusa `set`/`unset` fora de `presentation.*`, `textStyles.*` e dos campos de
  estilo já permitidos ao cabeçalho. O turno 1 deste incidente ficaria sem a
  ferramenta que usou.
- Para alvos em várias páginas, a rota injeta, além do snapshot da página em
  foco (`editingPageContext`, `page-edits.ts:129`), uma lista compacta dos
  blocos-alvo das outras páginas com slug, ID, revisão e `presentation`
  atual. O agente grava as cinco páginas em um passo, sem quatro leituras.
  Continua uma chamada de `edit_page` por página e uma gravação atômica por
  página.
- Prompt (`prompt.ts:141-157`): a regra de cor local passa a citar rodapé,
  cabeçalho e abertura como blocos por página; o pedido de degradê aponta para
  `backgroundEnd`/`gradient`; a seção de pedido que não cabe cobre decoração
  de vibe, com a frase de limite e a alternativa. A resposta final precisa
  nomear o hex gravado, a cor de texto calculada e as páginas alcançadas.
- Nome de cor sem hex: o agente escolhe um neutro coerente com a marca e diz
  qual foi. O recibo (Frente 6) mostra o hex, e o operador ajusta pelo número.
  Não há tabela de nomes de cor no servidor; uma imagem anexada continua
  sendo evidência visual para o modelo, nunca fonte automática de cor.

### Frente 5: medição renderizada depois de uma edição visual

- Após um `edit_page` bem-sucedido cujas mudanças toquem `presentation.*` ou
  `textStyles.*`, o executor abre a página editada no mesmo Chromium da
  revisão (`lib/review/capture.ts:50`), em 1440 e 390 px, localiza
  `[data-block-id]` de cada bloco alterado e mede, no padrão de
  `lib/review/navigation.ts:11`: `background-color` e `background-image`
  computados, e contraste de cada texto visível com `inspectText`. O retorno
  é estruturado: `{ ok, issues: ["\"Contato\" com contraste 1,1:1 sobre o
fundo renderizado em 1440 px"] }`. Só medições e achados chegam ao chat;
  sem pixels no histórico.
- O recibo de `edit_page` inclui o resultado. Com `ok: false`, o agente corrige
  ou relata; o fechamento determinístico (`lib/ai/edit-receipt.ts`) não pode
  dizer "salvo" sem a ressalva. `changesPreview` (`lib/ai/preview-updates.ts:2`)
  continua sinalizando a recarga da prévia.
- Custo: uma página, dois viewports, sem chamada de modelo. `EIXU_REVIEW_CAPTURE=0`
  desliga a medição e o recibo declara que ela não ocorreu. O Chromium já
  faz parte do manifesto serverless de `/api/chat`
  (`tests/build-runtime.test.mjs`).

### Frente 6: recibo e rótulos que dizem o que mudou

- `page-edits.ts:566-603`: nome padrão por família (`rodapé`, `menu superior`,
  `abertura`, `formulário`, `chamada`), e detalhe com valor para campos
  visuais: "fundo #27272a, texto #ffffff, contraste 14,9:1".
- Fechamento em `edit-receipt.ts`: mudanças iguais em várias páginas viram uma
  frase ("Rodapé com fundo #27272a nas 5 páginas"), seguida das recusas.
- `labels.ts:168`: rótulo com bloco quando o lote tem um único alvo
  ("Aplicando alterações no rodapé de /sobre").

### Frente 7: avaliação

- `scripts/eval-page-edits.mjs` ganha uma fixture comercial v6 com referência
  e `structure: comercial-atendimento` (hoje a fixture não tem `design`,
  `tests/helpers/page-edit-fixture.mjs:22`) e os casos `footer-gray` ("deixa
  o footer inteiro na cor cinza": `background` no rodapé de todas as páginas,
  nenhuma chamada a `set_brand`, hex na resposta), `footer-gradient` ("quero
  um degradê mais elegante no rodapé": `backgroundEnd`/`gradient` ou limite
  declarado, nunca `set_brand`) e `hero-decoration-off`.
- `tests/admin-page-edits.test.mjs`: validação das extremidades do degradê,
  recusa sem par legível, `decoration` e o escopo por família.
- Verificação manual, após deploy: na prévia do cliente do incidente, o
  rodapé com o fundo já gravado deve aparecer liso e legível sem nova edição.

## 5. Sobre trocar de modelo nas edições ou na geração

O defeito deste incidente não é de capacidade do modelo. Nenhum modelo vence
uma cascata de CSS por props, e a fabricação do turno 1 nasce de um controle
inexistente somado a uma ferramenta disponível que não devia estar. As
Frentes 1 a 6 vêm antes de qualquer troca; sem elas, um modelo mais forte
produziria o mesmo rodapé.

"Deixar o agente livre para alterar qualquer coisa no frontend" não deve
significar HTML ou CSS livre: isso passa por cima do contrato de
responsividade (`lib/design/responsive.ts`), do contraste medido, do
isolamento entre clientes e do pre-flight. O caminho é ampliar os controles
validados (Frente 3) e fazer o renderer respeitar a escolha do operador
(Frente 1). Na prática, isso cobre o que operadores pedem: fundo, degradê,
cor e tamanho de texto, respiro, largura, borda e ordem.

Onde um modelo mais forte compensa, se compensar, é na edição, não na
geração:

- O turno de edição tem contexto pequeno (snapshot e schemas da página), é
  multimodal (imagem anexada como referência), exige interpretar intenção com
  precisão e o operador julga cada resultado na hora. Com a Frente 4, o turno
  cai para um ou dois passos, então o custo por turno de um modelo premium
  fica limitado.
- A geração roda até 24 passos com 49.152 tokens de saída por passo sob
  gramática, estrutura e pre-flight que já limitam o que o modelo decide. O
  custo escala com o número de passos e o ganho depende menos do modelo.

Mecanismo proposto: `productModel('edit')` em `lib/ai/models.ts:12-24` com
`EIXU_EDIT_MODEL`, sem mudar o padrão. A decisão sai de `npm run eval:edits --
--live` nos casos novos, rodado com `EIXU_MODEL` apontando para Gemini 3.8
Flash e para o candidato (Fable 5.1 respondia pelo Gateway em 09/09/2026;
Astra precisa de confirmação no endpoint de modelos do Gateway antes do
ensaio). Comparar exatidão, passos, duração e custo registrados em
`outputs/page-edits/`. Esse ensaio é pago e exige autorização; este plano não
o executa nem afirma resultado.

## 6. Ordem de execução e verificação

1. Frente 1 com o teste de navegador que reproduz o incidente. Corrige o
   visível, só no renderer.
2. Frente 4 e Frente 6. Retiram `set_brand` do pedido local e tornam o recibo
   legível.
3. Frente 2 e Frente 3 juntas, porque o campo de degradê depende da superfície
   efetiva medida.
4. Frente 5, depois que o servidor e o CSS concordam.
5. Frente 7 e documentação: [Edição pelo chat](chat-edits.md),
   [Design](design.md), [Harness](harness.md) e [Verificação](verification.md).

Checks por etapa, conforme [Verificação](verification.md): `npx next typegen
&& npx tsc --noEmit`, `npm run lint`, `npm run test:sites`,
`npm run test:admin`, `npm run build:vercel` e, com `EIXU_CHROME_PATH`,
`npm run test:sites:browser` e `npm run test:admin:browser`. O ensaio
`eval:edits --live` só com autorização. Nenhuma etapa escreve no Neon de
produção nem publica.

Na implementação local, tipos, lint, formatação do diff, `test:sites` (24/24),
`test:admin` (30/30), `build:vercel` com os quatro checks de manifesto,
`test:sites:browser` (77/77) e `test:admin:browser` (18/18) passaram. A regressão
nova também chamou `measureEditedBlocks` contra uma prévia HTTP local nas duas
larguras, compôs transparências e recusou aprovação de texto diretamente sobre
imagem sem usar pixels. A confirmação de produção continua dependendo de release
autorizado.

## 7. Decisões registradas

1. Foram entregues os dois controles: degradê com dois pontos/direção e
   `decoration: none`.
2. A medição renderizada ocorre em toda edição visual salva, sem chamada de
   modelo; `EIXU_REVIEW_CAPTURE=0` a desliga com recibo explícito.
3. O ensaio comparativo de modelos continua pendente de autorização por ter
   custo. `EIXU_EDIT_MODEL` apenas oferece o mecanismo isolado.
4. O rascunho do cliente do incidente continua intocado. Depois de um deploy
   autorizado da Frente 1, o fundo já gravado deverá aparecer liso; voltar ao
   tom da marca continua sendo um `unset` explícito pelo chat.
