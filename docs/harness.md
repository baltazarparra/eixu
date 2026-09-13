# Harness e qualidade dos agentes

## Fluxo da Landing Page

Na vibe `landing`, `designSchemaFor` exige um único item em `pagePlan`, a home
com `stage: conversion`. `set_design` grava perfil v7 sem estrutura multipágina,
com abertura `stage` ou `form` e navegação `minimal`. A referência verificada
modula a direção visual dentro dessa forma. As quatro vibes anteriores
continuam no fluxo v5/v6 e mantêm seu piso de três páginas.

`phaseBrief(phase, shape)` e `lib/taste/landing-prompt.ts` dão ao autor e ao
crítico o mesmo contrato de ação única, prova literal, 6–11 seções, 250 palavras
e formulário curto. Cinco cenas são planejadas na própria home. Depois da
composição da home, a geração termina e a revisão é humana pela prévia.
Os erros continuam bloqueando publicação; nenhuma revisão automática foi
adicionada. O critério `conversao` participa da crítica solicitada pelo operador.

O catálogo prioriza os cinco novos blocos. A comparação de unicidade considera
outras landings v7, com piso de dois eixos. O perfil v7 convive com a versão
atual do harness; não converte perfis publicados nem revalida recibos legados.
`evals/cases/landing.json` oferece briefing sintético para ensaio controlado;
a implementação foi validada localmente com ferramentas reais e persistência
em memória, sem alegação de qualidade de uma geração paga.

A prioridade do produto é qualidade: entender o negócio, compor conteúdo útil,
observar o resultado e corrigir defeitos. Tokens, tempo e custo são medidas de
operação; reduzir essas medidas não é o objetivo de aceitação. Política revisada
em 11/09/2026 para **Gemini 3.8 Flash**.

## Identidade, contrato e execução

