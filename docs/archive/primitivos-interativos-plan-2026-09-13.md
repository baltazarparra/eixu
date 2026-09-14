# Plano: primitivos interativos dos sites e carrossel na abertura

> Arquivado em 13/09/2026 após a implementação local dos PRs 1 e 2.
> O PR 3 opcional (miniaturas, lightbox e exercício automatizado de todos os
> slides na revisão visual) não fez parte da entrega. O texto abaixo preserva
> o diagnóstico, as decisões e os critérios no estado em que foram propostos.

Pedido de 13/09/2026: ter uma base de componentes primitivos neutros para os
sites gerados, de modo que um slider ou carrossel possa ser usado com pouco
esforço, com desempenho e coerência visual; e fazer o chat aceitar e entregar
um pedido como "no lugar de apenas uma imagem no hero, quero um carrossel com
as imagens #4, #6, #7, #8".

Análise sobre `origin/main` `143d313`, o mesmo SHA registrado nos eventos de
geração do cliente `deckdisck` em produção. O checkout local está em `8ab02d1`,
cerca de 40 commits atrás, com alterações sem commit que não pertencem a este
plano; sincronize antes de implementar e não misture esses arquivos no PR.

**Estado:** plano escrito; nada implementado. As decisões de §7 ficam com o
operador e não bloqueiam o PR 1.

## 1. O caso observado e o que existe hoje

Conversa do `deckdisck` em 13/09/2026, 19:57 (canal `site`):

> **Operador:** no lugar de apenas uma imagem no hero, quero um carrousel /
> slider com as imagens #4, #6, #7, #8
>
> **Agente:** A abertura da página permite apenas uma imagem principal em
> destaque, sem suporte a carrossel ou passagem rotativa de fotos. Podemos
> manter a foto principal no topo e exibir as imagens #4, #6, #7 e #8 reunidas
> em uma galeria logo abaixo. [...]

A recusa está correta para o contrato atual. Dados lidos do banco, somente
leitura, sem conteúdo pessoal:

| Fato                  | Valor                                                                                                                          |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Vibe e perfil         | `landing`, `brand.design.version` 7, `heroComposition` `stage`, navegação `minimal`, imagem `framed`                           |
| Abertura da home      | `hero.landing:stage` com `image` = #4; a silhueta segue a sequência da Landing Page                                            |
| Imagens pedidas       | #4 upload 2560×1707 (3:2), #6 upload 1080×890, #7 e #8 uploads 720×720; todas `targetBlock` `livre`                            |
| Proporção exibida     | `expectedRatio('hero.landing','stage')` é 16:9; as quatro fotos geram aviso `imagem-proporcao`, salvo `fit` natural ou contain |
| O que o schema aceita | `hero.landing` tem `image`, `imageAlt` e `imagePresentation` (`frame`, `fit`, `width`, `spacingTop`); uma foto só              |

Nenhum bloco do catálogo é um carrossel. `media.gallery:filmstrip` cria uma
coluna por foto com `overflow-x: auto` e `scroll-snap`, sem controles, sem
uma foto por vez e sem uso no hero. `feature.explorer` e `feature.showcase:tabs`
alternam painéis por abas, com foco por teclado e HTML completo sem JS; são
seleção, não passagem de fotos.

Componentes interativos dos sites hoje: `lib/blocks/explorer.tsx`,
`lib/blocks/landing-interactions.tsx` (abas e botão fixo), `lib/blocks/motion.tsx`
(Framer Motion), `lib/blocks/mobile-navigation.tsx` (diálogo nativo),
`lib/blocks/location-picker.tsx` e o editor de texto na prévia. Todos saem
completos do servidor, respeitam movimento reduzido e usam apenas tokens do
site. Não há uma pasta nem um contrato comum para eles.

