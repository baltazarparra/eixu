# Plano: História do cliente e prioridade da referência

> Histórico: diagnóstico, proposta ou ensaio daquela versão. Não é contrato vigente nem confirmação de produção. Consulte o [índice](../README.md) e a [verificação atual](../verification.md). Artefatos de `outputs/` são locais e podem não acompanhar o checkout.

Análise original de 12/09/2026 no checkout `8ab02d1`. **Estado posterior:** História do cliente e prioridade visual da referência foram entregues no PR #45; Site atual foi acrescentado no PR #46. As garantias vigentes estão em [Arquitetura](../architecture.md) e [Design](../design.md). O restante preserva a proposta e as medições originais; não registra uma nova execução.

## Resultado esperado

O cadastro passa a pedir **História do cliente** como fonte principal de conteúdo.
Um único texto reúne trajetória, segmento, oferta, região atendida, público,
diferenciais e objetivo do site. Ele substitui o bloco **O que o site precisa
fazer**, incluindo seus campos de oferta e ação esperada. Segmento, região e
público deixam de existir como campos separados em **Mais contexto e contatos**.

**Referência** continua opcional, aceita um único link e, depois de verificada,
define a composição visual mais próxima possível dentro do catálogo e das
informações do cliente. A vibe e os padrões completam o que a referência não
definir. Não podem obrigar o resultado a ter outra abertura ou outra estrutura.

São duas autoridades complementares: a história decide **o que comunicar**;
a referência decide **como apresentar**. Marca, fatos, restrições explícitas,
acessibilidade, funcionamento e isolamento entre clientes continuam obrigatórios.

## Diagnóstico confirmado

| Camada                                                                                                                                          | Comportamento atual                                                                                                                                | Consequência para a mudança                                                                             |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| [Formulário compartilhado](../../components/admin/tenant-fields.tsx)                                                                            | Cadastro exige `offer` e `goal`; segmento, região, público e até três referências ficam recolhidos. Dados apresenta os cinco campos separadamente. | Alterar criação e edição juntas; não basta trocar o título do bloco.                                    |
| [Parser do formulário](../../lib/admin/tenant-input.ts) e [intake](../../lib/tenant-intake.ts)                                                  | Não conhecem `story`. `references` aceita três URLs; `lines(..., 3)` corta entradas excedentes antes de validar.                                   | Introduzir a história no contrato e recusar referências excedentes, sem truncamento silencioso.         |
| [Criação](<../../app/(admin)/admin/actions.ts>) e [edição](../../app/api/admin/[tenant]/settings/route.ts)                                      | Criação exige oferta/objetivo no servidor. PATCH substitui `brief.intake`; só a mudança de vibe bloqueia durante uma geração e remove o design.    | Exigência nova no servidor, preservação dos dados antigos e tratamento de alterações durante a geração. |
| [Dados](<../../app/(admin)/admin/[tenant]/dados/page.tsx>), [prompt](../../lib/taste/prompt.ts) e [referências](../../lib/design/references.ts) | Usam o mesmo `intakeSchema`; falha de parsing resulta em contexto vazio.                                                                           | Tornar o leitor inteiro obrigatório ou reduzir seu limite para uma URL quebraria briefings legados.     |
| [Direção](../../lib/ai/tools.ts) e [vibes](../../lib/design/vibes.ts)                                                                           | `set_design` exige leitura visual, mas `layout` só libera navegação. Hero, motivo, variância e movimento permanecem na faixa da vibe.              | Uma referência válida ainda pode ter sua estrutura recusada.                                            |
| [Cenas](../../lib/images/scene-plan.ts) e [retomada](../../lib/sites/generation.ts)                                                             | Alvos e proporções vêm da gramática; o hero é reconduzido à composição permitida pela vibe.                                                        | Mesmo um prompt corrigido pode receber imagens preparadas para o layout errado.                         |
| [Métricas](../../lib/taste/metrics.ts), [catálogo](../../lib/blocks/registry.ts) e [unicidade](../../lib/design/uniqueness.ts)                  | V4 impõe abertura/protagonista por vibe; há pisos fixos de fotos e tons. Similaridade de silhueta a partir de 0,75 pode recusar outro site.        | Padrões estéticos podem impedir seguir a referência, inclusive quando dois clientes escolhem a mesma.   |
| [Render](<../../app/(sites)/s/[tenant]/[[...slug]]/page.tsx>), [tema](../../lib/blocks/theme.ts) e [CSS](<../../app/(sites)/vibes.css>)         | V4 conserva a vibe no CSS. Só alguns tratamentos cedem aos aspectos da referência.                                                                 | Tipografia, respiro, molduras e navegação podem contrariar a direção salva.                             |
| [Crítico](../../lib/review/critic.ts)                                                                                                           | Recebe pixels do cliente e observações textuais da referência; continua exigindo a gramática v4.                                                   | Pode recomendar desfazer uma composição fiel; não comprova comparação direta entre as duas capturas.    |

