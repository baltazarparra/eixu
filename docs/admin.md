# Manual do operador

## Encontrar ou cadastrar um cliente

Entre em `/admin` com a credencial do operador. A busca procura nome ou
endereço; os filtros separam rascunhos e clientes com site publicado. Abra
**Novo cliente** e informe nome, endereço, oferta, ação principal e vibe. Esses
campos bastam para **Criar site**; contexto, contatos, referências, logo e cores
ficam em seções opcionais. O endereço aceita letras minúsculas, números e
hífens; nomes reservados e duplicados são recusados.

Em **Contatos**, tudo é opcional e vai direto para o site. Cada telefone é WhatsApp ou telefone comum: o primeiro WhatsApp vira o botão flutuante e os CTAs rastreados, os demais aparecem no rodapé, e o telefone comum vira link de ligação. O e-mail aparece no rodapé. Cada endereço vira a seção "Onde estamos", com mapa e link de rota, logo acima do rodapé de toda página comum; com mais de um, o visitante alterna entre eles. As redes sociais aparecem no rodapé com o ícone da rede, e o primeiro Instagram ou LinkedIn da lista é o perfil lido para o briefing.

Informe números internacionais com `+` e DDI, como `+55 11 99999-0000` ou
`+1 415 555 2671`. O sinal é preservado ao salvar e reabrir Dados. Telefones
locais podem ficar sem DDI; WhatsApp exige o código do país. Números
internacionais curtos já gravados sem o sinal precisam ser reinformados com
`+`, pois não é possível distingui-los de números locais só pelos dígitos.

Em **Direção visual**, compare miniaturas com a mesma estrutura: **Comercial**
prioriza percurso direto, prova e contato; **Moderno** usa papel quase preto,
fios de 1px, rótulos em mono e pílula clara; **Ousado** usa tipografia condensada/expressiva, contraste e
imagem de borda a borda; **Artístico** usa serifas editoriais, assimetria e
colagem controlada. Sem referência visual verificada, a vibe limita tipografia,
abertura, navegação, ritmo, superfície, imagens, ícones e movimento. Uma
referência verificada tem prioridade nesses aspectos; a vibe completa as
lacunas e continua definindo a voz do texto. Ela pode ser trocada depois em
Dados; isso abre uma nova direção no rascunho e exige recomposição antes de
publicar.

Em Marca, envie o logo, opcional, e confira três cores sugeridas pela vibe: a
primária pinta seções e superfícies, a secundária alterna o ritmo e a de acento
vai nos botões, links e destaques. A sugestão pode ser ajustada pelo agente ao
negócio. Ao editar uma cor, a paleta vira uma decisão confirmada do operador e
é preservada. Primária e secundária precisam ser diferentes; o site ajusta o
uso quando uma combinação não alcança contraste mínimo.

O painel é uma operação administrativa global: quem tem a credencial pode acessar todos os clientes. Não compartilhe essa sessão com clientes finais.

A lista de clientes é a base da navegação: busque por nome/endereço ou filtre
publicados e rascunhos. Os números mostram clientes, leads recebidos nos últimos
30 dias e execuções em fila, rodando ou encerrando uma etapa. Dentro de um
cliente, a seta no canto do cabeçalho volta para a lista, em qualquer aparelho.
O botão de sair fica no fim das ações do cabeçalho, na lista e no cliente.

## Preparar os dados

Dentro do cliente, a navegação reúne **Site**, **Imagens**, **Tráfego** e
**Dados**. Em Dados, atualize diretamente contatos e briefing: telefones,
e-mail, endereços, redes sociais, segmento, região, público, oferta, ação
esperada, fatos confirmados, restrições e até três referências. A direção visual
também pode ser trocada ali. A edição dos campos não usa o chat; a descrição de
um avatar social novo pode consumir uma chamada ao modelo.

