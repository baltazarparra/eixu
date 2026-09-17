# Harness e qualidade dos agentes

## Fontes opcionais do cliente

`lib/ai/source-context.ts` monta um roteiro explícito para os quatro cenários:
nenhum link, só Site atual, só Referência visual e ambos. História, confirmações,
marca e contatos do operador prevalecem. A ausência de link não produz uma
pendência; falha ou conflito de uma fonte informada exige lacuna e permite
continuar com o contexto disponível. O mesmo roteiro de coleta vale para sites
multipágina e Landing Pages.

A referência visual vai diretamente para a captura desktop/mobile e a análise
multimodal. Não depende de leitura HTML textual anterior. O retorno da ferramenta
e o contexto das fases contêm suas observações visuais, sem oferta ou contatos de
outro negócio. O recibo visual utilizável é reutilizado por 24 horas; `refresh` permite nova
leitura pedida pelo operador. Chamadas simultâneas compartilham a mesma leitura.
Uma referência alterada durante a captura recusa o recibo atrasado. Falhas ficam
registradas e são reutilizadas apenas no turno atual, permitindo nova tentativa
no próximo pedido sem conservar uma indisponibilidade por 24 horas.

O Site atual mantém um recibo separado, vinculado à URL do cadastro. A primeira
leitura e o cache retornam a mesma síntese, conflitos, limites e ativos com número
e URL. Se a síntese não verificar a identidade, o texto bruto não entra como fato
confirmado. Uma falha de importação preserva a coleta e a síntese e registra a
limitação. URL removida ou trocada não reaproveita esse contexto antigo. A mesma
URL nos dois campos exige as duas leituras, sem misturar seus papéis.