Dependências já instaladas e relevantes: `embla-carousel-react` 8.5.2 (traz
`embla-carousel` 8.5.2 como dependência transitiva), `@base-ui/react` 1.7.0,
`framer-motion` 13.2.0. `components/ui/*` é o shadcn do painel, com classes
Tailwind ligadas aos tokens de `app/(admin)/admin.css`; ele não pode entrar em
`app/(sites)`, que mantém CSS próprio. `embla-carousel-autoplay` não está
instalado.

Consumidores que já percorrem arrays de props e não precisam mudar para um
novo campo de fotos: `blockImageUrls` (chaves `image`, `secondaryImage`, `src`),
`replaceImageInBlocks` (`src` → `alt`), `imageUsage.containsUrl` (proteção de
exclusão), `blockFields` (inventário de textos por schema, com rótulo para
`caption`) e `contentLossError` (`alt` e `caption` são texto protegido).

## 2. Resultado esperado

A mesma mensagem, no mesmo cliente, produz uma única chamada de `edit_page`:
mantém `image` = #4 como primeira foto, grava as demais em ordem e responde
com o recibo real ("carrossel com 4 fotos" na abertura). A prévia atualiza
pelo evento já existente. As recomendações de proporção continuam no recibo e
no painel, sem bloquear. Nenhuma galeria é inserida como substituto, e nenhuma
pergunta é feita quando os números existem na biblioteca.

