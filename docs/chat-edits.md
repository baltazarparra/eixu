# Edição de sites gerados pelo chat

## Objetivo e escopo

O estudo de 12/09/2026 encontrou uma leitura obrigatória da página em cada
edição, substituição integral de objetos/listas em `update_block`, posições
numéricas em inserção/movimento e ausência de cor exclusiva por seção. Além
disso, o renderer agrupava todo conteúdo antes do rodapé, mesmo quando a
ordem salva colocava um bloco depois dele. Serializar ferramentas do mesmo
turno não protegia a página de outra aba.

O contrato implementado reúne o pedido de uma página em uma operação validada,
entrega o snapshot atual no contexto do agente, preserva posição e campos não
alterados, permite uma paleta local e confere concorrência na gravação. A
melhoria de latência buscada é eliminar viagens desnecessárias entre modelo e
ferramentas; o modelo e o raciocínio `high` permanecem iguais. Não há parser de
frases que finja entender toda linguagem natural. A edição visual ganha medição
determinística no navegador; crítica visual por modelo continua somente a pedido.

Antes deste contrato, a rota distingue conversa de ação. Pergunta, hipótese,
opinião ou anexo sem comando não chega a `edit_page`: o runtime fornece somente
leitura do manual, estado, página, catálogo, imagens e lint. Uma instrução
direta, um resultado desejado ou a confirmação de uma proposta executável abre
a política abaixo. A classificação é conservadora; se uma frase ambígua ficar
em conversa, o rascunho permanece intacto e o operador pode reformular como
ordem. O [manual completo](manual-gerador-sites.md#conversa-e-edição) traz
exemplos e a lista de ferramentas.

## Contrato

`edit_page` recebe página, revisão e operações. `set`/`unset` alteram caminhos
de props, inclusive itens de listas. `replace_text` troca texto literal,
preservando maiúsculas, acentos e o restante do campo; sua contagem esperada é
um por padrão. Ambiguidade retorna os blocos/campos candidatos sem gravar.
Em pedidos curtos contendo apenas uma troca entre dois textos entre aspas,
a rota detecta múltiplas ocorrências e pergunta antes de chamar o modelo. O
executor repete essa proteção para que IDs escolhidos pelo modelo não a
contornem. Esse reconhecimento é restrito; pedidos compostos ou com alvo
explícito continuam sendo interpretados pelo agente.
URLs, âncoras e configuração não entram na busca textual. `insert` e `move`
aceitam antes/depois de um ID ou início/fim. Em listas, `insert_item` acrescenta
um valor na posição indicada, `move_item` reposiciona um valor existente e
`remove_item` tira um elemento pelo caminho e índice. `remove` apaga o bloco
inteiro e só é aceito quando o pedido autoriza esse tamanho.
`replace_block` troca o tipo e as props completas mantendo o ID, quando a
mudança de variante exige outro schema; ajustes de layout usam `set`.

A rota resolve página ou conteúdo explicitamente nomeado antes do foco e injeta
o snapshot e os schemas dessa página, lidos no servidor neste turno. Em um
pedido visual por família, ela inclui também slug, ID, revisão e
`presentation` dos alvos das outras páginas; `get_page` só é necessário se essa
revisão faltar ou houver conflito. O agente reúne as mudanças em uma chamada
por página e conclui usando o recibo; uma pergunta necessária de alvo continua
sendo preferível a alterar o lugar errado. A edição geral deixa de expor os
quatro mutadores antigos. Geração/revisão e os consumidores legados permanecem
compatíveis.
Nos turnos que usam edição, confirmação de evidência e validação, o fechamento
exibido e salvo no histórico vem dos recibos reais, mesmo se o modelo escrever
outra conclusão. As ferramentas e o loop do SDK continuam ativos; somente o
texto aguarda o término. Perguntas sem operação preservam a resposta do modelo.
Pedidos mistos com outras ferramentas, como publicação ou geração de imagens,
conservam seu fechamento próprio. Erro fatal descarta texto ainda não exibido.
Se o loop terminar após ferramentas sem resposta textual, o stream produz um
resumo do estado salvo.

## Andamento e atualização da prévia

Durante uma edição, a atividade e o tempo ficam fora da área rolável do
histórico, junto do compositor. A prévia também mostra a atividade, inclusive
com a conversa recolhida e na aba Prévia do celular. Os rótulos acompanham o
pedido recebido, as ferramentas em execução e a preparação da resposta final;
não estimam porcentagem nem expõem raciocínio privado.

Após um recibo de escrita confirmada, `completeChatStream` envia o evento
transitório `data-preview-update`. Ele não depende da resposta final do modelo
nem de uma nova leitura do banco e não entra no histórico do agente.
`changesPreview` reconhece os mutadores e recusa leituras, resultados
preliminares, falhas e operações sem mudança. Cada chamada sinaliza uma vez.

O editor recarrega o iframe imediatamente e consulta o estado do painel em
paralelo. A revisão recebida nessa consulta não repete a recarga já pedida;
respostas antigas continuam sendo descartadas. O fim ou a interrupção do
turno mantém a releitura de segurança, e o feed da geração continua usando
a revisão do rascunho para detectar alterações.

A edição direta de textos conserva sua referência ao iframe e o protocolo
de salvamento. Enquanto há uma sessão de edição direta, sinais de mudança
avisam sobre o novo estado sem recarregar ou descartar textos não salvos.

O iframe informa **Atualizando prévia** e só confirma **Prévia atualizada**
quando carrega o documento do site. Erro, redirecionamento de sessão ou espera
maior que 20 segundos oferecem nova tentativa. A rolagem é preservada em
edições da mesma página; escolher outra página começa uma prévia nova.

## Fundo, degradê e escopo por família

`presentation.background` aceita um hex local ou `transparent`.
`backgroundEnd` junto de `gradient: down | diagonal | right` cria um degradê
validado; ambos exigem `background` em hex. Uma única tinta precisa manter
contraste mínimo de 4,5:1 nas duas extremidades. Sem `foreground`, o servidor
escolhe essa tinta; com `foreground`, valida a escolha explícita. Se não houver
par comum, o lote é recusado e, quando só o fim precisa mudar, a mensagem sugere
a extremidade mais próxima que passa.

`decoration: none` retira lavagem, degradê de CTA e motivo da vibe daquela
seção sem escolher outra cor; `vibe` restaura a decoração. Um fundo local passa
a prevalecer sobre qualquer decoração de vibe pelo arquivo
`app/(sites)/operator.css`, importado por último, e não muda a paleta da marca.
Para voltar ao padrão, remova `background`, `backgroundEnd`, `gradient` e
`foreground` e restaure `decoration: vibe` quando aplicável.

Pedidos visuais que nomeiam rodapé/footer, cabeçalho/header/menu ou
abertura/banner/hero viram um escopo `visualOnly`. Sem página indicada, atingem
todos os blocos daquela família; “nesta página”, home ou uma página nomeada
restringem o conjunto. Nesse modo, `set_brand` não existe e o executor aceita
somente `presentation.*`, `textStyles.*`, apresentação de imagem e, em
`nav.bar`, `position`/`backgroundOpacity`. Textos, itens, tipo, layout e ordem
continuam preservados.

Alinhamento tem três alcances. `textStyles.align` muda um campo, como apenas o
subtexto. `presentation.textAlign` muda todos os textos da seção.
`presentation.contentAlign` posiciona o grupo e seus controles em `start`,
`center` ou `end`; ele só entra quando o pedido inclui o conteúdo, os botões, a
lista ou o layout do grupo. A página Início explicitamente nomeada resolve para
`/` mesmo quando outra página está aberta. O CSS do operador é a última camada:
um campo com alinhamento próprio vence a regra da seção sem usar `!important`.

`presentation.elements` cobre ajustes internos que não têm uma prop dedicada.
Cada entrada escolhe seção, container, conteúdo, título, corpo, ações, lista,
item por índice, mídia, imagem, formulário, ação ou campo e pode valer sempre,
somente no mobile ou somente no desktop. Flex, grid, posição, dimensões,
espaçamento, ordem, deslocamento, raio, opacidade, cor, borda e sombra são
valores tipados. O renderer converte esses valores em CSS escopado ao bloco; o
agente nunca fornece seletor nem CSS livre.

Depois de uma gravação que altere `presentation.*` ou `textStyles.*`, o mesmo
Chromium da revisão abre a prévia autenticada em 1440 e 390 px. Ele localiza
somente os `[data-block-id]` tocados, lê fundo/camada, tipografia, regras
internas e alinhamentos computados e mede todo texto visível pelo inspetor
compartilhado. O retorno contém números e achados,
sem screenshot, pixels ou crítica por modelo. Transparências são compostas com
as superfícies ancestrais; texto diretamente sobre uma imagem, sem painel opaco,
é declarado não mensurável em vez de receber aprovação por uma cor de fallback.
Falha ou indisponibilidade não desfaz a gravação, mas o recibo precisa ressalvá-la. `EIXU_REVIEW_CAPTURE=0`
desliga essa medição e isso também aparece no recibo. A prévia segue como
revisão humana; a edição não publica nada.

## Ajuste sem campo dedicado

O agente usa primeiro o campo semântico próprio porque ele preserva acessibilidade
e ordem do DOM. Os selos do hero usam `bulletsPlacement` em `hero.split` e
`badgesPlacement` em `hero.landing`, com `cta` (sob os botões, padrão) e
`headline` (logo abaixo do título). A ordem muda no DOM, não por CSS, para o
teclado e o leitor de tela encontrarem os selos onde eles aparecem; no layout
`editorial` os selos pedidos sob o título acompanham a coluna dele.

Quando não há campo próprio, `presentation.elements` posiciona e estiliza a
parte interna por alvo semântico e viewport. Inserir ou mover um card usa
`insert_item` ou `move_item`; trocar a própria composição usa o layout ou o
tipo registrado. O agente executa o pedido claro e não oferece centralização,
inversão de mídia ou outra composição como substituto.

`contentLossError` garante em código que essa liberdade não apaga conteúdo.
Quando o pedido atual não menciona remoção, uma operação que apague texto é
recusada com o lote inteiro: campo de copy que some ou fica vazio, lista que
encolhe, bloco com texto removido e troca de tipo que não migra o texto.
`asksRemoval` reconhece expressões de remoção na mensagem atual. Restrições
como "apenas mova", "sem apagar" e remoção de bordas não autorizam apagar
conteúdo. O reconhecimento é conservador e não cobre toda linguagem natural.
Apresentação, layout, links, imagens
e `textStyles` não contam como conteúdo. A guarda vale na edição geral; a
composição e o reparo continuam livres para recompor a página.

Pedidos visuais com alvo como `no bloco "Reconhecimento comprovado"` têm uma
guarda adicional quando não incluem alteração de conteúdo. O executor limita
o lote à apresentação e imagem desse bloco na página em foco. Recusa troca de
tipo/layout, reordenação, perda de textos/itens e mudanças em outras seções.
Marca global, geração de imagens e confirmação de fatos não ficam disponíveis
nesse turno. Alvo ausente impede a escrita. Pedidos mistos seguem o escopo geral.

Em `signature.composition`, cada item aceita `imagePresentation`: `frame: none`
retira fundo, borda, arredondamento, sombra e padding do box e da imagem, inclusive a moldura
global; `fit: natural` mostra a proporção original; `width: container` ocupa
100% do box atual; `spacingTop: none` retira margem/padding superiores. Esses
campos não trocam a grade da seção. Para o contêiner da seção, use
`presentation.background: transparent`, `edge: none` e `spacingTop: none`.
Sem as novas props, os padrões continuam iguais.

`hero.landing` oferece os mesmos controles em `imagePresentation`, tanto na
foto do `stage` quanto na foto opcional do `form`. Para retirar o container
decorativo e deixar só a imagem, `frame: none` e `fit: natural` removem as duas
molduras e a área vazia da proporção fixa. A imagem permanece no mesmo lugar,
com o mesmo arquivo; headline, selos, ações e formulário são preservados.
Isso não exige trocar a abertura por `hero.split`. No `form`, o painel dos
campos continua independente da moldura da foto.
O pedido de remover um container **deixando apenas a imagem** não autoriza
apagar o conteúdo do bloco. Esse recorte é conservador e não substitui a
interpretação do alvo pelo agente e pelo anexo do operador.

Para carrosséis, `hero.landing:stage` e os layouts `split`, `poster`,
`editorial` e `offset` de `hero.split` aceitam `slides`; a configuração comum
fica em `carousel`, e `media.gallery` aceita o layout `carousel`. A foto já
salva em `image` permanece como primeira imagem, e `slides` recebe as demais na
ordem pedida. O recibo de um `set slides` informa **“carrossel com N fotos”**;
alterar autoplay ou intervalo informa **“carrossel ajustado”**. Remover depois
uma foto reduz a lista e exige que a mensagem atual peça essa remoção, pois
`alt` e legenda também são conteúdo. `hero.landing:form`, `hero.split:cover` e
`hero.split:atelier` não aceitam slides: o agente deve explicar o limite e
oferecer `media.gallery:carousel` após a abertura, sem gravar uma mudança não
pedida.

## Fato confirmado pelo operador

`landing-prova` e as demais regras de prova leem a evidência confirmada. Ela
vem do cadastro, em Dados › Evidências, ou do chat: `confirm_evidence` grava
em `brief.evidence` os fatos que o operador escreveu na conversa. O executor
compara frases completas, preservando números, ordem, contexto e negações;
aceita diferenças de acento, caixa e pontuação terminal. Não autoriza resumo,
recombinação de termos, perguntas ou fatos extraídos de anexos. A página
montada não comprova nada sozinha. A correspondência não verifica a verdade
externa da declaração do operador.
A comparação ignora acento, caixa e ponto final: o fato digitado sem acento em
Dados sustenta o selo acentuado da página, e a grafia deixa de ser o fato. Uma
frase com pontuação no meio não passa por `confirm_evidence` e pode entrar em
Dados › Evidências. Cadastro, confirmação e referência do bloco aceitam até
160 caracteres. Salvar Dados com outro
nome, história, Site atual ou referência refaz o briefing derivado e conserva
`brief.evidence`.

A ferramenta não apaga evidência existente, deduplica o próprio lote e recusa
toda a chamada quando ultrapassaria 12 registros. A escrita compara o cadastro
anterior para evitar perda entre abas. `added` contém somente o que foi gravado;
o retorno inclui a validação feita nessa chamada. Não existe espera de
sincronização do validador. A ferramenta não entra nos escopos restritos de
cabeçalho ou de apresentação de um bloco.

## Pendências de publicação pelo chat

`lib/taste/pendencias.ts` transforma os achados do pre-flight no que resolve
cada um, em código. Para prova, compara a alegação exibida com as frases
confirmadas: quando alguma sustenta o texto, devolve `alinhar` com bloco,
caminho e valor exatos para um `set`; fatos já escritos podem ser registrados
por `confirm_evidence`. Quando falta confirmação, oferece `reparar-prova`,
sem exigir que o operador repita frases do modelo. Para `imagem-proporcao`, devolve o número da
imagem, a proporção atual e a exibida, as fotos da biblioteca que cabem, os
layouts do mesmo bloco que exibem a proporção atual e a geração por
`update_image` com `ratio`. As demais regras recebem `editar`: o agente deve
consultar o schema, corrigir com as ferramentas existentes e verificar o resultado.

O plano entra no prompt do turno de edição, junto das frases confirmadas, e no
retorno de `lint_site`, `lint_page`, `edit_page`, `repair_publication` e `confirm_evidence`. O agente
deixa de depender de o operador colar a lista e de adivinhar a causa do
bloqueio. `lint_page` soma as regras de site daquela página e usa a mesma
classificação de publicação do painel. O painel oferece **Resolver pelo chat**, que preenche o
pedido sem enviar.

Um pedido atual e explícito para resolver pendências inicia `repair_publication`.
O mesmo filtro determinístico que inicia o fluxo controla a presença da
ferramenta no runtime; um pedido visual que termina em “corrigir” continua
vendo `edit_page`, mas nunca recebe `repair_publication`. O executor repete a
validação antes da escrita. Quando autorizado, o reparo
alinha referências com fatos existentes, retira alegações sem confirmação e
remove fotos de depoimentos que não são envios reais. Se uma lista fica abaixo
do mínimo do componente, preserva os fatos confirmados em texto; destinos de
âncora são mantidos. Não altera o cadastro, imagens ou snapshots publicados,
nem dá autorização de remoção livre ao `edit_page`. A escrita continua validada
e compara a revisão do rascunho. O recibo descreve as mudanças efetivas.

`cta.band` aceita `layout: cover` quando a faixa precisa usar uma foto como
fundo. Nesse modo, `image` e `imageAlt` são obrigatórios e o renderer aplica uma
camada de contraste sem transformar base64 ou CSS em dados do tenant. `items`
recebe de um a quatro pares `{icon, label, href?}` para contatos e localização;
o ícone vem do enum compartilhado. Sem uma foto inequívoca na biblioteca, o
agente pergunta qual usar. Sem foto disponível, explica o limite e oferece um
layout com imagem separada ou `media.image`, que são alternativas executáveis.

Cards de `feature.bento` aceitam `items.N.href`. Um pedido para ligar o card de
Padaria à página já criada usa um único `set` no item correspondente e preserva
foto, título, texto, bloco e layout. O renderer torna o conteúdo inteiro do card
navegável e mantém os itens sem `href` inalterados; o agente não deve sugerir a
troca da seção para contornar esse caso.

O mesmo bloco aceita `layout: featured-masonry`: o primeiro item ocupa a largura
inteira do container e os seguintes são distribuídos em colunas masonry, com uma
coluna no celular. `remove_item` retira somente o índice apontado em uma lista e
só é aceito quando o pedido atual menciona remoção. Assim, uma referência visual
pode indicar o trecho a retirar sem obrigar o agente a reconstruir `items` ou
substituir o bloco por uma composição diferente.

**Publicar** e pedidos diretos como **“publicar, eu autorizo”** promovem o conteúdo
atual. O comando direto roda no servidor sem chamada ao modelo. Recomendações
de prova, copy, SEO, imagens ou composição ficam visíveis e não vetam a decisão.
Erros técnicos, como props inválidas, página vazia ou destino inexistente,
continuam recusando a transação. Publicação não confirma fatos e não executa
reparos por conta própria. A ferramenta usa o briefing atualizado no mesmo turno.

## Tamanho da remoção e reversão

A autorização para apagar deixou de ser um único bit do turno. `removalScope`
em `lib/ai/edit-policy.ts` classifica o pedido atual pelo objeto da ação:
"remova a foto da seção" autoriza `item`; "remova a seção que tem uma foto"
autoriza `block`, porque a foto só identifica o alvo. A grafia "sessão" também
é aceita. Um alvo apontado só por anexo fica indefinido e a remoção grande
passa a exigir confirmação.

`applyPageEdit` mede a operação contra esse escopo antes de qualquer escrita.
Apagar ou substituir um bloco sob escopo de item é recusado com o nome da seção
e a quantidade de itens e textos que sairiam; um lote não apaga duas seções de
uma vez. Quando a tentativa de `remove` pede confirmação, o servidor guarda
o lote, a página, o ID do bloco e a revisão num registro interno de
`chat_messages` (`edit-pending`). Uma resposta afirmativa na fala seguinte
retoma esse lote sem nova interpretação do modelo. Outra fala consome a
pendência; revisão desatualizada ou bloco ausente recusam a escrita. Um "sim"
sem pendência não autoriza nada. Pedido explícito de remover a seção inteira
grava diretamente, sujeito aos erros técnicos do schema e do pre-flight;
recomendações de composição ficam no painel.

Em um pedido composto, a exclusão autorizada não libera perda incidental de
texto nos demais blocos do lote. Se o agente salvar outra parte e deixar a
seção pedida intacta, o recibo declara essa omissão.

Toda escrita do rascunho guarda o estado anterior em `page_revisions`, com
retenção das vinte últimas versões por página. `undo_page_edit` e o botão
Desfazer do painel restauram essa versão com os mesmos blocos, IDs, textos e
posições, e guardam o estado atual antes de restaurar, de modo que um segundo
desfazer devolve o que estava ali. Um pedido curto e direto de reverter é
resolvido pelo servidor, sem chamar o modelo. No chat, a revisão mais recente do
cliente decide a página; trocar o foco depois de editar não muda o alvo do
“desfaz”. O botão acima da prévia continua deliberadamente restrito à página
aberta. O histórico é melhor esforço: se
a gravação falhar, a edição continua valendo e o recibo não oferece desfazer.
Atualização da página, inserção da revisão e retenção usam a mesma transação e
mantêm o lock da página até o commit. Assim duas edições aceitas não conseguem
inverter a ordem do histórico; o desfazer também escolhe, restaura e consome a
revisão sob o mesmo lock.
Nada disso alcança snapshot publicado, imagens ou cadastro.

O recibo declara o tamanho do que saiu, por exemplo `seção removida, com 4
itens e 21 textos`, e uma inserção é descrita como seção nova, nunca como
reversão. Depois de um lote que removeu conteúdo, o fechamento informa que é
possível desfazer.

## Alvo apontado na prévia

No modo apontar, a prévia marca o elemento sob o cursor e envia bloco e texto
visível pelo protocolo `eixu-edit/1`. O painel exibe o alvo escolhido junto do
compositor e o envia com a próxima mensagem. `resolveAnchor` confere esse texto
nas props antes de aceitar o índice do item: sem correspondência, o alvo fica
no bloco e a remoção grande continua exigindo confirmação. O modo existe apenas
na prévia autenticada e não altera o layout do site.

## Integridade da edição

O executor prepara o lote em memória, valida os blocos tocados e recusa novos
erros de `lintPage` e `lintTextStyles`. Erros anteriores fora do pedido permanecem no recibo. A
escrita compara `blocks` em JSONB e usa ID da página e do tenant; se outra aba
gravou, retorna conflito. O lock da página ordena a revisão e a mutação até o
commit. Os mutadores antigos também usam essa gravação.
Nenhum snapshot publicado é alterado. A atomicidade vale por página, não por
um pedido com várias páginas. Uma repetição com revisão antiga é recusada. O
desfazer é o caminho de reversão, descrito acima; a comparação de revisão
continua sendo proteção de concorrência, não histórico de versões do site.

`presentation.background` aceita hex de seis dígitos ou `transparent`; degradê
e decoração seguem o contrato acima. `sectionBackgrounds` resolve a superfície
efetiva pela vibe renderizada, versão, família, layout, tom e escolha local. A
tabela compartilhada em `lib/blocks/theme.ts` alimenta renderer, lint e recibo,
que sempre medem a pior superfície. Sem essas props o comportamento anterior
permanece. A ordem salva é respeitada após o footer, com um único `main` e
localização automática antes do rodapé. A seção extra posterior fica fora de
`main`.

`savePageEdit` fica em `lib/sites/edits.ts` e é compartilhado pelo chat, pelos
mutadores legados e pela rota administrativa de edição direta. A prop
`textStyles` permite pedidos de tamanho, cor e alinhamento pelo mesmo
`edit_page`, por exemplo `set` com
`[{"field":"headline","size":1,"align":"right"}]`. Os
limites e o contraste são os do [contrato visual](design.md#texto-por-campo).
O chat não muda de modelo, raciocínio ou fluxo por causa dessa prop.

## Validação reproduzível

- `EIXU_CHROME_PATH=... node --test tests/browser/admin-chat-edits.test.mjs`
  usa o POST, stream, SDK, executores e editor reais com I/O/modelo em memória
  e CSS do build Next.js. Segura resposta final, consulta de estado e iframe
  separadamente para verificar a atualização imediata, etapas, rolagem,
  interrupção, recusas, ausência de mudança e recuperação em desktop/celular.
- `node --test tests/admin-page-edits.test.mjs tests/admin-edit-scope.test.mjs`
  confere operações reais, recusas, preservação e os scopes.
- `node --test tests/admin-remocao-escopo.test.mjs` classifica os pedidos do
  caso real, recusa a remoção da seção sob escopo de item, mantém a recusa
  quando o mínimo do schema impede tirar o elemento, libera a seção após a
  confirmação, barra dois blocos no mesmo lote, resolve o alvo apontado e mede
  o piso de composição antes da escrita.
- `node --test tests/admin-desfazer.test.mjs` usa a rota, os executores e o
  histórico em memória: reconhece o pedido de reverter, restaura blocos, IDs e
  posições idênticos, alterna entre desfazer e refazer e explica a ausência de
  versão anterior sem recriar conteúdo.
- `node --test tests/site-signature-arranjo.test.mjs` confere o arranjo
  `focus-full` no schema, no HTML e no CSS da composição de assinatura.
- `tests/admin-visual-edit.test.mjs` e `tests/admin-evidence.test.mjs` cobrem
  o pedido de reconhecimento, recusas, fechamento do chat e integridade dos
  fatos. `tests/browser/site-recognition-edit.test.mjs` mede quatro famílias
  com a moldura global e CSS de produção em desktop e celular.
- `tests/browser/site-operator-colors.test.mjs`, depois do build, percorre as
  cinco vibes, versões `2`, `4` e `reference`, 1440/390 px e as famílias hero,
  rodapé, explorer e fatos. Confere a precedência da cor local, contraste AA,
  `decoration: none` e paridade entre a tabela de superfícies e o CSS emitido.
- `tests/admin-landing-frame.test.mjs` e
  `tests/browser/site-landing-frame.test.mjs` cobrem remoção da moldura do hero,
  preservação dos campos e snapshots, restauração dos padrões e as duas
  variantes com CSS de produção em 1440, 390 e 320 px.
- `EIXU_TEST_POSTGRES_URL=... node --test tests/admin-page-edits-db.test.mjs`
  aceita apenas PostgreSQL local descartável `eixu_pr2_test`; força duas
  leituras da mesma versão e verifica o conflito no SQL real.
- `npm run eval:edits -- --live` usa o modelo de edição configurado, prompt e executores
  reais sobre páginas sintéticas em memória. Registra exatidão, chamadas,
  passos, duração, consumo e saída em `outputs/page-edits/`. Não acessa Neon,
  Blob nem publicação. `EIXU_EDIT_MODEL` permite compará-lo sem trocar o modelo
  de geração. Os casos `footer-gray`, `footer-gradient` e
  `hero-decoration-off` usam uma fixture comercial v6 com referência; o filtro
  também conserva `text|nested|color|insert|move|move-within|impossible-move|ambiguous|recognition-image|landing-frame`.
  `--attachment=fixture.png` envia os pixels de uma captura sintética ao modelo;
  o caso `landing-frame` usa o pedido real de remover o container e deixar a
  imagem. Sem `--live`, o comando apenas mostra o uso. A chamada paga exige
  autorização explícita.

Os checks atuais estão em [Verificação](verification.md); resultados medidos
ficam no [histórico](archive/verification-2026-09-13.md). Testes determinísticos não provam que toda
formulação em linguagem natural será interpretada corretamente, e uma
medição de chamadas não equivale a comparação estatística de latência.
