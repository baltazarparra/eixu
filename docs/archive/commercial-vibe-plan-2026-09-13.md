# Plano: atualização da vibe Comercial

Análise feita em 13/09/2026 sobre o código em produção, `origin/main` no SHA
`143d313` (o mesmo `deployment` registrado nos eventos de geração do cliente
`raizen`), e sobre a prévia desse cliente em `/admin/raizen`. O checkout local
estava 30 commits atrás desse SHA e com alterações de outro agente ainda sem
commit; o plano cita caminhos e linhas de `origin/main`. Implemente a partir
dele, em worktree próprio.

**Estado:** proposta não implementada. O cliente `raizen` é só o exemplo que
tornou os defeitos visíveis; toda mudança abaixo é no gerador, para a vibe
Comercial em qualquer cliente. Nada aqui autoriza regenerar, publicar ou
alterar rascunhos de clientes existentes.

## 1. O que a prévia mostrou e por que o gerador produz isso

| Sintoma na prévia                                                                                     | Causa no código                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Fundo quadriculado no hero e em seções do miolo                                                       | O perfil é v6 guiado pela referência `raizen.com.br` com os seis aspectos. `laneIssues` (`lib/design/vibes.ts:514-524`) libera todos os eixos nesse caso, inclusive `motif`, e o agente gravou `motif: grid`. `site.css:932-937` desenha a grade de 3rem no `.site-hero` e em `main > .site-block:nth-child(3n)` para qualquer `data-motif='grid'`. A faixa comercial nunca teve `grid` (`['none', 'corners']`), e a recriação da moderna tirou o valor da faixa dela, mas nenhum código veta o valor em si. |
| "informaçõe / s ou / atendiment / o?" na faixa de conversão, com metade da largura vazia à direita    | `.site-theme { overflow-wrap: anywhere }` (`site.css:52`) autoriza quebrar qualquer palavra em qualquer ponto. `CtaBand` (`lib/blocks/components.tsx:973`) envolve o título em `max-w-[34ch]` medido na fonte do corpo (cerca de 300 px em 1440 px), enquanto o `h2` usa `--type-title`, até 3,5rem. "informações" a 56 px não cabe em 300 px, e `text-wrap: balance` espalha a quebra pelas quatro linhas.                                                                                                  |
| Nenhum gate acusa a quebra                                                                            | `lib/review/capture.ts` mede overflow horizontal e imagens quebradas; `lib/taste/lint.ts:73` estima linhas por 28 caracteres. Palavra partida no meio não é medida em lugar nenhum.                                                                                                                                                                                                                                                                                                                          |
| Home com cinco seções, 158 palavras, para um cadastro com história de 2.402 caracteres e 8 evidências | A estrutura `comercial-vitrine` (`lib/design/structures.ts:108-128`) fixa cinco marcas e o pre-flight só cobra essa ordem (`estrutura-v5-incompleta`). O prompt diz que "seções úteis podem entrar entre as marcas", mas nada relaciona a riqueza do briefing ao número de seções. `inbound-conteudo` pede 100 palavras. O agente entrega o mínimo que passa.                                                                                                                                                |
| Os blocos que sustentariam essas camadas existem e não aparecem                                       | `proof.strip`, `narrative.statement`, `feature.showcase` e `proof.testimonials` nasceram para a Landing Page (perfil v7). O catálogo não marca papel deles na comercial (`grammarRole`, `lib/blocks/registry.ts:1084`), o CSS deles em `vibes.css:897-1040` foi desenhado para a landing e `FeatureShowcase` assume `vibe = 'landing'` por padrão.                                                                                                                                                           |

O hero comercial tem o mesmo risco tipográfico do título: em v4/v5/v6 a
display cresce até 6,2vw com `max-width: 13ch` (`vibes.css:213-221`), sem os
degraus por comprimento que a vibe artística recebeu em 12/09. Uma headline no
orçamento de 56 caracteres vira quatro ou cinco linhas, e uma palavra de 16
letras como "sustentabilidade" ultrapassa a coluna a 390 px.

## 2. Princípios

