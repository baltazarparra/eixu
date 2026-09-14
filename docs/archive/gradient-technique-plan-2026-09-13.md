# Plano: degradê com técnica nos fundos dos sites

Análise feita em 13/09/2026 sobre `origin/main` no SHA `29a1f34` e sobre a
prévia do cliente `skinaosupermercado` em `/admin/skinaosupermercado`, cuja
geração registrou o deployment `f9d5918` nos eventos. O checkout local estava
48 commits atrás e com alterações de outro agente ainda sem commit; caminhos
e linhas abaixo são de `origin/main`. Implemente a partir dele, em worktree
próprio.

**Estado:** Frentes 1 e 2 e o contrato estático da Frente 3 executados em
13/09/2026 a partir de `29a1f34`; ver a seção "Degradê com técnica" em
[Design](../design.md) para o contrato vigente. Ficaram de fora, para um plano
próprio: o campo `presentation.glow` da seção 6, a paridade de
`sectionBackgrounds` e a entrada de `surfaces` em `lib/review/capture.ts` — a
medição de pixels sob o texto existe hoje só no teste de navegador
`tests/browser/site-operator-colors.test.mjs`, não no recibo de `review_pages`.
O Skinão é só o caso que tornou o defeito visível; toda mudança abaixo é no
gerador, para todas as vibes. Nada aqui autorizou alterar rascunhos, snapshots
publicados ou executar geração paga. Este plano complementa
"Edições visuais fiéis pelo chat" (plano ainda não versionado): aquele trata
da cascata em que a cor do operador perde para a decoração da vibe; este
trata da técnica do degradê em si e emenda o campo de degradê proposto lá.

## 1. O que a prévia mostrou e por que o gerador produz isso

Estado lido no Neon (somente leitura) e tokens recalculados com o código de
`origin/main`. O cliente é `vibe: comercial`, perfil `design.version: 6`,
`motif: wash`, paleta do operador com `accent #ffdd00`, `highlight #b80505`,
`accentAlt #fffbeb`, `ink #1f2937` e `paper #ffffff`.

| Sintoma na prévia                                                                | Causa no código                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rodapé com degradê de creme a vermelho saturado, links e apoio em cinza ilegível | O chat gravou `presentation.background: #b80505` no `footer.compact` das quatro páginas (pedido do operador, três vezes: "vermelho chapado sem efeitos", "tirar o efeito de gradiente"). O renderer marca `data-tone="custom"` e emite `--paper: #b80505`, `--ink: #ffffff` (`lib/blocks/section-colors.ts:25-59`). A regra `.site-footer` da comercial v3/v4 (`app/(sites)/vibes.css:296-303`) pinta `linear-gradient(160deg, var(--wash), var(--paper) 68%)` por cima e troca `--muted` por `--muted-wash`. |
| Hero da home e de `/ofertas` de creme a vinho, apoio cinza sobre o vinho         | Mesmo mecanismo com `background: #4a0303` e `#5c0404` e a regra `.site-hero` (`vibes.css:288-295`).                                                                                                                                                                                                                                                                                                                                                                                                           |
| O agente responde "ajuste salvo" e nada muda                                     | Não existe campo para a lavagem da vibe. `edit_page` gravou o hex que o operador pediu; o CSS repintou o degradê. A resposta descreve a gravação, não o pixel.                                                                                                                                                                                                                                                                                                                                                |
| A faixa `cta.band` em tom `accent` escurece de amarelo para mostarda             | `vibes.css:304-309`: `linear-gradient(135deg, var(--accent), var(--accent-deep))`, com `--accent-deep` = acento misturado 12% com a tinta (`lib/blocks/theme.ts:64-68`). Misturar em direção ao preto tira croma e suja a cor.                                                                                                                                                                                                                                                                                |
| Mesmo sem cor do operador, a lavagem lê como uma faixa diagonal                  | `site.css:951-959` e `vibes.css:294,302`: dois pontos opacos, ângulo fixo de 160°, sem alfa. O olho lê a direção da reta, não uma luz.                                                                                                                                                                                                                                                                                                                                                                        |
| Nenhum gate acusa                                                                | `text-style-lint.ts` mede contraste contra o hex que o servidor conhece, não contra os pixels pintados. A captura confere "gradiente sem repetição" e "faixa de 1 px" (`tests/browser/site-word-breaks.test.mjs:142-161`), não a forma do degradê nem o texto sobre ele. `lib/review/critic.ts` não tem critério para degradê.                                                                                                                                                                                |