A barra inferior conta alterações não salvas. **Salvar dados** confirma os
campos; **Descartar** restaura o último salvamento, incluindo listas de contatos
e fatos. Se salvar falhar, os valores continuam no formulário. Adicione fatos
pelo botão **+ prova** e remova um pelo seu ×. O upload do logo é imediato e
fica fora dessa barra.

Todos os campos do briefing são opcionais e cada um traz a legenda do que registrar. **Fatos confirmados** é o que a empresa faz e comprova; o site só afirma o que estiver ali ou numa referência lida, e sem isso o agente declara lacunas. **Restrições** é o que ele não pode prometer nem mostrar.

As referências do cadastro orientam estrutura, tipografia, imagens e ritmo
depois de uma leitura visual em desktop e celular. Um site de outro negócio é
referência apenas de design: não confirma oferta, capacidade ou contato do
cliente. Se a captura estiver bloqueada ou incompleta, o painel conserva a
lacuna e o gerador usa a vibe.

**Redes sociais** aceita `@perfil`, o link da rede ou a página de empresa no LinkedIn; o primeiro Instagram ou LinkedIn da lista é o perfil lido. Ao salvar, o painel lê nome, bio e foto de perfil públicos e descreve o avatar para orientar marca e imagens. A leitura é melhor esforço: perfil pessoal do LinkedIn e boa parte das contas do Instagram respondem a tela de login, e o card mostra o motivo. Nesse caso, cole a bio em Fatos confirmados e envie a imagem em Logo do site. **Ler perfil novamente** repete a tentativa.

Trocar ou remover o perfil durante a leitura descarta a resposta anterior. Uma releitura com o mesmo avatar reaproveita a imagem e a descrição existentes. O gerador de imagens também recebe as restrições e evidências consolidadas no briefing do site.

Clientes antigos recuperam em Redes sociais o perfil que estava apenas no
briefing. Salvar outros dados conserva o perfil e o avatar já lidos. Remover
essa linha explicitamente continua removendo o perfil.

Nome, contatos, logo e direção alteram o rascunho. O site no ar conserva o
snapshot completo até a próxima publicação. Alterar o briefing orienta as
próximas edições; não reescreve páginas automaticamente. Para trocar o endereço
de um cliente existente, é necessária uma operação técnica; o formulário não
altera o slug.

Envie o logo em Dados ou escolha uma opção na conversa do site. O upload entra
no rascunho imediatamente; em seguida o sistema remove fundo uniforme quando
seguro, recorta margens e prepara as versões para cabeçalho, fundo escuro,
favicon e compartilhamento. Dados mostra as prévias e oferece **Abrir SVG**
quando o vetor original ou o traçado passou na verificação de fidelidade.
Arquivos complexos podem continuar em PNG.

Durante o primeiro briefing, o estúdio cria propostas fiel e ousada em paralelo
ao planejamento. A fiel só entra sozinha no rascunho se mantiver nome e
identidade, atingir nota 8 e fidelidade 7, e o logo enviado continuar sendo a
escolha atual. O original fica numerado em Imagens. O recibo informa o que foi
aplicado e como voltar: **“volta para a #12”** ou **Usar como logo** no original.
Se os critérios falharem, as propostas continuam disponíveis para sua escolha.
O estúdio não publica o site.

**“Modernize o logo”** usa a marca cadastrada mesmo sem anexo. Uma proposta
pedida pelo chat só é aplicada quando você pedir. **“Atualize a imagem #13…”**
cria outra versão e preserva a anterior. Dados não altera as cores; peça essa
mudança na conversa. Favicon e imagem de compartilhamento do site no ar só
mudam depois de publicar o rascunho com os assets prontos.

## Excluir um cliente

A seção **Zona de risco** em Dados abre a confirmação com o que será apagado: páginas, contatos recebidos, eventos, gastos, conversas, imagens e arquivos. Digite o endereço do cliente para liberar o botão. O servidor mantém a conferência adicional obrigatória para site publicado ou com contato recebido. Esc e **Cancelar** não apagam nada.

