# Design dos sites gerados

Referências lidas em 10/09/2026: [Frontend Design, Anthropic](https://github.com/anthropics/claude-code/blob/main/plugins/frontend-design/skills/frontend-design/SKILL.md) e [Taste Skill v1](https://github.com/Leonxlnx/taste-skill/blob/main/skills/taste-skill-v1/SKILL.md). Para mudanças de frontend, use ambas como direção, respeitando o negócio, o contrato do repositório e o código disponível. Este documento registra a adaptação ao gerador, não substitui a leitura das referências ao mudar a direção visual.

## Painel administrativo

O handoff `design_handoff_painel_admin`, recebido em 11/09/2026, orienta
entrada, clientes, editor, imagens, tráfego e dados. A prancha de estados é
referência para os componentes, sem rota de demonstração no produto.

O painel usa Geist e Geist Mono locais, acompanhadas da
[licença OFL](<../app/(admin)/fonts/LICENSE.txt>) do [projeto Geist](https://github.com/vercel/geist-font/blob/main/LICENSE.txt), fundo quente `#0c0b0a`, painéis
`#100f0e`, âmbar `#f0a868`, verde `#5fc98c` e vermelho `#f0705d`. O cabeçalho
contextual pertence ao layout do cliente e abre com o botão de voltar para a
lista; sair fica no fim das ações. O editor reserva 42% (até 520 px) à conversa,
com o andamento dentro dela, e devolve a altura inteira à prévia. No celular,
conversa e prévia são alternáveis.

`app/(admin)/admin.css` concentra os tokens e componentes `admin-*`; os três
grupos de rotas mantêm CSS e fontes separados. Textos funcionais pequenos usam
`--color-support: #938b7e`: os tons faint/dim da referência têm contraste baixo
e ficam em elementos decorativos. Foco visível, estados além da cor, tabelas
alternativas ao gráfico e movimento reduzido fazem parte da implementação.

O produto mantém credencial administrativa compartilhada, publicação validada
no editor, acervo sem aprovação e métricas derivadas do banco. Login Google,
recuperação de senha, identidade nominal, deltas comerciais e navegação de demo
do protótipo não representam recursos existentes. Os componentes foram
adaptados às APIs reais; o handoff não autoriza esses serviços adicionais.

## Direção e qualidade

A composição parte do briefing, da marca e de cenas coerentes com o cliente: uma seção protagonista, hierarquia de texto e variação de layout. Não há receita obrigatória de home. Cada projeto tem pelo menos três páginas orgânicas conectadas, com intenções de descoberta, consideração e conversão. Obrigado e landing de anúncio não completam esse mínimo. Serviços usam listas editoriais; números de ordem ficam em processos. Provas, garantias, equipamentos e capacidades operacionais dependem de evidência do briefing.

As skills divergem: frontend-design recomenda movimento pontual e identidade específica; taste-v1 propõe animações contínuas e uma estética fixa para certos bentos. Prevalecem a marca e o pedido atual do operador. Framer Motion realiza entradas coordenadas, revelações de seções, seleção visual e respostas a hover/toque em componentes de cliente isolados. O conteúdo sai visível do servidor, continua acessível sem JavaScript e respeita movimento reduzido. Dados inventados e fotos aleatórias sugeridos como placeholders na v1 não servem para sites de clientes reais.

`lib/taste/prompt.ts` contém a orientação operacional. `catalogForPrompt()`
deriva campos, enums, obrigatoriedade e limites dos schemas, e desde 10/09/2026
emite também para que serve cada bloco e em que proporção ele exibe a foto.
Esconder essa informação fazia o agente ignorar `feature.explorer` e
`editorial.resources`, que são as seções que sustentam uma home com imagens.
`describe_block` continua oferecendo o schema completo.

## Piso de composição

O cabeçalho `nav.bar` aceita `position: fixed` sem trocar layout ou direção da
marca. `backgroundOpacity` controla o fundo entre 70 e 100%; o tom escuro vem de
`presentation.tone: ink`. A ilha `NavigationFrame` mede e reserva sua altura,
incluindo o menu mobile, e ajusta a margem de rolagem das âncoras.

A variante `media.gallery/filmstrip` cria uma coluna por foto. Duas imagens
preenchem a largura disponível em desktop; acervos maiores rolam horizontalmente.
O CSS anterior sempre criava oito colunas e deixava seis vazias numa galeria
de duas fotos. A correção atua no renderizador, preservando conteúdo e imagens.

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
segundos, sem nunca olhar o resultado. O painel agora apresenta três etapas de
produto — **Preparar**, **Criar** e **Conferir** — enquanto
`lib/taste/phases.ts` preserva quatro checkpoints internos para retomar sem
refazer trabalho. Cada checkpoint recebe somente as ferramentas e o contexto
de que precisa; o catálogo completo entra na composição e na revisão.

1. **Briefing e direção**: `read_reference`, `define_image_guide`, `set_design`.
2. **Cenas**: o runner executa `prepare_site_images` diretamente com as vagas
   semânticas persistidas em `brief.imageScenes`.
3. **Composição**: `build_site` e `repair_site`.
4. **Revisão**: `review_pages` e as edições pontuais.

A próxima etapa vem do estado persistido, não da conversa: `nextPhase` lê
direção, cobertura do plano de cenas, páginas, erros e rodadas de revisão. A
sequência roda no servidor, em invocações encadeadas: recarregar o painel,
trocar de aparelho ou fechar a aba não perde o progresso nem interrompe a
execução. A cobertura
governa só antes da composição: depois que as páginas existem, foto faltando é
erro de pre-flight e quem resolve é a revisão, senão um cliente já publicado
com biblioteca menor que o plano voltaria a gerar cena sem ninguém pedir.

A etapa de cenas recebe de uma vez todas as vagas que faltam; o estúdio gera em
lotes paralelos de três, com crítica por imagem. Uma foto por requisição
transformava cinco cenas em cinco idas ao modelo e minutos de espera com o
painel parado. Cada imagem fica disponível com número e URL imediatamente, sem
aprovação. `sceneCoverage` mede o progresso
pelas fotos disponíveis, inclusive candidatas legadas, casando bloco e
proporção. O laço distingue uma nova cena de uma etapa sem progresso e admite
até 14 chamadas, incluindo todas as cenas do atelier e a revisão.

A biblioteca mantém o acervo numerado. `update_image` usa a imagem indicada
como referência, gera uma nova versão e troca a URL e o texto alternativo nos
rascunhos do mesmo tenant. O original e os snapshots publicados são preservados.
A crítica continua informativa; não é uma fila de aprovação.

`review_pages` reúne pre-flight, métricas e crítica visual do rascunho. O
pre-flight roda primeiro; erros conhecidos não consomem captura nem crítico. Um
Chromium atende o lote, com duas páginas em paralelo, repetição por viewport e
preservação das capturas boas quando um alvo falha. Cada página mantém seu
próprio recibo e só volta à fila quando seus pixels ou uma dependência global
mudam; imagem fora das páginas não invalida a revisão. Os pixels seguem como
imagens binárias a uma chamada separada do Gemini, e o chat recebe somente o
relatório estruturado. Overflow, imagem quebrada, falha de captura e cobertura
incompleta impedem a conclusão automática. Uma avaliação completa sem erro
material encerra; quando houve reparo, a segunda leitura confere apenas as
páginas afetadas. A captura é padrão; `EIXU_REVIEW_CAPTURE=0` deixa explícita a
ausência de conclusão visual.

O plano editorial em `brief.pagePlan` diferencia intenção, etapa, conteúdo e evidência por página. O raciocínio `high`, os orçamentos por tarefa e a identidade em SOUL.md dão suporte à composição; não substituem o catálogo, a medição e a leitura crítica. Veja [Harness](harness.md).

## Vibes

O operador escolhe a vibe no cadastro do cliente e ela vale para o site
inteiro. As quatro direções têm contratos próprios; `comercial` deixou de ser
uma faixa permissiva que podia reproduzir qualquer uma das outras. Referências
lidas em 10/09/2026: [Linear](https://linear.app/) para `moderno`,
[14islands](https://www.14islands.com/) para `ousado` e
[Actionline](https://actionline.io/) para `artistico`. Elas orientam a
linguagem visual; o conteúdo continua vindo do briefing do cliente.

| Vibe        | O que a faixa exige                                                                                                                      |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `comercial` | Display humanista/slab, hero split/cover, navegação em barra, ritmo direto, fotos emolduradas, superfície plana e cantos discretos.      |
| `moderno`   | Papel escuro, display geométrica/grotesca, hero editorial/offset, navegação mínima, capítulos, molduras e superfícies delineadas.        |
| `ousado`    | Display condensada/expressiva, hero cover/poster, navegação de contraste, fluxo contínuo, fotografia full-bleed, faixas e cantos retos.  |
| `artistico` | Display editorial/clássica, hero offset/atelier, navegação flutuante, alternância, colagem/cutout, camadas e motivos de anéis ou cantos. |

`lib/design/vibes.ts` guarda essas faixas, o texto de direção que entra no
prompt e a direção de imagem por vibe. `set_design` recusa a direção que sair
da faixa, apontando eixo, valor recebido e valores permitidos, e a trava de
unicidade compara clientes da mesma vibe. O catálogo tipográfico amplia as
combinações dentro de cada faixa, conservando a distância mínima de três eixos
entre clientes da mesma vibe.

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

## Tipografia e iconografia por vibe

A revisão de 11/09/2026 usa como referência o PDF **Tipografia para Web**,
de André Rafael (2015), fornecido pelo operador: contraste de escala, entrelinha,
medida, alinhamento e pareamento. Os exemplos históricos do livro não são
regras atuais de CSS nem instruções de operação do agente.

O catálogo de `lib/design/typography.ts` oferece **14 famílias**, com dez opções
de display e sete de corpo (algumas famílias atendem aos dois papéis). Schema,
prompt e `themeVars` compartilham o catálogo. IDs anteriores continuam válidos;
a mudança não reescreve direções de clientes nem exige migração.

| Vibe      | Possibilidades de pareamento                               | Iconografia e gesto                                           |
| --------- | ---------------------------------------------------------- | ------------------------------------------------------------- |
| Comercial | Roboto Slab + Source Sans 3; Manrope; Fraunces + Work Sans | Traço regular, suporte arredondado, elevação breve            |
| Moderno   | Sora + Source Sans 3; Space Grotesk + Geist                | Traço leve, suporte delineado e pequeno deslocamento diagonal |
| Ousado    | Barlow Condensed + Work Sans; Syne + Geist                 | Traço forte, suporte quadrado e impulso diagonal              |
| Artístico | Bodoni Moda + Source Sans 3; Fraunces + Literata           | Duotone, suporte orgânico e inclinação suave                  |

São opções de direção, não pares obrigatórios. O contexto do negócio orienta
a escolha. Display inclui Geist, Fraunces, Space Grotesk, Manrope, Geist Mono,
Sora, Barlow Condensed, Syne, Bodoni Moda e Roboto Slab. Corpo inclui Geist,
Newsreader, Space Grotesk, Manrope, Work Sans, Literata e Source Sans 3.
Condensadas e displays expressivas ficam fora do corpo. As faixas de cada vibe
continuam validadas por `set_design`.

`app/(sites)/typography.css` coordena títulos, subtítulos, lead, corpo, rótulos,
legendas e números tabulares. Peso, entrelinha e tracking acompanham a família;
os títulos preservam a escala fluida de cada composição. A medida de leitura
fica entre 60 e 65 caracteres nos textos longos. Citações usam itálico real
quando o corpo é Newsreader ou Literata. Fontes são auto-hospedadas por
`next/font`, com `preload: false`: ter o catálogo no CSS não baixa as 14 famílias
em cada página. O navegador busca apenas as famílias e estilos efetivamente usados.

`lib/blocks/icon.tsx` usa [Phosphor](https://github.com/phosphor-icons/react)
com imports individuais compatíveis com SSR e 26 símbolos semânticos. O campo
opcional `icon` nos itens de serviços, bento, narrativa, explorer e recursos é
validado por enum. Sem esse campo, o bloco mantém um símbolo neutro adequado
à sua função. Ícones não substituem fotos nem sustentam alegações comerciais.
O renderer fornece a vibe resolvida no servidor; blocos não escolhem um peso
arbitrário nem fornecem SVG ou URLs de ícones.

Ações, menus, FAQs, abas, formulários, etapas, provas, conteúdos, rotas e
contatos compartilham o sistema. Blocos de foto sem título/legenda continuam
priorizando a imagem. Ícones são decorativos junto do texto, saem visíveis no
SSR e não criam focos adicionais. Hover, foco visível, toque e estado aberto
têm respostas em `iconography.css`; badges entram uma vez pelo `SiteMotion`,
quando o dial permite. Não há animação infinita. Movimento reduzido desativa
as transições e as entradas e mantém o estado aberto reconhecível.

O institucional e o painel administrativo conservam fontes e estilos próprios.
As regras radicais de composição em `vibes.css` ficam limitadas a perfis de
design v3. Perfis v2 e sites legados preservam a apresentação atual até uma
recomposição explícita e nova publicação.

## Contrato visual v3

| Recurso              | Comportamento                                                                                                                                                                                                                                                                                                                                   |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Perfil persistido    | `brand.design`, versão 3, guarda conceito, elemento-assinatura e oito eixos estruturais. A leitura aceita v2 para preservar sites existentes. `tenant.brief` guarda também plano editorial e cenas semânticas.                                                                                                                                  |
| Tipografia           | 14 famílias, dez opções de display e sete de corpo, descritas acima. `next/font` auto-hospeda os arquivos; o navegador carrega somente as famílias usadas. Escala, peso, entrelinha, medida, legendas e números têm papéis consistentes.                                                                                                        |
| Vibe                 | `brand.vibe` limita os eixos, o raio, a luminância do papel e os dials que `set_design` aceita. Ausente significa `comercial`.                                                                                                                                                                                                                  |
| Paleta               | O cadastro oferece uma sugestão por vibe. Enquanto `paletteSource` for `sugerida`, a direção pode adaptá-la ao negócio; editar qualquer cor muda a origem para `operador` e trava `accent`, `accentAlt` e `highlight`. `ink`, `paper` e `surface` continuam com a direção. Contraste AA e diferença entre primária/secundária permanecem gates. |
| Composição global    | Seis heroes, quatro navegações, quatro ritmos, quatro tratamentos de imagem, quatro superfícies e cinco motivos formam a gramática do cliente. Dials controlam variância, densidade e motion. Atelier compõe ambiente e detalhe; não é padrão obrigatório.                                                                                      |
| Apresentação local   | Todo bloco aceita `presentation`: tom (incluindo a cor secundária), largura, respiro, alinhamento, borda e motion (`none`, `reveal`, `stagger`, `image`). Use um a três momentos de movimento coerentes com a narrativa.                                                                                                                        |
| Exploração e inbound | `feature.explorer` oferece seleção de aplicações com imagem, texto, fatos e CTA por aba; suporta teclado. `editorial.resources` conecta páginas com hierarquia editorial e imagem ou símbolo. Ambos oferecem layouts próprios.                                                                                                                  |
| Imagens              | Hero aceita posição, `cover`/`contain`, ponto focal e legendas; atelier aceita imagem secundária. A home exige duas fotos geradas distintas da biblioteca do tenant. Imagens geradas chegam ao agente com número e URL para uso imediato, sem aprovação.                                                                                        |
| Navegação e FAQ      | Menu mobile e perguntas usam `details`/`summary` nativos, foco visível e interação por teclado.                                                                                                                                                                                                                                                 |
| Âncoras              | Todo bloco aceita `anchor` opcional, começando com letra minúscula, seguido de letras/números/hífens, até 64 caracteres. Link usa `#anchor`. Duplicação bloqueia publicação. Formulário sem âncora mantém `contato`.                                                                                                                            |

## Unicidade e coerência

`set_design` compara oito decisões estruturais com os perfis dos outros tenants da mesma vibe. A direção precisa diferir em pelo menos três eixos do perfil mais próximo. Nome, briefing, texto, imagens e identidade do outro cliente não são retornados ao agente.

A home também recebe uma assinatura de composição baseada em sequência de tipos, layout, tom e borda das seções. Texto, URL e imagem são ignorados. `build_site`, `set_blocks`, as ferramentas de publicação e a API administrativa recusam uma home com assinatura idêntica a um rascunho ou snapshot publicado de outro tenant. Páginas com menos de quatro blocos de conteúdo ficam fora dessa trava para não forçar diferenças artificiais em obrigado ou páginas curtas.

Essas verificações detectam repetição estrutural; não medem qualidade estética nem comprovam coerência semântica. A revisão visual precisa conferir a ligação entre briefing, imagens, silhueta, ritmo e elemento-assinatura. Trocar cores e fontes para vencer o gate não substitui uma direção própria. Uma empresa de pedras pode privilegiar matéria e aplicações; isso não obriga outros negócios a usar a mesma colagem ou as mesmas abas.

O pre-flight v2 exige decisões locais de layout e presentation em páginas comerciais; somente escolher motion não conta como decisão de composição. `build_site` valida páginas e projeto antes de gravar o lote em uma transação. Um erro não substitui páginas válidas. Edições incrementais podem produzir rascunho inválido, mas a publicação continua bloqueada.

`lintSite` exige três páginas orgânicas com pelo menos 100 palavras de conteúdo, intenções e SEO distintos, etapas de inbound, links/âncoras válidos e alcance a partir da home. Também aplica o piso de composição descrito acima: duas fotos geradas distintas e uma seção protagonista na home, cor de marca em uma seção e imagem em toda página orgânica. A contagem de palavras impede páginas vazias, mas não prova utilidade editorial. `lib/sites/publish.ts` é compartilhado pela API, `publish_page` e `publish_site`: valida o estado que ficará ao vivo e publica o lote atomicamente. Uma publicação pontual não conta rascunhos de outras páginas como conteúdo publicado.

A proteção de exclusão consulta referências em rascunhos, páginas publicadas e logo, inclusive URLs aninhadas nos itens. A crítica orienta os ajustes sem exigir aprovação. Cenas geradas ilustram a proposta; não são evidência de obras, equipe ou instalações reais.

## Alcance

A mudança atua nos componentes compartilhados de `(sites)`, nos agentes de
site/imagem e no pre-flight. Institucional e painel mantêm seus próprios
layouts/CSS. Sites já publicados sem `brand.design` continuam no contrato
legado; o deploy não inventa uma direção nem reescreve seus blocos. Ao
reconstruir um cliente antigo, o agente cria o perfil v3 e recompõe as páginas
antes da nova publicação.

A prévia local de comparação usa três clientes sintéticos, sem gravar no tenant. Ela comprovou que o mesmo catálogo forma silhuetas distintas em desktop e mobile, mas não substitui uma avaliação de geração do modelo. Essa avaliação exige briefing controlado, tenant descartável e registro de qualidade, chamadas, latência e tokens.

Registro histórico, anterior ao harness de qualidade: medido em 10/09/2026 com tenant sintético, o prompt de edição livre tem 11.951
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

O painel usa Geist, superfícies escuras, texto claro e acento areia, com CSS isolado em `(admin)`. A hierarquia privilegia a tarefa: encontrar cliente; abrir Site, Imagens, Tráfego ou Dados; revisar antes de publicar. Cadastro novo fica recolhido até ser solicitado. Em desktop, conversa e prévia/biblioteca ficam lado a lado e ocupam a altura da tela, sem faixa de navegação lateral: voltar para a lista é um botão no cabeçalho do cliente. Abaixo de 1024 px, conversa e prévia alternam por botões, mantendo cabeçalho, publicação e avisos acessíveis.

Sugestões preenchem o compositor e aguardam envio. A prévia oferece seletor de página, largura desktop/celular e pendências de projeto e página. Erros HTTP aparecem como avisos, exclusão de imagem pede confirmação local e ações em andamento ficam desabilitadas. Dados simples e briefing têm formulário direto, sem chamada ao modelo. Tokens e custo ficam em detalhes recolhidos, com seu escopo declarado.

A coluna da conversa é o lugar do andamento, não só do texto: logo abaixo do
cabeçalho dela, um bloco compacto traz estado, etapa atual e ação numa linha,
três trilhas de produto, unidades realmente concluídas, tempo decorrido,
ferramenta em execução e linha do tempo recolhida. Captura e crítico atualizam
página, viewport e contagem durante a mesma ferramenta. A linha do tempo
continua sendo a via acessível para o mesmo conteúdo. A escala tipográfica tem
piso de 12 px, com 14 px no corpo das mensagens e a família monoespaçada nos
tempos, contagens e custos, em `tabular-nums`. Movimento é pontual e respeita
`prefers-reduced-motion`.

Cliente sem tentativa ou conversa anterior começa sozinho ao abrir a tela, sem botão e sem pergunta de abertura: ele chegou ali pelo cadastro. A condição inclui o histórico anterior à geração no servidor, nenhuma página e a primeira etapa pendente, porque retomar sozinho um rascunho antigo gastaria geração paga sem pedido. O consumo soma as fases gravadas no servidor e os turnos livres do stream.

O detalhamento de consumo tem altura limitada à tela, rolagem própria e região nomeada para navegação assistiva. Abrir o detalhe o traz à área visível. Em telas baixas, a coluna da conversa permite rolagem manual para alcançar todos os controles; a rolagem automática das mensagens continua restrita à lista, preservando o andamento acima dela.

A aplicação das duas referências prioriza hierarquia, contraste e feedback. O painel não precisa das animações expressivas dos sites de clientes para operar bem. O [manual](admin.md) descreve a jornada e a [revisão](admin-review.md) registra a verificação em 320, 390 e 1440 px.