A síntese envia ao provedor um formato derivado do schema do recibo, com tipos,
campos e limites descritos em texto. A combinação original de listas aninhadas
e limites numéricos foi recusada pelo Gemini com HTTP 400. O validador Zod
completo continua obrigatório na saída: URLs, tamanhos, contagens e enums não
foram relaxados. A [documentação do provedor](https://ai.google.dev/gemini-api/docs/structured-output#limitations)
descreve essa limitação de complexidade. `lib/current-site/output-schema.ts`
centraliza essa adaptação, sem manter uma segunda definição manual do recibo.

`npm run eval:site-sources -- --live --assets=<fixture.json>` exercita o modelo
real com os quatro cenários, incluindo composição. Usa Chromium, transporte de
fontes sintéticas, biblioteca de fotos de fixture e ferramentas reais com
persistência em memória. Não acessa Neon nem grava Blob. `--case=nenhum`, `atual`,
`referencia` ou `ambos` restringe o ensaio; os recibos e resultados ficam em
`outputs/source-eval/`. Esse ensaio mede o uso das fontes e os contratos do
resultado, sem substituir a revisão humana da qualidade visual.

Para verificar apenas a composição depois de uma correção, `--resume=<caso.json>`
reaproveita o briefing e as páginas salvas pelo ensaio correspondente, junto de
`--case`. O relatório identifica a retomada; ela não conta como uma nova leitura
de fontes. Quando o pre-flight recusa um lote em memória, o loop direciona o
próximo passo a `repair_site` antes de encerrar. A direção é pelo `toolChoice`, e
as ferramentas que o histórico do turno já cita continuam declaradas: estreitar
`activeTools` nesse passo deixava um `functionResponse` de `build_site` sem a
declaração correspondente, e o provedor recusava a requisição inteira. Isso
preserva os limites, a pausa, a gravação atômica e a revisão humana após a
composição.

## Fluxo da Landing Page

Na vibe `landing`, `designSchemaFor` exige um único item em `pagePlan`, a home
com `stage: conversion`. `set_design` grava perfil v7 sem estrutura multipágina,
com abertura `stage` ou `form` e navegação `minimal`. A referência verificada
modula a direção visual dentro dessa forma. Moderno, Ousado e Artístico
continuam no fluxo v5/v6 e mantêm seu piso de três páginas. Comercial usa o
perfil v8 e a jornada fixa derivada da Minatel Brotas, também com piso
de três páginas; referências do tenant complementam marca e fotografia sem
trocar a estrutura.

`phaseBrief(phase, shape)` e `lib/taste/landing-prompt.ts` dão ao autor e ao
crítico o mesmo contrato de ação única, prova literal, 6–11 seções, 250 palavras
e formulário curto. Cinco cenas são planejadas na própria home. Depois da
composição da home, a geração termina e a revisão é humana pela prévia.
Os erros técnicos continuam bloqueando publicação; nenhuma revisão automática foi
adicionada. O critério `conversao` participa da crítica solicitada pelo operador.

O catálogo prioriza os cinco novos blocos. A comparação de unicidade considera
outras landings v7, com piso de dois eixos. O perfil v7 convive com a versão
atual do harness; não converte perfis publicados nem revalida recibos legados.
`evals/cases/landing.json` oferece briefing sintético para ensaio controlado;
a implementação foi validada localmente com ferramentas reais e persistência
em memória, sem alegação de qualidade de uma geração paga.

A prioridade do produto é qualidade: entender o negócio, compor conteúdo útil,
observar o resultado e corrigir defeitos. Tokens, tempo e custo são medidas de
operação; reduzir essas medidas não é o objetivo de aceitação. Contrato conferido
no checkout em 13/09/2026; fallback **Gemini 3.8 Flash**, sem leitura das variáveis remotas.

## Identidade, contrato e execução

[SOUL.md](../SOUL.md) define postura, valores e relação com o operador, inspirado
na proposta de [soul.md](https://soul.md/). É um documento de identidade, sem
alegação de consciência ou memória contínua. `lib/ai/soul.ts` carrega esse mesmo
arquivo no prompt do produto, e `next.config.ts` o inclui no artefato do chat.
Não há uma segunda cópia da identidade dentro do código.

Projetos convertidos têm um contrato distinto em
[`apps/premium/SOUL.md`](../apps/premium/SOUL.md). Ele define a persona de
Creative Developer Sênior, com direção específica, detalhe, acessibilidade e
factualidade como critérios conjuntos. [`apps/premium/AGENTS.md`](../apps/premium/AGENTS.md)
mantém os limites compartilhados. A skill local `premium-delivery` distingue
conversão, CMS e atualização por código até a release verificada;
`premium-frontend` oferece a direção de composição e a adaptação da Taste Skill
v1. Edições rotineiras dos campos de
`content/editor.json` passam pelo CMS determinístico, sem modelo e sem acesso ao
chat do gerador.

[Manual do gerador](manual-gerador-sites.md) reúne funcionalidades, fluxos,
blocos, ferramentas e limites. `lib/ai/generator-manual.ts` valida as seções no
boot; `read_generator_manual` entrega de uma a seis delas. O prompt do chat leva
somente o índice para não repetir o documento inteiro em todo turno, e
`next.config.ts` inclui o arquivo nos artefatos das rotas que montam o agente.
Schemas, pre-flight e retorno atual continuam prevalecendo se uma descrição
ficar desatualizada.

### Conversa e ação

`lib/ai/interaction.ts` decide o modo antes de `editPolicyFor`. A conversa é o
padrão seguro: perguntas, hipóteses, opiniões, contexto solto e anexos sem
comando recebem apenas `read_generator_manual`, `list_state`, `get_page`,
`describe_block`, `list_images`, `lint_page` e `lint_site`. O modelo pode
aconselhar e consultar, mas não tem executor de escrita, publicação, evidência,
geração paga, fonte externa ou crítica visual. O prompt usa uma seção própria e
não encerra como relatório de mudança.

Uma ação exige formulação reconhecível: verbo direto, resultado desejado,
convite “vamos…”, pedido “pode fazer…?” ou confirmação curta de uma proposta
executável do assistente. Perguntas de capacidade como “o que você pode criar?”
continuam conversa mesmo contendo um verbo de ação. Negação explícita, como
“não mude nada”, também prevalece. Confirmação de remoção, publicação,
andamento, retomada e desfazer mantêm seus caminhos determinísticos da rota.
Uma confirmação de exclusão só retoma a pendência interna da fala anterior,
vinculada ao bloco e à revisão; o texto anterior do assistente não concede
autorização por si só. Pedidos de seção com foto tratam a foto como descrição
do alvo, e ordens como “há uma seção; apague-a” entram em ação.
O classificador é conservador; não tenta resolver toda pragmática da linguagem.

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
`EIXU_EDIT_MODEL` prevalece somente nos turnos que a rota classificou como
edição, depois cai em `EIXU_MODEL` e no mesmo padrão, sem alterar briefing,
composição ou revisão. Esse override é mecanismo de avaliação/configuração, não
evidência de que outro modelo é melhor.
`EIXU_CRITIC_MODEL` prevalece para os críticos, depois cai em `EIXU_MODEL` e no
padrão. Antes de publicar, confira os valores do ambiente de destino.

O fallback de leitura/crítica de logo é `anthropic/claude-sonnet-5`, escolhido
pela sonda sintética de 12/09/2026 registrada no [histórico de verificação](archive/verification-2026-09-13.md).
Overrides explícitos continuam prevalecendo; o restante do produto mantém Gemini.
Em um ambiente que já define `EIXU_MODEL` ou `EIXU_CRITIC_MODEL`, configure
`EIXU_LOGO_CRITIC_MODEL=anthropic/claude-sonnet-5` para usar Sonnet somente no
logo. Alterar o fallback no código não substitui essas variáveis existentes.

Os modelos e limites desta seção descrevem a política no código; não certificam os overrides nem a disponibilidade do provedor em produção.

A política usa **`reasoning: 'high'`**, pela API comum documentada no AI SDK 7
instalado (`node_modules/ai/docs/03-ai-sdk-core/26-reasoning.mdx`). A temperatura
permanece no padrão do provedor. Não combine esse ajuste com outro orçamento de
thinking em `providerOptions` nem reduza saída a poucas centenas de tokens: o
raciocínio também precisa caber. Os geradores de imagens mantêm seu modelo próprio;
um modelo que entende imagens não necessariamente as gera.

| Tarefa                        | Máximo de saída por passo |              Passos por turno |
| ----------------------------- | ------------------------: | ----------------------------: |
| Briefing e plano editorial    |                    16.384 |                            12 |
| Cenas (fallback com agente)   |                     8.192 |                             4 |
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

Na fase de briefing multipágina, a Comercial recebe a estrutura fixa
`comercial-marca`; as demais vibes recebem três estruturas sem referência ou
as doze quando há leitura visual válida. Precisa comparar as opções disponíveis contra história,
conteúdo disponível, jornada e, no v6, a composição observada. Após
`set_design`, prompt, catálogo, plano de cenas, composição, pre-flight e crítico
recebem somente a gramática selecionada. O bloco `signature.composition` usa o
layout dessa estrutura, papéis distintos e duas fotos disponíveis do tenant; HTML e código
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
turno de edição; pedidos combinados seguem para o agente. Esses atalhos usam as
expressões de `lib/ai/chat-progress.ts`. As demais falas passam pela fronteira
conversa/ação de `lib/ai/interaction.ts` antes de receber ferramentas.

Uma parada em ferramentas pode terminar sem resposta textual. Nesse caso,
`lib/ai/chat-stream.ts` acrescenta um recibo do estado atual ao stream e ao
histórico, antes de encerrar. O recibo distingue geração incompleta, site entregue e análise visual solicitada; atingir o limite de passos é informado. Erros recuperáveis de entrada
ou execução de ferramenta são tentativas recusadas, não falhas do turno inteiro.
Logs identificam fase, ferramenta e tenant por ID, sem argumentos ou credenciais.
Fim de stream sem evento terminal vira erro explícito no cliente. O painel relê
o estado também ao encerrar ou interromper um turno.

## Execução em etapas no servidor

A geração roda no servidor para sobreviver a recarga, troca de aparelho ou
fechamento da aba. Ela mantém três checkpoints e duas etapas visíveis.

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
do Gateway — para a linha do tempo da execução.

O ledger `ai_usage` é a fonte consolidada da aba Dados. Cada passo de texto
cria uma linha pendente antes da chamada e completa o recibo com entrada, saída,
total, cache, raciocínio e custo do Gateway. Geração e crítica de imagens usam o
mesmo contrato, embora o provedor possa informar custo sem tokens. Chat, runner,
crítica visual, referências, Site atual, logo e avatar passam por esse ledger.
O `operation_id` agrupa os passos do mesmo turno e a chave por cliente impede
duplicação. Ausência continua ausente, sem virar zero; a migração importa uma
vez os recibos antigos de `phase_end` e os eventos novos marcam `usageLedger`
para não serem somados de novo.

A continuidade depois da conversão segue [Consumo por projeto](project-usage.md).
O ledger também aceita recibos externos de desenvolvimento e serviços atribuídos
ao mesmo tenant, com origem e fase. `npm run usage:sync` coleta logs dedicados de
Codex/Claude, com modo contínuo e deduplicação. O painel distingue acumulado e
período; assinaturas e fontes não coletadas continuam como lacunas, sem preço
presumido. Coleta externa exige execução do sincronizador, não somente prompt.

O painel de andamento lê por consulta
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

## Composição e revisão solicitada

O fluxo automático é briefing → cenas → composição, seguido de revisão humana.
O planejamento escolhe
alternativas coerentes com as referências visuais verificadas e o negócio,
usando a vibe como apoio; o plano editorial diferencia as intenções das
páginas. Em comercial v5/v6 legado, o prompt e o catálogo recebem a profundidade
mensurada do briefing, o piso da home e as camadas que história, evidências,
números e acervo realmente sustentam. Na Comercial v8, o prompt recebe a
sequência completa e as variantes da estrutura escolhida. Conteúdo sem fonte não
é criado para preencher nenhuma delas. A composição grava o lote validado e usa
`repair_site` para corrigir
recusas sem reenviar tudo. Um lote salvo sem erros encerra o loop de composição
por condição externa do SDK e entrega a prévia ao operador. Avisos de recorte são
julgados nos pixels; não provocam reenvios do projeto para zerar contagens. A
captura também segmenta e mede cada palavra visível com `Range`; termo partido no
meio entra no recibo e impede concluir uma revisão visual solicitada. Overflow e
palavra partida são sinais distintos.
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

Um pedido que o schema não atende não vira outra mudança. `contentLossError`
recusa, na edição geral, a operação que apague texto sem que a mensagem atual
peça remoção; `asksRemoval` reconhece esse pedido. Os selos do hero passaram a
ter posição própria (`bulletsPlacement`, `badgesPlacement`), então mover deixou
de exigir remover. `confirm_evidence` grava em `brief.evidence` o fato que o
operador escreveu no chat, conferido em código contra o texto dele, para que a
prova deixe de depender de uma nova geração. Veja o
[contrato de edição](chat-edits.md).

Pedidos visuais com bloco nomeado entre aspas recebem uma guarda de alvo e
campos: só apresentação e imagem na página em foco, sem trocar layout, textos
ou itens. O schema oferece controles locais de imagem em
`signature.composition` e `hero.landing`; o executor recusa contornar um limite reconstruindo
a seção. O recorte textual e os pedidos que seguem o fluxo geral estão no
contrato de edição.

Pedidos de fundo, cor, degradê, lavagem ou texto claro/escuro que nomeiam
rodapé/footer, cabeçalho/header/menu ou abertura/banner/hero recebem a mesma
guarda por família. Sem página explícita, a política enumera todos os alvos das
páginas; com página atual, home ou nome, restringe o conjunto. `set_brand` fica
fora desse turno. Além de `presentation.*`, `textStyles.*` e apresentação de
imagem, somente `nav.bar` pode usar `position` e `backgroundOpacity` como estilo.
Slug, ID, revisão e apresentação dos alvos fora da página em foco entram como
snapshots compactos, evitando releituras sem abrir escrita em lote entre páginas.

Remover o container decorativo de uma foto do hero usa `imagePresentation`
no bloco existente. O prompt e o catálogo informam essa capacidade; o pedido
de preservar a imagem enquanto se retira a caixa não libera apagar conteúdo.
O ensaio `eval:edits -- --live --case=landing-frame --attachment=fixture.png`
testa a interpretação multimodal com o agente configurado e gravação em memória.

O prompt de edição trata carrossel como forma da mídia existente. Para um
pedido com fotos numeradas, mantém `image` como primeira foto e grava as demais
em `slides`, em vez de inserir uma galeria não pedida. `hero.landing:stage` e
`hero.split` sem `cover`/`atelier` aceitam essa forma; `media.gallery` aceita
layout `carousel`. Proporções diferentes ficam no recibo, com `contain` como
opção para mostrar a foto inteira. `form`, `cover` e `atelier` geram explicação
e alternativa sem escrita. A composição não é instruída a criar carrosséis por
padrão: slides ocultos não cumprem sozinhos o piso de protagonista.

O turno de edição recebe duas seções próprias: as pendências de publicação com
a resolução decidida em código (`lib/taste/pendencias.ts`) e as frases que a
validação aceita como prova. As fases da geração não recebem nenhuma das duas.
As mesmas informações voltam no campo `plano` das ferramentas de validação e
edição, preservado na compactação do histórico.

Nos turnos limitados às ferramentas de edição, evidência e validação, o texto
final exibido e persistido usa os recibos reais. `update_image` entra nesse
conjunto: o recibo nomeia a nova versão e onde ela foi aplicada. `repair_publication`
só entra quando o filtro determinístico reconhece no texto atual um pedido
explícito de resolver pendências; “corrigir” dentro de uma edição visual não
expõe essa capacidade. Quando autorizada, a ferramenta informa os reparos
salvos sem exigir que o operador repita frases.
Recomendações não são anunciadas como bloqueios. O loop do SDK e seus metadados
permanecem intactos. Perguntas sem operação e pedidos mistos com outras
ferramentas conservam a resposta do modelo. `confirm_evidence` exige frases
completas do operador, recusa lote acima do limite e verifica concorrência;
seu retorno contém a validação atual, sem etapa posterior de sincronização.

Pedidos de posição/fundo do cabeçalho recebem uma proteção adicional: IDs dos
`nav.bar` e caminhos de propriedades permitidos, verificados no executor antes
da escrita. O pedido de fixação permite `position`; fundo e transparência
permitem `backgroundOpacity` e `presentation.tone`. Marca, logo, textos, links,
outros blocos e publicação ficam fora desse conjunto. Menção à home restringe
os alvos à home; sem essa restrição, os cabeçalhos das páginas são os alvos.
Pedidos mistos com outros blocos seguem a edição geral, sem essa garantia de
campos. O prompt instrui a relatar achados da crítica fora do pedido atual.

O [fluxo de edição pós-geração](chat-edits.md) usa `edit_page`, com snapshot e
schemas da página resolvida já presentes no turno e os alvos compactos das outras
páginas quando a intenção é visual por família. Texto literal, caminhos de props
e posições relativas formam um lote por página, validado antes da escrita. A
comparação de `blocks` em JSONB recusa conflito entre abas; o recibo inclui
mudanças, revisão, pre-flight e, para `presentation.*`/`textStyles.*`, medição
renderizada em 1440 e 390 px. Essa medição reutiliza o Chromium, não captura
pixels nem chama crítico; somente fundos, tipografia, composição interna,
alinhamentos computados, contraste e problemas
voltam ao agente. `EIXU_REVIEW_CAPTURE=0` a desliga com indisponibilidade
explícita. A edição geral não expõe os quatro mutadores antigos.

Alinhamento tem três caminhos semânticos no schema: campo
(`textStyles.align`), textos da seção (`presentation.textAlign`) e
grupo/controles (`presentation.contentAlign`). O prompt proíbe usar centro,
inversão de foto ou troca de layout como substituto para direita. A página
explicitamente nomeada vence o foco atual.

Quando uma disposição não tem prop própria, `presentation.elements` oferece
alvos internos e propriedades tipadas para flex, grid, dimensões, espaçamento,
ordem e acabamento por viewport. `insert_item` e `move_item` alteram listas
sem reenviá-las. O schema estrito não aceita seletor, CSS ou chave desconhecida;
o renderer gera regras confinadas ao bloco correspondente.

Nos consumidores legados, `update_block` combina parcialmente `presentation`, preservando seus campos
omitidos, e valida o bloco completo com schema estrito antes de escrever.
Propriedades desconhecidas ou inválidas são recusadas, não gravadas como se
fossem alterações visuais aplicadas.

Quando solicitada, a revisão tem três fontes de evidência:

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
No modo explícito `revisao`, o loop força a primeira avaliação e reserva o último passo para a conferência se ainda houver leitura
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
completo nasce dos recibos atuais de todas as páginas. Ele qualifica a análise
solicitada; `nextPhase` encerra pela entrega salva ou pelas páginas esperadas para a forma do site: três orgânicas em multipágina ou uma home orgânica em Landing Page. A página de obrigado é exigida pelo lint da composição, mas não pela contagem de `nextPhase`. Esse encerramento independe do certificado visual. Contar chamadas não comprova
aprovação visual.

A publicação manual mantém o pre-flight determinístico em ambos os caminhos.
`lib/sites/publication-policy.ts` converte avaliações editoriais em recomendações
para respeitar o pedido de publicação. O lint da geração mantém suas exigências;
os erros técnicos continuam recusando a transação. Ordens diretas de publicar
são executadas pelo servidor sem chamada ao modelo. No pedido explícito de resolver
pendências, o loop começa por `repair_publication`, com escopo limitado às
alegações pendentes. O agente continua outros ajustes pelas ferramentas existentes,
sem exigir a repetição de frases. `scripts/eval-publication.mjs --live` exercita
dois casos sintéticos com o modelo real e executores em memória.
O recibo do crítico governa a aprovação visual, sem transformar uma opinião
do modelo em permissão para publicar ou indisponibilidade em falha da entrega.

## Avaliação reproduzível

`npm run test:sites` e `npm run test:admin` cobrem contratos, contexto, erro de
revisão, captura incompleta, evidência desatualizada e isolamento. Captura real
usa `EIXU_CHROME_PATH`. Esses testes não chamam modelos pagos.

`npm run eval:edits` valida em memória os casos `hero-carousel` e
`hero-carousel-unsupported`: o primeiro preserva a foto principal, grava os
slides em uma única `edit_page` e não insere galeria; o segundo mantém um hero
`cover` intacto e devolve a alternativa. Também inclui `footer-gray`,
`footer-gradient` e `hero-decoration-off`, que exercitam uma estrutura comercial
v6 dirigida por referência, escopo em várias páginas, ausência de `set_brand` e
fechamento fiel. Sem `--live`, o comando apenas mostra o uso. Com `--live`, usa
`productModel('edit')`, prompt e executores reais sobre páginas sintéticas em
memória. Para comparar modelos, altere `EIXU_EDIT_MODEL`, conserve os mesmos
casos/repetições e registre custo e variância. É um ensaio pago e não deve ser
executado sem autorização explícita; não é um check local obrigatório.

`npm run eval:harness` explica o ensaio. Com `--live`, usa o modelo, os schemas,
os executores e o renderer reais; substitui I/O editorial por memória, com fotos
de uma fixture local. Não acessa Neon, não grava Blob e não publica. O ensaio executa briefing,
composição e revisão visual explicitamente; essa revisão é critério do
experimento, não uma etapa automática da geração do produto. Exemplo:

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
superioridade geral. O [guia de verificação](verification.md) reúne os checks; resultados datados ficam
no [histórico](archive/verification-2026-09-13.md).

As rotas declaram `maxDuration = 800`; o limite efetivo depende da configuração e do plano na Vercel. Confira o ambiente no release, conforme [Verificação](verification.md#publicação). Ferramentas de um mesmo passo executam em sequência para evitar perda de edições; leituras independentes dentro dos executores continuam agrupadas. Isso não substitui locks entre abas ou instâncias.

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