A exclusão é definitiva e não tem lixeira. Ao concluir, o site publicado passa a responder 404. Ela aguarda envios de arquivos já iniciados, impede novos envios e apaga os arquivos antes do cadastro: se essa etapa falhar, o cliente continua no painel e a operação pode ser repetida. Uma geração que terminar depois da exclusão não consegue enviar arquivos para esse cliente.

## Qualidade e retomada

O andamento é atualizado automaticamente ao iniciar pelo botão ou ao digitar
“continuar”, até a conclusão. Ele mostra atividade real, tempo decorrido e
unidades concluídas quando há um total conhecido; não usa estimativa fixa como
porcentagem. A prévia acompanha as alterações salvas. Quando a geração está
parada, os motivos que bloqueiam a publicação continuam visíveis.

O agente interno usa Gemini 3.8 Flash e dedica mais raciocínio à composição. Ele planeja intenções distintas por página e salva o projeto completo. Depois disso, a geração está concluída e a revisão é sua: confira a prévia em desktop e celular e peça ajustes pelo chat. Não há etapa automática Conferir nem aviso de revisão visual pendente.

## Gerar e editar o site

Um cliente recém-cadastrado começa a construção sozinho: ao abrir Site, a primeira etapa já está rodando, sem botão para clicar. O início automático vale só para quem ainda não tem página, tentativa de geração nem conversa anterior no site. Rascunho antigo, execução pausada ou com falha espera o seu comando, inclusive tentativas anteriores à geração no servidor, para não gastar geração que ninguém pediu. Quando o cadastro informou uma rede social, o briefing aguarda até 20 segundos pela leitura do perfil antes de começar; se ela demorar mais, a etapa segue e o perfil vira lacuna declarada.

**Continuar**, em uma geração ainda incompleta, percorre **Preparar** e **Criar**. Internamente, Criar
mantém checkpoints separados para imagens e páginas, permitindo retomar no
ponto certo. **Retomar** aparece depois de uma pausa e **Tentar novamente**
depois de uma falha. A sequência roda no servidor, não na aba: recarregar a
tela, trocar de aparelho ou fechar o navegador não interrompe nem duplica nada,
e o painel volta mostrando a etapa e a atividade em andamento. Digitar
"continuar" no chat faz a mesma coisa que o botão.

O andamento fica dentro da conversa, logo abaixo do título dela, e a prévia
ocupa a altura inteira: etapa atual, duas trilhas, resultado já produzido,
atividade concreta, tempo decorrido e **Linha do tempo**. No celular,
o andamento acompanha a vista **Conversa**. **Pausar** encerra depois do passo
atual — uma ferramenta já iniciada termina e salva; a pausa não desfaz
escritas. Ao terminar, o painel mostra páginas, fotos, tempo e consumo até você
fechar.

Enquanto a composição não grava a primeira página, a prévia mostra um diamante
negro em 3D. As facetas se fecham conforme as etapas medidas e o progresso acompanha as duas etapas do painel, com as mesmas
unidades (cenas prontas e páginas gravadas). Nada ali é
porcentagem estimada pelo tempo. Depois da primeira página, a versão compacta
do mesmo indicador fica na barra do editor, ao lado de **Publicar**, até a
geração terminar. Sem WebGL,
só o texto da etapa aparece; com movimento reduzido, o diamante fica parado e
atualiza apenas quando o progresso muda.

Enquanto a geração roda, o chat fica em espera e diz por quê: os dois disputariam as mesmas páginas. Se uma etapa falhar ou não avançar, a execução para com o motivo no painel; leia a última resposta antes de retomar. Se aparecer que a próxima etapa não pôde ser iniciada, **Tentar novamente** retoma pelo progresso salvo. Cenas e páginas prontas continuam disponíveis. Depois de salvar as páginas, a execução termina e o chat fica disponível para ajustes.

