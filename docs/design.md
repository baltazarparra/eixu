# Design dos sites gerados

## Landing Page v7

A quinta vibe acrescenta uma forma de site: home indexável e obrigado, com a
mesma ação na abertura, no meio e no fechamento. Não recebe as doze estruturas
multipágina nem `signature.composition`. O perfil v7 preserva os eixos de design
e permite referência visual verificada, mantendo hero `stage`/`form` e navegação
`minimal`. Os perfis v2-v6 publicados conservam seu contrato.

O preset usa papel branco, tinta `#0b0b0f`, acento `#16a34a`, secundária
`#ecfdf5`, destaque `#f59e0b`, display grotesca/geométrica e corpo sans/geométrico.
A paleta final continua passando por contraste AA e respeita cores do operador.
A sequência reúne hero, prova, problema/promessa, demonstração, passos,
depoimentos, preço quando confirmado, FAQ e fechamento. São 6–11 seções e no
mínimo 250 palavras úteis na home, sem contar navegação e rodapé.

| Bloco                 | Layouts             | Contrato                                                                                                           |
| --------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `hero.landing`        | `stage`, `form`     | Até 60 caracteres; imagem em moldura ou formulário nativo com 2–4 campos. `form` permite foto 4:5 junto da oferta. |
| `proof.strip`         | `logos`, `numbers`  | 3–6 marcas ou 2–4 números; cada item aponta uma evidência literal do briefing.                                     |
| `narrative.statement` | `center`, `split`   | Problema ou promessa em uma frase, até 160 caracteres.                                                             |
| `feature.showcase`    | `steps`, `tabs`     | 2–4 itens com imagem; abas com setas e Home/End, todos os painéis legíveis sem JS ou na edição.                    |
| `proof.testimonials`  | `grid`, `spotlight` | 2–3 citações, autor, cargo e resultado sustentados pela mesma evidência; foto opcional somente do acervo enviado.  |

A protagonista é `feature.showcase` ou `feature.bento:showcase` com duas fotos.
O plano mantém cinco cenas na home: hero, duas da protagonista, apoio em
`media.image` e fechamento em `cta.band`. Não solicita retratos de clientes
para preencher depoimentos. A imagem da faixa final fica separada do texto.

Os controles têm alvo de 48 px e formulários em coluna única. `nav.bar.stickyCta`
com `position: fixed` habilita o botão inferior de 56 px em telas abaixo de
1024 px e com pelo menos 440 px de altura. Ele respeita a área segura e some
com formulário visível, campo em foco, menu aberto, sem JS ou em edição.
A FAQ usa duas colunas a partir de 1024 px; movimento reduzido preserva o
conteúdo e desliga animações.

`landingFindings` bloqueia ação divergente, menu fora da home, prova sem
correspondência literal, preço não confirmado, páginas extras e formulário
sem obrigado. Repetição da ação é aviso. `form.lead` com 5–6 campos avisa;
menos de 2 ou mais de 6 bloqueia. O hero embutido só aceita 2–4 no schema.
A correspondência de evidência verifica o texto fornecido, não a veracidade
externa; a confirmação continua sendo responsabilidade editorial.

A unicidade compara somente landings v7: exige dois eixos diferentes e mede
semelhança de silhueta entre direções próximas. Navegação, catálogo, plano de
cenas, prompt, crítico e publicação compartilham essa decisão.
Veja o [plano implementado](plano-vibe-landing-page.md) e os
[registros de validação local](verification.md).

