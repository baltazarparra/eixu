# Plano: cada vibe com estrutura e experiência próprias

Análise feita em 12/09/2026 sobre o código em `main` e sobre os tenants
`chiquinho` (vibe artístico) e `tech` (vibe ousado) no banco de produção. O
documento registra o diagnóstico com evidência e o plano de implementação em
fases.

**Estado:** o PR 1, com as fases 0, 1 e 2, está implementado e verificado. O
contrato resultante vive em [Design](design.md); a verificação, em
[Verificação](verification.md). As fases 3 a 7 continuam pendentes e mantêm a
descrição abaixo como escrita. Em 12/09/2026 a recriação da vibe moderna
cumpriu, só para essa vibe e sem blocos novos, a parte de CSS da fase 3 (fio
entre capítulos, painéis com fade, pílula) e os rótulos em mono da fase 4; ver
[Recriação da vibe moderna](design.md#recriação-da-vibe-moderna).

## 1. Diagnóstico

### O que saiu igual

| Item                     | chiquinho (artístico)                                                 | tech (ousado)                                                       |
| ------------------------ | --------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Referências verificadas  | gelatoborelli.com.br (leitura visual ok)                              | 14islands.com (leitura visual ok)                                   |
| Eixos gravados           | editorial, source, split, bar, alternating, framed, flat, none, md    | geometric, sans, editorial, minimal, continuous, framed, flat, none |
| Eixos fora da faixa      | 5 de 8, mais o raio                                                   | 6 de 8                                                              |
| `data-vibe` renderizado  | `comercial`                                                           | `comercial`                                                         |
| `data-design-version`    | `reference`                                                           | `reference`                                                         |
| Plano de cenas           | hero, explorer, explorer, narrative.split, media.image                | hero, explorer, explorer, narrative.split, media.image              |
| Esqueleto da home        | hero.split › explorer showroom › facts split › faq split › cta band   | hero.split › explorer showroom › facts split › faq split › cta band |
| Esqueleto das subpáginas | hero.statement left › media.image wide ou narrative.split split › ... | hero.statement left › narrative.split split › ...                   |

As duas homes têm os mesmos cinco blocos de conteúdo, nos mesmos layouts e na
mesma ordem. Só o tom (`presentation.tone`) muda, e é isso que faz a
assinatura de composição passar no gate de duplicidade.

### Causas, em ordem de peso

1. **O plano de cenas fixa os blocos.** `scenePlan()` em
   `lib/images/scene-plan.ts` sempre pede hero, duas cenas 4:3 para
   `feature.explorer`, uma 5:6 para `narrative.split` e uma 16:9 para
   `media.image`, independente da vibe. As fotos nascem com `target_block`
   gravado, a cobertura casa bloco e proporção, e o aviso `imagem-proporcao`
   penaliza usar a foto em outro lugar. A composição recebe uma biblioteca
   rotulada "explorer, explorer, narrative.split, media.image" e monta
   exatamente isso. O prompt de composição e a mensagem de erro
   `home-protagonista` ainda citam `feature.explorer` primeiro.
2. **Referência verificada apaga a vibe de ponta a ponta.** Com qualquer
   leitura visual válida, `set_design` pula `laneIssues` e o agente escolhe
   os eixos mais neutros (framed, flat, none, split ou editorial, bar ou
   minimal). Em seguida `renderingVibeOf` devolve `comercial`, então
   `vibes.css`, o estilo de ícone, o tom da localização e a lavagem artística
   somem. A vibe sobrevive só na voz do texto. Os dois tenants tinham
   referência, e os dois renderizaram a base neutra.
3. **Os eixos são cosméticos no renderer.** `rhythm`, `surfaceStyle`,
   `imageTreatment` e `motif` viram poucas linhas de CSS em `site.css`
   (fundo alternado, raio zero, rotação de 1,5°, gradiente de grade, um anel
   em pseudo-elemento). As seis composições de hero compartilham o mesmo DOM
   com ajustes de CSS; `offset` é um `translateY`, `editorial` reordena a
   cópia. As variantes de `layout` dos demais blocos são do mesmo tipo.
4. **O catálogo não tem blocos próprios de vibe.** São 24 tipos, todos
   compartilhados. Não existe seção que só faça sentido em ousado, moderno ou
   artístico. Dois sites de vibes diferentes podem repetir o mesmo esqueleto,
   porque a distância de eixos compara só dentro da mesma vibe e a trava de
   home compara só igualdade exata.
5. **Tipografia com um peso por família.** `DISPLAY_TYPE` grava um único
   `weight`, `leading` e `tracking` por família. Não há itálico de display
   fora do artístico v3, caixa alta de display, mistura de pesos no título,
   nem uso dos eixos variáveis (Fraunces opsz/SOFT, Syne até 800, Bodoni
   Moda opsz). Rótulos são sempre corpo 600 com tracking 0,1em.
6. **Ícones em um tom, poucos símbolos, poucos lugares.** 26 nomes, quatro
   pesos por vibe, duotone só no artístico e com a segunda camada na mesma cor
   a 20% de opacidade. O gesto de hover é uma translação. Ícones aparecem só
   em listas, setas, check e o mais do FAQ.
7. **Estilo de imagem é uma frase por vibe.** `VIBE_IMAGE_DIRECTION` tem uma
   linha, e o tratamento chega ao renderer apenas no hero e no `padding` de
   `main img`.

## 2. Princípios do plano

- A vibe é uma **gramática estrutural garantida em código**: plano de cenas,
  catálogo disponível, gate de direção, renderer e métricas. Prompt orienta;
  não sustenta sozinho.
- Referência verificada **modula** a vibe por aspecto (layout, tipografia,
  imagens, ritmo). Ela não devolve o site à base comercial.
- Variação vem de **DOM diferente**, não só de CSS. Blocos novos entram com
  schema, catálogo, renderizador, componente, proporção e pre-flight, como
  manda o contrato de `lib/blocks/` e `lib/taste/`.
- Sites publicados não mudam sozinhos. O comportamento novo entra sob a
  versão 4 do perfil de design; v2 e v3 preservam a apresentação atual.
- Fatos, contraste AA, linguagem simples, acessibilidade e movimento reduzido
  continuam obrigatórios em toda vibe.

## 3. Fases

### Fase 0. Medir a silhueta

Objetivo: ter um número que mostre o problema antes e depois.

- `lib/taste/metrics.ts`: `siteMetrics` passa a expor `silhouette` (sequência
  `tipo:layout` da home, sem tom) e `structuralFindings` ganha a comparação
  entre tenants com similaridade de Jaccard sobre pares tipo:layout. A trava
  atual de igualdade exata em `lib/design/uniqueness.ts` vira a base dessa
  medida, com corte em 0,8 e comparação entre todas as vibes.
- `scripts/eval-site.mjs` e `docs/eval-rubric.md`: o relatório imprime a
  silhueta e a distância contra os tenants existentes. Linha de base:
  chiquinho e tech empatam em 5 de 5 blocos.

Verificação: teste unitário da métrica em `tests/site-contract.test.mjs`
usando as duas homes de produção como fixture sintética.

### Fase 1. Vibe como gramática estrutural

Objetivo: tornar impossível que duas vibes gerem a mesma sequência.

- `lib/design/vibes.ts`: cada faixa ganha `grammar` com aberturas permitidas,
  blocos protagonistas permitidos, aberturas de subpágina, fechamentos e
  layouts preferidos ou vetados por bloco. Exemplo de intenção, a calibrar
  na implementação:

  | Vibe      | Abertura                                                       | Protagonista                                                 | Fechamento                        |
  | --------- | -------------------------------------------------------------- | ------------------------------------------------------------ | --------------------------------- |
  | comercial | hero.split split ou cover                                      | feature.explorer showroom, feature.bento gallery             | cta.band band, form.lead          |
  | moderno   | hero.split editorial, hero.statement framed                    | feature.bento showcase, narrative.chapter, explorer panorama | cta.band minimal, proof.manifesto |
  | ousado    | hero.statement oversize + media.image bleed, hero.split poster | media.gallery collage full, media.ticker, media.image bleed  | cta.band poster                   |
  | artistico | hero.split atelier ou offset                                   | media.collage, narrative.split overlap, hero atelier         | cta.band split, faq cards         |

- `lib/images/scene-plan.ts`: `scenePlan(design, vibe, pages)` deriva
  `targetBlock` e proporção da gramática, não da lista fixa. O total continua
  entre 5 e 6 cenas. `sceneRequestsMatchPlan` e `sceneCoverage` não mudam de
  contrato.
- `lib/blocks/registry.ts`: `catalogForPrompt({ vibe })` lista primeiro os
  blocos e layouts da gramática e marca os demais como "fora da vibe". O
  schema continua aceitando tudo; a recusa é do pre-flight.
- `lib/taste/metrics.ts`: novas regras. `silhueta-generica` (erro): a home
  precisa de pelo menos dois blocos do conjunto assinatura da vibe.
  `layout-fora-da-vibe` (aviso, erro quando sem referência): bloco ou layout
  vetado pela gramática. `silhueta-repetida` (erro): similaridade acima do
  corte contra qualquer outro tenant, em qualquer vibe.
- `lib/taste/prompt.ts` e `VIBE_DIRECTION`: a direção vira gramática com
  duas ou três silhuetas válidas por vibe, em vez de uma receita única. A
  mensagem de `home-protagonista` deixa de citar `feature.explorer` como
  primeira opção.

Verificação: `tests/site-contract.test.mjs` (plano de cenas por vibe,
gramática, novas regras), `tests/site-visual-system.test.mjs` (faixas), e a
métrica da fase 0 mostrando silhuetas distintas para os três casos de
`evals/cases/` em cada vibe.

### Fase 2. Referência modula, não apaga

Objetivo: manter a prioridade das referências sem perder a vibe.

- `lib/design/vibes.ts`: `renderingVibeOf` devolve `brand.vibe` quando o
  perfil é versão 4. O fallback para `comercial` fica restrito a perfis v2 e
  v3 com `referenceDirection`, para não alterar o que já está publicado.
- `app/(sites)/s/[tenant]/[[...slug]]/page.tsx`: além de `data-vibe`, expõe
  `data-reference-aspects` com os aspectos cobertos pela referência
  (`layout`, `typography`, `imagery`, `rhythm`). `vibes.css` desliga só as
  regras radicais do aspecto coberto.
- `lib/ai/tools.ts` (`set_design`): com referência, a faixa vira flexível
  por aspecto. Um eixo só pode sair da faixa se `referenceDirection` traz
  decisão com traço observado e aplicação naquele aspecto. Motivo, estilo de
  ícone e voz continuam da vibe. A distância entre perfis passa a ser
  informativa em qualquer caso, e a trava de silhueta da fase 1 assume o
  papel de unicidade.
- `lib/review/critic.ts`: o crítico recebe a gramática da vibe e os aspectos
  cobertos pela referência, e ganha o critério `identidade-da-vibe` (erro
  quando a home lê como base neutra sem justificativa por referência).

Verificação: reescrever em `tests/site-references.test.mjs` o teste "renderer
não aplica lavagem nem preset da vibe antiga" para o novo contrato por
aspecto; manter os testes de fonte inacessível, texto sem pixel e URL
removida.

### Fase 3. Renderer com silhuetas reais

Objetivo: layouts que mudam o DOM, e blocos que só existem em algumas vibes.

- Heroes em componentes próprios em `lib/blocks/components.tsx`, um por
  composição: `cover` com imagem de borda a borda e texto sobreposto;
  `poster` com bloco de cor e recorte; `editorial` com título acima e foto
  16:9 abaixo, margem alta; `offset` com cartão sobreposto real; `atelier`
  com duas figuras; `split` como hoje. O schema não muda; muda o que cada
  layout renderiza.
- Blocos novos, cada um com schema, `blockMeta.use`, renderizador, componente,
  proporção em `ratios.ts`, ícone e cobertura no pre-flight:

  | Bloco               | Vibes              | O que é                                                                               |
  | ------------------- | ------------------ | ------------------------------------------------------------------------------------- |
  | `media.ticker`      | ousado             | Faixa horizontal de palavras ou serviços; estática sem JS, movimento só com dial alto |
  | `proof.manifesto`   | moderno            | Declarações numeradas em escala grande, numeral em mono, linha de 1px                 |
  | `media.collage`     | artistico          | Três a cinco fotos com rotação, legenda e sobreposição; realiza motif rings/corners   |
  | `feature.cards`     | comercial          | Grade de serviços com ícone duotone em destaque, fundo suave, cantos do raio da marca |
  | `narrative.chapter` | moderno, artistico | Número de capítulo, texto e foto 16:9, um capítulo por seção                          |

  Cinco blocos são o teto desta fase; cada um precisa passar pelas mesmas
  verificações de contraste, teclado e movimento reduzido dos blocos atuais.

- `app/(sites)/vibes.css`: quatro sistemas completos, não ajustes: respiro
  entre seções, divisores, colunas de grade, máscara e moldura das fotos
  (mancha orgânica no artístico, corte reto no ousado, fio no moderno, mat
  suave no comercial). `data-imagery` passa a valer para toda mídia, não só
  para o hero.
- Compatibilidade: `data-design-version='4'` protege as novas regras; v2 e
  v3 preservam o CSS atual.

Verificação: `tests/browser/site-*.test.mjs` fotografa o mesmo briefing
sintético nas quatro vibes em 1440 e 390 px, sem gerar imagem nem chamar
modelo, e o relatório compara as silhuetas. O antigo laboratório de três
clientes sintéticos citado em `docs/design.md` não existe mais no repositório
(`app/(sites)/design-lab` e `creative-preview` estão vazios); esta fase o
recria como fixture de teste, não como rota do produto.

### Fase 4. Tipografia mais ousada e variada

Objetivo: escala, peso e estilo diferentes por vibe e por papel.

- `lib/design/typography.ts`: cada família de display ganha perfil com faixa
  de pesos, itálico, tamanho óptico e permissão de caixa alta, além de
  ajustes por papel (`h1`, `h2`, `eyebrow`, `stat`, `quote`, `label`). Um
  terceiro papel `label` pode usar família própria (Geist Mono no moderno,
  Barlow Condensed no ousado, itálico serifado no artístico).
- `lib/design/profile.ts`: eixo novo `headlineStyle` (`plain`,
  `italic-accent`, `uppercase`, `mixed-weight`) com valores permitidos por
  vibe. `hero.split` e `hero.statement` ganham `emphasis` opcional: trecho do
  título renderizado em itálico, peso alternativo ou cor de acento. O
  pre-flight confere que o trecho existe no título.
- `app/(sites)/layout.tsx`: carregar as faixas de peso realmente usadas
  (variáveis onde a família permite; Barlow Condensed 500 a 900; corpo 400,
  500 e 600). `preload: false` continua.
- `app/(sites)/typography.css` e `vibes.css`: escala por vibe. Ousado até
  13vw e rótulos em caixa alta; moderno com rótulos em mono e numerais
  tabulares; artístico com display itálico e lead maior; comercial com slab
  ou humanista 700 nos títulos e 500 nos subtítulos.
- `lib/blocks/theme.ts`: emitir as variáveis por papel; `--display-weight`
  deixa de ser um único número.

Verificação: `tests/site-visual-system.test.mjs` (schema, tokens e legados),
medição de contraste em `tests/site-contrast.test.mjs` para os novos pesos
leves sobre fundos coloridos, e a captura da fase 3.

### Fase 5. Ícones em duas cores, mais símbolos, mais lugares

Objetivo: iconografia como assinatura da vibe, com microinteração.

- `lib/design/iconography.ts`: ampliar `ICON_NAMES` de 26 para cerca de 60,
  agrupados por domínio (alimentação, saúde, casa, beleza, automotivo,
  educação, finanças, tecnologia, natureza, comércio). Continua enum; o agente
  nunca envia SVG.
- Duotone em duas cores: o Phosphor renderiza a camada secundária como
  `path` com `opacity` 0.2. `iconography.css` passa a pintar essa camada com
  `--icon-secondary`, resolvido por tom de seção em `theme.ts` com contraste
  medido, para toda vibe que a gramática autorizar: comercial suave, moderno
  leve com acento, ousado cheio com bloco de cor, artístico orgânico.
- `lib/blocks/motion.tsx`: presets por vibe, sem laço infinito: entrada do
  selo, deslize da camada secundária, traço desenhado no foco. Movimento
  reduzido desliga tudo e preserva estados.
- Ícones em mais blocos: `proof.stats`, `narrative.steps`, `editorial.facts`,
  `faq.accordion`, `cta.band`, selos do hero e contatos do rodapé recebem
  `icon` opcional pelo mesmo enum.

Verificação: os testes de SSR e de schema em `tests/site-visual-system.test.mjs`
cobrem os novos nomes, a segunda camada e a ausência de tab stop; a captura
da fase 3 confere o estado de foco.

### Fase 6. Estilo de imagem por vibe

Objetivo: fotos que pareçam da vibe e tratamentos que o renderer realize.

- `lib/design/vibes.ts`: `VIBE_IMAGE_DIRECTION` vira objeto estruturado (luz,
  lente, tratamento de cor, enquadramento, pós-processamento) e por
  tratamento de imagem. `define_image_guide` parte desse objeto e o plano de
  cenas repassa a dica de enquadramento certa para os novos blocos (colagem
  1:1 e 4:5, capítulo 16:9, ticker sem foto).
- Renderer: tratamentos por `data-imagery` e vibe em toda mídia: sobreposição
  em duas cores no ousado, grão quente e máscara orgânica no artístico,
  dessaturação fria e fio no moderno, natural no comercial. Sempre via CSS,
  sem reprocessar a foto.

Verificação: `tests/site-scenes.test.mjs` e `tests/site-images.test.mjs` para
o plano e as proporções; a captura visual para os tratamentos.

### Fase 7. Prompt, crítica e métricas fechando o ciclo

- `lib/taste/prompt.ts`: o catálogo por fase lista primeiro os blocos da
  vibe; a seção de composição descreve as silhuetas válidas e cita a métrica
  de silhueta como gate.
- `lib/review/critic.ts`: recebe silhueta, gramática e aspectos de
  referência; julga `identidade-da-vibe` e `referencias` juntos.
- `docs/design.md`, `docs/architecture.md`, `docs/harness.md`,
  `docs/verification.md` e `docs/eval-rubric.md` registram o contrato v4.

## 4. Sequência e tamanho

| PR  | Conteúdo       | Ganho esperado                                        |
| --- | -------------- | ----------------------------------------------------- |
| 1   | Fases 0, 1 e 2 | Silhuetas diferentes por vibe já com o catálogo atual |
| 2   | Fase 3         | Heroes e cinco blocos novos; CSS por vibe completo    |
| 3   | Fase 4         | Tipografia por papel e ênfase no título               |
| 4   | Fase 5         | Ícones em duas cores, mais símbolos, microinterações  |
| 5   | Fases 6 e 7    | Estilo de imagem, crítica e documentação              |

O PR 1 é o de maior alavancagem e o menor em código: muda o plano de cenas,
o gate de direção, o `renderingVibeOf` sob versão 4 e as métricas. Ele já
resolve o caso observado sem depender de blocos novos.

Cada PR passa por `npx next typegen && npx tsc --noEmit`, `npm run lint`,
`npm run test:sites`, `npm run test:admin` e `npm run build:vercel`, além da
captura das quatro vibes. Uma avaliação real com `npm run eval:site` em um
tenant descartável, nas quatro vibes, fecha o PR 1 e o PR 2; ela gera imagens
e chama o modelo, então é paga.

## 5. Riscos e decisões que ficam com o operador

- **Custo de avaliação.** Cada rodada de `eval:site` com `--generate` produz
  cinco ou seis fotos e várias chamadas de modelo por vibe. Quatro vibes por
  PR são quatro gerações.
- **Sites publicados.** `chiquinho` está publicado com perfil v3 e referência.
  Nada muda nele até uma recomposição explícita com perfil v4. `tech` só tem
  rascunho. Regerar os dois depois do PR 1 é decisão do operador e é pago.
- **Tamanho do prompt.** Blocos novos aumentam o catálogo da fase de
  composição. A janela de 1 milhão de tokens e a saída de 49.152 comportam;
  o evento `[chat] usage` mede o efeito real.
- **Blocos com movimento.** `media.ticker` precisa sair legível no SSR, parar
  com movimento reduzido e nunca esconder conteúdo. Se não couber nessas
  condições, sai do escopo.
- **Árvore atual.** O diamante de geração do painel já está em `main` (#25).
  Restam alterações locais em `.gitignore` e `.oxlintrc.json` para o
  `.design-sync/`, sem relação com este plano. O PR 1 parte de `main` e não
  toca o painel.