Em um hero que não aceita carrossel, o agente explica o limite em uma frase e
oferece a alternativa real do catálogo, sem gravar, como já manda o contrato
de [edição pelo chat](chat-edits.md#pedido-que-não-cabe-no-bloco).

## 3. Decisões

### 3.1 Biblioteca: motores headless, estilo do site

| Opção                              | Avaliação                                                                                                                                                                                                                                                                    |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `components/ui` (shadcn) nos sites | Recusada. Depende de `--color-*` do admin, de `Button` e de utilitários com a paleta do painel. Violaria a separação de CSS entre `(admin)` e `(sites)` e levaria a identidade do painel aos clientes.                                                                       |
| Base UI (`@base-ui/react`)         | Motor de comportamento sem estilo: abas, acordeão, diálogo, popover, slider de valor, tooltip. Estiliza por `className` e `data-*`; compatível com SSR. Não tem carrossel. Fica reservado para primitivos que ainda não existem, como lightbox; não migra o que já funciona. |
| Embla (`embla-carousel`)           | Motor de carrossel sem estilo, sem dependências, com arrasto, snaps, loop e API imperativa. É a escolha para carrossel e slider de fotos.                                                                                                                                    |
| Só CSS (`scroll-snap`)             | Continua como camada base: é o que o HTML sem JS e o modo de edição mostram. Não dá controles, indicadores, teclado consistente nem loop.                                                                                                                                    |

Decisão: criar `lib/blocks/ui/`, a pasta dos **primitivos neutros dos sites**.
Cada primitivo é um componente de cliente, sem estilo próprio além de
`app/(sites)/primitives.css`, escrito com os tokens do site (`--ink`,
`--paper`, `--surface`, `--line`, `--accent`, `--radius`, `--panel-radius`) e
modulado por vibe em `vibes.css` sob `.site-theme[data-vibe='…']`. Motores
permitidos: Embla para movimento contínuo e Base UI para estados compostos.
Nenhuma dependência nova nos PRs 1 e 2; `embla-carousel` passa a dependência
direta em `package.json`, na versão 8.5.2 já presente no lockfile, porque
importar um pacote transitivo é frágil.

Contrato de todo primitivo, verificado em teste:

1. O HTML sai completo do servidor e continua utilizável sem JavaScript.
2. A hidratação só acrescenta comportamento; não reordena nem esconde conteúdo
   que estava visível, exceto quando o padrão exige uma foto por vez.
3. `prefers-reduced-motion`, `data-motion='still'` e o modo de edição
   (`ctx.editing`) desligam movimento automático e transições.
4. Alvos de toque de pelo menos 44 px, 48 px na Landing Page; foco visível;
   teclado completo; rótulos em português.
5. Nenhum CSS livre do agente: variantes entram como enum no schema e viram
   `data-*` no DOM, como `imagePresentation` já faz.
6. O código do motor só é carregado nas páginas que renderizam o primitivo.

Os componentes interativos existentes não são migrados neste plano. Mover
`explorer.tsx`, `landing-interactions.tsx` e `mobile-navigation.tsx` para a
pasta pode acontecer em um PR de organização, sem mudança de comportamento.

### 3.2 Onde o carrossel entra no catálogo

Sem bloco novo. Um `hero.carousel` quebraria aberturas da gramática, as
sequências das doze estruturas, a silhueta, o plano de cenas e o singleton de
hero. O carrossel é uma **forma da mídia** de blocos que já existem:

| Bloco                                                         | Campo                                               | Regra                                                                                                                                                       |
| ------------------------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hero.landing` layout `stage`                                 | `slides?: {src, alt, caption?}[]` (1 a 5)           | `image` continua obrigatória e é a primeira foto (LCP). Com `slides`, a figura `.site-landing-product` vira carrossel. `imagePresentation` vale para todas. |
| `hero.split` layouts `split`, `poster`, `editorial`, `offset` | mesmos `slides`                                     | `.site-hero-media` vira carrossel na proporção da composição. `imageFit` e `focalPoint` valem para todas.                                                   |
| `media.gallery`                                               | `layout: 'carousel'`                                | Uma foto por vez em 4:3, com controles; `images` continua o mesmo array (2 a 8). `filmstrip` não muda.                                                      |
| Comum aos heroes                                              | `carousel?: {autoplay?: boolean, interval?: 4..12}` | Autoplay desligado por padrão; intervalo em segundos. Sem outros ajustes.                                                                                   |

Excluídos, com `superRefine` cuja mensagem cita a alternativa
(`media.gallery` layout `carousel` logo após a abertura):

- `hero.landing:form`, porque a foto é um retrato de 16 rem ao lado do
  formulário; passar fotos ali disputa com os campos.
- `hero.split:cover`, porque o texto fica sobre a foto com degradê; a
  legibilidade muda a cada slide e a captura só avalia o primeiro.
- `hero.split:atelier`, porque já é uma composição de duas fotos.

Por que `image` + `slides` e não um único array: `image` já sustenta
`showsWholeImage`, a validação `stage exige imagem`, `landingClaims`, a
cobertura de cenas, o `hero-detail` do atelier e a substituição por URL. Manter
a primeira foto onde ela está evita um `unset` e preserva LCP e compatibilidade
com todos os clientes publicados. Os itens usam `src`/`alt`, como
`media.gallery`, para que `replaceImageInBlocks`, `blockImageUrls` e
`contentLossError` funcionem sem alteração. `alt` mínimo de 5 caracteres, como
`imageAlt` na Landing.

Gramática, estruturas, `DEFAULT_LAYOUT`, `silhouette`, plano de cenas e
`sceneCoverage` não mudam: a assinatura `tipo:layout` do hero é a mesma.
Uma consequência conhecida: em perfis v5/v6, trocar a galeria da sequência
mínima para `carousel` gera o aviso editorial `estrutura-v5-incompleta`.
Isso é coerente com o contrato das estruturas e fica documentado.

### 3.3 O primitivo `SiteCarousel`

Arquivo `lib/blocks/ui/carousel.tsx`, `'use client'`, usado por `HeroLanding`,
`HeroSplit` e `MediaGallery` no servidor.

- **Marcação.** `section` ou `div` com `aria-roledescription="carrossel"` e
  `aria-label` recebido do bloco ("Fotos da abertura", "Galeria: título").
  Viewport com `overflow: hidden` e trilha `display: flex`; cada slide é um
  `figure` com `role="group"`, `aria-roledescription="slide"`,
  `aria-label="Foto 2 de 4"` e `figcaption` opcional via `text.node`, para a
  legenda ser editável na prévia. Controles anterior/próxima com `SiteIcon`,
  indicadores como botões com rótulo, e uma região `aria-live="polite"` que
  anuncia a foto atual quando não há autoplay. Com autoplay, um botão
  Pausar/Continuar e `aria-live="off"`.
- **Motor.** O componente renderiza a trilha estática no servidor, com
  `scroll-snap-type: x mandatory` na viewport (o mesmo recurso do filmstrip).
  Após hidratar, e só fora do modo de edição, faz `import('embla-carousel')`
  e cria a instância sobre o DOM existente, sem trocar a marcação
  (`data-enhanced="true"`). Assim a página sem JS rola e ancora as fotos, o
  modo de edição mostra todas as fotos alcançáveis pelo editor, e o motor só
  é baixado onde existe carrossel. Se a importação falhar, a trilha continua
  rolável.
- **Interação.** Arrasto e toque pelo Embla; setas Esquerda/Direita, Home e
  End quando o foco está nos controles ou na região; `loop: true`;
  `duration` zero com movimento reduzido. Sem `hover` obrigatório.
- **Autoplay.** Só com `carousel.autoplay`. Pausa ao passar o mouse, ao focar
  qualquer controle ou slide, quando a aba está oculta e quando um diálogo do
  site está aberto. Desativado com `prefers-reduced-motion`,
  `data-motion='still'` e na edição. Implementado no próprio componente, com
  `setInterval` e limpeza; o plugin `embla-carousel-autoplay` fica como
  alternativa em §7.
- **Imagens.** Primeira foto com `fetchPriority="high"` e `decoding="async"`;
  a segunda com `loading="eager"` para a primeira passagem não piscar; as
  demais `loading="lazy"`. Todas com `width`/`height` e `object-fit` do box.
- **Ícones.** `arrow-left` entra no mapa de `lib/blocks/icon.tsx` como ícone
  de controle, em uma lista separada de `ICON_NAMES`, para não ampliar o enum
  exposto ao agente. O peso segue `ICON_STYLE` da vibe.

### 3.4 Renderização e CSS

- `HeroLanding` (`stage`): sem `slides`, nada muda. Com `slides`, o
  `figure.site-landing-product` recebe o carrossel por dentro; o box mantém
  `imagePresentationAttrs`, então `frame: none` e `fit: natural|contain`
  continuam valendo para o conjunto.
- `HeroSplit`: `.site-hero-media` recebe o carrossel. As proporções por
  composição já estão nessa classe (1:1, 5:6, 21:9 e alturas mínimas de
  poster/offset); os slides preenchem o box. `data-focal` vale por slide.
- `MediaGallery` layout `carousel`: uma foto por vez em 4:3 com controles;
  `title` continua editável.
- `app/(sites)/primitives.css`, importado em `app/(sites)/layout.tsx`, define
  `.site-carousel`, `-viewport`, `-track`, `-slide`, `-control`, `-dots` e
  `-live`, com tamanhos de toque, foco e cores por token. `vibes.css` modula:
  cantos retos e controles quadrados no ousado, controles em pílula com fio no
  artístico, indicadores em linha fina no moderno, padrão redondo no comercial
  e na Landing. Sem animação infinita.
- `lib/blocks/motion.tsx`: a entrada da foto do hero passa a mirar só a
  primeira foto (`.site-hero-media img:first-of-type`); em `data-animation="image"`
  os slides além do primeiro ficam fora da animação.

### 3.5 Pre-flight, métricas e pendências

- `blockImageUrls` já coleta `src` dentro de arrays, então os slides contam
  para `pagina-sem-foto` e para a riqueza do bloco. O hero com carrossel segue
  a regra atual do hero rico: só sustenta a home quando outra seção também
  mostra o negócio em foto, como o atelier. Não vira protagonista sozinho.
- `imagem-proporcao` avalia cada slide contra a proporção do box. `showsWholeImage`
  passa a considerar `slides` em `hero.landing` (`imagePresentation.fit`
  natural ou contain) e `imageFit: contain` em `hero.split`.
- `lib/taste/pendencias.ts` já localiza a imagem pelo número citado no achado
  e devolve biblioteca, layouts e `update_image` com `ratio`. Ganha o campo
  `apresentacao` quando o bloco suporta `imagePresentation` ou `imageFit`,
  oferecendo mostrar a foto inteira sem trocar a imagem.
- `lintPage` não ganha regra nova: limites, `alt` e layouts excluídos ficam no
  schema estrito. `landingFindings`, `landingClaims` e a política de publicação
  não mudam; `imagem-proporcao` já é aviso.

### 3.6 Edição pelo chat

- Política: o pedido do caso não cita bloco entre aspas nem verbo de remoção
  ("no lugar de" não casa com `asksRemoval`), então segue a edição geral;
  `contentLossError` não acusa perda porque só há acréscimo. O escopo visual
  (`visualOnly`) passa a permitir `slides`, `slides.N.src|alt|caption` e
  `carousel.*`, porque são mídia e apresentação do bloco nomeado.
- Prompt (`EDIT` em `lib/taste/prompt.ts`), um item: "Carrossel ou slider de
  fotos: `hero.landing` stage e `hero.split` (exceto cover e atelier) aceitam
  `slides`; `media.gallery` aceita layout `carousel`. Para 'carrossel com #4,
  #6, #7, #8', mantenha `image` como primeira foto (ou grave a pedida) e faça
  `set slides` com as demais em ordem, com `alt` da biblioteca. Não substitua
  por galeria abaixo sem pedido. Se as proporções diferirem do box, salve e
  informe a recomendação; ofereça `fit contain` quando o operador quiser a foto
  inteira. Em cover, atelier ou form, explique o limite e ofereça
  `media.gallery` carousel após a abertura, sem gravar."
- Catálogo: `use` de `hero.landing`, `hero.split` e `media.gallery` cita o
  carrossel; `describe` de `slides` e `carousel` é autossuficiente, porque o
  turno de edição recebe o JSON Schema dos blocos presentes.
- Recibo: em `applyPageEdit`, o caminho `slides` gera "carrossel com N fotos"
  e `carousel` gera "carrossel ajustado", na mesma frase "Em “…”: …".
- Remover uma foto do carrossel depois é perda de `alt`/`caption`; exige
  pedido de remoção, como qualquer conteúdo. Está correto e fica documentado.
- `update_image` pelo número continua trocando a URL dentro dos slides;
  exclusão de imagem em uso continua bloqueada.
- Editor na prévia: legendas dos slides aparecem como campos "Legenda N";
  no modo de edição a trilha é estática e rolável, então os `data-field`
  ficam alcançáveis. `alt` continua fora da edição inline, como hoje.

### 3.7 Geração e revisão solicitada

- Composição: `slides` é opcional e o prompt de composição não incentiva
  carrossel por padrão, porque fotos escondidas não sustentam o piso de
  composição nem a leitura do crítico. A direção pode usá-lo quando o
  briefing tem três ou mais fotos reais do produto (uploads ou Site atual).
- Captura e crítica: a captura emula movimento reduzido, então mostra a
  primeira foto e nenhum autoplay. O crítico recebe as props e vê os slides
  em JSON. Um exercício dos controles do carrossel na revisão solicitada,
  como `lib/review/navigation.ts` faz com o menu, fica para o PR 3.

## 4. Sequência

### PR 1: primitivo, Landing e galeria (entrega o caso do deckdisck)

Arquivos: `package.json` (dependência direta `embla-carousel` 8.5.2),
`lib/blocks/ui/carousel.tsx`, `app/(sites)/primitives.css`,
`app/(sites)/layout.tsx`, `app/(sites)/vibes.css`, `lib/blocks/icon.tsx`,
`lib/blocks/registry.ts` (`slides`, `carousel`, layout `carousel`,
`superRefine`, `use`, `IMAGE_LAYOUTS`), `lib/blocks/components.tsx`
(`HeroLanding`, `MediaGallery`), `lib/blocks/motion.tsx`, `lib/taste/metrics.ts`
(`showsWholeImage`), `lib/taste/pendencias.ts`, `lib/ai/edit-policy.ts`,
`lib/ai/page-edits.ts` (resumo), `lib/taste/prompt.ts`, testes e documentação
de §5 e §6.

### PR 2: `hero.split`

`slides` em `split`, `poster`, `editorial` e `offset`; `superRefine` para
`cover` e `atelier`; CSS por composição em `site.css`/`creative.css`;
`showsWholeImage` com `imageFit`; fixtures das quatro vibes no teste de
navegador; `use` do bloco e prompt.

### PR 3: opcional, após uso real

Miniaturas como indicador, lightbox com Base UI Dialog para `media.gallery`,
exercício dos controles na revisão solicitada, comparação de custo e exatidão
do caso no ensaio de edição. Só com pedido e critério registrados.

## 5. Verificação

Checks de sempre, com resultado observado de cada um:

```bash
npx next typegen && npx tsc --noEmit
npm run lint
npm run test:sites
npm run test:admin
npm run build:vercel
git diff --check
```

Testes novos ou ampliados:

- `tests/site-carousel.test.mjs`: schema aceita `slides` em `stage` e recusa
  em `form`, `cover`, `atelier`, seis ou mais fotos e `alt` curto;
  `blockImageUrls` inclui os slides; `imagem-proporcao` por slide e
  `showsWholeImage` com `fit`; `catalogForPrompt` cita o carrossel;
  `imageLayouts` não oferece hero.
- `tests/admin-page-edits.test.mjs`: `set slides` preserva `image`, textos e
  demais props; recibo "carrossel com 4 fotos"; remoção de slide sem pedido de
  remoção é recusada; escopo visual permite `slides` no bloco nomeado.
- `tests/admin-pendencias.test.mjs`: plano de proporção para um slide traz
  número, biblioteca, `update_image` e `apresentacao`.
- `tests/browser/site-carousel.test.mjs`, com `EIXU_CHROME_PATH` e CSS do
  `build:vercel`, em 1440, 390 e 320 px: HTML do servidor mostra a primeira
  foto; após hidratar, controles, indicadores, teclado, arrasto e anúncio ao
  vivo; movimento reduzido sem autoplay e sem transição; `?edit=1` com trilha
  estática e legendas editáveis; sem JS a trilha rola e ancora; controles com
  pelo menos 48 px na Landing; primeira foto sem `loading="lazy"`; nenhum
  erro de página; o chunk do Embla só aparece na rede da página com carrossel.
- `tests/browser/admin-chat-edits.test.mjs`: o pedido do caso, com modelo em
  memória, produz uma escrita, o evento de prévia e o recibo esperado.
- `scripts/eval-page-edits.mjs`: casos `hero-carousel` (uma chamada de
  `edit_page`, `image` #4 preservada, `slides` #6, #7, #8 em ordem, nenhuma
  galeria inserida, nenhuma pergunta) e `hero-carousel-unsupported` (hero
  `cover`: explicação e alternativa, sem escrita). Com `--live`, exige
  autorização e registra custo; sem ela, valida a fixture e o executor.

Depois do deploy, o operador confere na prévia do `deckdisck`: repetir o
pedido, ver o carrossel na abertura em desktop e celular e conferir o recibo.
Limites: nenhum teste em Safari ou aparelho físico; o tempo do autoplay não é
medido; o ensaio com modelo depende de chamadas pagas autorizadas.

## 6. Documentação a atualizar na entrega

- [Design](design.md): nova seção "Primitivos interativos" com o contrato de
  §3.1 e §3.3; linhas do carrossel na tabela da Landing Page e no piso de
  composição; CSS por vibe.
- [Edição pelo chat](chat-edits.md): parágrafo em "Pedido que não cabe no
  bloco" com `slides`, `carousel`, layout `carousel`, recibo e a regra de
  remoção de fotos.
- [Manual do operador](admin.md): exemplo "quero um carrossel no hero com as
  imagens #4, #6, #7 e #8" e como pedir a foto inteira.
- [Arquitetura](architecture.md): `lib/blocks/ui/` no despacho do renderer.
- [Harness](harness.md): o item de prompt sobre carrossel.
- [AGENTS.md](../AGENTS.md): invariante curta: componentes interativos dos
  sites ficam em `lib/blocks/ui/` e seguem o contrato de primitivos;
  `components/ui` pertence ao painel.
- [Índice](README.md): este plano em "Evoluções propostas" enquanto aberto;
  ao entregar, mover para `archive/` com data e registrar no guia vigente.

## 7. Riscos e decisões que ficam com o operador

| Decisão                             | Proposta                                                                                  | Alternativa                                                            |
| ----------------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Autoplay                            | Desligado por padrão; ligado só por `carousel.autoplay`, com pausa e movimento reduzido   | Ligado por padrão na Landing, com 6 s                                  |
| Fotos com proporções diferentes     | Recorte `cover` no box da composição, com recomendação no recibo e `fit contain` a pedido | `fit contain` automático quando algum slide não cabe                   |
| Carrossel como protagonista da home | Não conta sozinho, como o atelier                                                         | Contar quando tiver duas fotos disponíveis                             |
| Heroes cobertos                     | PR 1 `hero.landing:stage`; PR 2 `hero.split` sem cover e atelier                          | Incluir `cover` com veto de autoplay e teste de legibilidade por slide |
| Motor de autoplay                   | Próprio, dentro do componente                                                             | `embla-carousel-autoplay` fixado em 8.5.2                              |
| Base UI                             | Reservado para primitivos novos; nada migra agora                                         | Migrar abas do explorer/showcase quando houver defeito medido          |

Riscos:

- **Chunk do motor.** O carregamento sob demanda depende de `import()` dentro
  do componente de cliente. O teste de navegador mede a rede; se o Next
  agrupar o Embla no chunk comum da rota, a alternativa é manter a importação
  dinâmica e aceitar o custo apenas nas páginas com carrossel.
- **Fotos escondidas na crítica.** O crítico só vê a primeira foto nos pixels.
  Recomendações sobre os demais slides vêm do pre-flight e do JSON, não da
  imagem; o relatório precisa dizer isso.
- **Legendas e editor.** A trilha estática no modo de edição pode ficar larga
  em 320 px; a rolagem horizontal fica dentro da viewport do carrossel, nunca
  na página. O teste de 320 px confere.
- **Checkout local.** O plano foi lido em `origin/main`; a implementação
  precisa partir dele, não da árvore local com alterações de outro trabalho.

## 8. Critérios de aceitação do PR 1

1. No `deckdisck`, a mensagem do caso produz uma chamada de `edit_page`, com
   `image` #4 preservada e `slides` #6, #7, #8; o recibo diz "carrossel com 4
   fotos" e a prévia atualiza.
2. Sem JavaScript, a abertura mostra a primeira foto e permite rolar as demais.
3. Com movimento reduzido, não há autoplay nem transição, e os controles
   funcionam por teclado e toque com alvos de 48 px.
4. `imagem-proporcao` lista cada slide fora da proporção como recomendação,
   com biblioteca, `update_image` e `apresentacao`; a publicação não é vetada.
5. Excluir #6, #7 ou #8 na biblioteca é recusado enquanto estiverem no
   carrossel; `update_image` pelo número troca a foto certa nos slides.
6. `hero.landing:form`, `hero.split:cover` e `hero.split:atelier` recusam
   `slides` no schema com a alternativa na mensagem; o agente explica sem gravar.
7. Todos os checks de §5 passam com resultado observado; lint global sem
   regras desligadas; documentação de §6 atualizada e formatada.