- **Proibição em código, não em prompt.** Grade nunca mais entra em perfil
  novo, com ou sem referência. O renderer troca a grade de perfis existentes
  pelo degradê, como a recriação da moderna e a correção do filmstrip já
  alcançaram sites publicados sem recompor blocos.
- **Palavra inteira em todo lugar.** Título, subtítulo, botão e rótulo não
  quebram no meio da palavra em nenhuma vibe, largura ou versão de perfil. Um
  texto que não cabe fica menor ou ganha largura; se ainda assim não couber,
  ele transborda de forma visível e medida, em vez de quebrar em silêncio.
- **Conteúdo proporcional ao cadastro.** O número de seções da home passa a ser
  medido a partir do briefing. Camada nova só entra com fato confirmado em
  `brief.evidence`; cadastro pobre continua gerando home enxuta.
- **Sem afrouxar gates.** Nenhuma regra existente é relaxada para aceitar uma
  geração. Regras novas nascem bloqueantes na geração e são classificadas em
  `lib/sites/publication-policy.ts` como editoriais na publicação, como as
  demais regras de composição.

## 3. Frente 1: fundo sem grade, degradê discreto

### Contrato

- `lib/design/profile.ts`: o enum de `motif` ganha `wash` e a leitura continua
  aceitando `grid` só para perfis já gravados. `designSchemaFor` recusa `grid`
  em qualquer gravação nova, com mensagem que aponta `wash` ou `none`.
- `lib/design/vibes.ts`: `MOTIFS_VETADOS = ['grid']`, verificado em
  `laneIssues` antes de qualquer liberação por aspecto. A faixa comercial passa
  a `motif: ['none', 'wash']`; a landing troca `grid` por `wash`; moderno,
  ousado e artístico não mudam. `VIBE_DIRECTION.comercial` descreve o degradê:
  cor da marca a até 8% sobre o papel, na abertura e em uma seção do miolo, sem
  linha, textura ou padrão repetido.
- `renderedMotif(brand)`, na mesma pasta: devolve o `motif` gravado, exceto
  `grid`, que vira `wash` em perfis v3 ou superiores. Perfil v2 conserva `grid`
  (só o moderno `neidemarialimpeza` está nesse caso; ver seção 7).
  `app/(sites)/s/[tenant]/[[...slug]]/page.tsx:224` emite `data-motif` por essa
  função.

### Cor medida, não estimada

- `lib/blocks/theme.ts` calcula `--wash` (`mixHex(paper, accent, 0.07)`) e
  `--wash-2` (`mixHex(paper, accentAlt, 0.09)`), cada um só se
  `contrastRatio(ink, wash) >= 4.5`; senão vale o papel. Emite também
  `--muted-wash` por `readableMuted(ink, wash)`, porque o texto de apoio sobre a
  lavagem precisa do próprio valor medido, como já acontece com `--muted-soft`.
- Para a faixa de conversão em tom `accent`, `--accent-deep` é
  `mixHex(accent, ink, 0.12)`; o token só existe quando `--accent-ink` mantém
  4,5:1 contra os dois extremos do degradê. Sem isso o token vale o próprio
  `accent` e a faixa fica plana.

### CSS

- `app/(sites)/site.css`: a regra de `data-motif='grid'` (linhas 932-937) fica
  restrita a `[data-design-version='2']`. Nova regra `data-motif='wash'`, para
  todas as vibes: `.site-hero` recebe
  `linear-gradient(160deg, var(--wash), var(--paper) 62%)`;
  `main > .site-block:not([data-tone]):nth-child(3n)` recebe
  `linear-gradient(180deg, var(--paper), var(--wash-2))`. Sem `background-size`,
  sem gradiente de 1px.
- `app/(sites)/vibes.css`, bloco comercial v3/v4 (que também atende v5 e v6
  pelo mapeamento de `data-design-version`): o hero e o rodapé recebem a
  lavagem mesmo com `motif: none`, em intensidade menor; `cta.band` em tom
  `accent` usa `linear-gradient(135deg, var(--accent), var(--accent-deep))`;
  o painel do explorer usa `--wash-2` no lugar da superfície plana. Cantos,
  espessura do fio superior dos cards e escala continuam como estão.
