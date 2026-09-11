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
inclusive quando só chegam partes de raciocínio, que não são exibidas. **Ver
progresso** relê o estado salvo. Consultas curtas como “travou?” recebem esse
estado diretamente, sem chamar o modelo; pedidos combinados de edição seguem
para o agente. Esse recorte é determinístico e restrito às expressões de
`lib/ai/chat-progress.ts`, não um classificador geral de intenção.

Uma parada em ferramentas pode terminar sem resposta textual. Nesse caso,
`lib/ai/chat-stream.ts` acrescenta um recibo do estado atual ao stream e ao
histórico, antes de encerrar. O recibo distingue etapa pendente de revisão
concluída; atingir o limite de passos é informado. Erros recuperáveis de entrada
ou execução de ferramenta são tentativas recusadas, não falhas do turno inteiro.
Logs identificam fase, ferramenta e tenant por ID, sem argumentos ou credenciais.
Fim de stream sem evento terminal vira erro explícito no cliente. O painel relê
o estado também ao encerrar ou interromper um turno; não há job durável nem
garantia de continuidade quando a aba fecha.

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

O schema de saída restringe os caminhos às páginas presentes. O servidor valida
também que o ID do bloco pertence à página indicada; o crítico pode usar `null`
quando não localiza o bloco. Enum dinâmico de todos os IDs foi recusado pelo
Gateway no ensaio, por isso essa restrição permanece na verificação externa.

A captura é ligada por padrão. `EIXU_REVIEW_CAPTURE=0` permite diagnóstico
estrutural, mas não concede conclusão visual. Origem ausente, falha de captura,
cobertura incompleta, crítica inválida ou página/bloco inventado deixam a revisão
incompleta. São permitidas três chamadas a `review_pages` por turno, para revisar,
corrigir e conferir. A crítica é sugestão verificável, não autorização humana.
O loop reserva o último passo à conferência. Depois do refinamento, uma nova
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
