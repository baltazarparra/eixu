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
frases que finja entender toda linguagem natural, nem revisão visual automática.

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
aceitam antes/depois de um ID ou início/fim; `remove` remove o alvo indicado.
`replace_block` troca o tipo e as props completas mantendo o ID, quando a
mudança de variante exige outro schema; ajustes de layout usam `set`.

A rota injeta snapshot e schemas da página em foco, lidos no servidor neste
turno. Outra página exige `get_page`. O agente reúne as mudanças em uma chamada
por página e conclui usando o recibo; uma pergunta necessária de alvo continua
sendo preferível a alterar o lugar errado. A edição geral deixa de expor os
quatro mutadores antigos. Geração/revisão e o escopo específico de cabeçalho
conservam seus consumidores compatíveis.
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

## Pedido que não cabe no bloco

Reposicionar um elemento dentro de um bloco só existe quando há campo para
isso. Os selos do hero ganharam `bulletsPlacement` em `hero.split` e
`badgesPlacement` em `hero.landing`, com `cta` (sob os botões, padrão) e
`headline` (logo abaixo do título). A ordem muda no DOM, não por CSS, para o
teclado e o leitor de tela encontrarem os selos onde eles aparecem; no layout
`editorial` os selos pedidos sob o título acompanham a coluna dele.

Degradê é um desses pedidos. `presentation.background` grava uma cor chapada e
remove lavagem, brilho e motivo da vibe naquela seção; não existe campo para um
degradê local. O agente explica isso e oferece o que o bloco permite — a cor
chapada, ou o tom da marca, que devolve a seção ao brilho da vibe. Ver
[Design](design.md), "Degradê com técnica".

Sem um campo assim, o agente não grava: explica o limite e oferece a
alternativa real. `contentLossError` garante isso em código, não só no prompt.
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

Um pedido atual para resolver pendências inicia `repair_publication`. O reparo
alinha referências com fatos existentes, retira alegações sem confirmação e
remove fotos de depoimentos que não são envios reais. Se uma lista fica abaixo
do mínimo do componente, preserva os fatos confirmados em texto; destinos de
âncora são mantidos. Não altera o cadastro, imagens ou snapshots publicados,
nem dá autorização de remoção livre ao `edit_page`. A escrita continua validada
e compara a revisão do rascunho. O recibo descreve as mudanças efetivas.

**Publicar** e pedidos diretos como **“publicar, eu autorizo”** promovem o conteúdo
atual. O comando direto roda no servidor sem chamada ao modelo. Recomendações
de prova, copy, SEO, imagens ou composição ficam visíveis e não vetam a decisão.
Erros técnicos, como props inválidas, página vazia ou destino inexistente,
continuam recusando a transação. Publicação não confirma fatos e não executa
reparos por conta própria. A ferramenta usa o briefing atualizado no mesmo turno.

## Integridade da edição

O executor prepara o lote em memória, valida os blocos tocados e recusa novos
erros de `lintPage` e `lintTextStyles`. Erros anteriores fora do pedido permanecem no recibo. A
escrita compara `blocks` em JSONB e usa ID da página e do tenant; se outra aba
gravou, retorna conflito. Os mutadores antigos também usam essa gravação.
Nenhum snapshot publicado é alterado. A atomicidade vale por página, não por
um pedido com várias páginas. Uma repetição com revisão antiga é recusada; não
é um mecanismo de desfazer ou histórico de versões.

`presentation.background` aceita hex de seis dígitos ou `transparent`.
O renderer calcula texto, apoio e links legíveis localmente.
`presentation.foreground` é opcional e exige fundo hex explícito e contraste de
4,5:1. Sem essas props o comportamento anterior permanece. A ordem salva é
respeitada após o footer, com um único `main` e localização automática antes do
rodapé. A seção extra posterior fica fora de `main`.

`savePageEdit` fica em `lib/sites/edits.ts` e é compartilhado pelo chat, pelos
mutadores legados e pela rota administrativa de edição direta. A prop
`textStyles` permite pedidos de tamanho e cor pelo mesmo `edit_page`, por
exemplo `set` de `textStyles` com `[{"field":"headline","size":1}]`. Os
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
- `tests/admin-visual-edit.test.mjs` e `tests/admin-evidence.test.mjs` cobrem
  o pedido de reconhecimento, recusas, fechamento do chat e integridade dos
  fatos. `tests/browser/site-recognition-edit.test.mjs` mede quatro famílias
  com a moldura global e CSS de produção em desktop e celular.
- `tests/admin-landing-frame.test.mjs` e
  `tests/browser/site-landing-frame.test.mjs` cobrem remoção da moldura do hero,
  preservação dos campos e snapshots, restauração dos padrões e as duas
  variantes com CSS de produção em 1440, 390 e 320 px.
- `EIXU_TEST_POSTGRES_URL=... node --test tests/admin-page-edits-db.test.mjs`
  aceita apenas PostgreSQL local descartável `eixu_pr2_test`; força duas
  leituras da mesma versão e verifica o conflito no SQL real.
- `npm run eval:edits -- --live` usa Gemini configurado, prompt e executores
  reais sobre páginas sintéticas em memória. Registra exatidão, chamadas,
  passos, duração, consumo e saída em `outputs/page-edits/`. Não acessa Neon,
  Blob nem publicação. `--case=text|nested|color|insert|move|move-within|impossible-move|ambiguous|recognition-image|landing-frame` filtra.
  `--attachment=fixture.png` envia os pixels de uma captura sintética ao modelo;
  o caso `landing-frame` usa o pedido real de remover o container e deixar a imagem.

Os checks atuais estão em [Verificação](verification.md); resultados medidos
ficam no [histórico](archive/verification-2026-09-13.md). Testes determinísticos não provam que toda
formulação em linguagem natural será interpretada corretamente, e uma
medição de chamadas não equivale a comparação estatística de latência.