O armazenamento já usa `tenants.brief` e `tenants.brand` em JSONB, conforme
[schema](../../db/schema.sql). A proposta não precisa de coluna nova nem de migração
em massa. Isso foi conferido no código local; a distribuição dos dados de
produção não foi consultada.

### Verificação realizada

Passaram **105 testes existentes**, sem falhas ou casos pulados, em duas execuções:

```bash
node --test --test-reporter=spec tests/admin-create.test.mjs tests/admin-contacts.test.mjs tests/site-references.test.mjs tests/site-contract.test.mjs tests/site-visual-system.test.mjs
node --test --test-reporter=spec tests/site-vibe-regressions.test.mjs tests/admin-publish.test.mjs
```

As suítes usam dependências simuladas nos caminhos de banco, Blob e modelo.
Não houve geração paga, escrita remota ou publicação. Elas confirmam o contrato
atual, inclusive as regras que a implementação precisará substituir por versão.

Um diagnóstico adicional, somente em memória, reproduziu quatro comportamentos:

1. Um objeto contendo apenas `story` perde esse campo no parser atual.
2. Essa história não chega a `intakeSummary`.
3. Quatro URLs submetidas pelo formulário viram três, sem erro.
4. Na vibe `moderno`, `heroComposition: split` é recusado mesmo com os seis
   aspectos de referência presentes; `scenePlan` prepara `hero.editorial`.

Não foi medida a fidelidade de uma nova geração: não existe implementação nova
nem uma referência concreta fornecida para esse ensaio.

## 1. Cadastro e edição

Ordem proposta: Identificação → História do cliente → Direção visual, com
Referência antes da Vibe → Contatos e contexto adicional → Marca.

**História do cliente** será um textarea amplo, obrigatório na criação e editável
em Dados. Oferta e ação esperada também passam para esse texto, evitando manter
um segundo briefing com respostas potencialmente divergentes. Exemplo de ajuda:

> Conte quem é o cliente, como o negócio começou, em que segmento atua, o que
> oferece, onde atende, para quem vende e o que o torna diferente. Inclua fatos
> importantes e o que espera que a pessoa faça ao visitar o site.

O campo admite parágrafos e tópicos; não exige uma narrativa cronológica.
Validar conteúdo não vazio depois de `trim`, preservar quebras de linha e exibir
contador. Limite inicial proposto: **12.000 caracteres**, com rejeição explícita
do excesso. Esse limite é uma escolha de implementação a aferir com histórias
longas, não uma medida da qualidade do briefing. Não exigir os antigos cinco
campos escondidos nem inventar respostas para completá-los.

**Referência** vira um input de URL único. A ajuda explica que o layout seguirá
esse site, adaptado ao conteúdo e à marca do cliente. Quando preenchido, o texto
junto às vibes deixa claro que a escolha será apoio para aspectos não definidos
pela referência. Antes da leitura, a interface não afirma que a fonte foi vista.

Contatos, fatos confirmados adicionais e restrições continuam opcionais.
Instagram e LinkedIn permanecem nos contatos; não ocupam o link de referência
visual. Um dado operacional mencionado na história, como telefone, não deve
sobrescrever silenciosamente os contatos estruturados.

## 2. Contrato de dados e compatibilidade

Adicionar `story` em `brief.intake`. Manter a chave existente `references` como
array, com zero ou uma URL nas novas gravações, reduz o impacto nos consumidores.
Separar validação de **criação**, **edição** e **leitura de registros existentes**.

- Criação exige história e recusa mais de uma URL antes de qualquer upload,
  insert ou geração. O servidor deve conferir também campos repetidos e URLs
  coladas juntas; mudar apenas o controle HTML não é suficiente.
- Edição recusa uma história explicitamente apagada e novos conjuntos de duas
  ou mais referências. Atualizações só de contato não devem revalidar ou
  regravar um intake legado inteiro.
- Leitura aceita o formato atual, inclusive registros sem história e com até
  três referências. `intakeSummary`, `intakeSocialUrl`, `referenceUrls`, Dados
  e os demais consumidores devem usar esse caminho compatível.