- `app/(admin)/admin.css:1060-1072`: a miniatura da vibe comercial no
  cadastro mostra a mesma lavagem, para o operador ver o que a vibe entrega.

### Verificação

- `tests/site-vibe-regressions.test.mjs`: "nenhuma vibe aceita grid, mesmo com
  referência completa", no molde do teste da moderna (linha 557): `laneIssues`
  com os seis aspectos e `motif: 'grid'` devolve o veto; `renderedMotif` mapeia
  `grid` para `wash` em v4, v5 e v6 e preserva em v2; `designSchemaFor` recusa
  a gravação.
- `tests/site-visual-system.test.mjs`: `themeVars` emite `--wash`, `--wash-2`,
  `--muted-wash` e `--accent-deep` com contraste medido, inclusive para paletas
  em que a mistura precisa cair no papel ou no acento plano.
- `tests/browser/site-visual-system.test.mjs`: o `background-image` computado
  do hero comercial contém `linear-gradient` e nenhum `1px`; amostra de
  contraste do texto de apoio sobre a lavagem, como `site-contrast.test.mjs`
  já faz para as superfícies.
- Captura local do cliente `raizen` pela rota de prévia autenticada, antes e
  depois, em 1440 e 390 px. A rota só lê o banco; não grava nada.

## 4. Frente 2: palavras inteiras

### CSS

- `site.css:52`: `.site-theme` passa de `overflow-wrap: anywhere` para
  `break-word`. A diferença é a largura mínima: com `anywhere`, colunas de
  grade e flex encolhem até zero e qualquer palavra vira candidata a quebra;
  com `break-word`, a coluna não fica mais estreita que a maior palavra. O
  `anywhere` continua explícito onde é intencional: marca e links do menu
  compacto (`navigation.css:144, 178, 191`), endereços, e-mails e URLs dos
  contatos e do rodapé.
- `typography.css`: `h1`, `h2`, `h3`, `.site-headline`, `.site-h2`,
  `.site-explorer-heading h2`, `.site-signature h3`, `blockquote`,
  `.site-action` e `.site-nav-link` recebem `overflow-wrap: normal` e
  `hyphens: manual`. `text-wrap: balance` continua nos títulos.
- Degraus por comprimento no hero comercial, como a artística já tem:
  `short` (até 24 caracteres) mantém 6,2vw e 13ch; `medium` (até 40) usa 5vw e
  16ch; `long` usa 3,8vw e 20ch. Com isso o orçamento de 56 caracteres cabe em
  três linhas a 1440 px.
- `data-long-word`: quando a maior palavra do título tem 12 caracteres ou
  mais, a display cai um degrau, o piso do `clamp` desce a 2,4rem e a
  `max-width` cresce 3ch. É o que faz "sustentabilidade" caber em 390 px sem
  quebrar.

### Componentes

- `lib/blocks/components.tsx`: `headlineScale` passa a devolver também a
  maior palavra; `HeroSplit`, `HeroStatement`, `hero.landing` e `CtaBand`
  emitem `data-long-word` por um helper único.
- `CtaBand` (linha 973): o `max-w-[34ch]` sai do invólucro. O `h2` recebe
  `max-w-[20ch]` na própria fonte e o parágrafo `max-w-[44ch]`. No layout
  `split`, o `shell` vira grade `minmax(0, 1.4fr) auto` para o texto ocupar a
  largura que hoje fica vazia; o botão continua alinhado ao fim.
- Auditoria dos demais `max-w-[Nch]` do arquivo (linhas 798, 1478, 1836 e
  afins): só permanecem quando aplicados ao próprio elemento de texto, nunca a
  um invólucro com fonte menor que o título.

### Medição

- `lib/review/text.ts`, no molde de `lib/review/navigation.ts`:
  `inspectText(page)` percorre títulos, botões, rótulos e legendas, cria um
  `Range` por palavra e conta as que ocupam mais de uma linha
  (`getClientRects()` com topos distintos). Devolve
  `{ brokenWords: { page, viewport, selector, word }[] }`.