Tokens recalculados para o Skinão com `themeVars` e `sectionColorVars` de
`origin/main`:

| Token ou par                                                             | Valor     | Medida                         |
| ------------------------------------------------------------------------ | --------- | ------------------------------ |
| `--wash` (papel + acento 7%)                                             | `#fffded` | OKLCH L 0,99, C 0,02           |
| `--muted-wash` (apoio medido contra `--wash`)                            | `#6b7175` | 4,5:1 contra `#fffded`         |
| `--muted-wash` sobre o rodapé `#b80505`                                  |           | 1,39:1                         |
| `--muted-wash` sobre o meio do degradê do rodapé (`#dc8179`)             |           | 1,76:1                         |
| `--muted` da seção custom `#ba9f9f` sobre o topo creme do hero `#4a0303` |           | 2,40:1                         |
| `--accent-deep` (acento + tinta 12%)                                     | `#e4c707` | L 0,90 → 0,83; C 0,186 → 0,171 |

O servidor mediu o par branco sobre vermelho (`#ffffff` / `#b80505`,
7,0:1) e aprovou. O navegador pintou creme na metade de cima.

Além do rodapé e dos heroes, o rascunho tem `proof.strip` com `#b80505` e
onze seções em amarelos pálidos (`#fff9e6`, `#fff3cc`, `#fdf8ee`), todas
chapadas e legíveis. O problema não é cor local; é o degradê que a vibe
impõe sobre qualquer papel.

## 2. Estudo da referência: actionline.io

Lidas em 13/09/2026 a home e nove páginas internas (`about-us`, `untold`,
`servicios`, `resultados`, `people`, `contato`, `newsroom`,
`servico/vendas`, `solution/customer-experience`) em Chrome headless a
1440 px: 35 regiões com degradê no `background` computado, mais o CSS do
tema e as imagens de fundo. Os valores abaixo são os do site, não uma
interpretação.

### 2.1 Receitas encontradas

| Onde                               | CSS computado                                                                                                                                                                                             | O que faz                                                                                       |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Rodapé, em todas as páginas        | `radial-gradient(circle at 50% 200%, rgb(214 151 18) 8%, rgba(235,206,108,.75) 47%, rgba(240,205,150,.30) 65%, #fff 107%)`                                                                                | Centro duas alturas abaixo da caixa: só a borda do círculo aparece, como luz subindo do chão    |
| Seção "ecossistema" (`untold`)     | `radial-gradient(circle at 30% 151%, rgba(90,140,220,.70) 0%, rgba(110,160,235,.50) 19%, rgba(150,190,240,.30) 35%, #fff 45%)`                                                                            | Centro fora da tela, quatro paradas, alfa decrescente, papel pleno antes da metade              |
| Seção do mapa (`untold`)           | `radial-gradient(circle at 16% -35%, rgba(255,160,225,.70) 10%, rgba(210,140,255,.50) 23%, rgba(150,175,255,.35) 36%, #fff 50%)`                                                                          | Mesmo princípio vindo do alto; três matizes vizinhos (rosa, lilás, azul) na mesma luminosidade  |
| Hero `untold`                      | Três camadas: halo branco `at top left` (1 → 0), `linear-gradient(to right bottom, #b6c8ff, #c9b7fa 25%, #e2c4f5 45%, transparent 70%)`, `radial-gradient(circle at 0% 100%, #ff8a42, … transparent 55%)` | Cada cor é uma camada própria que termina em `transparent`; as cores nunca se misturam entre si |
| "Insights" (home)                  | `linear-gradient(135deg, #fff 0%, #f8fbff 10%, #e8f2ff 20%, #d8ecfb 35%, #c8e0f6 50%, #b8d4f1 65%, #fff8eb 80%, #fff1d6 100%)`                                                                            | Oito paradas: de azul a creme passando pelo claro, sem cinza no meio                            |
| "Filosofia" e "História" (`about`) | `linear-gradient(to right, #fff 0%, #eef5fb 42%, #d6e4f0 100%)`                                                                                                                                           | Um só matiz, três paradas, o extremo mais forte ainda em L 0,92                                 |
| Faixas amarelas (6 páginas)        | `linear-gradient(90deg, #fdd44c 0%, #fdd44c 91%, transparent 100%)`                                                                                                                                       | Cor chapada que só se dissolve na borda; o texto fica na parte plena                            |
| Heroes de página interna           | `bgEquipoDicHeader.jpg` (1600×718) em `background-size: cover`; `aboutusBg.jpg` (1600×4618); `background-latest-news.webp` (8001×12716, 442 KB)                                                           | Malha de três a quatro cores desfocadas sobre branco, pré-renderizada                           |