- Para um cliente antigo, oferecer em História uma composição determinística
  dos campos já informados, com rótulos, sem acrescentar fatos. Persistir a
  conversão ao salvar esse briefing; não executar backfill remoto automático.
- Conservar os dados de origem na transição. Quando existir história nova,
  ela passa a ser a fonte ativa; não misturar silenciosamente valores antigos
  de público, oferta ou região que possam estar desatualizados.
- Para registros com várias referências, preservar leitura, publicação e
  retomada antigas. Antes de converter o briefing/recompor sob o contrato novo,
  o operador escolhe uma das URLs ou informa outra. Sugerir a principal já
  registrada quando existir; não descartar as demais ao salvar outro dado.
- Validar HTTP/HTTPS e normalizar a URL. Preservar as proteções existentes de
  leitura pública, redirects, portas, credenciais e rede privada.

Uma nova geração completa pelo contrato novo exige história preenchida e no
máximo uma referência ativa. Uma simples edição de telefone em cliente antigo
não deve obrigar essa conversão.

## 3. História como fonte principal da geração

Na etapa Preparar, extrair da história oferta, público, região, diferenciais,
trajetória, objetivo, restrições e lacunas. Fazer isso no planejamento existente,
sem criar uma chamada de modelo só para resumir o cadastro.

A história integral permanece persistida e disponível nas fases, no chat e na
crítica. O resumo estruturado ajuda a operar, mas não pode substituir a fonte
rica pelos oito itens curtos permitidos hoje em `brief.evidence`. Cada página
deve selecionar os fatos pertinentes, inclusive informações do fim de uma
história longa, e registrar sua sustentação no plano editorial.

O guia e os pedidos de imagem devem traduzir os fatos relevantes da história em
assuntos e cenas. Hoje o gerador de imagens recebe guia e pedido, não a história
diretamente; alterar somente o prompt de composição não cobriria esse caminho.

Tratar desejos e planos como tais: “queremos atender todo o estado” não significa
“atendemos todo o estado”. Divergência material entre história, fatos adicionais
e contatos vira uma lacuna a resolver. A referência de outro negócio fornece
design; não fornece serviços, clientes, depoimentos, equipe ou comprovações para
este cliente. Experiência da liderança também não vira alegação de cliente da
empresa sem evidência.

## 4. Referência acima da vibe no contrato visual

Introduzir **perfil visual v5**, com autoridade visual explícita e um plano de
composição persistido. Evitar alterar retroativamente as regras da v4. O novo
perfil tem dois caminhos: referência verificada ou vibe, usando a mesma solução
de autoridade no planejamento, ferramentas, imagens, render e verificadores.

### Leitura e plano aplicável

Reaproveitar a captura desktop/mobile e a leitura multimodal existentes. Ampliar
as observações para um plano concreto: abertura, ordem e função das seções,
navegação, proporção texto/imagem, largura, escala tipográfica, espaçamento,
superfícies, papel das imagens, fechamento e adaptação mobile.

Para cada traço relevante, registrar o que foi observado, a realização no
catálogo e a adaptação necessária. Uma adaptação precisa apontar uma razão real:
conteúdo indisponível, marca, acessibilidade ou recurso fora do catálogo. “A vibe
prefere outro hero” e “outro cliente tem estrutura parecida” deixam de ser razões
para descaracterizar a referência.

Não inferir movimento de capturas estáticas. A página indicada é a fonte; não
prometer cobertura de páginas internas que não foram lidas. Login, captura
insuficiente e conteúdo não carregado continuam como lacunas, com fallback
explícito para a vibe e sem alegação de fidelidade. Não escolher outra URL por
conta própria.

### Composição, cenas e padrões

Com referência verificada, permitir hero, protagonista, sequência, navegação,
motivo, tipografia, ritmo, superfícies e dials coerentes com o plano, sem as
faixas estéticas da vibe. Aspectos não observados recebem soluções discretas
compatíveis com o conjunto; a vibe não pode reintroduzir um conflito visual.

`scenePlan`, `plannedScenes`, cobertura e retomada devem derivar as vagas do
plano persistido, incluindo a variante e a proporção usadas pelo render.
Não passar novamente por `heroCompositionFor(vibe, ...)`. O atual mínimo de
cinco cenas e a exigência fixa de protagonista não devem fabricar uma galeria
que a referência não tem. Manter inicialmente o teto atual de seis cenas na
criação; a quantidade efetiva vem do plano e considera o acervo disponível.