Referências lidas em 10/09/2026: [Frontend Design, Anthropic](https://github.com/anthropics/claude-code/blob/main/plugins/frontend-design/skills/frontend-design/SKILL.md) e [Taste Skill v1](https://github.com/Leonxlnx/taste-skill/blob/main/skills/taste-skill-v1/SKILL.md). Para mudanças de frontend, use ambas como direção, respeitando o negócio, o contrato do repositório e o código disponível. Este documento registra a adaptação ao gerador, não substitui a leitura das referências ao mudar a direção visual.

## Painel administrativo

O handoff `design_handoff_painel_admin`, recebido em 11/09/2026, orienta
entrada, clientes, editor, imagens, tráfego e dados. A prancha de estados é
referência para os componentes, sem rota de demonstração no produto.

O painel usa Geist e Geist Mono locais, acompanhadas da
[licença OFL](<../app/(admin)/fonts/LICENSE.txt>) do [projeto Geist](https://github.com/vercel/geist-font/blob/main/LICENSE.txt), fundo quente `#0c0b0a`, painéis
`#100f0e`, âmbar `#f0a868`, verde `#5fc98c` e vermelho `#f0705d`. O cabeçalho
contextual pertence ao layout do cliente e abre com **Voltar** secundário e o
controle primário da conversa; sair fica no fim das ações. O editor reserva 42% (até 520 px) à conversa,
com o andamento dentro dela, e devolve a altura inteira à prévia. A partir de
1024 px, esse botão recolhe a conversa até uma faixa de 56 px — no máximo 5,5%
da viewport — e entrega o restante à prévia. Outro controle simples fica no
centro da borda direita da conversa e permanece na faixa: ele recolhe e expande
o painel como um toggle. Entre 1024 e 1440 px a coluna de 42% deixava o desktop
apertado. No celular, conversa e prévia são alternáveis.

Em edições pelo chat, a atividade e o tempo ficam junto do compositor, fora
da rolagem do histórico, e se repetem acima da prévia para quem recolheu a
conversa ou usa a aba Prévia no celular. O iframe tem uma linha discreta de
carregamento, confirmação ou falha com nova tentativa. A atualização acontece
ao confirmar a escrita, preservando a rolagem da mesma página.

O handoff `design_handoff_cabecalho_unico`, recebido em 12/09/2026, substituiu
os três cabeçalhos do editor (página, conversa e prévia, 207 px somados) por
uma barra de 64 px em `components/admin/navigation.tsx`: identidade com
domínio, abas de altura inteira com sublinhado âmbar, o grupo PRÉVIA (caminho
da página com pill de rascunho, larguras Desktop/Celular e abrir em outra aba)
e, depois de um divisor, só o que condiciona a publicação: diamante compacto
de 32 px, aviso **Revisão pendente** e **Publicar**. O editor injeta os dois
grupos vivos por portais em dois slots da barra. A conversa começa no
andamento e a contagem de turnos desceu para a dica do compositor. Abaixo de
1520 px o rótulo PRÉVIA some; abaixo de 1280 px a barra fica em 52 px sem a
linha do domínio e o grupo PRÉVIA volta para uma faixa no topo da coluna da
prévia; abaixo de 1024 px as abas ocupam uma linha própria e, no celular, a
decisão também.

A prévia vazia durante a geração usa um diamante negro em WebGL
(`components/admin/generation-diamond.tsx`): lapidação brilhante procedural com
shader próprio, fresnel e refração com dispersão sobre um estúdio escuro, sem
anel. A pedra tem 70% da escala inicial e gira à metade da velocidade original.
Passar o mouse ou arrastar com toque na pedra dá impulso horizontal: a favor
do giro acelera; contra freia e pode inverter o sentido. O impulso se dissipa
até a velocidade automática. Com movimento reduzido, só o gesto move a pedra,
sem inércia; a rolagem vertical e o zoom por toque continuam disponíveis.
Ele não estima porcentagem: fecha facetas só com unidades medidas em
`creationProgress`, a mesma leitura do painel. A versão compacta tem 32 px no
grupo de decisão da barra, ao lado de **Publicar**, quando já existe página,
e mantém a escala cheia da pedra: a 70% ela sumia nesse tamanho.

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

A edição direta usa uma barra junto ao campo no desktop e presa ao rodapé da
prévia abaixo de 640 px, com rolagem própria em telas baixas. Foco e erros têm
contorno e texto; o contraste aparece numericamente. O CSS da ilha só é
carregado na prévia em edição. Menus e painéis ficam visíveis, movimento e
navegação ficam suspensos, e o cabeçalho troca Publicar por Salvar/Cancelar.

## Texto por campo

A prop comum `textStyles` aceita até 40 entradas únicas com `field`, `size`
entre -2 e 2 e/ou `color` em hex de seis dígitos. Não aceita CSS livre.
`lib/blocks/fields.ts` deriva o inventário do catálogo, incluindo limites e
piso de leitura. Textos de controles, inclusive os títulos das abas do
explorador, são editáveis sem estilo individual.

`textAttrs` insere `.site-styled` apenas em campos com estilo; sem ele, o HTML
público permanece igual. O span usa 80, 90, 100, 115 ou 130% sobre a tipografia
fluida existente. Cor explícita remove a opacidade decorativa do texto para
preservar o contraste medido. `data-field` e `data-part` só existem na edição.

`sectionBackgrounds` e `fieldBackgrounds` compartilham tokens com o renderer,
incluindo tons, fundos locais, cartões, painéis, superfícies modernas e
legendas translúcidas. Seções sem tom consideram papel e superfície alternada.
O servidor exige 4,5:1 no salvamento e na publicação. A ilha também mede o
fundo calculado pelo navegador, incluindo transparência e `color-mix`. Texto
sobre foto sem um painel uniforme só permite cor automática; tamanho segue
editável. Não se presume uma cor de fundo a partir da imagem.

## Direção e qualidade

A composição parte da história do cliente, da marca e de cenas coerentes: uma
seção protagonista, hierarquia de texto e variação de layout. Sem referência, o
perfil v5 escolhe uma de três estruturas completas da vibe. Com uma referência
visual verificada, o perfil v6 escolhe a estrutura mais próxima entre as doze e
leva suas aplicações para toda a direção visual. Cada projeto tem pelo menos
três páginas orgânicas conectadas, com intenções de descoberta, consideração e
conversão. Provas, garantias, equipamentos e capacidades operacionais dependem
de evidência da história ou das fontes do próprio cliente.

As skills divergem: frontend-design recomenda movimento pontual e identidade específica; taste-v1 propõe animações contínuas e uma estética fixa para certos bentos. Prevalecem a marca e o pedido atual do operador. Framer Motion realiza entradas coordenadas, revelações de seções, seleção visual e respostas a hover/toque em componentes de cliente isolados. O conteúdo sai visível do servidor, continua acessível sem JavaScript e respeita movimento reduzido. Dados inventados e fotos aleatórias sugeridos como placeholders na v1 não servem para sites de clientes reais.

`lib/taste/prompt.ts` contém a orientação operacional. `catalogForPrompt()`
deriva campos, enums, obrigatoriedade e limites dos schemas, e desde 10/09/2026
emite também para que serve cada bloco e em que proporção ele exibe a foto.
Esconder essa informação fazia o agente ignorar `feature.explorer` e
`editorial.resources`, que são as seções que sustentam uma home com imagens.
`describe_block` continua oferecendo o schema completo.

## Piso de composição

Edições pontuais aceitam `presentation.background` em hex e `foreground`
opcional, com contraste validado. São cores locais da seção e prevalecem
sobre o tom padrão da vibe sem mudar a marca. O renderer respeita a ordem
salva inclusive para uma seção inserida depois do rodapé; a localização
automática continua antes dele. Veja o [contrato de edição](chat-edits.md).

O cabeçalho `nav.bar` aceita `position: fixed` sem trocar layout ou direção da
marca. `backgroundOpacity` controla o fundo entre 70 e 100%; o tom escuro vem de
`presentation.tone: ink`. A ilha `NavigationFrame` mede e reserva sua altura,
sem incluir o painel mobile, e ajusta a margem de rolagem das âncoras.

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

## Navegação responsiva

O contrato em `lib/design/responsive.ts` vale para todas as vibes, referências e
perfis legados, sem migrar sua composição. `navigation.css` mantém logo e Menu
na mesma barra, com alvos de pelo menos 44 px. `logoImage` usa o PNG recortado
com atributos proporcionais às dimensões reais, reservando o espaço antes do
carregamento. A altura padrão vem da proporção: 40 px a partir de 3,5; 48 px
entre 2 e 3,5; 56 px entre 1 e 2; 64 px abaixo de 1. Sem asset fresco, permanece
o fallback de 48 px. O rodapé usa 75% da altura. `logoHeight` continua sendo
um ajuste explícito do operador; no cabeçalho compacto o limite é 48 px e a largura
disponível, preservando a proporção. Abaixo de 1024 px, ou quando a largura real
dos destinos não cabe, `NavigationFrame` recolhe links e CTA juntos.

`MobileNavigation` abre um diálogo nativo acima das camadas do site, com fundo
opaco no tom do cabeçalho, página atual e CTA. O painel tem altura dinâmica,
áreas seguras e rolagem própria; a barra não aumenta nem empurra a abertura.
Escape, Fechar, toque no fundo e escolha de destino encerram o menu. Foco e
rolagem voltam ao contexto anterior; âncoras respeitam a barra fixa. Ao voltar ao
desktop ou desmontar a página, a rolagem é liberada. Sem JavaScript, o mesmo
conteúdo continua disponível por `details`.

Direção, composição e edição recebem o contrato responsivo. Quando solicitada,
a revisão automática exercita abertura e fechamento e envia também os pixels do
menu aberto ao crítico. As medições entram como erros de revisão; não ligam uma
revisão automática após gerar nem substituem o pre-flight de publicação.

## Geração em etapas

Um único turno fazia briefing, direção, imagens e quatro páginas em 300
segundos, sem nunca olhar o resultado. O painel agora apresenta duas etapas de
produto — **Preparar** e **Criar** — enquanto
`lib/taste/phases.ts` preserva três checkpoints internos para retomar sem
refazer trabalho. Cada checkpoint recebe somente as ferramentas e o contexto
de que precisa; o catálogo completo entra na composição. A revisão posterior é humana pela prévia.

1. **Briefing e direção**: `read_reference`, `define_image_guide`, `set_design`.
2. **Cenas**: o runner executa `prepare_site_images` diretamente com as vagas
   semânticas persistidas em `brief.imageScenes`.
3. **Composição**: `build_site` e `repair_site`.

A próxima etapa vem do estado persistido, não da conversa: `nextPhase` lê
direção, cobertura do plano de cenas e páginas. Páginas montadas encerram a geração. A
sequência roda no servidor, em invocações encadeadas: recarregar o painel,
trocar de aparelho ou fechar a aba não perde o progresso nem interrompe a
execução. A cobertura
governa só antes da composição: depois que as páginas existem, foto faltando é
erro de pre-flight que o operador pode ajustar pelo chat, senão um cliente já publicado
com biblioteca menor que o plano voltaria a gerar cena sem ninguém pedir.

A etapa de cenas recebe de uma vez todas as vagas que faltam; o estúdio gera em
lotes paralelos de três, com crítica por imagem. Uma foto por requisição
transformava cinco cenas em cinco idas ao modelo e minutos de espera com o
painel parado. Cada imagem fica disponível com número e URL imediatamente, sem
aprovação. `sceneCoverage` mede o progresso
pelas fotos disponíveis, inclusive candidatas legadas, casando bloco e
proporção. O laço distingue uma nova cena de uma etapa sem progresso e admite
até 14 chamadas, incluindo todas as cenas do atelier e a revisão.

A biblioteca mantém o acervo numerado de imagens geradas e fotos enviadas. **Enviar imagens** abre seleção múltipla, com andamento e falhas por arquivo. As fotos enviadas têm os mesmos atalhos de uso e alteração, entram na composição e mantêm sua proporção real. `update_image` usa a imagem indicada
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

Cada vibe também tem uma [voz de escrita](copy.md). Comercial é direta e
prestativa; moderno, claro e preciso; ousado, firme e curto; artístico, próximo
e sensível. Todas usam palavras do dia a dia. `lib/copy/policy.ts` é a fonte
compartilhada pela geração, edição e crítica; o estilo visual não autoriza
inglês, jargão ou texto difícil.

O operador escolhe a vibe no cadastro como direção inicial para o site inteiro.
Referências visuais verificadas nesse cadastro têm prioridade sobre a vibe. Sem
essa direção, as cinco vibes têm contratos próprios e delimitam a faixa em que
a direção de arte decide; `comercial` deixou de poder reproduzir qualquer uma
das outras. Referências
lidas em 10/09/2026: [Linear](https://linear.app/) para `moderno`,
[14islands](https://www.14islands.com/) para `ousado` e
[Actionline](https://actionline.io/) para `artistico`; em 12/09/2026 o
moderno foi recriado sobre Linear, [Resend](https://resend.com/) e
[Untold](https://untold.site/pt). Elas orientam a linguagem visual; o
conteúdo continua vindo do briefing do cliente.

| Vibe        | O que a faixa exige                                                                                                                      |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `comercial` | Display humanista/slab, hero split/cover, navegação em barra, ritmo direto, fotos emolduradas, superfície plana e cantos discretos.      |
| `moderno`   | Papel quase preto e liso, display geométrica/grotesca, hero editorial/offset, navegação mínima, capítulos com fio de 1px, rótulos mono.  |
| `ousado`    | Display condensada/expressiva, hero cover/poster, navegação de contraste, fluxo contínuo, fotografia full-bleed, faixas e cantos retos.  |
| `artistico` | Display editorial/clássica, hero offset/atelier, navegação flutuante, alternância, colagem/cutout, camadas e motivos de anéis ou cantos. |

`lib/design/vibes.ts` guarda essas faixas, o texto de direção que entra no
prompt e a direção de imagem por vibe. Sem referência, `set_design` recusa a
direção que sair da faixa. No perfil v6, a leitura completa de uma única
referência libera estrutura, eixos, raio, luminância e dials; apenas contraste,
marca, factualidade, responsividade, catálogo e piso de composição continuam
como limites. `lib/design/structures.ts` guarda as estruturas e a composição
autoral usadas pelos dois perfis.

## Estruturas v5/v6 e composição autoral

Sites multipágina novos gravam `structure` e `structureRationale`. V5 escolhe entre as três
jornadas da vibe; v6 escolhe entre as doze pela proximidade com a referência.
Cada jornada fixa abertura, ordem mínima,
protagonista, apoios, fechamento, proporção das cenas e um layout de
`signature.composition`. Seções úteis podem entrar entre as marcas obrigatórias;
a ordem dessas marcas não pode mudar.

| Vibe      | Estrutura               | Sequência mínima da home                                                        |
| --------- | ----------------------- | ------------------------------------------------------------------------------- |
| Comercial | `comercial-atendimento` | hero split, percurso numerado, `decision-path`, dúvidas, formulário             |
| Comercial | `comercial-vitrine`     | hero cover, `service-lens`, explorador, recursos, CTA split                     |
| Comercial | `comercial-confianca`   | hero split, contexto, dúvidas, `proof-route`, CTA band                          |
| Moderno   | `moderno-editorial`     | hero editorial, texto lead, `editorial-index`, narrativa editorial, CTA minimal |
| Moderno   | `moderno-sistema`       | hero offset, `system-map`, trilho numerado, etapas, CTA split                   |
| Moderno   | `moderno-exploracao`    | hero editorial, explorador, `detail-lens`, recursos, formulário                 |
| Ousado    | `ousado-manifesto`      | hero cover, `impact-manifesto`, texto lead, imagem bleed, CTA poster            |
| Ousado    | `ousado-campanha`       | hero poster, colagem, `campaign-sequence`, etapas horizontais, CTA band         |
| Ousado    | `ousado-mostruario`     | hero cover, `visual-selector`, galeria, fatos poster, CTA poster                |
| Artístico | `artistico-atelier`     | hero atelier, `material-table`, narrativa overlap, galeria masonry, formulário  |
| Artístico | `artistico-revista`     | hero offset, texto lead, `editorial-spread`, recursos, CTA split                |
| Artístico | `artistico-galeria`     | hero atelier, filmstrip, `story-orbit`, narrativa reverse, CTA band             |

`signature.composition` é um bloco controlado e editável, renderizado no
servidor. O schema exige de três a seis itens, exatamente um `focus`, pelo
menos um `support`, alt em toda imagem e o layout da estrutura. Percurso,
lente, mapa e ensaio editorial têm árvores semânticas distintas; as doze
variantes mudam a composição em CSS e colapsam para uma coluna em tela estreita.
No celular, as etapas da campanha reservam espaço para a numeração sem cobrir
texto, foto ou ação.
O bloco recebe duas cenas geradas do assunto do cliente. Não aceita HTML,
JavaScript ou CSS gerado por tenant.

O pre-flight v5/v6 recusa home sem uma única composição autoral, sequência fora de
ordem ou protagonista sem duas fotos geradas. A comparação entre tenants usa
tipo, layout, ordem, papéis, presença de mídia e ação da assinatura. Texto,
nome, imagem e URL do outro cliente não entram na assinatura nem na mensagem.
Isso permite partir da mesma estrutura quando a composição interna muda de
verdade, sem aceitar a mesma home pintada de outra cor.

## Gramática da vibe

Medido em 12/09/2026 nos clientes `chiquinho` (artístico) e `tech` (ousado),
com vibes e referências diferentes: as duas homes tinham quatro das cinco
seções iguais, nos mesmos layouts e na mesma ordem, e passavam em todos os
gates. A silhueta não pertencia à vibe. Três causas se somavam.

1. `scenePlan` pedia sempre os mesmos alvos, qualquer que fosse a vibe. A foto
   nasce com `target_block` gravado e usá-la em outro bloco vira aviso de
   proporção, então a composição montava exatamente o que a biblioteca
   rotulava.
2. Uma referência visual verificada pulava a faixa inteira em `set_design`, e
   `renderingVibeOf` devolvia `comercial`: CSS da vibe, iconografia e tom da
   localização sumiam junto.
3. A trava de unicidade exigia igualdade exata da sequência, com tom e borda.
   Trocar a cor de fundo de uma seção já passava.

`VIBE_GRAMMAR` define, por vibe, a abertura da home, a seção protagonista, as
aberturas internas, os fechamentos, as combinações a evitar e os alvos de cena
das páginas internas. A notação é `tipo:layout`, e o layout ausente nas props é
resolvido pelo padrão do componente (`DEFAULT_LAYOUT` em `lib/blocks/registry.ts`)
ou, no hero e na navegação, pela composição do perfil.

| Vibe        | Abertura da home                            | Seção protagonista                                     | Cenas das páginas internas           |
| ----------- | ------------------------------------------- | ------------------------------------------------------ | ------------------------------------ |
| `comercial` | `hero.split:split`, `hero.split:cover`      | `feature.explorer:showroom`, `feature.bento:gallery`   | `narrative.split`, `media.image`     |
| `moderno`   | `hero.split:editorial`, `hero.split:offset` | `feature.bento:showcase`, `feature.explorer:panorama`  | `media.image`, `narrative.split`     |
| `ousado`    | `hero.split:cover`, `hero.split:poster`     | `media.gallery:collage`, `media.gallery:grid`          | `media.image`, `media.image`         |
| `artistico` | `hero.split:offset`, `hero.split:atelier`   | `media.gallery:masonry`, `editorial.resources:feature` | `narrative.split`, `narrative.split` |

As aberturas saem da composição de hero da própria faixa, então o plano de
cenas e a gramática nunca pedem proporções diferentes. `scenePlan` recebe a
vibe e deriva os alvos dessa tabela; uma composição fora da faixa cai na que a
vibe sustenta, para a foto de abertura nascer na proporção que a home exibe.
`catalogForPrompt({ vibe })` marca o papel de cada bloco, e `grammarDirection`
entra no prompt em toda fase com composição e na crítica visual.

| Regra                           | Nível | O que exige                                                         |
| ------------------------------- | ----- | ------------------------------------------------------------------- |
| `abertura-fora-da-vibe`         | erro  | A primeira seção da home está na lista de aberturas da vibe.        |
| `protagonista-fora-da-vibe`     | erro  | A home tem a seção protagonista da vibe, que carrega as duas fotos. |
| `abertura-interna-fora-da-vibe` | aviso | A abertura de cada página interna sai da gramática.                 |
| `fechamento-fora-da-vibe`       | aviso | A última seção da página é um fechamento da vibe.                   |
| `secao-vetada`                  | aviso | Nenhuma seção usa uma combinação que contradiz a vibe.              |

Essas regras valem para os perfis 4, 5 e 6. V4 conserva a faixa ampla da vibe;
v5 aplica a estrutura da vibe e v6 aplica a estrutura selecionada pela
referência. Sites publicados em
v2 e v3 continuam com a composição que já têm; recompor exige uma nova direção
e uma nova publicação. Na retomada, o plano de cenas conserva os alvos,
proporções, pedidos semânticos e cobertura do perfil antigo; o prompt e o
crítico também preservam essa composição. A seção protagonista precisa conter,
ela própria, duas URLs distintas de fotos geradas disponíveis do cliente. Fotos
em outro bloco não completam essa exigência.

A unicidade passou a medir proporção em vez de igualdade. `silhouette` reduz a
página à sequência `tipo:layout`, sem texto, imagem nem tom;
`silhouetteSimilarity` conta as seções em comum sobre a página maior; acima de
`SILHOUETTE_LIMIT`, 0,75, a home é recusada em `build_site`, `set_blocks` e na
publicação de perfis v4. V5 usa a maior subsequência comum e expande a marca da
assinatura com papéis, mídia e ação. As duas homes medidas em produção dão 0,80.
Perfis v2/v3 conservam a trava de igualdade exata, incluindo ordem, tom e borda.
A comparação atravessa todas as vibes e não devolve texto, nome ou imagem do
outro cliente. Cada snapshot usa seu próprio perfil para resolver layouts
implícitos: o rascunho usa a marca atual; o publicado, a marca publicada.

O CSS por vibe fica em `app/(sites)/vibes.css`, sempre sob
`.site-theme[data-vibe='…']`, e realiza o que só o CSS resolve: escala e peso
da tipografia, respiro entre seções, linha de 1px, caixa alta dos rótulos,
lavagens de cor, cartão sobreposto no hero e filtro do mapa. O respiro da vibe
sobrepõe o de `data-density`, porque a faixa já limita os dials. Em papel
escuro, as faixas que pintam o fundo com a cor do texto (`cta.band`,
`editorial.facts` escuro, plano em destaque, card do bento e seções com tom
`ink`) viram um escuro elevado em vez de um bloco branco no meio da página.
Variáveis emitidas inline por `themeVars` (`--line`, `--radius`, cores) não se
redefinem na raiz pelo CSS da vibe; o moderno usa `--hairline` própria para o
fio entre capítulos.

Na vibe artística, `themeVars` resolve a lavagem de cor da superfície `soft`
antes de calcular os tokens de tinta, apoio e destaque. Se a mistura tirar o
contraste mínimo da tinta escolhida, usa o papel da marca. O CSS não substitui
essa superfície depois do cálculo. O cartão sobreposto do hero offset usa o
papel do tom da própria seção, conservando o par texto/fundo também em `ink`,
`accent` e `secondary`.

## Refinamento da vibe artística

Medido em 12/09/2026 no cliente `grupofisk` (artístico, perfil v4, hero
atelier, navegação flutuante fixa, tratamento collage, galeria masonry com
duas fotos). A prévia mostrava quatro defeitos que o pre-flight não vê: a
headline de 48 caracteres a 8vw em `max-width: 11ch` virava uma palavra por
linha e seis linhas de hero; o atelier somava painel parcial, foto rotacionada
com sombra dura na cor da marca, detalhe com legenda cortada pelo
`overflow: clip` e cartão de legenda, quatro camadas disputando com o título;
a masonry criava três colunas para duas fotos e deixava um terço da seção
vazio; a ilha do cabeçalho ficava numa faixa de papel colada à lavagem do
hero, e as seções pares deslocadas 2vw à esquerda pareciam desalinhadas.

- **Escala pelo comprimento.** `HeroSplit` e `HeroStatement` emitem
  `data-length` (`short` até 24 caracteres, `medium` até 40, `long` acima)
  por `headlineScale`, em `lib/blocks/components.tsx`. No artístico v3/v4 a
  display cai de 8vw/11ch para 5,6vw/14ch e 3,9vw/18ch; a declaração
  centralizada ganha 17ch e 22ch. O hero atelier tem os mesmos degraus para
  perfis v2. Medido a 1440 px: os 48 caracteres passaram de 115 px em seis
  linhas para 56 px em três.
- **Orçamento de headline na gramática.** `VIBE_GRAMMAR.headline` fixa 56
  caracteres para comercial e moderno, 36 para ousado e 40 para artístico.
  `grammarDirection` leva o número ao prompt e `headline-fora-da-vibe` é
  aviso em perfis v4. O erro `hero-headline` de duas linhas continua global.
- **Ilha do cabeçalho.** No artístico v3/v4, `nav.bar` flutuante é uma ilha
  translúcida de 68 px com desfoque, CTA em pílula com fio e cantos redondos
  a partir de 1024 px. Com `position: fixed`, a moldura deixa de reservar
  altura, a abertura sobe até o topo e paga o respiro com
  `--navigation-offset`, medido pela `NavigationFrame`; o fallback de 6rem
  cobre o primeiro paint. A direção da vibe passa a pedir esse par. O
  deslocamento das seções pares saiu.
- **Atelier.** O campo de cor ocupa a coluna inteira à direita (36%,
  `accent-2` a 14%) e a foto de ambiente se sobrepõe a ele, reta, com sombra
  difusa e o raio do painel; a colagem é o detalhe sobreposto, dentro da
  altura da foto, com moldura de papel e legenda própria. A legenda da foto
  principal fica no canto oposto, com fundo translúcido. `imagePosition: left`
  espelha os três. O tratamento collage global perdeu a rotação e a sombra
  dura: a lâmina de cor atrás da foto usa `accent-2` a 38% sobre o papel.
- **Masonry pelo acervo.** Duas fotos viram uma dupla em grade
  `1.15fr 0.85fr`, alinhada pela base, com a segunda em 4:5; uma foto fica em
  coluna única de até 56rem; três ou mais mantêm as três colunas. O renderer
  não muda o conteúdo.

As regras de v3/v4 valem para todos os clientes artísticos publicados nessas
versões. O atelier, a colagem e a masonry valem também para v2, porque são
correções do renderizador, como a do filmstrip.

## Recriação da vibe moderna

Medido em 12/09/2026: a vibe pintava uma grade de dois gradientes de 1px na
raiz da página, com célula de `min(8vw, 7rem)`, e deixava cada seção a 94% de
opacidade para a grade atravessar o site inteiro (`vibes.css`, perfis v3/v4);
um cliente com `motif: grid` recebia uma segunda grade de 3rem no hero e a
cada terceira seção, e a miniatura do cadastro repetia o padrão. Nenhuma das
referências lidas nesse dia usa grade: [Linear](https://linear.app/) e
[Resend](https://resend.com/) são papel quase preto com um fio de 1px entre
capítulos, rótulos em mono caixa alta, painel de produto que some no papel e
botão primário em pílula clara; [Untold](https://untold.site/pt) é papel creme
com display enorme, rótulos mono entre parênteses e um acento só. O moderno
continua escuro; Untold entra pelos rótulos e pelo ritmo, não pela cor.

- **Papel liso.** A grade saiu da raiz e das seções, e `motif` da faixa vale só
  `none`. O CSS de `data-motif='grid'` fica para o único moderno publicado,
  `neidemarialimpeza`, em perfil v2; nenhum perfil novo grava `grid`.
- **Um fio entre capítulos.** `--hairline` (tinta a 9%) desenha `border-top`
  entre os blocos de `main`; o `border-b` das seções, `edge "line"`, a faixa
  de conversão e o fechamento minimal deixam de desenhar o próprio fio.
- **Rótulos em mono.** Eyebrow, links do menu, kicker do explorer, categoria
  dos recursos, legendas, rótulos de números e o índice do rail usam Geist
  Mono em caixa alta a 0,68rem com tracking 0,12em.
- **Headline e declaração.** Grotesk 500 até 16ch com lead pequeno e apagado;
  `editorial.text layout lead` vira declaração em duas cores: o primeiro
  parágrafo na display e na tinta, os demais apagados.
- **Painéis com fade.** A mídia do hero editorial ganha borda fina, raio do
  painel e `mask-image` que a dissolve no papel; a imagem do item em destaque
  do bento showcase faz o mesmo, e esse item herda os tokens da seção em vez
  da troca legada de tinta e papel, que o pintava de claro. Fotos têm borda
  de 1px sem moldura.
- **Colunas e números.** `feature.numbered layout rail` recebe índice `01` em
  mono e fio vertical; `proof.stats layout strip` recebe numerais tabulares na
  display e fio lateral.
- **Pílula clara.** A ação sólida, o botão da faixa de conversão, o CTA do
  menu e o do explorer são tinta sobre papel em pílula; o ghost é pílula com
  fio. A faixa de conversão herda
  os tokens da seção e, sem tom, vira um escuro elevado. A cor do cadastro
  fica em links, numerais e na única seção `tone "accent"`.
- **Cabeçalho.** `nav.bar layout minimal` com fio; com `position "fixed"` fica
  translúcido sobre o conteúdo. A direção da vibe passa a pedir esse par.
- **Paleta sugerida.** Índigo apagado para a seção colorida, grafite para a
  superfície elevada e ação lavanda: a demonstração deixou de ser azul-marinho
  com ciano.

O bloco vale para perfis v3 e v4, como o restante dos contratos v3; não há
moderno v3 no ar. O perfil v2 continua no bloco legado.

## Logo sobre superfície escura

O logo `transferir.png` de um cliente era um PNG sem alfa: sobre o papel escuro
virava uma placa branca no cabeçalho, e nada media isso, porque `logoPrecheck`
só corria em `generate_logo` e `update_image`. Agora aplicar um logo, por
upload, pela biblioteca ou pelo chat, passa por
`applyBrandLogo`: grava `logoUrl` e a versão operacional `logoRevision`, e
depois da resposta prepara `logoAsset`: remove o fundo uniforme conectado à
borda, recorta margens e gera master, PNG de navegação e derivados de marca.
O master tem lado máximo de 1024 px, com respiro de 2%. O traçado SVG só entra
quando mantém silhueta, cores e tamanho de arquivo dentro dos gates; SVG seguro
de origem mantém seu vetor. `measureLogoFit` mede esse master (ou a origem se
o fundo não pôde ser removido), registrando alfa, luminância e placa em
`brand.logoFit` e deriva uma versão branca por recorte de luminância
(`deriveWhiteLogo`): pixel escuro ou colorido vira branco, pixel claro vira
transparente, o que preserva o texto vazado de uma placa colorida e apaga a
placa de um arquivo sem alfa. A versão entra na biblioteca com número e
`reference_urls` do original, passa pelo crítico de logo em modo `derivar`,
composta sobre papel escuro, e, aprovada, vira `brand.logoDarkUrl`, com
`logoDarkAsset.nav` para render. Uma versão escura escolhida manualmente ganha
sua própria rendição, guardada pela mesma revisão.
O cadastro persiste a mesma versão antes de agendar `deriveLogoAssets`.

`NavBar` e `FooterCompact` escolhem o logo pelo papel real da seção
(`logoFor` em `lib/blocks/theme.ts`): tom `ink`, `accent`, `secondary`, `soft`
ou o papel da marca, com luminância abaixo de 0,4 contando como escuro.
O tom `ink` moderno usa a mistura elevada de papel e tinta em Oklab emitida
pelo CSS; `soft` usa a superfície resolvida do tema, incluindo a lavagem
artística. Uma cor local prevalece sobre o tom; a navegação `contrast` tem
papel próprio, resolvido pelo layout local ou pelo perfil. Renderer e
pre-flight usam essas mesmas regras, respeitando o fallback das referências
nos perfis antigos. O site não tem modo escuro; tem papel. `lintSite` emite o
aviso `logo-fundo-escuro`
quando o cabeçalho ou o rodapé da home é escuro, a medição acusa placa clara ou
tinta escura sem pixels claros e não há versão escura; `logo-fundo-claro` cobre
o caso inverso. Dados mostra o logo sobre o papel da marca e sobre um papel
escuro, e a biblioteca oferece **Usar sobre fundo escuro** e a remoção. Trocar
o logo apaga a medição e a versão escura do anterior. Cada aplicação ou escolha
manual da versão escura, inclusive remoção, renova `logoRevision`: a derivação
só grava se a URL e essa versão ainda coincidirem. Reaplicar a mesma URL
preserva a medição e a variante existentes, invalidando trabalhos anteriores.
O chat usa a marca devolvida pela aplicação; ajustes de cor e design mesclam
somente seus campos no banco, preservando escolhas e derivados concorrentes.
`logoAsset` e `logoDarkAsset` integram o snapshot publicado. Medição e versão
operacional ficam fora dele; renovar a
versão não marca o rascunho como alterado nem invalida a evidência visual.
Ilustrações e logos de meio-tom não têm versão por recorte: o aviso permanece e a versão pode ser
pedida ao modelo pelo chat.

Ícones opacos usam o papel da marca e, quando necessário, uma placa de contraste.
O ícone maskable mantém a arte nos 60% centrais. Um símbolo separado, detectado
nos componentes ou lido na imagem, pode ocupar o favicon; sem símbolo, fica a
marca inteira. A imagem OG usa 1200 × 630, papel da marca e logo centralizado
sem texto; a placa de contraste aparece somente quando a tinta sumiria.

## Referências acima da vibe

O campo **Site atual** não participa da autoridade visual. Sua coleta vive em
`brief.currentSite`, serve a fatos, páginas, links e ativos do próprio cliente e
mantém a História do cliente como autoridade em conflitos. Mesmo quando o Site
atual e a Referência visual têm o mesmo URL, somente a captura registrada em
`brief.sources[].visual` pode liberar decisões fora da vibe.

`read_reference` continua extraindo texto e, para URLs presentes em
`brief.intake.references`, também captura desktop (1440 px) e mobile (390 px).
Uma chamada multimodal separada lê composição, tipografia, imagens, ritmo,
superfícies e adaptação mobile. Pixels não entram no histórico textual nem no
banco; `brief.sources[].visual` guarda as observações, limites e estado da
leitura. Perfis sociais são contexto factual, sem liberar estilo por uma bio.

`set_design` exige a tentativa de leitura do único link visual do cadastro.
Quando a captura é válida, exige `referenceDirection` com aplicações para os
seis aspectos: layout, tipografia, imagens, ritmo, superfície e mobile. Só a URL
atual e visualmente verificada pode sustentar as decisões. Texto lido, URL
removida, fonte de outro contexto ou captura bloqueada não libera a faixa. Sem
leitura visual, o fallback mantém a vibe e exige lacuna declarada.

Com esse plano persistido, o perfil v6 permite escolher qualquer uma das doze
estruturas e qualquer combinação dos eixos, raio, luminância, variância,
movimento e densidade. A abertura e o plano de cenas seguem a estrutura
escolhida, e o renderer usa sua família de CSS e iconografia. A vibe cadastrada
continua guiando a voz e as lacunas que a referência não resolver.

Nos perfis v4/v5 o renderer preserva `brand.vibe`: CSS da vibe, iconografia e tom
da localização continuam valendo. `data-reference-aspects` lista no elemento
raiz o que a referência documentou, e as duas decisões mais opinativas saem do
caminho do aspecto correspondente: o cabeçalho invertido do ousado cede a
`layout` e a lavagem de cor entre seções do artístico cede a `surface`, tanto
no CSS quanto em `themeVars`. Perfis v2 e v3 com referência continuam na base
comercial neutra com que foram publicados. No v6, os seis aspectos ficam
expostos no HTML e a estrutura substitui a vibe como família visual. Cores do
operador, contraste, catálogo e composição mínima continuam obrigatórios.

A única fonte visual organiza o conjunto. Composição e cenas recebem as
observações e o plano. A crítica
compara os pixels atuais do cliente com essas observações persistidas,
verificando os traços centrais em toda a jornada. Desvio material sem adaptação
justificada pode ser erro `referencias`; preferência estética continua aviso.
Isso não é medição automática de similaridade pixel a pixel. Marca, oferta e
contatos de terceiros não são conteúdo confirmado do cliente.

A captura externa usa navegador sem sessão, com rede direta indisponível.
Cada recurso passa por GET no servidor com IP público validado e fixado ao
socket, inclusive após redirects; credenciais, portas não padrão e redes
privadas são recusadas. Há limite total de 55 segundos, 400 requisições e 50 MB por
viewport, 5 MB por recurso e 9000 px por viewport. Cada viewport tem seu
próprio orçamento para o desktop não impedir a leitura mobile. Cortes e
recursos ausentes ficam explicitamente registrados nos limites da leitura. Site bloqueado ou captura/crítica indisponível vira lacuna explícita.
Cada leitura visual acrescenta uma chamada ao crítico; não há nova geração
paga em testes de contrato.

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

| Vibe      | Possibilidades de pareamento                                       | Iconografia e gesto                                           |
| --------- | ------------------------------------------------------------------ | ------------------------------------------------------------- |
| Comercial | Roboto Slab + Source Sans 3; Manrope; Fraunces + Work Sans         | Traço regular, suporte arredondado, elevação breve            |
| Moderno   | Sora + Source Sans 3; Space Grotesk + Geist; rótulos em Geist Mono | Traço leve, suporte delineado e pequeno deslocamento diagonal |
| Ousado    | Barlow Condensed + Work Sans; Syne + Geist                         | Traço forte, suporte quadrado e impulso diagonal              |
| Artístico | Bodoni Moda + Source Sans 3; Fraunces + Literata                   | Duotone, suporte orgânico e inclinação suave                  |

São opções de direção, não pares obrigatórios. O contexto do negócio orienta
a escolha. Display inclui Geist, Fraunces, Space Grotesk, Manrope, Geist Mono,
Sora, Barlow Condensed, Syne, Bodoni Moda e Roboto Slab. Corpo inclui Geist,
Newsreader, Space Grotesk, Manrope, Work Sans, Literata e Source Sans 3.
Condensadas e displays expressivas ficam fora do corpo. Sem direção por referências verificadas, as faixas de cada vibe
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
validado por enum. Sem esse campo, o item usa apenas texto, sem símbolo padrão
nem espaço reservado. Em bento e recursos, a foto tem prioridade sobre o ícone.
Ícones não substituem fotos nem sustentam alegações comerciais.
O renderer fornece a vibe resolvida no servidor; blocos não escolhem um peso
arbitrário nem fornecem SVG ou URLs de ícones.

Títulos de seção, rótulos, estatísticas, fatos, números de etapas e legendas
não recebem ícones automáticos. Os símbolos escolhidos para itens de serviços,
bento e narrativa ficam junto do título, com escala em `em`, distância de
`0.5em` e alinhamento na primeira linha quando o texto quebra. O tamanho
explícito continua disponível para controles e símbolos em destaque.

Abas do explorer exibem só o símbolo escolhido e o título, sem seta de link;
seus fatos usam marcadores de lista. Abas de endereço usam o nome da unidade.
Menus, FAQs, formulários, ações e contatos mantêm os sinais funcionais.
O pre-flight avisa sobre símbolos de conteúdo repetidos na página, inclusive
entre blocos; não conta setas, checks ou outros sinais inseridos pelos controles.
O aviso não altera escolhas salvas nem bloqueia publicação. O prompt orienta
a omitir ícones dispensáveis, sem variar símbolos por decoração.

Ícones são decorativos junto do texto, saem visíveis no
SSR e não criam focos adicionais. Hover, foco visível, toque e estado aberto
têm respostas em `iconography.css`; badges entram uma vez pelo `SiteMotion`,
quando o dial permite. Não há animação infinita. Movimento reduzido desativa
as transições e as entradas e mantém o estado aberto reconhecível.

O institucional e o painel administrativo conservam fontes e estilos próprios.
As regras radicais de composição em `vibes.css` ficam limitadas aos contratos
visuais v3 e v4; perfis v5/v6 reutilizam o contrato CSS v4 e acrescentam a
estrutura pelo bloco autoral. No v6, `data-vibe` recebe a família da estrutura,
não a vibe cadastrada. Perfis v2 e sites legados preservam a
apresentação atual até uma recomposição explícita e nova publicação.

## Contrato visual versionado

| Recurso              | Comportamento                                                                                                                                                                                                                                                                                                                                                  |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Perfil persistido    | `brand.design` guarda conceito, elemento-assinatura, estrutura, justificativa e oito eixos. Sem referência nova grava v5; com referência verificada grava v6 e `referenceDirection`. Landing Page grava v7 sem estrutura multipágina. A leitura aceita v2-v7 para preservar sites existentes. `tenant.brief` guarda também plano editorial e cenas semânticas. |
| Tipografia           | 14 famílias, dez opções de display e sete de corpo, descritas acima. `next/font` auto-hospeda os arquivos; o navegador carrega somente as famílias usadas. Escala, peso, entrelinha, medida, legendas e números têm papéis consistentes.                                                                                                                       |
| Vibe e referência    | Sem referência, `brand.vibe` define gramática, eixos, raio, luminância e dials. No v6, a referência escolhe entre as doze estruturas e pode definir todos esses valores; a vibe continua como voz e fallback. Ausente significa `comercial`.                                                                                                                   |
| Paleta               | O cadastro oferece uma sugestão por vibe. Enquanto `paletteSource` for `sugerida`, a direção pode adaptá-la ao negócio; editar qualquer cor muda a origem para `operador` e trava `accent`, `accentAlt` e `highlight`. `ink`, `paper` e `surface` continuam com a direção. Contraste AA e diferença entre primária/secundária permanecem gates.                |
| Composição global    | Três estruturas por vibe combinam abertura, ordem mínima, assinatura e fechamento. V5 escolhe dentro da vibe; v6 escolhe a mais próxima da referência entre as doze. Seis heroes, quatro navegações, quatro ritmos, quatro tratamentos de imagem, quatro superfícies e cinco motivos modulam o resultado.                                                      |
| Apresentação local   | Todo bloco aceita `presentation`: tom (incluindo a cor secundária), largura, respiro, alinhamento, borda e motion (`none`, `reveal`, `stagger`, `image`). Use um a três momentos de movimento coerentes com a narrativa.                                                                                                                                       |
| Exploração e inbound | `feature.explorer` oferece seleção de aplicações com imagem, texto, fatos e CTA por aba; suporta teclado. `editorial.resources` conecta páginas com hierarquia editorial e imagem ou símbolo. Ambos oferecem layouts próprios.                                                                                                                                 |
| Imagens              | Hero aceita posição, `cover`/`contain`, ponto focal e legendas; atelier aceita imagem secundária. A home exige duas fotos geradas distintas da biblioteca do tenant. Imagens geradas chegam ao agente com número e URL para uso imediato, sem aprovação.                                                                                                       |
| Navegação e FAQ      | Menu mobile e perguntas usam `details`/`summary` nativos, foco visível e interação por teclado.                                                                                                                                                                                                                                                                |
| Âncoras              | Todo bloco aceita `anchor` opcional, começando com letra minúscula, seguido de letras/números/hífens, até 64 caracteres. Link usa `#anchor`. Duplicação bloqueia publicação. Formulário sem âncora mantém `contato`.                                                                                                                                           |

## Unicidade e coerência

`set_design` mede a distância entre os eixos dos perfis da mesma vibe. Em v5,
essa leitura é informativa: estruturas moderno e ousado têm poucos enums e uma
distância fixa impediria a terceira jornada. A recusa acontece sobre a home
completa, depois que estrutura, ordem e assinatura existem. Nome, briefing,
texto, imagens e identidade do outro cliente não são retornados ao agente.

No perfil v4, a home é medida pela silhueta: a sequência `tipo:layout` das
seções de conteúdo, com o layout resolvido como o visitante o vê. V5 preserva
a ordem pela maior subsequência comum e acrescenta dois sinais estruturais da
assinatura: sequência de papéis e distribuição de mídia/ação. Texto, URL,
imagem e tom são ignorados. Mapas usam a ordem efetivamente renderizada: o
`focus` vem primeiro, seguido dos demais itens na ordem salva. Essa ordenação
é compartilhada com o renderer; mover apenas o `focus` no JSON não diferencia
duas composições idênticas. Trocar a ordem dos itens de apoio continua contando.
Acima de 0,75, `build_site`, `set_blocks`, as
ferramentas de publicação e a API administrativa recusam a home, listando as
marcas repetidas sem revelar o outro cliente. Perfis v2/v3 continuam na régua
de igualdade exata da sequência inteira, incluindo tom e borda; essa
compatibilidade evita bloquear republicações anteriores ao v4. Páginas com
menos de quatro marcas ficam fora da trava.

O perfil v6 guiado por referência não passa por essa recusa: mudar uma
composição comprovadamente próxima da fonte apenas para diferenciar dois
clientes violaria a prioridade pedida. Estrutura, catálogo, factualidade,
contraste, imagens e responsividade continuam nos gates.

Essas verificações detectam repetição estrutural; não medem qualidade estética nem comprovam coerência semântica. A revisão visual precisa conferir a ligação entre briefing, imagens, silhueta, ritmo e elemento-assinatura. Trocar cores e fontes para vencer o gate não substitui uma direção própria. Uma empresa de pedras pode privilegiar matéria e aplicações; isso não obriga outros negócios a usar a mesma colagem ou as mesmas abas.

O pre-flight exige decisões locais de layout e presentation em páginas
comerciais dos perfis v2-v7; somente escolher motion não conta como decisão de
composição. `build_site` valida páginas e projeto antes de gravar o lote em uma
transação. Um erro não substitui páginas válidas. Edições incrementais podem
produzir rascunho inválido, mas a publicação continua bloqueada.

Na forma `multi`, `lintSite` exige três páginas orgânicas com pelo menos 100 palavras de conteúdo,
intenções e SEO distintos, etapas de inbound, links e âncoras válidos e alcance
a partir da home. Também exige duas fotos geradas distintas, uma seção
protagonista e imagem em toda página orgânica. Sem referência, exige cor de
marca em uma seção; v6 preserva o ritmo tonal observado na fonte. A contagem de
palavras impede páginas vazias, mas não prova utilidade editorial.
`lib/sites/publish.ts` valida o estado que ficará ao vivo e publica o lote
atomicamente.

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
limite de 14 chamadas para incluir as seis cenas do atelier e a composição.
`report.flow` informa conclusão, próxima fase, motivo da parada e tentativas.
Limite esgotado ou fase com erro resultam em
execução incompleta e código de saída 1.

## Interface de operação do admin

O painel usa Geist, superfícies escuras, texto claro e acento areia, com CSS isolado em `(admin)`. A hierarquia privilegia a tarefa: encontrar cliente; abrir Site, Imagens, Tráfego ou Dados; revisar antes de publicar. Cadastro novo fica recolhido até ser solicitado. Em desktop, conversa e prévia/biblioteca ficam lado a lado e ocupam a altura da tela, sem faixa de navegação lateral: voltar para a lista é um botão no cabeçalho do cliente. Abaixo de 1024 px, conversa e prévia alternam por botões, mantendo cabeçalho, publicação e avisos acessíveis.

Sugestões preenchem o compositor e aguardam envio. A prévia oferece seletor de página, largura desktop/celular e pendências de projeto e página. Erros HTTP aparecem como avisos, exclusão de imagem pede confirmação local e ações em andamento ficam desabilitadas. Dados simples e briefing têm formulário direto, sem chamada ao modelo. Tokens e custo ficam em detalhes recolhidos, com seu escopo declarado.

A coluna da conversa é o lugar do andamento, não só do texto: logo abaixo do
cabeçalho dela, um bloco compacto traz estado, etapa atual e ação numa linha,
duas trilhas de produto, unidades realmente concluídas, tempo decorrido,
ferramenta em execução e linha do tempo recolhida. A linha do tempo
continua sendo a via acessível para o mesmo conteúdo. A escala tipográfica tem
piso de 12 px, com 14 px no corpo das mensagens e a família monoespaçada nos
tempos, contagens e custos, em `tabular-nums`. Movimento é pontual e respeita
`prefers-reduced-motion`.

Cliente sem tentativa ou conversa anterior começa sozinho ao abrir a tela, sem botão e sem pergunta de abertura: ele chegou ali pelo cadastro. A condição inclui o histórico anterior à geração no servidor, nenhuma página e a primeira etapa pendente, porque retomar sozinho um rascunho antigo gastaria geração paga sem pedido. O consumo soma as fases gravadas no servidor e os turnos livres do stream.

O detalhamento de consumo tem altura limitada à tela, rolagem própria e região nomeada para navegação assistiva. Abrir o detalhe o traz à área visível. Em telas baixas, a coluna da conversa permite rolagem manual para alcançar todos os controles; a rolagem automática das mensagens continua restrita à lista, preservando o andamento acima dela.

A aplicação das duas referências prioriza hierarquia, contraste e feedback. O painel não precisa das animações expressivas dos sites de clientes para operar bem. O [manual](admin.md) descreve a jornada e a [revisão](admin-review.md) registra a verificação em 320, 390 e 1440 px.