- `lib/review/capture.ts`: `Shot` ganha `text`, preenchido nas duas viewports
  depois de `document.fonts.ready`.
- `lib/ai/tools.ts:1368`: `review_pages` trata `brokenWords` como erro, ao
  lado de overflow e imagem quebrada, e o texto que acompanha cada captura na
  crítica lista as palavras. `docs/harness.md` e `docs/design.md` registram que
  palavra partida impede a conclusão da análise visual solicitada.
- Fora da geração, a captura de `npm run test:sites:browser` reutiliza a
  mesma função pelas fixtures.

### Verificação

- `tests/site-contract.test.mjs`: `headlineScale` e o helper de palavra longa
  com casos em português ("Precisa de informações ou atendimento?",
  "Energia sustentável e impacto positivo", "Responsabilidade socioambiental").
- Novo `tests/browser/site-word-breaks.test.mjs`, na infraestrutura de
  `site-ui-regressions.test.mjs`: renderiza `cta.band` em `band`, `split`,
  `poster` e `minimal` com os títulos acima, o hero comercial com headline de
  56 caracteres e o de 16 letras numa palavra, e `signature.composition`
  `service-lens`, em 320, 390, 768, 1024 e 1440 px. Zero palavras quebradas e
  zero overflow em todas as combinações, com o CSS do build.
- As fixtures existentes das quatro vibes e da landing passam pela mesma
  medição, porque a troca de `anywhere` por `break-word` muda a largura mínima
  de colunas em todo o site. Capturas antes e depois em 320 e 390 px.

## 5. Frente 3: home proporcional ao conteúdo

### Medir a profundidade do briefing

`lib/taste/metrics.ts` ganha `briefDepth(brief)`, determinístico:

| Sinal                                        | Fonte                            |
| -------------------------------------------- | -------------------------------- |
| Evidências confirmadas                       | `brief.evidence.length`          |
| Evidências com número, percentual ou quantia | `brief.evidence` com dígitos     |
| Tamanho da história                          | `brief.intake.story.length`      |
| Páginas do plano editorial                   | `brief.pagePlan.length`          |
| Fotos disponíveis na biblioteca              | `availablePhotos(images).length` |

`homeSectionFloor(structure, depth)` parte do tamanho da sequência mínima da
estrutura (cinco) e soma uma seção quando há quatro ou mais evidências, outra
quando há seis ou mais evidências com pelo menos duas numéricas ou história
acima de 1.500 caracteres, com teto de oito. O piso de palavras da home
acompanha: 180 com seis seções, 220 com sete ou mais. Para o cadastro do
exemplo, o piso seria sete seções: duas a mais que a home gerada.

### Camadas de aprofundamento por estrutura

`lib/design/structures.ts`: cada estrutura comercial declara `expansions`, uma
lista de `tipo:layout` com a condição que o pre-flight consegue verificar.

| Estrutura               | Camada                        | Entra quando                                     | O que traz para a home                                        |
| ----------------------- | ----------------------------- | ------------------------------------------------ | ------------------------------------------------------------- |
| `comercial-vitrine`     | `proof.strip:numbers`         | duas ou mais evidências numéricas                | Faixa de números logo após o hero, cada item citando evidence |
| `comercial-vitrine`     | `narrative.statement:split`   | evidência que descreva benefício ou resultado    | A promessa confirmada em uma frase grande, antes do explorer  |
| `comercial-vitrine`     | `editorial.facts:ledger`      | evidência sobre onde atende, unidades ou marcas  | Pares rótulo e valor depois dos recursos                      |
| `comercial-vitrine`     | `proof.testimonials:grid`     | depoimento literal em evidence                   | Duas a três citações confirmadas                              |
| `comercial-atendimento` | `narrative.steps:horizontal`  | história descreve etapas do atendimento          | Como funciona, entre o percurso e a composição autoral        |
| `comercial-atendimento` | `proof.strip:numbers`         | duas ou mais evidências numéricas                | Números antes das dúvidas                                     |
| `comercial-atendimento` | `proof.testimonial:spotlight` | depoimento literal em evidence                   | Um depoimento em destaque                                     |
| `comercial-confianca`   | `proof.strip:logos`           | três ou mais marcas ou clientes em evidence      | Faixa de marcas sob o hero                                    |
| `comercial-confianca`   | `feature.showcase:tabs`       | três ou mais fotos disponíveis além das cenas    | Produto ou serviço em uso, com seleção por teclado            |
| `comercial-confianca`   | `editorial.facts:ledger`      | evidência sobre estrutura, cobertura ou horários | Fatos verificáveis antes da composição autoral                |

