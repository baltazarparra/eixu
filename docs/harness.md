# Harness e qualidade dos agentes

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

`lib/ai/models.ts` é a fonte única dos modelos e limites. O chat, os críticos de
foto/logo, a descrição de avatar, a crítica do site renderizado e os runners usam
`google/gemini-3.8-flash`. `EIXU_MODEL` permite configuração explícita do agente;
`EIXU_CRITIC_MODEL` prevalece para os críticos, depois cai em `EIXU_MODEL` e no
padrão. Antes de publicar, confira os valores do ambiente de destino.

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

| Tarefa                        | Máximo de saída por passo |    Passos por turno |
| ----------------------------- | ------------------------: | ------------------: |
| Briefing e plano editorial    |                    16.384 |                  12 |
| Cena individual               |                     8.192 |                   2 |
| Composição e reparo           |                    49.152 |                  24 |
| Revisão e correção            |                    24.576 |                  32 |
| Edição livre                  |                    24.576 |                  32 |
| Crítica de foto, logo ou site |                    16.384 | chamada estruturada |
| Descrição de avatar           |                     4.096 |     chamada textual |

São tetos operacionais, não metas de verbosidade. `lib/ai/agent.ts` instancia o
`ToolLoopAgent` compartilhado entre chat e avaliação. O turno tem 760 segundos no
SDK, dentro dos 800 da função, e uma repetição de transporte. Críticos têm 150
segundos. Esgotar um limite não prova conclusão; o painel retoma pelo estado.

## Contexto e decisões

O prompt mantém fatos, restrições, vibe, marca, contatos, guia de imagens, fontes,
plano editorial e biblioteca do tenant. Referências lidas acompanham também a
composição e a revisão. `brief.pagePlan` guarda intenção, etapa de inbound,
conteúdo e evidências de cada página; é opcional no schema para ler briefings
legados. O agente é instruído a preenchê-lo ao definir uma nova direção.

O catálogo deriva do schema. Composição e revisão recebem os schemas JSON
completos, com campos obrigatórios, limites e descrições. Edições livres recebem
o mapa resumido; `describe_block` resolve o detalhe quando necessário. Até seis referências podem ser lidas em um turno;
fontes inacessíveis permanecem lacunas. Conteúdo externo e texto em imagens são
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
oferece **Tentar novamente**, preservando páginas, cenas e revisão pendente.
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
rótulos e contadores, sem conteúdo do cliente. O evento de fim de fase carrega
também o recibo daquela fase — modelo, passos, duração, tokens e custo do
Gateway —, porque a contagem do stream não existe fora do navegador e a parte
cara do trabalho tinha deixado de aparecer no consumo do painel.
`lib/admin/usage-summary.ts` soma esses recibos com os dos turnos livres;
parcela sem custo deixa o total sem valor, em vez de contá-lo como zero. O painel lê por consulta
periódica, reativa a leitura ao iniciar pelo botão ou pelo chat e reconstrói o
andamento depois de qualquer recarga. As mensagens são paginadas a partir de
zero, com cursor do último registro entregue; a leitura continua até esvaziar
o lote mesmo quando o run terminou. O recibo persistido reutiliza a bolha do
stream e preserva suas ferramentas e metadados. Enquanto um run
está ativo, `/api/chat` responde 409: os dois disputariam as mesmas páginas.
Sem sinal por 15 minutos, o run é dado por perdido e o operador pode retomar.

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

A revisão pode ocupar até três rodadas por execução, cada uma com turno e
limite de leituras próprios. `lib/generation/marker.ts` compara a quantidade de
leituras registradas e a assinatura do rascunho: repetir a fase `revisao` com
algum desses valores alterado é avanço. Cenas usam a cobertura do plano;
briefing e composição precisam produzir a fase seguinte. O teto global segue
em 14 saltos. Sem avanço ou ao esgotar as rodadas, o runner decide a parada no
fim do turno e registra o motivo no chat e em um evento de erro.

Quando o turno de revisão termina sem texto do agente, o resumo conta ajustes
somente quando a ferramenta confirma `ok: true`. Leituras contam quando captura
e crítica completaram, mesmo que apontem erros no rascunho; recusas, limite de
leituras e revisão visual indisponível ou desativada não contam como leitura
concluída. O recibo do estado atual continua decidindo a conclusão da geração.

