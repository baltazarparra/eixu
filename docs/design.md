# Design dos sites gerados

Referências lidas em 10/09/2026: [Frontend Design, Anthropic](https://github.com/anthropics/claude-code/blob/main/plugins/frontend-design/skills/frontend-design/SKILL.md) e [Taste Skill v1](https://github.com/Leonxlnx/taste-skill/blob/main/skills/taste-skill-v1/SKILL.md). Para mudanças de frontend, use ambas como direção, respeitando o negócio, o contrato do repositório e o código disponível. Este documento registra a adaptação ao gerador, não substitui a leitura das referências ao mudar a direção visual.

## Direção e custo

A composição parte do briefing, da marca e de cenas coerentes com o cliente: uma seção protagonista, hierarquia de texto e variação de layout. Não há receita obrigatória de home. Cada projeto tem pelo menos três páginas orgânicas conectadas, com intenções de descoberta, consideração e conversão. Obrigado e landing de anúncio não completam esse mínimo. Serviços usam listas editoriais; números de ordem ficam em processos. Provas, garantias, equipamentos e capacidades operacionais dependem de evidência do briefing.

As skills divergem: frontend-design recomenda movimento pontual e identidade específica; taste-v1 propõe animações contínuas e uma estética fixa para certos bentos. Prevalecem a marca e o pedido atual do operador. Framer Motion realiza entradas coordenadas, revelações de seções, seleção visual e respostas a hover/toque em componentes de cliente isolados. O conteúdo sai visível do servidor, continua acessível sem JavaScript e respeita movimento reduzido. Dados inventados e fotos aleatórias sugeridos como placeholders na v1 não servem para sites de clientes reais.

`lib/taste/prompt.ts` contém a orientação operacional. `catalogForPrompt()`
deriva campos, enums, obrigatoriedade e limites dos schemas, e desde 10/09/2026
emite também para que serve cada bloco e em que proporção ele exibe a foto.
Esconder essa informação fazia o agente ignorar `feature.explorer` e
`editorial.resources`, que são as seções que sustentam uma home com imagens.
`describe_block` continua oferecendo o schema completo.

## Piso de composição

Passar nos validadores não era o mesmo que entregar um site rico: uma home com
cinco seções, três delas só texto, duas fotos na abertura e subpáginas sem
imagem chegava a zero apontamentos. O contrato passou a medir composição, em
`lib/taste/metrics.ts`, e a recusar o que fica abaixo disso.

| Regra               | Nível | O que exige                                                                                                                 |
| ------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------- |
| `home-protagonista` | erro  | Uma seção de conteúdo da home reúne duas fotos do cliente. O hero atelier conta quando outra seção também mostra o negócio. |
| `pagina-sem-foto`   | erro  | Toda página orgânica do tipo `page` tem pelo menos uma imagem.                                                              |
| `home-paleta`       | erro  | A home aplica `accent` ou `secondary` em uma seção.                                                                         |
| `home-tons`         | aviso | A home alterna pelo menos três tons.                                                                                        |
| `imagem-proporcao`  | aviso | A proporção da foto corresponde ao que o layout exibe, por `expectedRatio`.                                                 |
| `layout-repetido`   | aviso | Dois blocos iguais com o mesmo layout em sequência.                                                                         |

O gate v2 de `lintPage` deixou de parar em três layouts e duas apresentações:
agora escala com o tamanho da página, até cinco e quatro. `expectedRatio`
traduz a variante de layout na proporção real exibida, porque o recorte é
`object-cover`: uma foto 4:3 num hero editorial perde um quarto da cena, que
foi o defeito observado em produção.

## Geração em etapas

Um único turno fazia briefing, direção, imagens e quatro páginas em 300
segundos, sem nunca olhar o resultado. `lib/taste/phases.ts` divide o trabalho
em quatro requisições, cada uma com suas ferramentas, seu limite de passos e o
contexto que ela precisa. O catálogo só entra na composição e na revisão.

1. **Briefing e direção**: `read_reference`, `define_image_guide`, `set_design`.
2. **Cenas**: `prepare_site_images`, uma cena por requisição, com o plano de
   `lib/images/scene-plan.ts`.
3. **Composição**: `build_site` e `repair_site`.
4. **Revisão**: `review_pages` e as edições pontuais.

A próxima etapa vem do estado persistido, não da conversa: `nextPhase` lê
direção, cobertura do plano de cenas, páginas, erros e rodadas de revisão.
Recarregar o painel ou interromper no meio não perde o progresso. A cobertura
governa só antes da composição: depois que as páginas existem, foto faltando é
erro de pre-flight e quem resolve é a revisão, senão um cliente já publicado
com biblioteca menor que o plano voltaria a gerar cena sem ninguém pedir.

A etapa de cenas gera uma imagem por requisição para respeitar o limite de
execução. Ela fica disponível com número e URL imediatamente; o painel segue
para a próxima cena sem pedir aprovação. `sceneCoverage` mede o progresso
pelas fotos disponíveis, inclusive candidatas legadas, casando bloco e
proporção. O laço distingue uma nova cena de uma etapa sem progresso e admite
até 14 chamadas, incluindo todas as cenas do atelier e a revisão.

A biblioteca mantém o acervo numerado. `update_image` usa a imagem indicada
como referência, gera uma nova versão e troca a URL e o texto alternativo nos
rascunhos do mesmo tenant. O original e os snapshots publicados são preservados.
A crítica continua informativa; não é uma fila de aprovação.

`review_pages` devolve o que ficou pobre com página e bloco apontados. Com
`EIXU_REVIEW_CAPTURE=1`, ela também abre o rascunho em 1440 e 390 com Chromium e
acrescenta a medição do navegador: largura da página, overflow e imagem
quebrada. As capturas não voltam ao modelo como imagem; medido, o base64 no
histórico da fase levou a entrada a 697 mil tokens contra 200 mil de limite.

## Vibes

O operador escolhe a vibe no cadastro do cliente e ela vale para o site
inteiro. `comercial` é o contrato descrito acima e não restringe nada; as
outras três delimitam a faixa em que a direção de arte decide. Referências
lidas em 10/09/2026: [Linear](https://linear.app/) para `moderno`,
[14islands](https://www.14islands.com/) para `ousado` e
[Actionline](https://actionline.io/) para `artistico`. Elas orientam a
linguagem visual; o conteúdo continua vindo do briefing do cliente.

| Vibe        | O que a faixa exige                                                                                                                         |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `comercial` | Nada. Todos os eixos, raios, papéis e dials continuam disponíveis.                                                                          |
| `moderno`   | Papel e superfície escuros, tinta clara, sans ou geométrica, capítulos ou ritmo contínuo, superfície delineada ou em camadas, raio pequeno. |
| `ousado`    | Papel claro, sans ou geométrica, hero editorial/cover/poster, navegação mínima, superfície plana ou de contraste, raio zero ou pequeno.     |
| `artistico` | Papel claro, display serifada ou humanista, hero deslocado/ateliê, superfície em camadas, motivo de anéis ou cantos, raio grande ou pílula. |

`lib/design/vibes.ts` guarda essas faixas, o texto de direção que entra no
prompt e a direção de imagem por vibe. `set_design` recusa a direção que sair
da faixa, apontando eixo, valor recebido e valores permitidos, e a trava de
unicidade passou a comparar só clientes da mesma vibe: as faixas se sobrepõem
em vários eixos, e um site moderno bloqueado por um ousado com os mesmos enums
seria uma recusa sem relação com o que se vê na tela. Dentro de cada faixa
sobram 864 combinações estruturais no moderno, 576 no ousado e 5.184 no
artístico, com folga para a distância mínima de três eixos.

O CSS por vibe fica em `app/(sites)/vibes.css`, sempre sob
`.site-theme[data-vibe='…']`, e realiza o que só o CSS resolve: escala e peso
da tipografia, respiro entre seções, linha de 1px, caixa alta dos rótulos,
lavagens de cor, cartão sobreposto no hero e filtro do mapa. O respiro da vibe
sobrepõe o de `data-density`, porque a faixa já limita os dials. Em papel
escuro, as faixas que pintam o fundo com a cor do texto (`cta.band`,
`editorial.facts` escuro, plano em destaque, card do bento e seções com tom
`ink`) viram um escuro elevado em vez de um bloco branco no meio da página.

Na vibe artística, `themeVars` resolve a lavagem de cor da superfície `soft`
antes de calcular os tokens de tinta, apoio e destaque. Se a mistura tirar o
contraste mínimo da tinta escolhida, usa o papel da marca. O CSS não substitui
essa superfície depois do cálculo. O cartão sobreposto do hero offset usa o
papel do tom da própria seção, conservando o par texto/fundo também em `ink`,
`accent` e `secondary`.

## Contatos e localização automáticos

Telefones, e-mail, endereços e redes sociais vêm do cadastro e são
renderizados fora do catálogo de blocos: os contatos no rodapé e a seção "Onde
estamos" logo acima dele, com o mapa carregado sob demanda e o link de rota.
São dado do operador, como o botão flutuante de WhatsApp, então não entram em
`pages.blocks`, no pre-flight nem na assinatura de composição. O prompt avisa
o agente para não repetir esses dados nem inventar contato, e a âncora
`onde-estamos` é reservada. `media.map` continua no catálogo para um mapa
adicional em outro ponto da página.

## Contrato visual v2

| Recurso              | Comportamento                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Perfil persistido    | `brand.design`, versão 2, guarda conceito, elemento-assinatura e oito eixos estruturais. `tenant.brief` guarda público, oferta, objetivo, personalidade, evidências e restrições. Não exige migração porque ambos os campos já são JSONB.                                                                                                                                                                                                                                                                                                                                                                  |
| Tipografia           | Display: Geist, Fraunces, Space Grotesk, Manrope ou Geist Mono. Corpo: Geist, Newsreader, Space Grotesk ou Manrope. `next/font` auto-hospeda os arquivos e evita troca de fonte após o carregamento.                                                                                                                                                                                                                                                                                                                                                                                                       |
| Vibe                 | `brand.vibe` limita os eixos, o raio, a luminância do papel e os dials que `set_design` aceita. Ausente significa `comercial`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Paleta               | `accent`, `accentAlt` e `highlight` vêm do cadastro do cliente e a direção não as reescreve: superfície de marca, tom complementar e cor da ação. `ink`, `paper` e `surface` continuam com a direção. A ferramenta recusa texto sem contraste AA em paper/surface e cores primária/secundária iguais; o render ainda ajusta acentos que não suportam texto legível. Sem `highlight`, a ação usa a primária. Botões usam `--highlight`/`--highlight-ink`; texto de destaque usa `--highlight-text`, medido contra o tom da seção ou a superfície interna do card/formulário, com contraste mínimo de 4,5:1. |
| Composição global    | Seis heroes, quatro navegações, quatro ritmos, quatro tratamentos de imagem, quatro superfícies e cinco motivos formam a gramática do cliente. Dials controlam variância, densidade e motion. Atelier compõe ambiente e detalhe; não é padrão obrigatório.                                                                                                                                                                                                                                                                                                                                                 |
| Apresentação local   | Todo bloco aceita `presentation`: tom (incluindo a cor secundária), largura, respiro, alinhamento, borda e motion (`none`, `reveal`, `stagger`, `image`). Use um a três momentos de movimento coerentes com a narrativa.                                                                                                                                                                                                                                                                                                                                                                                   |
| Exploração e inbound | `feature.explorer` oferece seleção de aplicações com imagem, texto, fatos e CTA por aba; suporta teclado. `editorial.resources` conecta páginas com hierarquia editorial e imagem ou símbolo. Ambos oferecem layouts próprios.                                                                                                                                                                                                                                                                                                                                                                             |
| Imagens              | Hero aceita posição, `cover`/`contain`, ponto focal e legendas; atelier aceita imagem secundária. A home exige duas fotos geradas distintas da biblioteca do tenant. Imagens geradas chegam ao agente com número e URL para uso imediato, sem aprovação.                                                                                                                                                                                                                                                                                                                                                   |
| Navegação e FAQ      | Menu mobile e perguntas usam `details`/`summary` nativos, foco visível e interação por teclado.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Âncoras              | Todo bloco aceita `anchor` opcional, começando com letra minúscula, seguido de letras/números/hífens, até 64 caracteres. Link usa `#anchor`. Duplicação bloqueia publicação. Formulário sem âncora mantém `contato`.                                                                                                                                                                                                                                                                                                                                                                                       |

## Unicidade e coerência

`set_design` compara oito decisões estruturais com os perfis dos outros tenants da mesma vibe. A direção precisa diferir em pelo menos três eixos do perfil mais próximo. Nome, briefing, texto, imagens e identidade do outro cliente não são retornados ao agente.

A home também recebe uma assinatura de composição baseada em sequência de tipos, layout, tom e borda das seções. Texto, URL e imagem são ignorados. `build_site`, `set_blocks`, as ferramentas de publicação e a API administrativa recusam uma home com assinatura idêntica a um rascunho ou snapshot publicado de outro tenant. Páginas com menos de quatro blocos de conteúdo ficam fora dessa trava para não forçar diferenças artificiais em obrigado ou páginas curtas.

Essas verificações detectam repetição estrutural; não medem qualidade estética nem comprovam coerência semântica. A revisão visual precisa conferir a ligação entre briefing, imagens, silhueta, ritmo e elemento-assinatura. Trocar cores e fontes para vencer o gate não substitui uma direção própria. Uma empresa de pedras pode privilegiar matéria e aplicações; isso não obriga outros negócios a usar a mesma colagem ou as mesmas abas.

O pre-flight v2 exige decisões locais de layout e presentation em páginas comerciais; somente escolher motion não conta como decisão de composição. `build_site` valida páginas e projeto antes de gravar o lote em uma transação. Um erro não substitui páginas válidas. Edições incrementais podem produzir rascunho inválido, mas a publicação continua bloqueada.

`lintSite` exige três páginas orgânicas com pelo menos 100 palavras de conteúdo, intenções e SEO distintos, etapas de inbound, links/âncoras válidos e alcance a partir da home. Também aplica o piso de composição descrito acima: duas fotos geradas distintas e uma seção protagonista na home, cor de marca em uma seção e imagem em toda página orgânica. A contagem de palavras impede páginas vazias, mas não prova utilidade editorial. `lib/sites/publish.ts` é compartilhado pela API, `publish_page` e `publish_site`: valida o estado que ficará ao vivo e publica o lote atomicamente. Uma publicação pontual não conta rascunhos de outras páginas como conteúdo publicado.

A proteção de exclusão consulta referências em rascunhos, páginas publicadas e logo, inclusive URLs aninhadas nos itens. A crítica orienta os ajustes sem exigir aprovação. Cenas geradas ilustram a proposta; não são evidência de obras, equipe ou instalações reais.

## Alcance

A mudança atua nos componentes compartilhados de `(sites)`, nos agentes de site/imagem e no pre-flight. Institucional e painel mantêm seus próprios layouts/CSS. Sites já publicados sem `brand.design` continuam no contrato legado; o deploy não inventa uma direção nem reescreve seus blocos. Ao reconstruir um cliente antigo, o agente cria o perfil v2 e recompõe as páginas antes da nova publicação.

A prévia local de comparação usa três clientes sintéticos, sem gravar no tenant. Ela comprovou que o mesmo catálogo forma silhuetas distintas em desktop e mobile, mas não substitui uma avaliação de geração do modelo. Essa avaliação exige briefing controlado, tenant descartável e registro de qualidade, chamadas, latência e tokens.

Medido em 10/09/2026 com tenant sintético, o prompt de edição livre tem 11.951
caracteres, contra 12.536 antes da divisão por fases, mesmo com o catálogo
maior. Por fase: briefing 3.859, cenas 2.758, composição 11.076 e revisão
9.269. É tamanho de texto, não tokens faturados; o evento `[chat] usage`, agora
com o campo `phase`, continua sendo a medida operacional.

A régua de avaliação está versionada: `evals/cases/` traz os briefings,
`docs/eval-rubric.md` a rubrica e `npm run eval:site` roda o fluxo real num
tenant descartável, gravando o relatório em `outputs/evals/`. Com `--generate`,
o runner gera fotos já disponíveis e segue o mesmo fluxo sem aprovação, com
limite de 14 chamadas para incluir as seis cenas do atelier e a revisão.
`report.flow` informa conclusão, próxima fase, motivo da parada e tentativas.
Limite esgotado ou fase com erro resultam em
execução incompleta e código de saída 1.

## Interface de operação do admin

O painel usa Geist, superfícies escuras, texto claro e acento areia, com CSS isolado em `(admin)`. A hierarquia privilegia a tarefa: encontrar cliente; abrir Site, Imagens, Tráfego ou Dados; revisar antes de publicar. Cadastro novo fica recolhido até ser solicitado. Em desktop, conversa e prévia/biblioteca ficam lado a lado e ocupam a altura da tela. Abaixo de 1024 px, alternam por botões, mantendo navegação, publicação e avisos acessíveis.

Sugestões preenchem o compositor e aguardam envio. A prévia oferece seletor de página, largura desktop/celular e pendências de projeto e página. Erros HTTP aparecem como avisos, exclusão de imagem pede confirmação local e ações em andamento ficam desabilitadas. Dados simples e briefing têm formulário direto, sem chamada ao modelo. Tokens e custo do chat ficam em detalhes recolhidos, com seu escopo declarado.

A aplicação das duas referências prioriza hierarquia, contraste e feedback. O painel não precisa das animações expressivas dos sites de clientes para operar bem. O [manual](admin.md) descreve a jornada e a [revisão](admin-review.md) registra a verificação em 320, 390 e 1440 px.