Só camadas cuja condição está satisfeita entram no pedido e na mensagem de
erro; sem evidência, a camada não existe para aquele cliente. Os itens de
`proof.strip` e `proof.testimonials` já exigem `evidence` copiada de
`brief.evidence`, e as pendências de prova em `lib/taste/pendencias.ts`
continuam valendo.

### Regra, prompt e catálogo

- `lib/taste/metrics.ts`: regra `home-rasa`, erro em perfis v5 e v6 com
  estrutura comercial, quando a home tem menos seções de conteúdo que o piso.
  A mensagem diz quantas seções e palavras a home tem, quantas o briefing
  sustenta e quais camadas estão disponíveis, na ordem em que cabem entre as
  marcas. `lib/sites/publication-policy.ts` classifica `home-rasa` como
  editorial, para virar recomendação na publicação solicitada.
- `lib/taste/site.ts`: `inbound-conteudo` lê o piso de palavras da home a
  partir da mesma medida, sem mudar as páginas internas.
- `lib/design/vibes.ts`, `grammarDirection`: uma linha com o piso calculado e
  as camadas disponíveis para este cliente, em todas as fases com composição e
  na crítica. `lib/blocks/registry.ts`, `grammarRole`: os blocos das camadas
  aparecem no catálogo com `[vibe: aprofundamento da home em …]`, como já
  ocorre com abertura, protagonista e fechamento.
- `lib/taste/prompt.ts`, briefing de composição: a home responde ao tamanho do
  cadastro; briefing amplo sem as camadas é recusado pelo pre-flight, e camada
  sem fato confirmado é pendência de prova.
- `lib/review/critic.ts`: o critério `ritmo` passa a considerar home com menos
  seções do que o briefing sustenta como erro material, com a medida no
  contexto enviado ao crítico.

### Cenas e fotos

- `lib/images/scene-plan.ts`: quando a profundidade for ampla e o plano tiver
  menos de seis cenas, entra uma cena `apoio` para a home no alvo
  `narrative.split` (5:6). O teto de `imageScenes` continua seis.
- Camadas com foto (`feature.showcase`, `narrative.split`) só ficam
  disponíveis quando a biblioteca tem fotos além das cenas planejadas,
  inclusive enviadas e importadas do Site atual. As demais camadas são de texto
  e número, e não pedem geração paga.

### CSS da vibe para as camadas

- `app/(sites)/vibes.css`, bloco comercial: `proof.strip:numbers` com
  numerais na display, sublinhado de 2px no acento e a lavagem `--wash-2`;
  `narrative.statement` com `--type-title`, eyebrow no acento e largura de
  leitura de 24ch; `editorial.facts:ledger` com o fio superior no acento, como
  os cards da vibe. `feature.showcase` recebe a vibe pelo `RenderContext` em
  `lib/blocks/render.tsx`, no lugar do padrão `landing`.
- Tudo passa pelo contrato de `lib/design/responsive.ts` e pela medição de
  palavras inteiras em 320 e 390 px.

### Verificação

- `tests/site-structures.test.mjs`: briefing amplo com a home mínima devolve
  `home-rasa` com as camadas certas; a mesma home com `proof.strip` citando
  evidence e `narrative.statement` passa; briefing com duas evidências e
  história curta não recebe a regra. Cada camada de cada estrutura aponta tipo
  e layout existentes no catálogo, no mesmo laço que já valida a gramática.
- `tests/site-pendencias.test.mjs`: `proof.strip` com item sem evidence
  correspondente continua pendência de prova; `home-rasa` vira recomendação na
  publicação.
- `tests/site-scenes.test.mjs`: o plano acrescenta a cena `apoio` só com
  profundidade ampla e nunca passa de seis.