### 2.2 Medidas nas capturas

Amostragem em grade de 16×12 pontos por região, convertida para OKLCH e
descontando pixels de texto:

| Região                | L (claridade) | C (croma)   | Matiz                              |
| --------------------- | ------------- | ----------- | ---------------------------------- |
| Rodapé (10 páginas)   | 0,87 – 0,99   | 0,01 – 0,11 | 74° – 94° (uma família, o amarelo) |
| "Insights"            | 0,76 – 1,00   | ≤ 0,09      | 80° – 262°, passando por 1,00      |
| Mapa (`untold`)       | 0,74 – 1,00   | ≤ 0,09      | 267° – 323°                        |
| "Filosofia" (`about`) | 0,92 – 1,00   | ≤ 0,02      | 240° – 248°                        |

### 2.3 O que a técnica é

1. **Luz sobre papel, não transição entre duas cores.** A cor entra como um
   brilho radial cujo centro fica fora da caixa (`at 50% 200%`, `at 30% 151%`,
   `at 16% -35%`). O visitante vê a borda de um círculo, nunca o centro nem a
   direção de uma reta.
2. **Alfa decrescente em três a cinco paradas.** A cor perde croma e opacidade
   ao afastar-se da origem e chega ao papel pleno antes da borda oposta
   (paradas de 45% a 65% já são brancas ou transparentes).
3. **Claridade alta e croma baixo nas áreas de texto.** Fundos de seção vivem
   em L ≥ 0,85 e C ≤ 0,11. O amarelo pleno da marca (`#fdd44c`, L 0,88) só
   aparece chapado, em faixas, com texto preto.
4. **Matizes vizinhos ou passagem pelo papel.** Azul e creme não se misturam
   diretamente; a parada do meio é branca. Rosa, lilás e azul convivem por
   serem vizinhos no círculo, na mesma claridade.
5. **Uma camada por cor.** Onde há mais de uma cor, cada uma é um gradiente
   próprio que termina em `transparent`; a sobreposição acontece sobre o
   papel, e não há mistura sRGB entre as duas cores.
6. **Nada escurece para o preto.** Nenhum degradê vai em direção à tinta. O
   escuro do site é chapado (botões `#000`).
7. **O texto fica na parte clara.** O brilho ocupa canto, borda ou atrás de
   foto; a coluna de texto está sobre L ≥ 0,9 com tinta preta.
8. **Scrim para texto sobre foto** usa o papel, não o preto: `.phrase` recebe
   `linear-gradient(to top, rgba(255,255,255,0) 0%, #fff 12%, #fff 100%)`.

O que não vamos copiar: as malhas em imagem. A referência entrega 442 KB de
WebP a 8001 px para um fundo; duas ou três camadas de `radial-gradient` em
CSS reproduzem o mesmo aspecto com as cores da marca do cliente, sem peso e
sem geração.

## 3. Princípios

- **Degradê é luz sobre papel.** Todo degradê de fundo é um brilho radial na
  cor da marca, nascendo na borda ou fora da caixa e terminando em
  `transparent` antes de chegar ao texto. Não existe degradê reto entre duas
  cores plenas em nenhuma vibe.