Separar **qualidade funcional** de **receita estética**. No modo referência,
duas fotos numa seção, protagonista fixo, seção inteira colorida, três tons e
variância mínima não são limites técnicos. Devem ceder quando contradizem
características verificadas da fonte, com a decisão registrada no plano.
A dispensa não pode nascer de uma captura incompleta ou de uma alegação do agente.

Os requisitos de páginas úteis e conectadas, oferta verdadeira, legibilidade,
responsividade, CTAs válidos, imagens válidas e schemas continuam. O escopo
atual de três páginas orgânicas é preservado: quando a fonte tiver só uma página,
suas escolhas visuais orientam as internas sem afirmar que elas foram copiadas.
Um produto de página única seria uma mudança separada de escopo.

### Render e verificação coerentes

No modo referência v5, tokens e decisões do perfil precisam governar o CSS
efetivo. Auditar escala, respiro, molduras, cabeçalho, ícones, localização e
movimento, inclusive seletores genéricos de `data-vibe`. Não resolver isso apenas
trocando todas as vibes por `comercial`, que também tem padrões próprios.

O catálogo e as ferramentas passam a informar o plano efetivo, não uma gramática
contraditória. `set_design`, composição/reparo, edição e ambos os caminhos de
publicação devem aplicar as mesmas regras. Similaridade estrutural entre clientes
com referência verificada vira informação para revisão, não veto automático.
Continuam vedados dados e imagens de outro tenant. Sem referência verificada,
as regras de variedade da vibe permanecem.

Qualquer extensão necessária ao catálogo deve ser pontual, com schema,
renderizador, componente e pre-flight correspondentes. Não aceitar HTML/CSS livre
do modelo como atalho para fidelidade.

## 5. Atualizações, retomada e sites existentes

Associar o briefing derivado, a leitura da referência e o plano visual à revisão
do intake que os produziu, usando versão ou fingerprint no JSONB. A referência
registrada no plano deve corresponder à URL ativa e à leitura que a sustentou.

Ao alterar história ou referência, marcar o planejamento derivado como
desatualizado para a próxima geração/edição pertinente. Não tratar fontes
removidas, respostas atrasadas ou evidências do briefing anterior como atuais.
O histórico factual de redes sociais permanece separado da referência de layout.

Proteger alterações desses campos durante uma execução, como já ocorre com a
vibe, e conferir novamente a revisão antes de persistir resultados. A checagem
inicial isolada não resolve a corrida entre salvar Dados e gravar `set_design`.

Salvar Dados não dispara gasto nem recomposição automaticamente e não apaga o
design renderizado. Atualização de conteúdo orienta as próximas edições; aplicar
uma nova referência ao site inteiro acontece na recomposição solicitada pelo
operador. Sites já gerados continuam concluídos, sem reabrir Conferir ou criar
pendência de análise visual automática.

Perfis v2, v3 e v4 preservam render, retomada e publicação. Auditar comparações
como `version === 4`, `version !== 4` e listas `[2, 3, 4]`; adicionar v5 apenas ao
tipo faria alguns consumidores tratarem o perfil novo como legado ou inválido.
Snapshots publicados continuam intactos até a próxima publicação autorizada.

## 6. Sequência de implementação

| Etapa | Entrega                                                                                                                | Arquivos principais                                                                                                                                                                                             |
| ----- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | Contratos de criação/edição/leitura, história integral e compatibilidade com múltiplas referências antigas.            | `lib/tenant-intake.ts`, `lib/admin/tenant-input.ts`, actions, PATCH de settings, Dados.                                                                                                                         |
| 2     | Formulário unificado, história obrigatória e uma referência antes da vibe, com mensagens consistentes.                 | `components/admin/tenant-fields.tsx`, `brand-fields.tsx`, `clients.tsx`, `settings-form.tsx`, CSS do admin.                                                                                                     |
| 3     | Autoridade visual v5, leitura estruturada e plano persistido; história conectada ao plano editorial e guia de imagens. | `lib/design/{profile,references,vibes}.ts`, `lib/references/`, `lib/taste/{prompt,phases}.ts`, `lib/ai/tools.ts`, `lib/generation/context.ts`.                                                                  |
| 4     | Cenas e retomada baseadas no plano; regras de composição, render e unicidade coerentes com a autoridade efetiva.       | `lib/images/{scene-plan,scene-slots,site-assets}.ts`, `lib/sites/generation.ts`, `lib/taste/{metrics,lint,site}.ts`, `lib/design/uniqueness.ts`, `lib/blocks/`, CSS e página dos sites, `lib/sites/publish.ts`. |
| 5     | Controle de contexto desatualizado, revisão solicitada e regressões de publicação/legado.                              | Settings, runner, tools, `lib/review/{critic,state}.ts`, snapshots e testes.                                                                                                                                    |
| 6     | Validação no navegador, avaliação de geração e documentação do contrato novo.                                          | Suítes admin/sites, fixtures, `evals/cases/`, `docs/{admin,architecture,design,harness,verification}.md`, `README.md`, `AGENTS.md`.                                                                             |