- `evals/cases/energia.json`, sintético: história de cerca de 2.000
  caracteres, oito evidências com números, cinco páginas. `npm run eval:site`
  com esse caso comprova a composição de ponta a ponta; chama modelo e grava em
  tenant `eval-*`, então depende de autorização.

## 6. Sequência e tamanho

| PR  | Conteúdo                                                                 | Efeito                                                                                                                                         |
| --- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Frente 2 inteira e a parte de renderer da Frente 1 (veto, `wash`, CSS)   | Depois do deploy, `raizen` e `villa-piva-juice` perdem a grade e todas as vibes perdem as palavras partidas, sem tocar em rascunho ou snapshot |
| 2   | Frente 3: profundidade, camadas, regra, prompt, cenas, CSS das camadas   | Sites novos e recomposições passam a sair com a home no tamanho do cadastro; sites existentes só mudam por recomposição solicitada             |
| 3   | Documentação e, se autorizado, recomposição de um cliente para comprovar | `docs/design.md`, `harness.md`, `verification.md`, `eval-rubric.md` e `plano-vibes-unicas.md` recebem os contratos e a medição nova            |

Cada PR passa por `npx next typegen && npx tsc --noEmit`, `npm run lint`,
`npm run test:sites`, `npm run test:admin`, `npm run build:vercel` e, com
`EIXU_CHROME_PATH`, `npm run test:sites:browser`, além das capturas em 320,
390, 768, 1024 e 1440 px descritas em cada frente. O PR 1 também compara a
prévia de `raizen` antes e depois. Relate o que foi executado; captura,
fixture e ausência de overflow não substituem a leitura das capturas.

## 7. Riscos e decisões que ficam com o operador

- **Quem tem grade hoje.** Conferido no banco em 13/09/2026: `raizen`
  (comercial, v6), `villa-piva-juice` (landing, v7) e `neidemarialimpeza`
  (moderno, v2), todos publicados. Os dois primeiros recebem o degradê no
  deploy do PR 1 pelo `renderedMotif`, sem recomposição. O plano preserva a
  grade no v2, como a recriação da moderna decidiu. Se "jamais" incluir esse
  site, `renderedMotif` mapeia também v2 e o site publicado muda; a decisão
  precisa ser explícita.
- **Raizen.** O PR 1 corrige fundo e tipografia da prévia atual sem alterar o
  rascunho. As camadas de conteúdo exigem recomposição por `build_site` ou
  inserções pelo chat, com chamadas pagas ao modelo; as fotos já geradas são
  reaproveitadas. Não há regeneração automática.
- **Transbordo em vez de quebra.** Com `overflow-wrap: normal` nos títulos, uma
  palavra que não couber transborda e é medida como overflow e como palavra
  partida. A troca de `anywhere` por `break-word` na raiz muda a largura mínima
  de colunas em todas as vibes; por isso as fixtures existentes entram na
  medição e as capturas em 320 px são obrigatórias no PR 1.
- **Contraste sobre degradê.** Os tokens de lavagem e de acento profundo só
  existem quando a medição passa; paletas do operador que não sustentem o
  degradê ficam planas. Isso é comportamento esperado, não regressão.
- **Camadas sem fato.** Um cadastro amplo em texto mas sem evidência numérica
  ou depoimento recebe piso menor, porque só camadas com condição satisfeita
  contam. O plano não aceita número, marca ou depoimento sem `evidence`.
- **Cenas.** `set_design` monta o plano com três páginas orgânicas: cinco
  vagas, seis com hero atelier. A cena `apoio` ocupa a sexta vaga, livre na
  comercial porque o atelier não pertence à faixa dela. Em perfil v6 cuja
  referência escolheu o atelier, a vaga já está tomada e as camadas com foto
  dependem de upload ou de fotos importadas do Site atual.
- **Escopo das outras vibes.** O veto à grade e as palavras inteiras valem
  para todas as vibes. As camadas de aprofundamento entram só nas três
  estruturas comerciais; moderno, ousado e artístico ganham `expansions` em
  plano próprio, depois de medir a mesma relação entre briefing e home.