Sites já gerados também ficam concluídos, inclusive os que tinham uma conferência automática interrompida. Recarga, edição ou atualização do gerador não exigem retomar a revisão. Uma análise visual automática só ocorre se você pedir pelo chat. Erros de página ou projeto continuam bloqueando **Publicar**; a geração não publica por conta própria.

Na etapa de cenas, o plano preparado já contém cada pedido de foto, página e
proporção. O runner envia o lote direto ao estúdio, sem um turno do coordenador
apenas para repetir essas instruções. As fotos são geradas em paralelo, ficam
disponíveis com número e URL e não exigem aprovação. A crítica registra nota e
problemas para orientar ajustes; nota baixa não abre uma fila de decisão.

O chat recebe o histórico textual recente do cliente. Escreva mudanças específicas e indique a página quando necessário. Sugestões apenas preenchem a caixa; **Enviar** executa o pedido. Enter envia, Shift+Enter quebra a linha. Imagens podem ser anexadas, coladas ou arrastadas para a conversa.

Para editar, selecione a página na prévia e peça, por exemplo: **“troque ‘Escolha
com calma’ por ‘Compare os acabamentos’”**, **“mude só o fundo do bloco Como
escolher para #173f54”** ou **“adicione um bloco de texto abaixo do rodapé”**.
Também é possível mudar uma pergunta específica, mover uma seção antes de outra
e combinar ajustes na mesma página. O restante do conteúdo é preservado. Se o
mesmo texto aparecer em mais de um lugar, indique qual deles ou peça todas as
ocorrências. Uma edição em outra aba pode exigir releitura antes de salvar. As
alterações aparecem no rascunho; a publicação continua sendo uma ação separada.

Ao pedir uma alteração, como **“o footer quero em darkmode”** ou **“quero o
header em darkmode”**, acompanhe a atividade e o tempo junto da caixa de
mensagem ou acima da prévia. O andamento permanece visível ao recolher a
conversa e na aba Prévia do celular. Assim que a alteração é salva, a prévia
atualiza automaticamente, sem esperar a resposta final do agente. **Atualizando
prévia** indica o carregamento; **Prévia atualizada** confirma que ela abriu.
Se o carregamento falhar, use **Tentar novamente**. A posição de rolagem da
mesma página é preservada, inclusive quando você estiver conferindo o rodapé.

No computador, conversa e prévia ficam lado a lado; o botão primário ao lado de **Voltar** recolhe a conversa até uma faixa de 56 px e entrega o restante à prévia, útil para conferir a versão desktop em telas menores. O controle no centro da borda direita permanece visível nessa faixa e funciona como toggle para recolher e expandir o painel. O botão do cabeçalho faz a mesma alternância, e um ponto de atividade nele avisa quando o agente ainda está trabalhando. No celular, alterne **Conversa** e **Prévia**. A barra do editor reúne identidade, áreas do cliente, prévia e publicação. O seletor mostra o caminho da página em edição e marca **rascunho** quando ela tem mudanças; ao lado ficam as larguras Desktop e Celular e o ícone que abre a página em foco em outra aba. Os links internos mantêm o modo de rascunho. A prévia exige sessão, não envia formulários e não registra eventos de tráfego.

Os textos das 60 mensagens mais recentes são recuperados ao abrir a tela. Ferramentas, anexos e contagens de custo antigos não são restaurados. Registre decisões duráveis no briefing; não dependa de uma conversa extensa como única fonte do negócio.

### Editar na prévia

Em um cliente publicado, selecione a página e clique em **Editar**, ao lado de
**Publicar**. O botão aparece quando a geração e o chat estão parados. Clique
no texto da prévia para escrever. A barra mostra o campo, seu limite e
**Restaurar**, que recupera o texto e o estilo anteriores daquele campo.

