# Plano: vibe Landing Page

Análise feita em 12/09/2026 sobre o código em `main`, sobre as duas guias de
boas práticas indicadas pelo operador e sobre seis referências visuais
capturadas em 1440 px e 390 px com Chrome headless. O documento registra o
que a vibe precisa ser, onde o produto hoje impede uma landing page e o plano
de implementação em fases, no mesmo formato de
[plano-vibes-unicas.md](plano-vibes-unicas.md).

**Estado:** implementação local das fases 0–3. O escopo confirmado pelo operador
é implementar e validar localmente; publicação e geração paga ficam fora desta
entrega. Evidências e limites estão em [Verificação](verification.md).

A implementação acompanha a base atual: Landing Page usa perfil **v7**, sem
`structure`/`structureRationale`; as quatro vibes multipágina mantêm v5/v6 e
as doze estruturas. A referência mantém a forma de página única. Trocar para
Landing Page preserva páginas existentes e aponta incompatibilidades, sem
exclusão automática. O plano de cinco cenas usa `media.image` como apoio e
imagem separada do texto em `cta.band`, sem gerar retratos para depoimentos.
Os registros abaixo preservam o diagnóstico original e detalham o contrato.

## 1. O que uma landing page exige

### Fontes lidas

- [Lovable, landing page best practices](https://lovable.dev/guides/landing-page-best-practices-convert):
  uma única ação, repetida no hero, no meio e no fim; headline que responde
  "o que eu ganho" em cinco segundos, com até 15 a 20 palavras e voz ativa;
  formulário com poucos campos (a guia cita salto de 120% ao cair de 11
  para 4 campos), coluna única e teclado certo no celular; prova social com
  nome, foto, cargo e resultado concreto; alvos de toque de 48 px; carga
  abaixo de 3 s no celular; hierarquia visual por tamanho, contraste e
  respiro.
- [RD Station, exemplos de landing pages](https://www.rdstation.com/blog/marketing/exemplos-de-landing-pages/):
  página com um objetivo só; título e subtítulo com a proposta de valor;
  imagem que reflete a oferta; descrição em frases curtas e tópicos;
  formulário só com o essencial; botão com cor contrastante e verbo de ação
  ("Baixe grátis"); depoimentos, números e contagem só quando reais. Quatro
  tipos: geração de leads, captura de contato, vendas e pré-lançamento. Os
  exemplos com melhor taxa tinham oferta única, formulário mínimo, vídeo ou
  quiz explicando o produto e boa leitura no celular.

### Referências visuais, capturadas em 12/09/2026

| Site                                              | Papel  | Abertura                                                                                                     | O que leva para a vibe                                                                                                                 |
| ------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| [rmc-studio.com](https://rmc-studio.com/)         | escuro | Claim em duas frases, grotesca condensada em 5 linhas, navegação em pílulas, avatares 3D e um selo lúdico    | Navegação em pílulas com CTA à direita; uma cor de acento (lima) só; um elemento lúdico repetido                                       |
| [hustla.app](https://hustla.app/)                 | claro  | Título de 6 palavras, subtítulo de 2 linhas, botão único, foto de produto em 3 aparelhos                     | Silhueta clássica: problema › "três listas" › benefícios em grade › depoimentos › preços › FAQ › CTA final                             |
| [openscreenshot.app](https://openscreenshot.app/) | claro  | Selo "Free · Open source", título de 3 frases curtas, dois botões, painel do produto com moldura em degradê  | Faixa de prova sob o hero (usuários, estrelas, licença); quatro benefícios com ícone colorido; "pronto em 3 passos"                    |
| [ugly.cash](https://ugly.cash/)                   | claro  | Título em caixa alta de duas linhas, celular centralizado, frase de apoio                                    | Bento de cartões com cor em bloco; declaração numérica em escala grande ("30.000 pessoas"); fechamento com logotipo                    |
| [near.com](https://near.com/)                     | claro  | Título de 2 linhas, subtítulo, botão preto com nota "sem e-mail, sem KYC"; demo do produto sobre faixa verde | Lista de capacidades em acordeão ao lado de um painel; faixa escura de confiança com logos e três números; FAQ; CTA final sobre acento |
| [simeon.sh](https://simeon.sh/)                   | escuro | Eyebrow, título de 2 linhas, mono no corpo, dois botões, painel do produto com 4 selos abaixo                | Seções com eyebrow colorido e âncoras no menu; integrações em grade de logos; preços em 3 colunas; FAQ em 2 colunas                    |

As seis páginas compartilham a mesma silhueta, com variação só na ordem do
meio: navegação mínima com um botão › hero centrado ou à esquerda com
imagem do produto › faixa de prova › problema ou promessa › benefícios em
grade › como funciona › depoimentos › preços (quando há) › FAQ › CTA final ›
rodapé. Nenhuma tem página interna; o menu aponta para âncoras.

O que o rmc-studio traz de diferente (avatares 3D, selo "Catch me") é
personalidade, não estrutura. A vibe adota o gesto (um elemento lúdico
repetido, navegação em pílulas), não o conteúdo.

### Como isso vira contrato da vibe

| Exigência        | Como a vibe garante                                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------------------ |
| Uma ação só      | Todo botão primário da página resolve para o mesmo destino: o formulário da página ou um link externo  |
| Ação repetida    | O destino primário aparece no hero, em uma seção do meio e no fechamento; no celular, botão fixo       |
| Headline curta   | Até 60 caracteres, cerca de 8 a 10 palavras; o resto vai para o subtext                                |
| Prova real       | Pelo menos uma seção de prova, com fatos vindos de `brief.evidence`; sem evidência, a seção não entra  |
| Formulário curto | `form.lead` com 2 a 4 campos; `type` correto por campo (`tel`, `email`) já existe e vira teclado certo |
| Celular primeiro | Alvos de 48 px, formulário em coluna única, botão fixo no rodapé da tela; validado no CSS de produção  |
| Uma página       | O projeto é a home mais a página de obrigado; o menu usa âncoras                                       |
| Velocidade       | Sem biblioteca nova; a moldura de produto é CSS; imagens continuam pelo pipeline atual                 |

## 2. Onde o produto impede uma landing page hoje

Os quatro contratos atuais assumem um site com jornada de inbound em várias
páginas. Uma vibe de página única colide com gates compartilhados; todos
precisam passar a depender da forma do site, não só existir.

| Gate                                                                          | Onde                                                            | Conflito                                                               |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `inbound-paginas`: mínimo de 3 páginas orgânicas                              | `lib/taste/site.ts:71-80`                                       | A landing tem uma página indexável                                     |
| `inbound-jornada`: discovery, consideration e conversion em páginas distintas | `lib/taste/site.ts:169-178`                                     | As três etapas acontecem em seções da mesma página                     |
| `nextPhase`: geração só termina com `organicPages >= 3`                       | `lib/taste/phases.ts:211`                                       | A composição nunca chegaria a `pronto`                                 |
| `pagePlan.min(3)` e `imageScenes.min(5)`                                      | `lib/design/profile.ts:24-38`                                   | O briefing de uma página é recusado no schema                          |
| Plano de cenas conta `organicPages - 1` páginas internas                      | `lib/images/scene-plan.ts:93-104`, `lib/sites/generation.ts:33` | Pediria fotos para páginas que não existem                             |
| Prompt: "no mínimo 3 páginas orgânicas conectadas"                            | `lib/taste/prompt.ts:91`                                        | O agente tentaria criar páginas internas                               |
| `openingsOf` deriva as aberturas de `hero.split:${composição}`                | `lib/design/vibes.ts:202`                                       | A landing abre em um bloco próprio, não em `hero.split`                |
| `heroComposition` é enum fechado e as vagas são fixas                         | `lib/design/profile.ts`, `lib/images/scene-slots.ts`            | Uma composição nova precisa de vaga e proporção                        |
| `paid_lp` é o único tipo de "landing" e nasce `noindex`                       | `lib/types.ts:1`, `lib/ai/tools.ts:333`                         | A landing desta vibe é a home indexável, não uma página paga escondida |
| Unicidade compara perfis dentro da mesma vibe                                 | `lib/ai/tools.ts:1640-1655`                                     | Landings de clientes diferentes tendem à mesma silhueta por natureza   |

Nada disso muda para as quatro vibes atuais. A decisão do plano é uma
função `siteShape(vibe)` em `lib/design/vibes.ts` que devolve `'multi'` ou
`'landing'`; cada gate acima consulta a forma e mantém o comportamento
atual em `'multi'`.

## 3. Princípios

- A vibe é uma **gramática de conversão garantida em código**: forma do
  site, silhueta, ação única, prova e formulário curto são regras de
  `lib/taste/metrics.ts` e `lib/taste/site.ts`, não só texto de prompt.
- Fatos continuam obrigatórios. Número, preço, depoimento e logotipo só
  entram com evidência em `brief.evidence` ou material do cliente. A
  ausência de prova é lacuna declarada, nunca prova inventada.
- Linguagem simples e a voz de `lib/copy/policy.ts` valem; a vibe muda o
  pedido (uma ação), não a dificuldade.
- Referência verificada modula aspectos, como nas outras vibes. Ela não
  transforma a landing em site multipágina nem o contrário.
- Responsividade, contraste AA, teclado e movimento reduzido continuam
  gates. O botão fixo do celular precisa passar por
  `lib/design/responsive.ts` e pela captura com CSS de produção.
- Sites publicados não mudam. A nova vibe entra sob perfil v7 e só para
  `brand.vibe === 'landing'`.

## 4. A vibe

### Identidade

- **Id:** `landing`. **Rótulo:** Landing Page. **Dica no cadastro:** "Uma
  página, uma ação: benefício, prova e formulário curto, com botão fixo no
  celular."
- **Paleta de partida:** papel `#ffffff`, tinta `#0b0b0f`, acento saturado
  `#16a34a`, secundária `#ecfdf5`, destaque `#f59e0b`. O acento pinta só
  botões, eyebrows e uma faixa; o restante é neutro, como em near.com e
  openscreenshot.app.
- **Faixa (`VIBE_LANE.landing`):** display `grotesk` ou `geometric`; corpo
  `sans` ou `geometric`; `heroComposition` `stage` ou `form` (novas, ver
  fase 1); navegação `minimal`; ritmo `alternating` ou `compact`; imagem
  `framed`; superfície `outlined` ou `layered`; motivo `none` ou `grid`;
  raio `md` ou `lg`; papel claro `[0.85, 1]`; dials variância `[3, 6]`,
  movimento `[3, 6]`, densidade `[5, 8]`. Papel escuro (rmc-studio, simeon)
  só por referência verificada com aspecto `surface`, como já acontece.
- **Voz (`VIBE_COPY.landing`):** tom "Concreta, confiante e focada em um
  pedido." Escrita: diga o benefício, mostre a prova e peça uma ação só;
  cada seção termina apontando para a mesma ação. Evite: dois convites
  diferentes na mesma página, urgência inventada, número sem fonte,
  superlativo. Exemplo com a oferta fictícia de móveis: título "Mesas de
  madeira sob medida, entregues em 15 dias", texto "Você escolhe a medida e
  a cor. A gente entrega montada.", botão "Pedir orçamento".
- **Iconografia (`ICON_STYLE.landing`):** peso `fill` em selo colorido
  (`data-icon-vibe='landing'` com fundo `--icon-secondary` e raio da
  marca), rótulo "preenchida em selo", movimento `pop`. É o que
  openscreenshot.app e near.com fazem com os ícones de benefício.
- **Imagem (`VIBE_IMAGE_DIRECTION.landing`):** produto ou resultado em
  primeiro plano, fundo limpo e neutro, luz uniforme, enquadramento
  central que aceite moldura. Sem pessoa posando. Quando o cliente tem
  tela ou foto de produto, o upload de
  [fluxo do acervo](admin.md) prevalece sobre a
  cena gerada no hero.
- **Localização:** `VIBE_LOCATION_TONE.landing = 'paper'`; a seção
  automática de contato fica compacta, antes do rodapé.

### Silhueta (`VIBE_GRAMMAR.landing`)

| Campo           | Valor                                                                                                                               |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `openings`      | `hero.landing:stage`, `hero.landing:form`                                                                                           |
| `protagonists`  | `feature.bento:showcase`, `feature.showcase:steps` (novo)                                                                           |
| `innerOpenings` | vazio; a única página além da home é a de obrigado, que já é isenta                                                                 |
| `closings`      | `cta.band:band`, `form.lead:panel`, `form.lead:stack`                                                                               |
| `support`       | `proof.testimonials` (novo), `media.image`                                                                                          |
| `avoid`         | `hero.split:*`, `hero.statement:*`, `feature.explorer:*`, `media.gallery:collage`, `media.gallery:masonry`, `editorial.resources:*` |
| `headline`      | 60                                                                                                                                  |

Ordem esperada, com o mínimo de 6 e o máximo de 11 seções de conteúdo:

1. `nav.bar` minimal, links só de âncora, um CTA, `stickyCta` no celular.
2. `hero.landing`: eyebrow, headline, subtext, CTA primário, no máximo um
   secundário, 3 selos de confiança; layout `stage` (imagem em moldura
   abaixo ou ao lado) ou `form` (formulário curto no lugar da imagem).
3. `proof.strip` (novo): logos, números ou selos em uma linha, só com fato.
4. `narrative.statement` (novo): o problema ou a promessa em uma frase
   grande centrada, como o "Most to-do apps bury you…" do hustla.app.
5. Protagonista: `feature.bento:showcase` ou `feature.showcase:steps` com
   as duas fotos do cliente.
6. `narrative.steps:horizontal` ("pronto em três passos").
7. `proof.testimonials` (novo): 2 a 3 depoimentos com nome, cargo e
   resultado; foto opcional.
8. `pricing.table:cards` só quando o briefing traz preço.
9. `faq.accordion:stack` com 4 a 8 perguntas.
10. Fechamento: `cta.band:band` sobre acento ou `form.lead`.
11. `footer.compact:minimal`.

O plano de cenas pede 5 fotos: hero, duas para a protagonista, uma para
`media.image` e uma para a imagem do fechamento. Fotos de depoimentos só
entram por upload real, com evidência; não são vagas de geração.

## 5. Fases

### Fase 0. Forma do site

Objetivo: o produto aceitar um projeto de uma página sem afrouxar as
outras vibes.

- `lib/design/vibes.ts`: `SITE_SHAPE: Record<Vibe, 'multi' | 'landing'>` e
  `siteShape(brand)`. Só `landing` devolve `'landing'`.
- `lib/taste/site.ts`: em `'landing'`, `inbound-paginas` exige exatamente
  uma página `page` indexável (a home) e uma `thank_you`; páginas `page`
  extras são erro `landing-pagina-extra`. `inbound-jornada` passa a exigir
  que a home tenha `meta.inbound.stage = 'conversion'` e que discovery e
  consideration estejam cobertas por seções (statement ou bento, e FAQ ou
  steps). `inbound-conteudo` sobe para 250 palavras na home. `pagina-isolada`
  e `link-interno` continuam; `anchor-inexistente` já cobre o menu.
- `lib/taste/phases.ts`: `nextPhase` recebe a forma; em `'landing'`, a
  composição termina com `organicPages >= 1`. `PHASE_BRIEF.composicao` e
  `lib/taste/prompt.ts:91` descrevem a landing quando a forma é essa.
- `lib/design/profile.ts`: `pagePlan.min(3)` vira `min(1)` com `superRefine`
  que exige 3 quando a vibe é multi; o schema recebe a vibe pelo contexto de
  `set_design`. `imageScenes` continua `min(5)`.
- `lib/images/scene-plan.ts` e `lib/sites/generation.ts`: `scenePlan` lê a
  forma e, em `'landing'`, troca as cenas de subpágina pelas de apoio da
  gramática na própria home.
- `lib/ai/tools.ts` (`create_page`): em `'landing'`, recusa `page` com slug
  não vazio e explica que a landing usa seções e âncoras.

Verificação: `tests/site-contract.test.mjs` com um projeto de uma página
aprovado em `landing` e recusado em `comercial`, e o inverso.

### Fase 1. Registro da vibe e blocos novos

Objetivo: a vibe existir de ponta a ponta com o catálogo que a silhueta
pede.

- `lib/design/vibes.ts`: `landing` em `VIBES` e nos oito registros
  (`VIBE_LABEL`, `VIBE_HINT`, `VIBE_PALETTE`, `VIBE_LANE`, `VIBE_GRAMMAR`,
  `VIBE_DIRECTION`, `VIBE_IMAGE_DIRECTION`, `VIBE_LOCATION_TONE`) com os
  valores da seção 4. `openingsOf` passa a aceitar uma sobrescrita por vibe
  para a gramática apontar `hero.landing`.
- `lib/design/profile.ts`: `heroComposition` ganha `stage` e `form`;
  `heroCompositionFor` já limita as outras vibes às composições atuais.
  `lib/images/scene-slots.ts`: vagas `hero.stage` (16:9) e `hero.form`
  (4:5), com proporção em `ratios.ts`.
- `lib/copy/policy.ts`: `VIBE_COPY.landing` com `tone` distinto, exigido por
  `tests/site-copy.test.mjs`.
- `lib/design/iconography.ts` e `app/(sites)/iconography.css`:
  `ICON_STYLE.landing` e o selo colorido.
- Blocos novos, cada um com schema em `lib/blocks/registry.ts`,
  `blockMeta.use`, `DEFAULT_LAYOUT`, renderizador em `render.tsx`,
  componente em `components.tsx`, proporção e cobertura no pre-flight:

  | Bloco                 | Layouts             | O que é                                                                                                                                                                    |
  | --------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `hero.landing`        | `stage`, `form`     | Eyebrow, headline, subtext, CTA, secundário opcional, 3 selos; `stage` mostra imagem em moldura, `form` embute até 4 campos com o mesmo contrato de `form.lead`            |
  | `proof.strip`         | `logos`, `numbers`  | Uma linha sob o hero: 3 a 6 logos em texto ou 2 a 4 números com rótulo; título opcional de uma linha                                                                       |
  | `narrative.statement` | `center`, `split`   | Uma frase de até 160 caracteres em escala grande, eyebrow opcional, sem imagem                                                                                             |
  | `feature.showcase`    | `steps`, `tabs`     | 2 a 4 itens com ícone, título, texto e imagem; `steps` alterna texto e imagem por linha, `tabs` troca a imagem por seleção acessível (mesmo padrão de teclado do explorer) |
  | `proof.testimonials`  | `grid`, `spotlight` | 2 a 3 depoimentos com citação, nome, cargo e resultado; foto opcional; cada item exige `evidence` referenciando o briefing                                                 |

  `nav.bar` ganha `stickyCta: boolean` que, com `position: 'fixed'` e tela
  estreita, renderiza o CTA fixo no rodapé da tela; fora da vibe o campo
  fica ignorado no renderer.

- `app/(sites)/vibes.css` e `typography.css`: sistema completo sob
  `.site-theme[data-vibe='landing']`: navegação em pílulas com fundo
  translúcido, hero centrado com título até 4.5rem no desktop, moldura de
  produto com borda de 1px e sombra suave, faixa de prova em cinza claro,
  cartões delineados no bento, eyebrow no acento, FAQ em duas colunas a
  partir de 1024 px, CTA final sobre acento com tinta medida por
  `lib/blocks/contrast.ts`, botão fixo de 56 px com respiro seguro
  (`env(safe-area-inset-bottom)`). Movimento reduzido desliga o `pop` dos
  ícones e a entrada da moldura.
- `app/(admin)/admin.css`: `.admin-vibe-preview[data-vibe='landing']`.
- `tests/browser/fixtures/visual-system.tsx`: `VISUAL_PAIRS.landing`.

Verificação: `tests/site-contract.test.mjs` já percorre `VIBE_GRAMMAR` e
confere tipo e layout no catálogo; `tests/site-visual-system.test.mjs`
percorre `VIBE_LANE`; `tests/site-copy.test.mjs` percorre `VIBES`. Novo
`tests/site-landing.test.mjs` com SSR dos cinco blocos, schema e teclado
de `feature.showcase:tabs`.

### Fase 2. Regras de conversão

Objetivo: o que as guias pedem virar gate medido no rascunho.

`lib/taste/metrics.ts`, em `grammarFindings` ou em um `landingFindings`
chamado só quando a forma é `'landing'`:

| Regra                      | Nível | O que exige                                                                                                    |
| -------------------------- | ----- | -------------------------------------------------------------------------------------------------------------- |
| `landing-acao-unica`       | erro  | Todo CTA primário (hero, cta.band, nav, sticky) aponta para o mesmo destino; o secundário do hero é a exceção  |
| `landing-acao-repetida`    | aviso | O destino primário aparece pelo menos 3 vezes: abertura, meio e fechamento                                     |
| `landing-prova`            | erro  | Há `proof.strip`, `proof.testimonials`, `proof.stats` ou `proof.logos`, e cada fato consta em `brief.evidence` |
| `landing-formulario-curto` | aviso | `form.lead` ou `hero.landing:form` com mais de 4 campos; erro acima de 6                                       |
| `landing-secoes`           | erro  | Menos de 6 ou mais de 11 seções de conteúdo na home                                                            |
| `landing-menu-ancoras`     | erro  | Link do menu que não é âncora da própria home nem o destino primário                                           |
| `landing-obrigado`         | erro  | Formulário sem página `thank_you` correspondente em `redirectTo`                                               |
| `headline-fora-da-vibe`    | aviso | Já existe; passa a valer 60 nesta vibe                                                                         |

`lib/taste/lint.ts`: `paid_lp` sem `noindex` continua aviso; a landing
desta vibe é `page`, então a regra não a alcança.

`lib/ai/tools.ts` (`set_design`): a comparação de unicidade continua dentro
da vibe, mas para `landing` a distância mínima cai de 3 para 2 eixos, com
a silhueta comparada por `silhouetteSimilarity` como hoje. Landings
legitimamente se parecem; a diferença vem de acento, tipografia, moldura
e conteúdo.

Verificação: cada regra com caso positivo e negativo em
`tests/site-landing.test.mjs`; `npm run test:sites`.

### Fase 3. Prompt, crítica e painel

- `lib/taste/prompt.ts`: com forma `'landing'`, a seção de composição
  descreve a ordem esperada, a ação única e a exigência de prova com
  evidência; o catálogo lista primeiro os blocos da gramática, como já faz
  `catalogForPrompt({ vibe })`. `PHASE_BRIEF.briefing` pede que `goal` seja
  uma ação só e que `pagePlan` tenha uma página.
- `lib/review/critic.ts`: critério `conversao` (erro quando a página pede
  duas ações diferentes, quando a prova não tem fato ou quando o formulário
  pede mais do que precisa) e o `identidade-da-vibe` recebe a silhueta da
  landing. A captura em 390 px confere o botão fixo e o alvo de 48 px.
- `components/admin/brand-fields.tsx` e
  `app/(admin)/admin/[tenant]/dados/settings-form.tsx`: a opção aparece
  pelo `VIBES`; a dica explica que a landing é uma página só. Trocar a
  vibe já apaga `brand.design` em
  `app/api/admin/[tenant]/settings/route.ts:90`; mudar de multi para
  landing também precisa avisar que as páginas internas serão preservadas
  e precisam ser removidas explicitamente ou mantidas com outra vibe.
- `scripts/eval-harness.mjs` e `evals/cases/`: um caso `landing` com oferta,
  evidência e preço para a rubrica.
- `docs/design.md`, `docs/architecture.md`, `docs/harness.md`,
  `docs/copy.md`, `docs/eval-rubric.md` e `docs/verification.md` registram
  a forma do site, a gramática e as regras.

## 6. Sequência e tamanho

| PR  | Conteúdo    | Ganho                                                                       |
| --- | ----------- | --------------------------------------------------------------------------- |
| 1   | Fases 0 e 1 | A vibe existe, gera uma página com os blocos novos e passa nos gates atuais |
| 2   | Fase 2      | As boas práticas viram gates medidos                                        |
| 3   | Fase 3      | Prompt, crítica, painel e documentação fechando o ciclo                     |

Cada PR passa por `npx next typegen && npx tsc --noEmit`, `npm run lint`,
`npm run test:sites`, `npm run test:admin` e `npm run build:vercel`, além
da captura em 1440 px e 390 px do fixture da landing com navegação
fechada/aberta, botão fixo, foco por teclado e movimento reduzido, no CSS
de produção. Uma geração real com `npm run eval:site` em tenant
descartável é uma validação posterior: gera imagens e chama o modelo, então
exige autorização própria e não faz parte do aceite local desta entrega.

## 7. Riscos e decisões que ficam com o operador

- **Uma página indexável.** A landing contraria a premissa de inbound em
  três páginas que o produto vende. O plano mantém a página de obrigado e
  permite `post` opcional, mas não cria páginas internas. Se o operador
  quiser landing e site institucional juntos, isso é outro produto (duas
  vibes por tenant) e fica fora deste plano.
- **Prova depende de evidência.** Sem número, depoimento ou logotipo no
  briefing, a landing sai sem faixa de prova e o gate registra lacuna. O
  plano não afrouxa a factualidade para "parecer" as referências.
- **Imagem de produto.** As referências vivem de telas e mockups. O modelo
  de imagem gera fotos, não interfaces. Para software, a qualidade do hero
  depende do upload de imagens; sem ele, a cena gerada mostra o produto
  físico ou o resultado do serviço.
- **Papel escuro.** Duas das seis referências são escuras. A faixa fica
  clara por padrão para diferenciar de `moderno`; o escuro entra só por
  referência verificada com aspecto `surface`.
- **Gates compartilhados.** As fases 0 e 2 tocam `lintSite`, `nextPhase` e
  o schema do briefing. Cada mudança é condicionada por `siteShape`, e os
  testes atuais das quatro vibes precisam continuar passando sem edição.
- **Botão fixo no celular.** Precisa cumprir `lib/design/responsive.ts`,
  não cobrir o formulário nem o menu aberto e sumir quando o formulário
  está visível. Se não couber nessas condições, sai do PR 1 e vira aviso.
- **Custo.** Cinco blocos novos e um sistema de CSS completo são o maior
  bloco de trabalho; as regras da fase 2 são pequenas e podem entrar junto
  se o PR 1 ficar pequeno.