- **Os dois extremos vêm do mesmo contexto de cor.** Um gradiente nunca
  interpola um token calculado contra o papel da marca (`--wash`) com o papel
  de uma seção de outro tom. A cor de brilho é derivada do papel efetivo da
  seção, ou o degradê não existe.
- **Nunca em direção ao preto.** Tokens de degradê só clareiam ou perdem
  opacidade. `--accent-deep` deixa de existir.
- **Claridade e contraste medidos no ponto mais forte.** O brilho tem L
  mínima definida por vibe, e o texto de apoio é medido contra a parada mais
  saturada, não contra a média. Se a paleta do operador não sustentar, o
  fundo fica chapado, como já acontece com `--wash`.
- **Cor do operador é chapada.** `presentation.background` remove qualquer
  lavagem, brilho e motivo da seção, garantido pela cascata da Frente 1 de
  "Edições visuais fiéis pelo chat" (plano ainda não versionado). O único
  degradê que o operador pode pedir usa a mesma técnica (seção 6).
- **Proibição em código, não em prompt.** Um teste estático sobre o CSS dos
  sites recusa gradiente com dois pontos opacos, gradiente que não termina em
  `transparent` e gradiente que usa `--paper`, `--ink` ou `--wash` como
  parada. A lista de exceções (scrims, máscaras, grade v2, faixas do ousado)
  é explícita e comentada.
- **Sem afrouxar gates.** Nenhuma regra existente é relaxada; as novas nascem
  bloqueantes na geração e são medidas na captura.

## 4. Frente 1: parar de repintar a cor do operador

É a Frente 1 do plano de edições visuais, executada primeiro e sem alteração:
regra de `data-tone='custom'` movida para `app/(sites)/operator.css`, importado
por último em `app/(sites)/layout.tsx:18-24`, com `background-image: none`; as
regras de lavagem em `vibes.css:288-352` e `site.css:951-959` passam a
selecionar `main > .site-block:not([data-tone]) .site-hero` e equivalentes, no
mesmo molde da regra `nth-child(3n)` que já exclui tom. Teste de navegador
`tests/browser/site-operator-colors.test.mjs` com o caso comercial + v4 +
rodapé, que reproduz o Skinão e o UPTax e falha antes da correção.

Acréscimo deste plano, no mesmo PR:

- **Scrim do hero `cover` na cor da seção.** `site.css:436-441` e `449-454`
  pintam o scrim em preto (`rgba(0,0,0,.72)` e `rgba(0,0,0,.7) → .08`). Quando
  a seção tem `background` escuro do operador (`isDarkSurface`,
  `lib/blocks/contrast.ts:28`), `sectionColorVars` emite `data-scrim="paper"`
  no bloco e o scrim usa `color-mix(in oklab, var(--paper) 78%, transparent)`
  até `10%`. É exatamente o pedido do operador do Skinão ("um tom de vermelho
  mais escuro ao invés de preto ou cinza" no banner). Com fundo claro do
  operador, o scrim continua preto, porque a cópia do `cover` é branca.

Efeito em sites publicados no deploy, sem tocar rascunho ou snapshot:
`skinaosupermercado` (21 blocos com `background`, rodapé, heroes e
`proof.strip` em vermelho chapado, como pedido), `uptaxconsultoriatributaria`
(rodapé grafite, só no rascunho) e `villa-piva-juice` (uma seção, rascunho).

## 5. Frente 2: a lavagem com técnica

### Tokens medidos (`lib/blocks/theme.ts`)

`glowOf(paper, color)` em `lib/blocks/contrast.ts`, ao lado de
`accessibleAccent`: percorre `t` de 0,60 a 0,10 em passos de 0,05 e devolve
`mixOklabHex(paper, color, t)` no primeiro `t` cuja claridade OKLCH esteja no
piso da vibe (papel claro: L ≥ 0,86; papel escuro: L ≤ 0,30) e cujo contraste
com a tinta seja ≥ 7:1. Sem `t` válido, devolve o papel, e o CSS não pinta
nada. Valores para paletas reais, sobre papel branco e tinta `#1f2937`:

| Cor de origem      | `t`  | Brilho    | L OKLCH | Contraste com a tinta |
| ------------------ | ---- | --------- | ------- | --------------------- |
| Amarelo `#ffdd00`  | 0,6  | `#ffec93` | 0,94    | 12,4:1                |
| Vermelho `#b80505` | 0,25 | `#f5cac3` | 0,87    | 9,9:1                 |
| Azul `#1f6feb`     | 0,3  | `#bdd6fd` | 0,87    | 9,9:1                 |
| Creme `#fffbeb`    | 0,6  | `#fffdf3` | 0,99    | 14,4:1 (quase papel)  |
| Laranja `#c45c26`  | 0,3  | `#f1cebf` | 0,88    | 10,0:1                |

Tokens emitidos, sempre como hex resolvido:

- `--glow`: `glowOf(paper, accent)`.
- `--glow-2`: `glowOf(paper, highlight)` quando `highlight` difere de `accent`;
  senão `glowOf(paper, accentAlt)`; senão o papel.
- `--accent-glow`: `mixOklabHex(accent, '#ffffff', 0.35)` só se
  `contrastRatio(accentInk, accentGlow) ≥ 4.5`; senão o próprio acento. Para o
  amarelo do Skinão dá `#ffea88`, 15,0:1 contra `--accent-ink`.
  Substitui `--accent-deep` (`theme.ts:64-68`, `90`), que é removido.
- `--muted-glow`: `readableMuted(ink, glow)`, o apoio medido contra a parada
  mais forte. Substitui `--muted-wash`. `--wash`, `--wash-2`, `--muted-wash-2`
  saem junto com o último consumidor em `vibes.css:317,326,352`, que passam a
  usar `--glow-2` chapado em 40% sobre o papel via `color-mix`, medido pelo
  mesmo `readableMuted`.
- A opacidade no CSS usa `color-mix(in oklab, var(--glow) N%, transparent)`,
  que interpola pré-multiplicado e conserva o matiz; nunca `rgba` calculado à
  mão nem mistura com a tinta.

### CSS (`app/(sites)/site.css` e `vibes.css`)

Receita única, com a origem fora da caixa e quatro paradas; as posições e
raios mudam por elemento, a forma não.

```css
/* hero comercial e landing: brilho vindo do canto superior direito, com a
   segunda cor no canto oposto. O texto fica na metade esquerda, em papel. */
.site-theme[data-motif='wash'] main > .site-block:not([data-tone]) .site-hero {
  --muted: var(--muted-glow);
  background-color: var(--paper);
  background-image:
    radial-gradient(
      110% 90% at 100% 0%,
      var(--glow) 0%,
      color-mix(in oklab, var(--glow) 55%, transparent) 28%,
      color-mix(in oklab, var(--glow) 18%, transparent) 52%,
      transparent 74%
    ),
    radial-gradient(
      80% 70% at 0% 100%,
      color-mix(in oklab, var(--glow-2) 60%, transparent) 0%,
      transparent 58%
    );
}
/* rodapé: luz subindo do chão, como a referência. */
.site-theme[data-motif='wash']
  main
  > .site-block:not([data-tone])
  .site-footer {
  background-image: radial-gradient(
    130% 80% at 50% 125%,
    var(--glow) 0%,
    color-mix(in oklab, var(--glow) 60%, transparent) 38%,
    color-mix(in oklab, var(--glow) 22%, transparent) 60%,
    transparent 82%
  );
}
/* seção intermediária: segunda cor entrando pela borda direita. */
.site-theme[data-motif='wash']
  main
  > .site-block:not([data-tone]):nth-child(3n) {
  background-image: radial-gradient(
    70% 120% at 100% 50%,
    color-mix(in oklab, var(--glow-2) 70%, transparent) 0%,
    color-mix(in oklab, var(--glow-2) 25%, transparent) 36%,
    transparent 62%
  );
}
```

- **Comercial v3/v4** (`vibes.css:288-303`): hero e rodapé com a receita acima
  mesmo em `motif: none`, como o contrato atual, mas com o segundo brilho
  omitido e o primeiro em 70% da intensidade. O explorer, a faixa de prova e
  o ledger trocam `--wash`/`--wash-2` por `color-mix(in oklab, var(--glow-2)
40%, var(--paper))` chapado.
- **`cta.band` em tom `accent`** (`vibes.css:304-309`): `background-color:
var(--accent)` e `background-image: radial-gradient(90% 140% at 100% 0%,
color-mix(in oklab, var(--accent-glow) 85%, transparent), transparent 62%)`.
  O texto continua medido contra o acento e passa a ser medido também contra
  `--accent-glow`.
- **Landing v7**: usa as regras de `data-motif='wash'` sem regra própria.
- **Artístico** (`vibes.css:141-190`): o hero já é radial em 14% e 10% e
  cumpre o contrato; a seção `3n+2` troca o `linear-gradient(135deg)` entre
  duas misturas opacas por duas camadas radiais em lados opostos, e o rodapé
  troca o `160deg` pela receita do rodapé, com `--highlight` como origem. A
  exclusão por `data-reference-aspects~='surface'` permanece.
- **Moderno e ousado**: sem degradê tonal; `stripes` é faixa chapada
  repetida e entra na lista de exceções do teste estático. Grade só em v2
  (`site.css:942-950`), também na lista.
- **Miniaturas do cadastro** (`app/(admin)/admin.css:1054,1064,1101,1136,1164`):
  a comercial (`linear-gradient(160deg, #e8f0fd, #f6f4ef 62%)`) e as duas
  miniaturas bicolores em 145° e 155° recebem a receita radial com cores
  fixas, para o operador ver o que a vibe entrega; o corte duro do ousado e o
  escuro do moderno ficam.
- **Responsividade**: em 390 px o hero empilha e a cópia desce; os raios em
  porcentagem mantêm o brilho no canto e a parada `transparent` antes de 74%
  garante papel sob a coluna de texto. Verificado pelo teste de pixels da
  Frente 3, não por inspeção.

### Prompt, catálogo e crítica

- `lib/design/vibes.ts:650` (comercial): "A cor de marca ocupa no máximo 8% do
  papel como lavagem contínua" passa a "A cor de marca aparece como brilho
  radial que nasce na borda e some no papel antes do texto; nunca degradê reto
  entre duas cores, nunca escurecendo para o preto". A linha do artístico
  (`vibes.ts:671`) recebe a mesma frase.
- `lib/blocks/registry.ts:71-76`: `background` descrito como "cor chapada
  exclusiva desta seção; remove lavagem, brilho e motivo da vibe".
  `lib/taste/prompt.ts:148` e a descrição de `edit_page`
  (`lib/ai/tools.ts:1792`) dizem o mesmo e apontam o campo da seção 6 para
  pedidos de degradê.
- `lib/review/critic.ts`: o critério de superfície ganha quatro sinais de
  erro material: transição reta entre duas cores plenas; cor escurecendo para
  preto ou tinta; texto de apoio sobre a parte saturada; degradê que atravessa
  a seção inteira sem chegar ao papel. `docs/eval-rubric.md` registra os
  quatro.

## 6. Emenda ao campo de degradê do plano de edições visuais

A Frente 3 daquele plano propõe `backgroundEnd` (hex) e `gradient: 'down' |
'diagonal' | 'right'`, renderizados como `linear-gradient(<ângulo>,
background, backgroundEnd)`. É a forma que este plano proíbe. Substituir por:

- `presentation.glow: { color?: hex, from: 'top' | 'bottom' | 'left' |
'right' }`, válido só com `background` hex. `color` omitido usa `glowOf(background,
accent)`; informado, passa por `glowOf(background, color)`, que clareia ou
  escurece até o piso de claridade do papel da seção. O renderer emite a mesma
  receita da Frente 2 no wrapper, com a origem no lado pedido, e
  `sectionColorVars` mede a tinta e o apoio contra o brilho e contra o
  fundo. Sem par legível, o schema recusa com o brilho mais próximo que passa.
- `decoration: 'vibe' | 'none'` permanece como proposto.
- "Quero um degradê mais elegante no rodapé" vira `background` na cor da marca
  ou do operador mais `glow: { from: 'bottom' }`. Um pedido de dois hex
  opostos recebe a resposta prevista em "Pedido que não cabe no bloco" de
  [Edição pelo chat](../chat-edits.md), com a alternativa real.

## 7. Frente 3: gates

- **Tokens** (`tests/site-visual-system.test.mjs:61-85`): substituir as
  asserções de `--wash`/`--accent-deep` por: `--glow` e `--glow-2` com L
  dentro do piso e contraste ≥ 7:1 com a tinta nas quatro paletas da tabela
  acima, mais uma paleta de papel escuro e uma paleta sem `t` válido que
  devolve o papel; `--accent-glow` mantém `--accent-ink` ≥ 4,5:1;
  `--accent-deep` não é emitido; nenhum token de fundo é mistura com a tinta.
- **Contrato estático do CSS**, `tests/site-gradient-contract.test.mjs`:
  percorre `app/(sites)/*.css` e as miniaturas de `app/(admin)/admin.css`.
  Em toda declaração `background`/`background-image` com `-gradient(`: a
  última parada é `transparent` (radial) ou a regra está na lista de
  exceções; nenhuma parada usa `var(--paper)`, `var(--ink)`, `var(--wash`
  ou `var(--accent-deep)`; `linear-gradient` com exatamente duas paradas
  opacas é recusado. Exceções, cada uma com o seletor e o motivo: scrims de
  `.site-hero-cover`, `mask-image`, grade `data-design-version='2'`, faixas
  `repeating-linear-gradient` do ousado, os fios de 1 px do painel admin. É o
  "nunca mais" em código: uma regra nova com o padrão do Skinão falha o
  `test:sites`.
- **Pixels sob o texto** (`tests/browser/site-visual-system.test.mjs`, CSS do
  build): comercial v4 e `reference`, landing v7 e artístico v4 com `wash`,
  em 1440 e 390 px. O `background-image` computado do hero e do rodapé contém
  `radial-gradient` e não contém `1px`. Depois, uma segunda captura com
  `color: transparent` em todo texto: dentro do retângulo de cada elemento
  de texto visível, todo pixel amostrado tem contraste ≥ 4,5:1 com a cor
  computada do texto. Essa medição entra em `lib/review/capture.ts` como
  `surfaces` e é o mecanismo da Frente 5 do plano de edições visuais;
  `review_pages` (`lib/ai/tools.ts`) trata o achado como erro, ao lado de
  overflow e palavra partida.
- **Cor do operador**: `tests/browser/site-operator-colors.test.mjs` da
  Frente 1, mais o caso `hero.split cover` com `background` escuro, que
  verifica o scrim na cor da seção e a cópia branca legível.
- **Paridade servidor/CSS**: `sectionBackgrounds`
  (`lib/blocks/section-colors.ts:11-22`) passa a devolver `[--paper, --glow]`
  para hero e rodapé com lavagem, como propõe a Frente 2 do plano de edições
  visuais; o teste de paridade compara com o `background` computado.

## 8. Sequência e tamanho

| PR  | Conteúdo                                                                                                         | Efeito                                                                                                               |
| --- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 1   | Frente 1: cascata, scrim na cor da seção, teste de navegador                                                     | No deploy, Skinão, UPTax e Villa Piva Juice mostram a cor gravada, chapada; nenhum rascunho muda                     |
| 2   | Frente 2 e contrato estático: tokens, CSS por vibe, miniaturas, prompt, catálogo, crítica, docs                  | Todo site comercial v3+, landing v7 com `wash` e artístico troca a faixa diagonal pelo brilho radial, só no renderer |
| 3   | Pixels sob o texto na captura, paridade servidor/CSS e o campo `glow`, junto das Frentes 2, 3 e 5 do outro plano | Edição visual termina com medida; o operador ganha um degradê que só existe na técnica correta                       |

Cada PR passa por `npx next typegen && npx tsc --noEmit`, `npm run lint`,
`npm run test:sites`, `npm run test:admin`, `npm run build:vercel` e, com
`EIXU_CHROME_PATH`, `npm run test:sites:browser`, além de capturas em 320,
390, 768, 1024 e 1440 px do hero, de uma seção intermediária, da `cta.band`
e do rodapé, antes e depois. Os PRs 1 e 2 comparam a prévia do Skinão pela
rota autenticada, que só lê o banco. Relate o que foi executado; a ausência
de overflow e o teste de tokens não substituem a leitura das capturas.

Reprodução sem build, como no plano de edições visuais: concatenar
`app/(sites)/*.css` na ordem de `layout.tsx`, montar o DOM mínimo com os
`data-*` reais e ler `getComputedStyle` com `puppeteer-core` e
`/usr/bin/google-chrome`.

## 9. Alcance no que está publicado

Lido no banco em 13/09/2026. O renderer da comercial v3/v4 vale para todo
perfil v3 ou superior renderizado como comercial, com ou sem `wash`:

| Cliente                                 | Vibe renderizada                       | Perfil | Motivo gravado | Muda no PR 2                                                                                       |
| --------------------------------------- | -------------------------------------- | ------ | -------------- | -------------------------------------------------------------------------------------------------- |
| `la-forme-center`                       | comercial                              | 3      | none           | hero e rodapé                                                                                      |
| `escolafisk`                            | comercial                              | 4      | corners        | hero e rodapé                                                                                      |
| `marques-pneus`                         | comercial                              | 5      | none           | hero e rodapé                                                                                      |
| `masterflake`                           | comercial                              | 5      | corners        | hero e rodapé                                                                                      |
| `raizen`                                | comercial                              | 6      | grid → wash    | hero, rodapé e seções `3n`                                                                         |
| `skinaosupermercado`                    | comercial                              | 6      | wash           | seções sem cor do operador                                                                         |
| `uptaxconsultoriatributaria`            | comercial (v6 com estrutura comercial) | 6      | corners        | hero e rodapé                                                                                      |
| `deckdisck`, `villa-piva-juice`         | landing                                | 7      | grid → wash    | hero, rodapé e seções `3n`                                                                         |
| `daniel-carmona`, `grupofisk`, `vivara` | artístico                              | 4–5    | rings/corners  | seção `3n+2` e rodapé                                                                              |
| `portoembalagens`, `skytattoo`          | artístico                              | 2      | rings/corners  | seção `3n+2` e rodapé, porque as regras artísticas de `vibes.css:141-190` não têm guarda de versão |

Ousado, moderno e os demais perfis v2 não mudam. Preservar os dois artísticos
v2 exigiria versionar as regras artísticas, decisão da seção 10.

## 10. Riscos e decisões que ficam com o operador

- **Mudança visual em onze sites publicados no PR 2.** É correção de
  renderer, como o veto à grade e a recriação da moderna, sem recomposição.
  Se algum cliente precisar ser preservado, a alternativa é condicionar a
  receita a `data-design-version` novo, o que mantém a faixa diagonal no ar.
- **Segunda cor do brilho.** Para o Skinão, `--glow-2` sai do destaque
  vermelho e vira um rosa pálido (`#f5cac3`) no canto oposto do hero e na
  seção intermediária. É a mesma lógica da referência (laranja e lilás sobre
  branco), mas a decisão de usar o destaque ou só o acento é do operador. O
  padrão proposto usa as duas; `--glow-2` chapado nas superfícies internas
  segue o mesmo valor.
- **Paleta que não sustenta brilho.** Acento quase branco (`#fffbeb`) ou
  contraste baixo devolve o papel e o fundo fica plano. Comportamento
  esperado, igual ao de `--wash` hoje.
- **Skinão.** O rascunho não muda. Depois do PR 1, rodapé, heroes e faixa de
  prova ficam no vermelho gravado; o scrim do banner passa a vinho em vez de
  preto. As onze seções em amarelo pálido continuam chapadas. Se o operador
  preferir o brilho da vibe em alguma delas, `unset` de `background` pelo
  chat; o degradê por campo só existe depois do PR 3.
- **Malhas em imagem.** Não entram. Se uma vibe futura pedir três ou mais
  cores desfocadas, a alternativa é um SVG inline com `feGaussianBlur` abaixo
  de 2 KB, gerado no servidor a partir dos tokens, em plano próprio.
- **Escopo do outro plano.** Este plano não executa as Frentes 4 a 7 de
  "Edições visuais fiéis pelo chat" (plano ainda não versionado); só emenda a
  Frente 3 e compartilha a medição da Frente 5.