Use **A−** e **A+** para escolher entre 80, 90, 100, 115 e 130% do tamanho
original. Textos de leitura corrida e legendas começam em 90%. Escolha uma cor
da marca ou digite um hexadecimal. Cores precisam de contraste mínimo de
4,5:1; **Automático** recupera a cor do layout. Texto sobre foto sem fundo
uniforme mantém a cor automática. Rótulos de links, botões, abas e formulários
podem ser reescritos, mas conservam tamanho e cor do controle.

O texto colado perde a formatação. Em blocos de texto editorial, Enter cria um
parágrafo e Backspace no início o une ao anterior. Nos demais campos, Enter
não cria linha. Tab percorre os campos; Esc fecha a barra e Ctrl+S ou Cmd+S
solicita o salvamento. Links não navegam durante a edição; menus e painéis
ficam expostos para permitir editar seus textos.

**Salvar** grava tudo de uma vez no rascunho e fecha a edição. Depois, confira
a prévia e clique em **Publicar** para atualizar o site no ar. **Cancelar**
descarta o que foi digitado, pedindo confirmação quando há alterações. O chat
e a troca de página ficam bloqueados durante a edição; Desktop/Celular
continuam disponíveis. Se outra aba salvar a mesma página, a gravação é
recusada e **Recarregar a prévia** descarta a tentativa local após confirmação.

Posts, listagens dinâmicas, textos automáticos de contatos, URLs, imagens e
textos alternativos continuam pelo chat, cadastro ou biblioteca. A edição é
por campo inteiro; não há formatação de palavras isoladas nem histórico de
desfazer além de **Restaurar**.

## Biblioteca e publicação

Imagens (`/admin/[tenant]/imagens`) reúne o guia visual e o acervo numerado, com filtros Todas, Fotos, Logos e Rejeitadas. Todas inclui as rejeitadas. Os cartões mostram proporção, descrição e nota quando existe; sem nota, mostram **sem crítica**. As candidatas antigas estão disponíveis sem aprovação. **Editar guia** e **Gerar imagens** abrem um pedido na conversa; revise e envie para executar.

**Enviar imagens** permite selecionar várias fotos JPG, PNG, WebP ou AVIF, de até 4 MB cada. O painel mostra o andamento e identifica arquivos que falharam; os demais continuam salvos. Cada foto recebe um número e aparece disponível no acervo, com a indicação **enviada**. Clique em **Usar no site** e indique no chat a página e a posição, como faria com uma imagem gerada. Fotos enviadas também contam na composição e podem ser publicadas normalmente. O envio sozinho não modifica páginas.

Para alterar uma imagem, escreva no chat: **“quero atualizar a imagem #5, quero outro carro”**. Ou clique em **Solicitar alteração** no cartão: o chat abre com o número preenchido; complete o pedido e envie. A geração usa a original como referência e preserva sua proporção quando o gerador a suporta. Para uploads com outro formato, usa o recorte suportado mais próximo; a original permanece no acervo com suas dimensões. A nova versão ganha outro número, substitui a anterior nas páginas em rascunho e mantém ambas na biblioteca. O chat informa o novo número. A versão publicada continua até você publicar as páginas de novo.

O filtro **Rejeitadas** preserva imagens recusadas no fluxo antigo, que continuam indisponíveis para publicação. Troque a imagem do bloco pelo chat e depois apague.

**Apagar** pede uma segunda confirmação e recusa imagens referenciadas no
rascunho, publicado ou logo. Cada cartão mostra onde a imagem é usada e separa
rascunho de publicado. **Usar no site**, em uma foto, abre o chat com o número
preenchido para você indicar página e posição; não altera conteúdo sozinho.
**Usar como logo**, em um logo disponível, aplica no rascunho.

As pendências para publicar aparecem no fim do fluxo, quando ainda sobra algo. Erros de página ou projeto bloqueiam a publicação; recomendações continuam disponíveis para revisão. Mudanças de blocos ou SEO tornam a página pendente. **Publicar** valida o projeto no servidor e atualiza o snapshot de páginas atomicamente; um erro preserva a versão anterior.