As etapas dependentes devem chegar juntas à entrega: liberar apenas o formulário
deixaria a referência prometida pela interface subordinada ao contrato antigo.
O trecho de AGENTS que hoje exige a silhueta da vibe deverá documentar a regra
v5 e a preservação de v2–v4. Não remover o bloco gerenciado pelo Next.js.

## 7. Critérios de aceite e validação da implementação

| Cenário                                                | Resultado verificável                                                                                                                |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| História ausente, só espaços ou acima do limite        | Recusa no cliente e servidor, sem upload, insert ou geração.                                                                         |
| História longa com fatos no início, meio e fim         | Texto preservado ao salvar/reabrir; fatos relevantes chegam ao plano, páginas, SEO e cenas, sem corte silencioso.                    |
| Cadastro e Dados                                       | Nenhum campo separado de segmento/região/público/oferta/objetivo; história acessível por teclado e utilizável em 320, 390 e 1440 px. |
| Zero, uma e duas referências                           | Zero é válido; uma normalizada é aceita; duas são recusadas também em requisição direta, sem guardar só a primeira.                  |
| Cliente antigo sem história ou com três referências    | Leitura, contatos, retomada e publicação preservados; conversão explícita sem perda silenciosa.                                      |
| História contraditória ou referência de outro setor    | Lacunas identificadas; oferta, equipe, métricas, clientes e contatos de terceiros não entram no site.                                |
| Mesma história e referência, quatro vibes conflitantes | Abertura, sequência, escala, imagens e ritmo seguem a referência nas quatro; mudanças da vibe ficam no apoio compatível.             |
| Mesma história e vibe, referências bem diferentes      | Os layouts finais se diferenciam pela estrutura das referências, não só por cor e fonte.                                             |
| Referência minimalista sem galeria                     | Nenhuma seção ou foto é inserida só para cumprir a receita antiga; adaptação sustentada pelo plano.                                  |
| Referência indisponível ou incompleta                  | Motivo registrado e fallback reconhecível; nenhuma alegação de leitura ou fidelidade inexistente.                                    |
| Troca/remoção de referência e resposta atrasada        | Leitura antiga não autoriza a direção nova; trabalho concluído não reinicia sozinho.                                                 |
| Mesmo link usado por dois clientes                     | Sem recusa apenas por semelhança estrutural; conteúdo e acervo continuam isolados.                                                   |
| Sem referência                                         | Vibes mantêm identidade e critérios de qualidade; não há regressão para layout genérico.                                             |
| V2, v3, v4 e v5; publicação completa e pontual         | Cada perfil usa suas regras e snapshot correto; erros funcionais continuam bloqueando publicação.                                    |

Executar contratos, tipos, lint e build conforme [Verificação](../verification.md):
`npm run test:sites`, `npm run test:admin`, `npx next typegen && npx tsc --noEmit`,
`npm run lint` e `npm run build:vercel`. Testes de navegador usam o CSS emitido
pelo Next.js e conferem navegação aberta/fechada, toque, teclado, foco, recortes,
leitura e telas estreitas/baixas. Ausência de overflow não comprova fidelidade.

A avaliação de geração deve usar histórias sintéticas controladas, uma referência
por caso e referências com estruturas contrastantes. Comparar, com o mesmo
briefing, a versão atual e a proposta; registrar adaptações, qualidade do
conteúdo, fidelidade por aspecto, chamadas, latência e custo. O caso repetido nas
quatro vibes verifica se a referência realmente prevalece. Ensaio com geração
paga precisa de recurso e escopo definidos na execução; não foi realizado nesta
análise.

Na revisão visual solicitada, preferir capturas atuais da referência e do
rascunho como entradas multimodais, com viewport e identidade da leitura
registrados. O crítico deve separar o que viu em pixels do que recebeu como
observação textual. Sem as duas capturas, não declarar comparação direta.
Não prometer porcentagem de fidelidade pixel a pixel com conteúdo diferente.

A geração continua terminando na composição. Revisão humana pela prévia e
ajustes pelo chat permanecem a jornada padrão; a comparação automatizada não
vira nova etapa obrigatória do produto.
