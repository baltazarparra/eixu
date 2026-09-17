# Design dos sites gerados

## Comercial v8

A Comercial usa como referência visual absoluta a página da unidade Brotas da
[Minatel Supermercados](https://minatelsupermercados.com.br/brotas), adaptando
marca, texto, fotografias e contatos aos fatos de cada tenant. O perfil v8 fica
isolado por `data-profile-version="8"`; perfis v2–v7 e seus snapshots continuam
com o renderer anterior.

A Comercial v8 usa somente `comercial-marca`. A silhueta é fixa: navegação
integrada ao hero; hero sobre a fachada; apresentação da unidade; seis setores;
ofertas; redes sociais; faixa fotográfica; história; segunda faixa fotográfica;
carreira; galeria; convite de contato; formulário; todas as unidades; rodapé.

A apresentação usa `editorial.text:bridge`, em contato com a base do hero:
painel na cor da marca com nome e endereço confirmado, texto institucional ao
lado e espaçamento curto até os setores. A largura acompanha as fotos abaixo;
no celular, identidade e texto viram uma coluna. O endereço ocupa `lead` e é
omitido quando não há dado confirmado. A sequência do pre-flight exige essa
ligação nas novas composições. Os layouts de texto já salvos não são migrados.
Para uma edição com foto ao lado, `editorial.text:split` mantém o conteúdo
completo em metade da seção e a imagem em outra, sem exigir CTA.

`hero.split:brand` exige fotografia panorâmica da fachada real do próprio
comércio, importada do site oficial ou enviada pelo operador, com o logo ou nome
visível no letreiro. A arte do logo aparece na navegação, sem uma segunda cópia
no hero. A foto recebe uma camada da cor principal da marca. `feature.bento`
exige exatamente seis setores, todos com foto distinta, título, descrição e
texto alternativo. `social.follow` recebe texto e fotos, enquanto links e ícones
vêm das redes cadastradas. As duas `media.image:immersive` ocupam toda a largura,
têm pelo menos 56% da altura da tela e recebem parallax. `media.gallery` exige
pelo menos seis fotos. `media.map` assume `onde-estamos` e renderiza nome,
endereço, telefone, horário, rota e mapa para cada unidade cadastrada.

A abertura entra junto do primeiro paint, sem desaparecer depois da hidratação.
As seções seguintes são preparadas antes de aparecer e entram uma única vez,
somente ao alcançar a viewport. Scroll reveal e fade in formam o vocabulário
principal: títulos, ações e conteúdo de cards sobem 28 px no desktop e 20 px no
celular durante 1 segundo; o título e a ação do hero usam 32 px no desktop.
Textos de apoio, formulários, mapas e fotografias usam fade gradual de 1,05 a
1,15 segundo. Título, descrição e ação entram em sequência de 100–120 ms.
Categorias coordenam foto, título e descrição sem mover o card inteiro; galeria
e unidades preservam entradas individuais. Cada propriedade recebe um único
controle de animação, evitando efeitos somados no hero. O parallax é amortecido
entre quadros para não acompanhar o scroll com trancos. O HTML continua visível
no servidor, a edição desliga o movimento e
`prefers-reduced-motion` preserva o conteúdo sem animação. A paleta usa até três
tons de seção, superfícies planas, texto curto e nenhuma textura ou prova
inventada.

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

| Bloco                 | Layouts             | Contrato                                                                                                          |
| --------------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `hero.landing`        | `stage`, `form`     | Até 60 caracteres; `stage` aceita carrossel de fotos e `form` mantém uma foto 4:5 opcional junto da oferta.       |
| `proof.strip`         | `logos`, `numbers`  | 3–6 marcas ou 2–4 números; cada item aponta uma evidência literal do briefing.                                    |
| `narrative.statement` | `center`, `split`   | Problema ou promessa em uma frase, até 160 caracteres.                                                            |
| `feature.showcase`    | `steps`, `tabs`     | 2–4 itens com imagem; abas com setas e Home/End, todos os painéis legíveis sem JS ou na edição.                   |
| `proof.testimonials`  | `grid`, `spotlight` | 2–3 citações, autor, cargo e resultado sustentados pela mesma evidência; foto opcional somente do acervo enviado. |

## Primitivos interativos

Os primitivos neutros dos sites vivem em `lib/blocks/ui/`; seus estilos ficam
em `app/(sites)/primitives.css`, separados dos componentes do painel. O HTML
completo sai do servidor e permanece utilizável sem JavaScript. A hidratação
acrescenta comportamento sem transformar o conteúdo em uma caixa-preta, e o
motor só é importado pelas páginas que usam o primitivo. Variantes são enums do
schema e atributos `data-*`, nunca CSS livre produzido pelo agente.

O primeiro primitivo é `SiteCarousel`. Sem JavaScript, a trilha usa rolagem e
`scroll-snap`; após hidratar, Embla acrescenta loop, arrasto e toque. Setas,
Home, End, botões anterior/próxima, indicadores, foco visível, rótulos em
português e anúncio da foto atual cobrem teclado e leitor de tela. Os alvos têm
pelo menos 44 px, ou 48 px na Landing Page. Movimento reduzido,
`data-motion='still'` e edição desligam autoplay e transições; na edição, todas
as fotos e legendas ficam alcançáveis na trilha estática.

`hero.landing:stage` e `hero.split` nos layouts `split`, `poster`, `editorial`
e `offset` aceitam até cinco fotos adicionais em `slides`. A imagem principal
continua sendo a primeira, com prioridade de carregamento; a segunda é eager e
as demais são lazy. `media.gallery:carousel` usa o mesmo primitivo com duas a
oito fotos. `hero.landing:form`, `hero.split:brand`, `hero.split:info`,
`hero.split:cover` e `hero.split:atelier`
recusam slides porque a mídia conflita com formulário, legibilidade ou a
composição de duas fotos; a alternativa é uma galeria `carousel` após a
abertura. `carousel.autoplay` é opcional, vem desligado e aceita intervalo de 4
a 12 segundos; quando ligado, pausa com hover, foco, aba oculta ou diálogo
aberto.

Enquadramento, foco e proporção continuam pertencendo ao bloco. O CSS usa os
tokens do site e modula os controles por vibe: formas mais retas no ousado,
pílulas com fio no artístico, indicadores lineares no moderno e círculos no
comercial e na Landing. Não há animação infinita decorativa.

A protagonista é `feature.showcase` ou `feature.bento:showcase` com duas fotos.
O plano mantém cinco cenas na home: hero, duas da protagonista, apoio em
`media.image` e fechamento em `cta.band`. Não solicita retratos de clientes
para preencher depoimentos. Nos layouts `band`, `split`, `poster` e `minimal`,
a imagem da faixa final fica separada do texto. O layout `cover` posiciona a
foto 16:9 como fundo sob uma camada de contraste; imagem e descrição são
obrigatórias no schema e no pre-flight.

Os controles têm alvo de 48 px e formulários em coluna única. `nav.bar.stickyCta`
com `position: fixed` habilita o botão inferior de 56 px em telas abaixo de
1024 px e com pelo menos 440 px de altura. Ele respeita a área segura e some
com formulário visível, campo em foco, menu aberto, sem JS ou em edição.
A FAQ usa duas colunas a partir de 1024 px; movimento reduzido preserva o
conteúdo e desliga animações.

A evidência confirmada vem do cadastro (`brief.intake.evidence`) ou do chat,
por `confirm_evidence`, que grava em `brief.evidence` o fato escrito pelo
operador. As duas origens valem no gate; nenhuma delas aceita fato deduzido.

Na geração, `landingFindings` aponta como erro ação divergente, menu fora da home, prova sem
correspondência literal, preço não confirmado, páginas extras e formulário
sem obrigado. Repetição da ação é aviso. `form.lead` com 5–6 campos avisa;
menos de 2 ou mais de 6 bloqueia. O hero embutido só aceita 2–4 no schema.
A correspondência de evidência verifica o texto fornecido, não a veracidade
externa; a confirmação continua sendo responsabilidade editorial. Na publicação
pedida pelo operador, a política compartilhada mantém os erros técnicos e
apresenta as avaliações editoriais como recomendações, sem vetar a decisão.

A unicidade compara somente landings v7: exige dois eixos diferentes e mede
semelhança de silhueta entre direções próximas. Navegação, catálogo, plano de
cenas, prompt, crítico e publicação compartilham essa decisão.
Veja o [plano implementado](archive/landing-plan-2026-09-12.md) e os
[registros de validação local](archive/verification-2026-09-13.md).

Referências lidas em 10/09/2026: [Frontend Design, Anthropic](https://github.com/anthropics/claude-code/blob/main/plugins/frontend-design/skills/frontend-design/SKILL.md) e [Taste Skill v1](https://github.com/Leonxlnx/taste-skill/blob/main/skills/taste-skill-v1/SKILL.md). Para mudanças de frontend, use ambas como direção, respeitando o negócio, o contrato do repositório e o código disponível. Este documento registra a adaptação ao gerador, não substitui a leitura das referências ao mudar a direção visual.

Contrato conferido no checkout em 13/09/2026. Registros de ensaios e de publicação
ficam no [histórico](archive/verification-2026-09-13.md); não certificam o estado remoto atual.

## Painel administrativo

### Conversão para Premium

Ao reservar uma conversão, o gerador sai da tela e dá lugar a uma superfície de
entrega. O trilho à esquerda diferencia pedido, preparação, revisão, publicação
e ativação; a versão pública ocupa o restante da tela e comprova que o endereço
continua disponível. Tempo decorrido, atualização manual, falha e ação humana
ficam no mesmo contexto. No celular, **Andamento** e **Site atual** alternam sem
duplicar avisos ou manter os controles antigos do gerador.

Quando a preparação termina e a PR existe, uma modal avisa que a conversão
aguarda aprovação e destaca **Revisar e aprovar**. Ela também abre ao entrar
nesse estado; **Revisar depois** ou Escape fecha o aviso sem que as atualizações
automáticas o reabram. A ação permanece junto ao passo de revisão e no cabeçalho.
Falha de release preserva a entrega e oferece a recuperação operacional no
workflow; ativação recarrega a rota e abre o CMS Premium. Movimento se limita
ao indicador do trabalho ativo e some com movimento reduzido.

### CMS dos projetos Premium

Quando `maintenance_mode` e `public_runtime` são `premium`, a área Site não
monta conversa, compositor ou ferramentas do gerador. A coluna editorial lista
somente as páginas, seções, textos e imagens de `content/editor.json`; composição
e comportamento continuam sob responsabilidade do Creative Developer no código.
O cabeçalho mantém página, Desktop/Celular, link público e a decisão única
**Salvar e publicar**. Alterações não salvas recebem contagem por página e aviso
ao sair.

A coluna direita abre a URL Premium canônica com uma sessão efêmera. Cada edição
é validada no servidor e aplicada após um debounce curto; a confirmação vem do
iframe por origem, janela, requisição e revisão exatas. O recarregamento preserva
rolagem e desativa envio de formulário e navegação externa dentro da prévia. A
troca de imagem usa o acervo do próprio tenant. No celular, Conteúdo e Prévia
ocupam vistas alternáveis com os mesmos alvos de 44 px do restante do painel.

### Operação pelo celular

Abaixo de 1024 px, o cabeçalho tem 57 px: retorno, nome do cliente,
publicação e menu. O menu nativo reúne Site, Imagens, Tráfego, Dados e saída,
com foco contido, Escape e fechamento pelo fundo. Conversa e Prévia ficam no
rodapé, respeitando a área segura. `AdminShell` acompanha a viewport visual
quando o teclado abre, sem desabilitar o zoom. Campos têm pelo menos 16 px
e os controles principais oferecem alvos de 44 px.

A prévia abre em Celular, com até 390 px de largura real; em telas menores,
usa toda a largura disponível. Desktop renderiza em pelo menos 1280 px e
reduz a escala para caber em áreas menores; acima disso, a viewport do site
acompanha toda a largura disponível. A prévia ocupa a altura restante da
coluna, sem moldura, cantos arredondados ou margens externas. Só a linha de
status tem espaçamento próprio; a rolagem fica dentro do iframe.
Ampliar recolhe o cabeçalho sem
recarregar o iframe; Restaurar, Escape ou Conversa devolvem o contexto.
Editar fica junto da prévia no celular; a edição mantém Salvar/Cancelar no
cabeçalho e suspende a ampliação para conservar essas ações acessíveis.

O compositor cresce até um limite com o texto. No teclado de toque, Enter
quebra a linha; Enviar manda a mensagem. Ctrl/Cmd+Enter também envia, e o
atalho Enter do desktop permanece. A atualização do histórico acompanha o
fim somente enquanto a pessoa está nele; Mensagens recentes permite voltar.
As ideias de ajustes e o consumo ficam dentro da conversa rolável. O acervo
precede o guia de imagem no celular, e Dados mantém a ação de salvar visível.

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

A prévia desktop ocupa toda a largura e a altura restante da coluna, sem
moldura, cantos arredondados ou margens externas. Só a linha de status tem
espaçamento próprio. A rolagem pertence ao site dentro do iframe; o painel não
cria outra área de rolagem ao redor. No modo Celular, a largura fica limitada
a 390 px e encolhe com a tela.

O handoff `design_handoff_cabecalho_unico`, recebido em 12/09/2026, substituiu
os três cabeçalhos do editor (página, conversa e prévia, 207 px somados) por
uma barra de 64 px em `components/admin/navigation.tsx`: identidade com
domínio, abas de altura inteira com sublinhado âmbar, o grupo PRÉVIA (caminho
da página com pill de rascunho, larguras Desktop/Celular e abrir em outra aba)
e, depois de um divisor, só o que condiciona a publicação: diamante compacto
de 32 px durante a geração e **Publicar**, habilitado conforme as pendências determinísticas. O editor injeta os dois
grupos vivos por portais em dois slots da barra. A conversa começa no
andamento e a contagem de turnos desceu para a dica do compositor. Abaixo de
1520 px o rótulo PRÉVIA some; abaixo de 1280 px a barra fica em 52 px sem a
linha do domínio e o grupo PRÉVIA volta para uma faixa no topo da coluna da
prévia. A operação abaixo de 1024 px foi substituída pela navegação compacta
descrita acima.

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

A prop comum `textStyles` aceita até 40 entradas únicas com `field`, escala
relativa ou `fontSize` de 10 a 160 px, `fontWeight`, `lineHeight`,
`letterSpacing`, transformação, itálico, `color` em hex e `align` em
`left`, `center`, `right` ou `justify`. Não aceita CSS livre.
`lib/blocks/fields.ts` deriva o inventário do catálogo, incluindo limites e
piso de leitura. Textos de controles, inclusive os títulos das abas do
explorador, são editáveis sem estilo individual.

`textAttrs` insere `.site-styled` apenas em campos com tipografia ou cor; alinhamento
fica no elemento sem criar uma caixa tipográfica concorrente. O span usa 80, 90,
100, 115 ou 130% sobre a tipografia fluida existente. Cor explícita remove a
opacidade decorativa do texto para preservar o contraste medido. `data-field` e
`data-part` só existem na edição; `data-text-align` também existe no site público
quando o operador escolheu um alinhamento.

`presentation.textAlign` alinha todos os textos da seção. O controle separado
`presentation.contentAlign` posiciona o grupo, ações e listas em `start`, `center`
ou `end`. Um `textStyles.align` mais específico prevalece sobre o alinhamento da
seção. Esses controles não trocam layout, ordem de leitura ou posição da mídia.

Todo bloco também aceita `presentation.elements` para ajustar sua composição
interna. Os alvos são semânticos e fechados: seção, container, conteúdo, título,
corpo, ações, lista, item indexado, mídia, imagem, formulário, ação e campo.
Regras independentes para mobile e desktop controlam flex, grid, dimensões,
espaçamento, ordem, posição e acabamento. O schema recebe somente enums, números
limitados e cores validadas; o renderer produz CSS escopado ao bloco.

`sectionBackgrounds` e `fieldBackgrounds` compartilham tokens com o renderer,
incluindo tons, fundos locais, cartões, painéis, superfícies modernas e
legendas translúcidas. A tabela `SECTION_SURFACE_RULES` acrescenta as
superfícies que o CSS da vibe realmente pinta, por vibe renderizada, versão,
família, layout, tom e campo; cada entrada aponta o seletor correspondente em
`vibes.css`. Seções sem tom consideram papel e superfície alternada. O servidor
exige 4,5:1 no salvamento e na publicação contra a pior superfície. A ilha
também mede o fundo calculado pelo navegador, incluindo transparência e
`color-mix`. Texto sobre foto sem um painel uniforme só permite cor automática;
tamanho segue editável. Não se presume uma cor de fundo a partir da imagem.

## Direção e qualidade

A composição parte da história do cliente, da marca e de cenas coerentes: uma
seção protagonista, hierarquia de texto e variação de layout. Na Comercial, o
perfil v8 usa a estrutura fixa `comercial-marca` e mantém a Minatel Brotas como
referência de forma; uma referência do tenant complementa marca e fotografia.
Nas demais vibes sem referência, o perfil v5 escolhe uma de três estruturas.
Com uma referência visual verificada, o perfil v6 escolhe a estrutura mais
próxima entre as doze gerais. Cada projeto tem pelo menos
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
opcional, com contraste validado. `backgroundEnd` mais `gradient` (`down`,
`diagonal` ou `right`) forma um degradê local; uma única tinta automática ou
explícita precisa passar em 4,5:1 nas duas extremidades. `decoration: none`
desliga lavagem, degradê e motivo herdados da vibe sem inventar outro fundo;
`vibe` restaura o padrão. São decisões locais da seção e prevalecem sobre o tom
e a decoração da vibe sem mudar a marca. O renderer respeita a ordem salva
inclusive para uma seção inserida depois do rodapé; a localização automática
continua antes dele. Veja o [contrato de edição](chat-edits.md).

`background: transparent` remove o fundo local e usa as cores legíveis da
marca; nesse caso, omita `foreground`. `edge: none` remove a borda/sombra da
seção e `spacingTop: none` retira somente o respiro superior.
`operator.css` é a última importação dos sites e limpa fundos de filhos e
painéis internos quando o wrapper tem `data-tone="custom"`. A cascata resolve
por ordem, sem `!important`; um degradê local inline continua prevalecendo.
Essa correção também afeta sites já publicados: uma seção comercial que já
tenha fundo custom passa a exibir o hex gravado, sem a lavagem da vibe sobre
ele. O snapshot não é reescrito.
Em `signature.composition`, `items.N.imagePresentation` controla a moldura,
a proporção natural, a largura do box e o respiro superior de uma única imagem.
As quatro famílias usam os mesmos controles, com precedência sobre a moldura
global `imagery: framed`. A grade, os textos e os demais itens são preservados.

Em `hero.landing`, os mesmos campos ficam em `imagePresentation`. `frame: none`
retira também o arredondamento e as duas bordas (box e imagem); `fit: natural`
elimina a proporção fixa sem trocar `stage`/`form`. O painel de formulário
continua preservado. O pre-flight reconhece `natural`/`contain` nos controles
implementados e não recomenda trocar layout ou gerar outra foto por um recorte
que já não acontece; fotos ainda recortadas continuam sendo avaliadas.

O cabeçalho `nav.bar` aceita `position: fixed` sem trocar layout ou direção da
marca. `backgroundOpacity` controla o fundo entre 70 e 100%; o tom escuro vem de
`presentation.tone: ink`. A ilha `NavigationFrame` mede e reserva sua altura,
sem incluir o painel mobile, e ajusta a margem de rolagem das âncoras.

A variante `media.gallery/filmstrip` cria uma coluna por foto. Duas imagens
preenchem a largura disponível em desktop; acervos maiores rolam horizontalmente.
O CSS anterior sempre criava oito colunas e deixava seis vazias numa galeria
de duas fotos. A correção atua no renderizador, preservando conteúdo e imagens.

No layout `carousel`, `media.gallery` mostra uma foto por vez em 4:3. Em
perfis v5/v6, trocar pela galeria mínima da sequência pode gerar o aviso
editorial `estrutura-v5-incompleta`, porque a assinatura da estrutura continua
sendo específica. Slides contam como imagens da página e cada um recebe sua
própria conferência de proporção. Um hero com carrossel não satisfaz sozinho
`home-protagonista`: fotos ocultas na passagem não substituem a seção
protagonista que mostra o negócio.

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
até 14 saltos entre briefing, cenas e composição; não despacha revisão automática.

A biblioteca mantém o acervo numerado de imagens geradas e fotos enviadas. **Enviar imagens** abre seleção múltipla, com andamento e falhas por arquivo. As fotos enviadas têm os mesmos atalhos de uso e alteração, entram na composição e mantêm sua proporção real. `update_image` usa a imagem indicada
como referência, gera uma nova versão e troca a URL e o texto alternativo nos
rascunhos do mesmo tenant. O original e os snapshots publicados são preservados.
A crítica continua informativa; não é uma fila de aprovação.

Quando solicitado pelo operador, `review_pages` reúne pre-flight, métricas e crítica visual do rascunho. O
pre-flight roda primeiro; erros conhecidos não consomem captura nem crítico. Um
Chromium atende o lote, com duas páginas em paralelo, repetição por viewport e
preservação das capturas boas quando um alvo falha. Cada página mantém seu
próprio recibo e só volta à fila quando seus pixels ou uma dependência global
mudam; imagem fora das páginas não invalida a revisão. Os pixels seguem como
imagens binárias a uma chamada separada do Gemini, e o chat recebe somente o
relatório estruturado. Overflow, imagem quebrada, falha de captura e cobertura
incompleta impedem a conclusão da análise visual solicitada, sem reabrir a geração. Uma avaliação completa sem erro
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

| Vibe        | O que a faixa exige                                                                                                                        |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `comercial` | Display humanista/slab, hero split/cover, navegação em barra, ritmo direto, fotos emolduradas, lavagem cromática suave e cantos discretos. |
| `moderno`   | Papel quase preto e liso, display geométrica/grotesca, hero editorial/offset, navegação mínima, capítulos com fio de 1px, rótulos mono.    |
| `ousado`    | Display condensada/expressiva, hero cover/poster, navegação de contraste, fluxo contínuo, fotografia full-bleed, faixas e cantos retos.    |
| `artistico` | Display editorial/clássica, hero offset/atelier, navegação flutuante, alternância, colagem/cutout, camadas e motivos de anéis ou cantos.   |

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
O bloco recebe duas fotos disponíveis do assunto do cliente. Não aceita HTML,
JavaScript ou CSS gerado por tenant.

As estruturas comerciais v5/v6 preservadas também ordenam camadas opcionais de aprofundamento.
O catálogo só as oferece quando o briefing sustenta o conteúdo: números exigem
evidência numérica, depoimentos exigem citações literais, narrativa exige história
e `feature.showcase` exige três fotos que sobrem depois das cinco ou seis cenas do
plano estrutural. `briefDepth` começa no piso estrutural de cinco
seções, acrescenta uma camada com quatro evidências e outra com seis evidências
mais dois números ou história acima de 1.500 caracteres, limitado a oito. O piso
editorial acompanha a forma: 180 palavras com seis seções e 220 com sete ou mais.
Em comercial v5/v6, `home-rasa` recusa composição abaixo do piso ou sem as camadas
disponíveis na ordem da estrutura. Na publicação solicitada, esse achado editorial
vira recomendação; prova sem fonte e demais erros de integridade continuam
bloqueantes.

O pre-flight v5/v6 recusa home sem uma única composição autoral, sequência fora de
ordem ou protagonista sem duas fotos disponíveis. A comparação entre tenants usa
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
ela própria, duas URLs distintas de fotos disponíveis do cliente. Fotos
em outro bloco não completam essa exigência.

A unicidade passou a medir proporção em vez de igualdade. `silhouette` reduz a
página à sequência `tipo:layout`, sem texto, imagem nem tom;
`silhouetteSimilarity` conta as seções em comum sobre a página maior; acima de
`SILHOUETTE_LIMIT`, 0,75, a home é recusada em `build_site` e `set_blocks` de perfis v4. Na publicação solicitada, essa duplicidade é recomendação. V5 usa a maior subsequência comum e expande a marca da
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

## Refinamento da vibe comercial

Medido em 13/09/2026 numa fixture de energia com headline de 56 caracteres,
palavra de 16 letras, assinatura `service-lens` e quatro layouts de CTA. A mesma
composição foi renderizada em 320, 390, 768, 1024 e 1440 px. Não houve overflow,
palavra partida, faixa de 1 px nem falha de contraste.

- **Lavagem em vez de grade.** `grid` é legado apenas no perfil v2. Em perfis
  v3 ou superiores, `renderedMotif` traduz um valor persistido para `wash`; toda
  gravação nova recusa a grade mesmo com referência completa. A faixa comercial
  e a landing aceitam `none` ou `wash`.
- **Cor mensurada.** `glowOf` em `lib/blocks/contrast.ts` percorre misturas de
  papel e cor de marca de 60% a 10% e devolve a primeira cuja claridade OKLCH
  fique no piso da vibe (papel claro L ≥ 0,86; papel escuro L ≤ 0,30) e que
  mantenha 7:1 com a tinta. Daí saem `--glow` (acento), `--glow-2` (destaque ou
  acento alternativo) e `--glow-2-flat`, a superfície chapada das seções
  internas. Sem mistura válida o token volta ao papel e o fundo fica plano.
  `--muted-glow`, `--muted-glow-2` e `--muted-glow-2-flat` resolvem o texto de
  apoio medido contra a parada mais forte, não contra a média. `--accent-glow`
  clareia o acento para a faixa de conversão e substituiu `--accent-deep`, que
  misturava com a tinta e sujava a cor.
- **Palavras inteiras.** A raiz usa `overflow-wrap: break-word`; títulos, ações,
  navegação larga e declarações usam `overflow-wrap: normal` e hifenização
  manual. Somente endereços, contatos e o menu compacto podem quebrar em qualquer
  ponto. O contrato compartilhado em `lib/blocks/headline.ts` registra o
  comprimento do título e marca palavras com 12 caracteres ou mais para reduzir
  um degrau adicional na escala, inclusive enquanto o texto é editado na prévia.
- **Medição por palavra.** A captura percorre texto visível com `Intl.Segmenter`
  e mede cada palavra com `Range`. Se uma palavra ocupar mais de uma linha, o
  recibo visual e a crítica recebem página, viewport, seletor e termo; uma análise
  visual solicitada não pode concluir enquanto houver esse defeito.

O hero comercial usa o brilho como campo de profundidade; a CTA em tom de acento
recebe um brilho claro no canto, o explorer e a faixa de prova usam
`--glow-2-flat` chapado e ganham hierarquia tipográfica. O renderer muda a
apresentação, não o rascunho nem o snapshot gravado de um cliente. Hero, rodapé,
CTA, explorer, prova numérica e ledger de fatos estão espelhados em
`SECTION_SURFACE_RULES`; fundo custom e `decoration: none` excluem essas pinturas.
O teste de navegador percorre a matriz em desktop e celular e compara os fundos
computados com essa tabela.

### Degradê com técnica

Todo degradê de fundo é um brilho radial: o centro nasce na borda ou fora da
caixa, a cor perde opacidade em três a cinco paradas e chega a `transparent`
antes da coluna de texto. Não existe degradê reto entre duas cores plenas em
nenhuma vibe, e nenhum token de fundo mistura em direção à tinta. Os dois
extremos de um degradê saem sempre do mesmo contexto de cor: um brilho medido
contra o papel da marca nunca é pintado sobre o papel de uma seção de outro
tom. `tests/site-gradient-contract.test.mjs` varre `app/(sites)/*.css` e as
miniaturas de `app/(admin)/admin.css` e recusa esse formato, com uma lista
explícita de exceções — véus do hero `cover`, máscaras, grade do v2, faixas
repetidas do ousado e os fios de 1 px do painel. A camada
`app/(sites)/operator.css`, importada por último, apaga lavagem, brilho e motivo
quando o operador escolhe fundo local ou `decoration: none`; um degradê local
explícito permanece inline e usa duas extremidades medidas. O estudo que originou o contrato está em
[registro do plano](archive/gradient-technique-plan-2026-09-13.md).

No hero `cover`, a cor local só substitui o véu preto se o extremo de 78% do
véu, composto sobre branco, sustentar o texto de apoio branco a 78% com
contraste de pelo menos 4,5:1. O limiar de fundo escuro usado para logos não
decide esse caso. Tons intermediários conservam o véu preto; vinho escuro
continua colorido. A escolha não certifica qualquer foto: o gradiente perde
opacidade ao longo da imagem. O teste de navegador inclui o `cover`, com uma
imagem cinza controlada, seis cores locais e medição da transparência real
do apoio em 1440 e 390 px.

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
  por `headlineScale`, em `lib/blocks/headline.ts`. No artístico v3/v4 a
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
validado por enum. Em `cta.band.items`, o símbolo é obrigatório porque identifica
o telefone, WhatsApp, endereço ou outro contato ao qual o rótulo pertence; o
link continua opcional. Sem `items`, a faixa não cria símbolos nem espaços
reservados. Em bento e recursos, a foto tem prioridade sobre o ícone. Ícones
não substituem fotos nem sustentam alegações comerciais.
O renderer fornece a vibe resolvida no servidor; blocos não escolhem um peso
arbitrário nem fornecem SVG ou URLs de ícones.

Em `feature.bento`, `items.href` é opcional. Quando existe, foto, título e texto
do item formam um único link, com seta funcional, foco visível e destino
resolvido pela prévia. Itens sem destino preservam o HTML e a apresentação
anteriores. O agente liga um card a uma página existente sem trocar a seção nem
inventar um botão separado.

O layout `featured-masonry` de `feature.bento` usa o primeiro item como faixa
protagonista na largura integral do container. Os demais cards seguem logo
abaixo em colunas CSS balanceadas, com `break-inside` e retorno a uma coluna em
telas estreitas. O arranjo continua responsivo e não cria HTML ou CSS livre por
tenant. Na gramática comercial, ele também satisfaz o papel de seção
protagonista quando reúne as fotos exigidas pelo pre-flight.

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

| Recurso              | Comportamento                                                                                                                                                                                                                                                                                                                                                                   |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Perfil persistido    | `brand.design` guarda conceito, elemento-assinatura, estrutura, justificativa e oito eixos. Sem referência nova grava v5; com referência verificada grava v6 e `referenceDirection`. Landing Page grava v7 sem estrutura multipágina. A leitura aceita v2-v7 para preservar sites existentes. `tenant.brief` guarda também plano editorial e cenas semânticas.                  |
| Tipografia           | 14 famílias, dez opções de display e sete de corpo, descritas acima. `next/font` auto-hospeda os arquivos; o navegador carrega somente as famílias usadas. Escala, peso, entrelinha, medida, legendas e números têm papéis consistentes.                                                                                                                                        |
| Vibe e referência    | Sem referência, `brand.vibe` define gramática, eixos, raio, luminância e dials. No v6, a referência escolhe entre as doze estruturas e pode definir todos esses valores; a vibe continua como voz e fallback. Ausente significa `comercial`.                                                                                                                                    |
| Paleta               | O cadastro oferece uma sugestão por vibe. Enquanto `paletteSource` for `sugerida`, a direção pode adaptá-la ao negócio; editar qualquer cor muda a origem para `operador` e trava `accent`, `accentAlt` e `highlight`. `ink`, `paper` e `surface` continuam com a direção. Contraste AA e diferença entre primária/secundária permanecem gates.                                 |
| Composição global    | Três estruturas por vibe combinam abertura, ordem mínima, assinatura e fechamento. V5 escolhe dentro da vibe; v6 escolhe a mais próxima da referência entre as doze. Seis heroes, quatro navegações, quatro ritmos, quatro tratamentos de imagem, quatro superfícies e cinco motivos modulam o resultado.                                                                       |
| Apresentação local   | Todo bloco aceita `presentation`: tom, fundo hex ou transparente, degradê de duas pontas/direção, decoração da vibe ligada/desligada, largura, respiro, alinhamento, borda e motion (`none`, `reveal`, `stagger`, `image`). Fundo local sempre vence a vibe; a mesma tinta precisa passar AA em todas as pontas. Use um a três momentos de movimento coerentes com a narrativa. |
| Exploração e inbound | `feature.explorer` oferece seleção de aplicações com imagem, texto, fatos e CTA por aba; suporta teclado. `editorial.resources` conecta páginas com hierarquia editorial e imagem ou símbolo. Ambos oferecem layouts próprios.                                                                                                                                                  |
| Imagens              | Hero aceita posição, `cover`/`contain`, ponto focal e legendas; atelier aceita imagem secundária. A home exige duas fotos disponíveis distintas da biblioteca do tenant. Imagens geradas chegam ao agente com número e URL para uso imediato, sem aprovação.                                                                                                                    |
| Navegação e FAQ      | Menu mobile usa diálogo modal com foco, Escape e restauração da rolagem; há fallback sem JavaScript. FAQ usa `details`/`summary` nativos.                                                                                                                                                                                                                                       |
| Âncoras              | Todo bloco aceita `anchor` opcional, começando com letra minúscula, seguido de letras/números/hífens, até 64 caracteres. Link usa `#anchor`. Duplicação bloqueia publicação. Formulário sem âncora mantém `contato`.                                                                                                                                                            |

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
Acima de 0,75, `build_site` e `set_blocks` recusam a home, listando as marcas repetidas sem revelar o outro cliente. Na publicação solicitada, `composicao-duplicada` é recomendação editorial. Perfis v2/v3 continuam na régua
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
produzir pendências no rascunho. Na publicação solicitada, `lib/sites/publication-policy.ts` converte achados editoriais em recomendações; dados inválidos, destinos quebrados e regras não classificadas continuam bloqueando a transação.

Na forma `multi`, `lintSite` exige três páginas orgânicas com pelo menos 100 palavras de conteúdo,
intenções e SEO distintos, etapas de inbound, links e âncoras válidos e alcance
a partir da home. Também exige duas fotos disponíveis distintas, uma seção
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
reconstruir um cliente antigo, o agente cria o perfil atual compatível: v5 sem referência, v6 com referência verificada ou v7 para Landing Page. As páginas são recompostas antes da nova publicação.

As fixtures em `tests/browser/` verificam componentes com dados sintéticos e
CSS do build Next.js. Elas não substituem uma avaliação de geração do modelo.
A [verificação](verification.md) descreve os recursos e limites de cada suíte.

A régua de avaliação está versionada: `evals/cases/` traz os briefings,
`docs/eval-rubric.md` a rubrica e `npm run eval:site` roda o fluxo real num
tenant descartável, gravando o relatório em `outputs/evals/`. Com `--generate`,
o runner gera fotos já disponíveis e segue o mesmo fluxo sem aprovação, com
limite de 14 chamadas para incluir as seis cenas do atelier e a composição.
`report.flow` informa conclusão, próxima fase, motivo da parada e tentativas.
Limite esgotado ou fase com erro resultam em
execução incompleta e código de saída 1.

## Acessibilidade da operação

Sugestões preenchem o compositor e aguardam envio. A escala funcional do painel
usa piso de 12 px, corpo das mensagens em 14 px e números tabulares para tempos
e custos. Movimento respeita `prefers-reduced-motion`.

O detalhe de consumo tem altura limitada, rolagem própria e região nomeada.
Ao abrir, entra na área visível. Em telas baixas, a conversa permite alcançar
os controles sem deslocar automaticamente o andamento durante a leitura do
histórico. A atividade das edições também aparece acima da prévia.

A composição visual do painel está no início deste guia; a jornada e as
condições de início automático estão no [manual do operador](admin.md).