Nas outras abas, **Revisar e publicar** leva ao editor para conferir as pendências atuais.

O snapshot inclui blocos, SEO, título, tipo, metadados, ordem da navegação,
nome, marca, vibe, fontes/dials, logo, contatos e locale. Ao aplicar o schema,
clientes já publicados recebem como ponto de partida a apresentação que estava
no ar; edições posteriores ficam no rascunho. Métricas de GA4 e Meta Pixel
continuam operacionais fora do snapshot visual. Publicar o código na Vercel não
publica automaticamente os rascunhos dos clientes.

## Acompanhar consumo

Abaixo da caixa de mensagem, **Consumo** mostra tokens e custo em dólar quando o Gateway informa. Aberto, traz uma linha por etapa da geração e por turno de conversa, com entrada, quanto veio do cache, saída, passos, duração e custo. As etapas da geração entram porque cada uma grava seu recibo ao terminar; antes disso, a parte cara do trabalho não aparecia em lugar nenhum do painel. Nada é convertido para reais.

Ao abrir, os detalhes entram na área visível. Listas longas têm rolagem própria, inclusive por teclado; em telas baixas, a coluna da conversa também permite rolar para alcançar seus controles.

Essa contagem não inclui geração de imagens, críticas internas, outras telas ou falhas sem recibo. Execução encerrada há mais de 30 minutos sai do painel e leva seu consumo junto. Custo ausente em qualquer parcela deixa o total sem valor, em vez de contá-lo como zero. Consulte o Gateway para conciliar o consumo total. Cache reduz processamento repetido quando o provedor encontra um prefixo reutilizável; não garante economia fixa. A aceitação depende do resultado e das verificações de qualidade.

Para evitar desperdício, use Dados para alterações cadastrais, descreva o ajuste desejado, confira a página em foco e trate a causa de uma falha antes de repetir geração. Não repita a geração completa para corrigir um detalhe.

## Tráfego e contatos

O filtro usa datas inclusivas no horário de Brasília, inicialmente os últimos 30 dias. Visitantes identificados são IDs de navegador; formulários e cliques no WhatsApp são ações. Um clique não confirma conversa. Dados anteriores à revisão podem conter cliques duplicados.

Os atalhos **7 dias**, **30 dias** e **90 dias** preenchem o período; datas
personalizadas aceitam até 366 dias. O gráfico conta cada navegador uma vez por
dia. O trecho âmbar é o subconjunto que visitou e fez uma ação de contato no
mesmo dia; não é a soma de cliques. A tabela **Ver valores por dia** expõe os
valores, incluindo dias zerados. A soma diária pode superar os visitantes
únicos do período. Ausência de gasto aparece como **Não informado**.

Gastos são inseridos manualmente por campanha, canal e período. Lance cada gasto uma vez: os valores são somados. Só entram no custo lançamentos inteiramente contidos no filtro. O painel avisa quando um lançamento cruza as datas; amplie o filtro para incluí-lo inteiro. Não há rateio automático, edição/exclusão de gasto ou integração com plataformas de anúncios nesta tela.

O custo por ação divide os gastos por formulários mais cliques no WhatsApp. Os totais incluem todas as campanhas, mesmo quando a tabela mostra só as 50 principais. **Todos os contatos (CSV)** exporta os últimos 5.000 contatos de formulário, independentemente do filtro de datas.

## Quando algo falhar

Aviso de sessão expirada exige entrar novamente pelo painel. Erros de rede não comprovam que uma escrita falhou: recarregue o estado antes de repetir uma operação que possa duplicar gasto ou geração. Um erro de carregamento oferece nova tentativa; cliente inexistente tem retorno à lista. A revisão técnica e seus limites estão em [Revisão do admin](admin-review.md).