[SOUL.md](../SOUL.md) define postura, valores e relação com o operador, inspirado
na proposta de [soul.md](https://soul.md/). É um documento de identidade, sem
alegação de consciência ou memória contínua. `lib/ai/soul.ts` carrega esse mesmo
arquivo no prompt do produto, e `next.config.ts` o inclui no artefato do chat.
Não há uma segunda cópia da identidade dentro do código.

[AGENTS.md](../AGENTS.md) orienta o desenvolvimento: mapa, invariantes e entrega.
`CLAUDE.md` importa esse contrato. A seleção do modelo no Codex ou Claude Code
continua no cliente; não altera o modelo que atende o painel. Skills locais
ficam em `.agents/skills/`, com adaptadores em `.claude/skills/`.

O mapa inicial deve continuar legível. Carregue mais evidências, schemas e estado
quando eles melhorarem a decisão; não acrescente instruções repetidas para ocupar
contexto. Ferramentas e verificações externas implementam os controles que um
prompt sozinho não garante.

## Modelo e orçamento de qualidade

`lib/ai/models.ts` é a fonte única dos modelos e limites. O chat, o crítico de
foto, a descrição de avatar, a crítica do site renderizado e os runners usam
`google/gemini-3.8-flash`. `EIXU_MODEL` permite configuração explícita do agente;
`EIXU_CRITIC_MODEL` prevalece para os críticos, depois cai em `EIXU_MODEL` e no
padrão. Antes de publicar, confira os valores do ambiente de destino.

O fallback de leitura/crítica de logo é `anthropic/claude-sonnet-5`, escolhido
pela sonda sintética de 12/09/2026 registrada em [Verificação](verification.md).
Overrides explícitos continuam prevalecendo; o restante do produto mantém Gemini.
Em um ambiente que já define `EIXU_MODEL` ou `EIXU_CRITIC_MODEL`, configure
`EIXU_LOGO_CRITIC_MODEL=anthropic/claude-sonnet-5` para usar Sonnet somente no
logo. Alterar o fallback no código não substitui essas variáveis existentes.

O ID foi conferido no [catálogo do Gateway](https://vercel.com/ai-gateway/models/gemini-3.8-flash)
e na [documentação do Google](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash).
A janela aceita cerca de 1 milhão de tokens e a saída até 65.536, incluindo
raciocínio. O modelo aceita imagens, ferramentas e saídas estruturadas; os níveis
suportados são `low`, `medium` e `high`, sem `minimal`.

A política usa **`reasoning: 'high'`**, pela API comum documentada no AI SDK 7
instalado (`node_modules/ai/docs/03-ai-sdk-core/26-reasoning.mdx`). A temperatura
permanece no padrão do provedor. Não combine esse ajuste com outro orçamento de
thinking em `providerOptions` nem reduza saída a poucas centenas de tokens: o
raciocínio também precisa caber. Os geradores de imagens mantêm seu modelo próprio;
um modelo que entende imagens não necessariamente as gera.

| Tarefa                        | Máximo de saída por passo |              Passos por turno |
| ----------------------------- | ------------------------: | ----------------------------: |
| Briefing e plano editorial    |                    16.384 |                            12 |
| Cena individual (fallback)    |                     8.192 |                             2 |
| Composição e reparo           |                    49.152 |                            24 |
| Revisão e correção            |                    24.576 |                            32 |
| Edição livre                  |                    24.576 |                            32 |
| Crítica de foto, logo ou site |                    16.384 |           chamada estruturada |
| Descrição de avatar           |                     4.096 |               chamada textual |
| Leitura de logo               |                     2.048 |  estruturada, 12 s, sem retry |
| Leitura focada do site atual  |                    12.288 | chamada estruturada sem tools |

São tetos operacionais, não metas de verbosidade. `lib/ai/agent.ts` instancia o
`ToolLoopAgent` compartilhado entre chat e avaliação. O turno tem 760 segundos no
SDK, dentro dos 800 da função, e uma repetição de transporte. Críticos têm 150
segundos. Esgotar um limite não prova conclusão; o painel retoma pelo estado.

## Contexto e decisões

A escrita tem um [contrato por vibe](copy.md), com linguagem simples em comum.
`lib/copy/policy.ts` fornece a mesma base ao autor, em todas as fases e edições,
e ao crítico. `lintPage` verifica rótulos de ação e aponta vocabulário/frases
para revisão; o crítico julga compreensão e voz com textos completos, sinais e
pixels. Erro material de linguagem impede a aprovação visual automática. A versão
`gemini-3.8-quality-v7-current-site` identifica o contrato atual e invalida
recibos anteriores. A gramática ampla da vibe entra no perfil v4; o perfil v5
compara três estruturas da vibe, enquanto o v6 compara as doze pela referência
e exige aplicações de layout, tipografia, imagens, ritmo, superfície e mobile.
Os dois exigem uma composição autoral com duas cenas.
Retomadas e críticas de perfis v2/v3 preservam a direção e o plano de cenas
existentes, mantendo as exigências de conteúdo, layout e apresentação.

A responsividade é um contrato compartilhado pelo autor e pelo crítico em
`lib/design/responsive.ts`: hierarquia, recortes, texto, ação principal e
navegação utilizáveis desde 320 px. Vale também para os perfis legados. O renderer
implementa barra compacta e painel mobile; `lib/review/navigation.ts` exercita os
controles sem seguir links. Na revisão solicitada, falhas de abertura, toque,
geometria, foco ou restauração de rolagem geram `navegacao-responsiva`, mesmo se
não houver overflow na página. Os pixels do menu aberto seguem como imagem
binária adicional para o crítico, e o chat recebe apenas medições e achados.

O prompt mantém fatos, restrições, vibe, marca, contatos, guia de imagens, fontes,
leitura estruturada do Site atual, plano editorial, plano semântico de cenas e biblioteca do tenant. Referências
visuais verificadas do cadastro prevalecem sobre a vibe. As capturas são
analisadas em uma chamada multimodal separada; as observações em
`brief.sources[].visual` e as aplicações em `brand.design.referenceDirection`
acompanham cenas, composição e revisão. O crítico final confronta os pixels do
rascunho com essa leitura persistida; não recebe os pixels originais da fonte.
`brief.pagePlan` guarda intenção, etapa de inbound, conteúdo e evidências de
cada página; `brief.imageScenes` liga página, papel, bloco, proporção e pedido
semântico a cada foto planejada. `brand.design.structure` e
`structureRationale` registram a jornada selecionada. Ambos os planos são
opcionais no schema para ler briefings legados e obrigatórios em uma nova
direção validada.

Quando `brief.intake.currentSiteUrl` existe, `read_current_site` precisa produzir
uma tentativa correspondente antes de `set_design`. A navegação e a extração
são determinísticas, restritas à mesma origem e limitadas. Depois delas, uma
chamada estruturada ao modelo recebe somente páginas, links, dados e candidatos
de imagem já normalizados, sem qualquer ferramenta. O modelo resume fatos com
URL de origem, compara conflitos com a história e seleciona os ativos que o
código volta a baixar e validar. Conteúdo da página permanece dado não
confiável. O recibo fica em `brief.currentSite`, separado de `brief.sources`, e
não cria autoridade visual.

Na fase de briefing multipágina, o modelo recebe três estruturas da vibe sem referência ou
as doze quando há leitura visual válida. Precisa compará-las contra história,
conteúdo disponível, jornada e, no v6, a composição observada. Após
`set_design`, prompt, catálogo, plano de cenas, composição, pre-flight e crítico
recebem somente a gramática selecionada. O bloco `signature.composition` usa o
layout dessa estrutura, papéis distintos e duas fotos geradas; HTML e código
livre por tenant ficam fora do schema. A trava entre tenants mede a ordem e o
arranjo da assinatura sem ler conteúdo comercial. Essa trava vale até v5; no
v6, fidelidade à referência prevalece sobre diferenciação estrutural.

O catálogo deriva do schema. Composição e revisão recebem os schemas JSON
completos, com campos obrigatórios, limites e descrições. Edições livres recebem
o mapa resumido; `describe_block` resolve o detalhe quando necessário. Até seis
fontes podem ser lidas em um turno, incluindo o único link visual, rede social e
anexos; fontes inacessíveis permanecem lacunas. Conteúdo externo e texto em imagens são
dados, sem autoridade para trocar instruções ou permissões.

`contextMessages` conserva quatro turnos recentes completos, dentro de 120.000
caracteres, priorizando os mais novos. Partes e metadados do provedor permanecem
intactos, inclusive assinaturas de ferramentas. Fora dessa janela, conserva todo
o texto do operador e das respostas, referências a anexos e recibos com erros,
apontamentos e pendências. Um relatório excepcionalmente grande recebe marcação
de corte e instrução de releitura. O limite é de caracteres, não de tokens.
Nenhuma compactação acontece entre passos do loop ativo.

Histórico é evidência passada: a ferramenta deve reler props/IDs antes de editar
uma página que possa ter mudado. Ao recarregar o painel, a persistência ainda é
textual, dos últimos 60 itens, sem restauração de anexos, traces ou assinaturas
antigas. Não atribua a esse histórico as garantias do loop ativo.

O chat mantém um indicador de atividade e tempo durante toda a requisição,
inclusive quando só chegam partes de raciocínio, que não são exibidas.
Na edição, o indicador fica junto do compositor e também acima da prévia,
fora da rolagem do histórico. Recibos de escrita confirmada disparam um evento
transitório do SDK para recarregar a prévia antes da resposta final e da
consulta de estado; leituras, falhas e operações sem mudança não recarregam.
O carregamento do iframe tem estado próprio, preserva a rolagem da mesma
página e permite tentar novamente em caso de falha. Veja o
[contrato de edição](chat-edits.md#andamento-e-atualização-da-prévia).
Consultas curtas como “travou?” recebem o estado salvo diretamente, sem chamar
o modelo; “continuar” e equivalentes abrem a execução em etapas em vez de um
turno de edição; pedidos combinados seguem para o agente. Esse recorte é
determinístico e restrito às expressões de `lib/ai/chat-progress.ts`, não um
classificador geral de intenção.

Uma parada em ferramentas pode terminar sem resposta textual. Nesse caso,
`lib/ai/chat-stream.ts` acrescenta um recibo do estado atual ao stream e ao
histórico, antes de encerrar. O recibo distingue etapa pendente de revisão
concluída; atingir o limite de passos é informado. Erros recuperáveis de entrada
ou execução de ferramenta são tentativas recusadas, não falhas do turno inteiro.
Logs identificam fase, ferramenta e tenant por ID, sem argumentos ou credenciais.
Fim de stream sem evento terminal vira erro explícito no cliente. O painel relê
o estado também ao encerrar ou interromper um turno.

## Execução em etapas no servidor

O laço das quatro fases vivia no navegador. Em 11/09/2026 uma recarga durante a
etapa de cenas matou a sequência sem deixar rastro: a cena em curso terminou no
servidor, a seguinte nunca foi pedida, e o painel voltou oferecendo “Continuar”
como se nada estivesse rodando. O operador então digitou “continuar”, que o
chat tratava como edição: 16 passos e 339 segundos no caminho errado, com dois
turnos concorrentes no mesmo cliente.

A execução é um registro em `generation_runs`, com um único run ativo por
cliente garantido por índice parcial. Na Vercel, `dispatchStep` envia cada
salto à fila `eixu-generation-steps`. O trigger de `vercel.json` torna
`/api/queues/generation` um consumidor privado, com invocação independente de
até 800 segundos. Isso substitui a recursão HTTP entre etapas, que produziu
508 ao tentar iniciar a revisão. O SDK usa OIDC da Vercel; a confirmação da
mensagem aguarda a fase e o envio seguinte, sem `after()` no consumidor.

A mensagem contém apenas slug, ID do run e salto esperado. A chave de
idempotência combina run e salto; o consumidor reconfirma o tenant e reserva
atomicamente o salto no banco antes de executar. Uma entrega repetida não
executa outra chamada paga. Falha de envio só encerra o run se a reserva ainda
pertencer à etapa que observou o erro, inclusive no primeiro envio. O painel
oferece **Tentar novamente**, preservando páginas e cenas. Sites já montados permanecem concluídos.
Mensagens ficam disponíveis por uma hora; falhas antes da reserva têm até
cinco entregas, espaçadas em 30 segundos. Interrupção após a reserva não
reexecuta automaticamente trabalho pago: vale a recuperação por inatividade
descrita abaixo.

Fora da Vercel, `/api/admin/[tenant]/generation/step` mantém o transporte HTTP
local: token assinado com run e salto, reserva antes do 202 e execução por
`after()`. Os dois consumidores usam `lib/generation/step.ts`; a origem do run
continua servindo à captura autenticada da prévia.

`generation_events` guarda o que o painel mostra: início e fim de fase, começo e
fim de cada ferramenta com o mesmo rótulo em pt-BR do chat, pausas e erros. São
rótulos e contadores, sem conteúdo do cliente. Cada chamada tem `callId` e
duração; os eventos carregam versão do fluxo/harness, modelo, SHA, espera de
fila e motivo de parada quando disponíveis. Captura e crítico publicam página,
viewport e unidades concluídas durante a execução. O evento de fim de fase
carrega também o recibo daquela fase — modelo, passos, duração, tokens e custo
do Gateway —, porque a contagem do stream não existe fora do navegador e a
parte cara do trabalho tinha deixado de aparecer no consumo do painel.
`lib/admin/usage-summary.ts` soma esses recibos com os dos turnos livres;
parcela sem custo deixa o total sem valor, em vez de contá-lo como zero. O painel lê por consulta
periódica, reativa a leitura ao iniciar pelo botão ou pelo chat e reconstrói o
andamento depois de qualquer recarga. As mensagens são paginadas a partir de
zero, com cursor do último registro entregue; a leitura continua até esvaziar
o lote mesmo quando o run terminou. O recibo persistido reutiliza a bolha do
stream e preserva suas ferramentas e metadados. Enquanto um run
está ativo, `/api/chat` responde 409: os dois disputariam as mesmas páginas.
Sem sinal por 15 minutos, o run é dado por perdido e o operador pode retomar.
O salto também expira após 14 minutos desde a reserva/início da fase: a função
Vercel já encerrou aos 800 segundos, mesmo que o último heartbeat ainda seja
recente. A expiração reconfirma status, salto e horários no UPDATE; uma leitura
antiga não encerra uma reserva nova. Pedir pausa e registrar a ação do operador
não renovam o heartbeat do worker. A retomada aceita o estado recém-expirado
na mesma requisição, preservando o conteúdo salvo.

Na leitura visual, chamadas simultâneas da mesma URL compartilham a mesma
captura, análise e gravação. Captura e análise aparecem como subetapas na linha
do tempo. O conjunto termina em até 120 segundos; a captura tem teto de 55
segundos e encerra à força um Chromium que ignore cancelamento ou fechamento.
Falha ou prazo esgotado vira lacuna explícita para o agente continuar o briefing.

A primeira etapa começa sozinha em cliente sem tentativa ou conversa anterior,
sem página e com o briefing pendente. O `GET` informa `everRan` considerando
execuções, o marcador legado em `brief.generation` e a existência de mensagens
no canal `site` daquele tenant, independentemente do cursor já entregue. Assim,
tentativas anteriores a `generation_runs` também aguardam o operador. A ausência
desse sinal não autoriza início automático. Antes de montar o prompt do
briefing, a etapa espera até 20 segundos pela leitura do perfil de rede social
disparada pelo cadastro: o redirecionamento leva ao painel em menos de um
segundo, e um perfil ainda em leitura entra no prompt como lacuna. Esgotado o
tempo, a fase segue com a lacuna declarada em vez de prender a execução.

Pausar é encerramento suave: a condição de parada entra no laço do agente e o
passo corrente termina e salva, em vez de abortar uma chamada paga no meio.
Gravações em `brief.generation` passaram a ser merge no banco; reescrever o
objeto inteiro a partir de um snapshot apagava o recibo de revisão gravado por
outra execução.

Quando o briefing persiste `brief.imageScenes`, o checkpoint de cenas não abre
um turno do coordenador só para repetir o plano. O runner chama o executor de
`prepare_site_images` diretamente, preservando os mesmos limites, eventos,
isolamento do tenant e recibos do estúdio. O caminho com agente continua como
fallback para briefings antigos sem plano válido.

A geração percorre briefing, cenas e composição; a interface mostra Preparar e
Criar. `nextPhase` encerra ao encontrar as páginas orgânicas montadas, inclusive
em clientes legados sem recibo visual. Cenas usam a cobertura do plano e fases
incompletas precisam produzir avanço. O teto global segue em 14 saltos.

O runner grava `brief.generation.delivery` ao terminar a composição. A data
registra entrega, sem certificar revisão visual. Edições e deploys não invalidam
a conclusão. O chat entrega um recibo determinístico e a prévia fica disponível
para revisão humana. Não há Conferir automático, revisão visual pendente nem
Continuar para sites concluídos. `review_pages` continua disponível por pedido
explícito; seus recibos só comprovam uma análise com evidência atual.

Quando o SDK falha ou devolve `TimeoutError`, o runner relê o estado salvo.
Páginas concluídas preservam a entrega; sem elas, o progresso decide continuação
ou falha. A pausa do operador continua sendo respeitada. Esse caminho não inventa
consumo que o SDK não devolveu. O timeout depende de a chamada em andamento
respeitar o sinal de aborto. Falha de banco que impeça confirmar ou persistir o
estado continua sendo falha de execução.

O painel mostra leituras da única passagem, sem usar o contador acumulado do
cliente. Os eventos legados de rodadas continuam legíveis. **Tentar novamente**
retoma uma execução antiga que falhou; uma geração já entregue não reinicia pelo
mesmo comando. O chat permite solicitar outra revisão explicitamente.

## Compor, observar, corrigir, conferir

O fluxo automático é briefing → cenas → composição, seguido de revisão humana.
O planejamento escolhe
alternativas coerentes com as referências visuais verificadas e o negócio,
usando a vibe como apoio; o plano editorial diferencia as intenções das
páginas. A composição grava o lote validado e usa `repair_site` para corrigir
recusas sem reenviar tudo. Um lote salvo sem erros encerra o loop de composição
por condição externa do SDK e entrega a prévia ao operador. Avisos de recorte são
julgados nos pixels; não provocam reenvios do projeto para zerar contagens.
Erros continuam bloqueando a transição. Imagens ficam disponíveis por número, conforme o fluxo
atual do produto; aplicar logo pelo chat e publicar continuam dependendo do pedido.

O estúdio do briefing é um job paralelo ao agente, fora de `PHASE_TOOLS`.
Prepara os assets, registra o original e gera fiel/ousada. A única aplicação
automática é fiel aprovada, nome correto, nota ≥ 8 e fidelidade ≥ 7 sobre upload
manual ainda atual. URL e revisão são comparadas no banco; o operador pode
reverter pelo número. O runner aguarda o job, registra eventos/recibo e propaga
a pausa; falha no estúdio não muda o resultado da fase. `EIXU_LOGO_AUTO_APPLY=0`
mantém só as propostas. Isso não cria etapa Conferir nem publica páginas.

Leitura multimodal e crítica de logo têm papel próprio: `EIXU_LOGO_CRITIC_MODEL`
prevalece sobre `EIXU_CRITIC_MODEL` e `EIXU_MODEL`, depois usa o fallback do papel.
A leitura recebe pixels, não base64 textual; erro vira ausência de leitura.
O schema usa array homogêneo de quatro números para a caixa do símbolo, pois
o provedor Gemini rejeita `items` em formato de tupla. A crítica vê o master
recortado e a miniatura de altura real. `EIXU_LOGO_IMAGE_MODEL` mantém GPT Image 2
como padrão; `input_fidelity` não é habilitado sem evidência da sonda.
`HARNESS_VERSION` é `gemini-3.8-quality-v7-current-site`. Perfis v2-v5
continuam legíveis; somente uma nova direção com referência grava v6.

Na edição de um site existente, a rota deriva uma política da **mensagem atual**,
sem herdar pedidos de reconstrução do histórico. Por padrão, remove `set_design`,
`build_site`, `repair_site` e `set_blocks` do conjunto executável. A ferramenta
`set_brand` continua disponível para ajustes pontuais de cor, fonte ou formato
na edição geral; a proteção adicional de cabeçalho abaixo também a remove.
Site novo, fases explícitas e um pedido direto de reconstrução mantêm seu fluxo.
O reconhecimento desse pedido é restrito às expressões de `lib/ai/edit-policy.ts`;
não é uma interpretação universal de linguagem natural.

Pedidos de posição/fundo do cabeçalho recebem uma proteção adicional: IDs dos
`nav.bar` e caminhos de propriedades permitidos, verificados no executor antes
da escrita. O pedido de fixação permite `position`; fundo e transparência
permitem `backgroundOpacity` e `presentation.tone`. Marca, logo, textos, links,
outros blocos e publicação ficam fora desse conjunto. Menção à home restringe
os alvos à home; sem essa restrição, os cabeçalhos das páginas são os alvos.
Pedidos mistos com outros blocos seguem a edição geral, sem essa garantia de
campos. O prompt instrui a relatar achados da crítica fora do pedido atual.

O [fluxo de edição pós-geração](chat-edits.md) usa `edit_page`, com snapshot e
schemas da página em foco já presentes no turno. Texto literal, caminhos de
props e posições relativas formam um lote por página, validado antes da escrita.
A comparação de `blocks` em JSONB recusa conflito entre abas; o recibo inclui
mudanças, revisão e pre-flight. A edição geral não expõe os quatro mutadores
antigos. Geração e o escopo restrito de cabeçalho conservam compatibilidade.

Nos consumidores legados, `update_block` combina parcialmente `presentation`, preservando seus campos
omitidos, e valida o bloco completo com schema estrito antes de escrever.
Propriedades desconhecidas ou inválidas são recusadas, não gravadas como se
fossem alterações visuais aplicadas.

A revisão tem três fontes de evidência:

1. `lintPage`, `lintSite` e métricas de composição conferem o projeto inteiro
   antes de abrir o navegador. Erro conhecido encerra a leitura sem gastar
   captura ou crítico.
2. Um Chromium abre as páginas sem recibo atual, até 12, em 1440 e 390 px, com
   duas páginas em paralelo e repetição local por viewport. Overflow e imagem
   quebrada viram erros do relatório, mesmo se o crítico não os perceber. As
   capturas usam movimento reduzido e rolagem instantânea; alvos concluídos são
   preservados quando outra página falha.
3. `lib/review/critic.ts` envia as capturas como **imagens binárias** em uma chamada
   separada ao Gemini, junto do briefing e dos blocos. O retorno estruturado cita
   página, bloco, evidência e correção. Pixels/base64 não entram como texto no
   resultado da ferramenta nem no histórico do chat.

O schema de saída anuncia os caminhos das páginas na descrição do campo, não em
um enum. Enum dinâmico foi recusado pelo Gateway com os IDs de bloco e volta a
ser recusado com os caminhos assim que a soma dos valores cresce: em 2026-09-11
um cliente de cinco páginas derrubou a chamada inteira com HTTP 400 no Vertex e
no fallback Google, e a revisão ficou indisponível em todas as rodadas. A
conferência do par página/bloco acontece depois da resposta, em
`resolveReviewReferences`: caminho normalizado e ID de bloco inexistente vira
`null`. Um achado com página inválida permanece em `unresolvedFindings`; se for
material, continua pendente em vez de desaparecer da conclusão. As duas
contagens entram no relatório como aviso `critica-referencia`.

A captura é ligada por padrão. `EIXU_REVIEW_CAPTURE=0` permite diagnóstico
estrutural, mas não concede conclusão visual. Origem ausente, falha de captura,
cobertura incompleta ou crítica inválida deixam a revisão incompleta.
`REVIEW_CALLS_PER_TURN` permite duas chamadas a `review_pages` por turno: uma
avaliação e, quando houve reparo, uma conferência focal. A primeira avaliação
com cobertura completa e sem erro material já encerra; avisos opcionais ficam
no relatório. A crítica é sugestão verificável, não autorização humana.
O loop força a primeira avaliação e reserva o último passo para a conferência se ainda houver leitura
disponível; uma terceira chamada seria recusada pela ferramenta. As correções
da mesma página podem ser agrupadas antes da nova leitura. Depois do refinamento, uma nova
revisão completa e sem erros encerra a fase por condição externa, mantendo os
avisos no relatório. Isso impede editar novamente após a conferência e consumir
o turno sem revisar a última versão. Falha ou erro material permanece pendente.

O recibo v2 em `brief.generation.review` guarda cobertura, apontamentos e
fingerprint SHA-256 por página. A dependência inclui conteúdo, SEO, marca,
contatos, briefing, imagens efetivamente usadas, versão do harness e deployment.
Uma página intacta reaproveita desktop e mobile; mudança global invalida o
conjunto dependente, e foto solta no acervo não invalida nada. O certificado
completo nasce dos recibos atuais de todas as páginas. `nextPhase` encerra com certificado visual completo e sem erro material ou com
entrega explícita do rascunho atual. Contar chamadas não comprova aprovação.

A publicação manual mantém o pre-flight determinístico em ambos os caminhos.
O recibo do crítico governa a aprovação visual, sem transformar uma opinião
do modelo em permissão para publicar ou indisponibilidade em falha da entrega.

## Avaliação reproduzível

`npm run test:sites` e `npm run test:admin` cobrem contratos, contexto, erro de
revisão, captura incompleta, evidência desatualizada e isolamento. Captura real
usa `EIXU_CHROME_PATH`. Esses testes não chamam modelos pagos.

`npm run eval:harness` explica o ensaio. Com `--live`, usa o modelo, os schemas,
os executores e o renderer reais; substitui I/O editorial por memória, com fotos
de uma fixture local. Não acessa Neon, não grava Blob e não publica. Exemplo:

```bash
EIXU_MODEL=google/gemini-3.8-flash EIXU_CHROME_PATH=/caminho/chrome \
  npm run eval:harness -- --live --case=aquecimento --assets=/caminho/fixture.json --repeat=2
```

A fixture contém `images`, com pelo menos duas fotos de teste distintas e os
campos `url`, `alt`, `ratio` e `targetBlock`. Use material autorizado, sem dados
pessoais ou cadastro de cliente real. O ensaio exige o CSS de `build:vercel` e
registra saída sem edição manual, capturas, recusas, término, tokens de raciocínio,
modelo, commit e recibo visual em `outputs/harness/`. Verifica SSR com CSS de
produção; não comprova hidratação/interações React nem persistência remota.

Cada passo salva o rascunho automático. `--resume=outputs/harness/.../output-1.json`
retoma somente a revisão desse mesmo caso, sem reconstruir páginas. O relatório
identifica a origem da retomada; considere também as fases do relatório original.
O runner não reutiliza cache de transformações JSX de outros testes e verifica
a resposta HTTP da fixture antes de consumir modelo numa retomada.

`eval:site` continua disponível para avaliar o fluxo com persistência em tenant
descartável e, com `--generate`, geração real de fotos. Exige recurso e escopo
identificados; pode sobrescrever dados. Usa o mesmo agente e envia a sessão à
captura. Não execute esse runner como se fosse um check sem escrita.

`node --env-file=.env.local scripts/eval-chat-stream.mjs --live` exercita o POST
real do chat, o stream SSE, as ferramentas e a persistência textual. A sessão e o
banco são substituídos por memória. Confere alteração exata do logo do cabeçalho,
preservação do rodapé e metadados de uso; não prova autenticação ou Neon reais.

`eval:admin-cost` permanece como ensaio histórico de edição isolada. Usa agora a
política de raciocínio/saída comum; seus resultados novos não são diretamente
comparáveis aos números antigos. Custo é diagnóstico, não critério de qualidade.

As notas humanas de [eval-rubric.md](eval-rubric.md) continuam separadas do aceite
automático. Compare os mesmos casos, fotos e renderer, repita saídas variáveis e
registre limitações. Um smoke multimodal ou uma nota do próprio modelo não prova
superioridade geral. Evidências desta entrega ficam em [Verificação](verification.md).

O projeto Vercel foi conferido com plano Pro e Fluid Compute ativo. O teto de 800 segundos usa o limite estável documentado em [Duration](https://vercel.com/docs/functions/configuring-functions/duration). Ferramentas de um mesmo passo executam em sequência para evitar perda de edições; leituras independentes dentro dos executores continuam agrupadas. Isso não substitui locks entre abas ou instâncias.

## Limites da leitura do site atual

A coleta tem um prazo de 90 segundos e no máximo 24 tentativas de páginas,
incluindo falhas e duplicatas, além do limite de 12 páginas úteis. O prazo
cobre renderização e leituras de rede; DNS compartilha os oito segundos da
requisição HTTP. Se o prazo terminar, o HTML já coletado permanece no recibo
com a lacuna explícita. O navegador recebe encerramento forçado quando não
responde ao prazo, inclusive se abrir atrasado, e fechar página/browser espera
no máximo dois segundos.

A síntese conserva os 150 segundos do crítico, com cancelamento externo ao SDK
para uma dependência que ignore o sinal. Os downloads de ativos têm 90 segundos
por lote; uma escrita Blob/banco já iniciada termina para preservar integridade.
Os modelos, raciocínio e orçamento de saída permanecem os mesmos. Coleta,
síntese, importação e conclusão emitem duração e contadores sem conteúdo do
cliente nos logs e na linha do tempo do runner.