Quando o SDK devolve `TimeoutError` por esgotar o turno de 760 segundos, o
runner relê o estado salvo e aplica a mesma decisão: continua se houve avanço,
conclui se a revisão atual está completa, ou encerra com o motivo. A pausa do
operador tem prioridade. Esse caminho grava o fim da fase sem inventar consumo
que o SDK não devolveu. O timeout depende de a chamada em andamento respeitar
o sinal de aborto; ele não garante que ferramentas independentes terminem
dentro do limite da função.

O painel mostra leituras dentro da rodada atual, sem usar o contador acumulado
do cliente. O número da rodada fica no evento de início para sobreviver ao
corte de eventos antigos no feed. O último turno recebe instrução explícita
para relatar pendências sem prometer continuação automática. **Tentar
novamente** abre uma execução com novas rodadas, preservando o rascunho.

## Compor, observar, corrigir, conferir

O fluxo continua briefing → cenas → composição → revisão. O planejamento escolhe
alternativas coerentes com a vibe; o plano editorial diferencia as intenções das
páginas. A composição grava o lote validado e usa `repair_site` para corrigir
recusas sem reenviar tudo. Um lote salvo sem erros encerra o loop de composição
por condição externa do SDK e segue para a revisão. Avisos de recorte são
julgados nos pixels; não provocam reenvios do projeto para zerar contagens.
Erros continuam bloqueando a transição. Imagens ficam disponíveis por número, conforme o fluxo
atual do produto; aplicar logo e publicar continuam dependendo do pedido.

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

`update_block` combina parcialmente `presentation`, preservando seus campos
omitidos, e valida o bloco completo com schema estrito antes de escrever.
Propriedades desconhecidas ou inválidas são recusadas, não gravadas como se
fossem alterações visuais aplicadas.

A revisão tem três fontes de evidência:

1. `lintPage`, `lintSite` e métricas de composição conferem o projeto inteiro.
2. Chromium abre todas as páginas do lote, até 12, em 1440 e 390 px. Overflow e
   imagem quebrada viram erros do relatório, mesmo se o crítico não os perceber.
   As capturas usam movimento reduzido e rolagem instantânea, conferindo o retorno
   ao topo; capturar durante o scroll suave deslocava barras fixas na imagem e
   induzia falsas correções de layout.
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
`resolveReviewReferences`: caminho normalizado, achado sem página existente sai
do relatório e ID de bloco inexistente vira `null`. As duas contagens entram no
relatório como aviso `critica-referencia`, porque uma citação imprecisa não pode
invalidar a revisão inteira nem passar despercebida.

A captura é ligada por padrão. `EIXU_REVIEW_CAPTURE=0` permite diagnóstico
estrutural, mas não concede conclusão visual. Origem ausente, falha de captura,
cobertura incompleta ou crítica inválida deixam a revisão incompleta.
`REVIEW_CALLS_PER_TURN` permite três chamadas a `review_pages` por turno,
incluindo tentativas com falha de captura ou crítica, para observar, corrigir
e conferir. A crítica é sugestão verificável, não autorização humana.
O loop força a conferência no último passo somente se ainda houver leitura
disponível; uma quarta chamada seria recusada pela ferramenta. As correções
da mesma página podem ser agrupadas antes da nova leitura. Depois do refinamento, uma nova
revisão completa e sem erros encerra a fase por condição externa, mantendo os
avisos no relatório. Isso impede editar novamente após a conferência e consumir
o turno sem revisar a última versão. Falha ou erro material permanece pendente.

O recibo em `brief.generation.review` guarda estado, apontamentos e fingerprint
SHA-256 do conteúdo revisado. Inclui páginas, SEO, marca, contatos, briefing,
imagens e versão do harness. Alteração posterior invalida o recibo, mesmo após
recarregar. `nextPhase` exige revisão visual completa e sem erro material do
rascunho atual: contar chamadas de revisão já não encerra a geração.

A publicação manual mantém o pre-flight determinístico em ambos os caminhos.
O recibo do crítico governa a conclusão automática, sem transformar uma opinião
do modelo em permissão para publicar.

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
