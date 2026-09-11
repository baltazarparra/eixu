# Arquitetura e limites do MVP

Mapa do fluxo de imagens atualizado em 11/09/2026. Descreve o comportamento implementado; os limites no fim deste arquivo não são funcionalidades entregues.

## Superfícies e dependências

| Superfície         | Rotas e fontes                                                                                                                      |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Institucional      | `/`, `/vibe-coding-para-producao`, `/cases/saldopix`, `/cases/naiacrm`; `app/(main)/`, `components/eixu.tsx`, `lib/site.ts`         |
| Operação           | `/admin`, `/admin/login`, `/admin/[tenant]`; `app/(admin)/admin/actions.ts` e `app/(admin)/admin/[tenant]/workspace.tsx`            |
| Imagens            | `/admin/[tenant]/imagens` (biblioteca), `/api/admin/[tenant]/images` e `/api/admin/[tenant]/upload`; a geração vive no chat do site |
| Dados e briefing   | `/admin/[tenant]/dados`, `/api/admin/[tenant]/settings`, `/api/admin/[tenant]/social`; validação em `lib/admin/tenant-input.ts`     |
| Tráfego e contatos | `/admin/[tenant]/trafego`, `/api/admin/[tenant]/contatos.csv`                                                                       |
| Site de cliente    | Host do tenant → `proxy.ts` → `/s/[tenant]/[[...slug]]`, com sitemap e robots próprios                                              |
| Conversão          | `/api/form`, `/api/e`, `/go/wa`; `lib/tracking.ts`                                                                                  |

Next.js roda páginas, Server Actions e Route Handlers. `lib/db.ts` cria o cliente Neon sob demanda; importar módulos no build não exige conexão ativa. O schema está em `db/schema.sql`, sem ORM; `npm run db:migrate` o reaplica e precisa rodar antes de um deploy que dependa de coluna nova. Imagens ficam em Blob público, e o banco guarda URL, estado, crítica e referência. O AI SDK usa o AI Gateway para modelos de texto e imagem.

O [contrato visual](design.md) descreve variantes, dials, âncoras e a aplicação das duas skills no gerador. Os grupos `(main)`, `(admin)` e `(sites)` têm layouts raiz e folhas de estilo próprios. O institucional usa componentes e efeitos próprios; os sites gerados combinam blocos renderizados no servidor, componentes interativos de Framer Motion, HTML nativo e um script de atribuição.

## Edição e publicação

A leitura em `lib/tenant-queries.ts` recupera o WhatsApp legado e a rede de
`brief.intake.socialUrl` para clientes anteriores a `contacts`. A rede só é
recuperada quando a chave `contacts.social` ainda não existe; uma lista vazia
gravada pelo operador prevalece. Assim, o primeiro salvamento em Dados
conserva o perfil e o avatar, sem impedir a remoção explícita. Telefones
preservam o `+` informado em `contacts`; a coluna `whatsapp` e os destinos de
WhatsApp continuam recebendo apenas dígitos.

1. O operador autentica em `lib/auth.ts`: cookie `eixu_admin`, HMAC e validade de 12 horas. As páginas administrativas, ações e APIs verificam a sessão.
2. A criação do tenant grava nome, slug, e-mail e o briefing estruturado do formulário (segmento, região, público, oferta, objetivo, fatos confirmados, restrições e referências) em `tenants.brief.intake`, validado por `lib/tenant-intake.ts`. Telefones, endereços e redes sociais vão para a coluna `tenants.contacts`, validados por `lib/tenant-contacts.ts`; o primeiro número marcado como WhatsApp é derivado para `tenants.whatsapp`, e o primeiro Instagram ou LinkedIn da lista alimenta `brief.intake.socialUrl` e a leitura de perfil. A vibe escolhida no cadastro fica em `brand.vibe` e vale para o site inteiro. Todos os campos do briefing são opcionais; o formulário traz a legenda de cada um. O mesmo formulário grava a marca em `tenants.brand`: cor primária em `accent`, secundária em `accentAlt`, acento em `highlight`, `paletteSource: 'operador'` e a vibe. O logo opcional sobe ao Blob por `putNewTenantBlob` antes do insert, porque a rota de upload exige um cliente existente; endereço duplicado recusa o cadastro e apaga o arquivo. Depois de confirmar o insert, falha ao iniciar a leitura social preserva o cliente e o logo e abre o editor; o operador pode reler o perfil no painel. O workspace reidrata em `useChat` as 60 mensagens textuais mais recentes do canal, na ordem cronológica; cada envio inclui esse histórico e as mensagens novas, além de tenant e página em foco. Slug duplicado é recusado sem abrir ou sobrescrever o cliente existente.
3. A rota resolve o tenant, inclui intake, briefing e direção no prompt e oferece `buildTools(tenant, { origin, cookie })`. Com `phase` no corpo, ela abre só as ferramentas daquela etapa (`lib/taste/phases.ts`), ajusta o limite de passos, poda o contexto e recusa a fase que não tem o estado que ela pressupõe. Em site novo ou reconstrução, `read_reference` lê as referências informadas e registra o que ficou inacessível, `define_image_guide` fixa a direção de imagem, `set_design` persiste o perfil v2 preservando as cores do cadastro, `prepare_site_images` gera na etapa de cenas todas as vagas que faltam, em lotes paralelos, `review_pages` mede o rascunho renderizado e `build_site` aceita até 12 páginas com 1–20 blocos por página, incluindo intenção/etapa de inbound em `meta`. `generate_logo` e `set_site_logo` também vivem no chat do site; aplicar logo exige pedido detectado na última mensagem do operador. Ferramentas menores leem, alteram, movem ou removem blocos. As páginas são resolvidas dentro do tenant.
4. Schemas e catálogo vivem em `lib/blocks/registry.ts`; o perfil e as assinaturas ficam em `lib/design/`; `lib/blocks/render.tsx` despacha para componentes de servidor e de interação. `build_site` valida páginas, contrato de projeto e duplicação da home antes de gravar o lote em uma transação. Um lote recusado fica apenas na memória da instância de ferramentas daquele tenant e turno; `repair_site` altera campos por slug/índice, revalida tudo pelo mesmo caminho e só grava se válido. Não altera snapshots nem páginas fora do lote e não publica. Edições menores ainda podem salvar rascunho inválido, que é omitido no render e apontado por `lintPage`.
5. O painel atualiza `/api/admin/[tenant]/state` após ferramentas de mutação e recarrega o iframe com `preview=1&__tenant=...`. Servidor e API usam `workspaceState`, incluindo pendências globais e comparação de blocos **e SEO** com o snapshot. Consultas de leitura não recarregam a prévia. O modo de rascunho exige sessão, recebe `noindex`, preserva o tenant nos links e desativa formulários e tracking. O cookie é passado somente ao capturador interno; não entra no prompt.
6. `publish_page`, `publish_site` e a API `/api/admin/[tenant]/publish` usam `lib/sites/publish.ts`. O serviço executa `lintPage`, `lintSite` e a trava estrutural antes de copiar os valores validados de `blocks`/`seo` para o snapshot em uma única transação. Um erro recusa o lote inteiro. Na publicação pontual, páginas fora do lote contam pelo snapshot publicado. O painel recebe também os erros de projeto e desabilita seu botão quando há erros.
7. A página pública usa os blocos publicados; sem publicação, retorna 404. Marca, título, tipo e `meta` não têm uma versão publicada própria.

A geração em etapas não passa pelo chat. `POST /api/admin/[tenant]/generation` cria um run em `generation_runs` — um ativo por cliente, garantido por índice parcial — e chama `/api/admin/[tenant]/generation/step`, que reserva atomicamente o salto assinado no token antes de responder 202 e executar a fase em `after()` com `maxDuration` de 800 segundos. Repetições do mesmo salto não agendam callbacks nem alteram o run ativo. `lib/generation/runner.ts` monta o mesmo agente, ferramentas e prompt do chat (`lib/generation/context.ts`), autentica a captura da prévia com uma sessão emitida no servidor e grava cada início e fim de ferramenta em `generation_events`. Ao terminar, a etapa decide a próxima por `generationState` e encadeia outra invocação pela origem registrada no run; `stop` marca o pedido de pausa, que o laço do agente respeita depois do passo corrente. `GET` devolve run, eventos, estado, `previewRevision`, a hora do servidor e as mensagens gravadas desde um id. A hora sincroniza os cronômetros da etapa e do total sem depender da configuração do aparelho. O cursor vem do último registro entregue, inclusive a partir de zero, e lotes de 60 são drenados sem saltar mensagens. A renderização inicial deriva o cursor do próprio histórico. `previewRevision` usa a assinatura do rascunho para recarregar o iframe quando conteúdo, marca ou imagens mudam, preservando-o em consultas sem alteração. Enquanto um run está ativo, `/api/chat` responde 409. O `GET` informa ainda `everRan`, considerando execuções, `brief.generation` legado e mensagens do canal `site` por tenant, inclusive antes do cursor entregue. Com ele, o painel inicia a geração sozinho apenas em cliente sem tentativa ou conversa anterior, sem página e com o briefing pendente; um feed antigo sem o campo não autoriza esse início. O evento de fim de fase carrega o recibo de consumo daquela fase, lido por `lib/admin/usage-summary.ts` junto com os recibos dos turnos livres.

Fora dos blocos, o render monta duas coisas a partir do cadastro. O rodapé recebe uma coluna de contato com e-mail, telefones (WhatsApp pelo redirecionador rastreado, comum em `tel:`) e redes sociais com ícone. Com endereço cadastrado, `lib/blocks/location.tsx` acrescenta a seção "Onde estamos" como último elemento de `<main>`, com o endereço, o link de rota e o mapa do Google carregado sob demanda; acima de um endereço, uma ilha de cliente alterna entre eles e o conteúdo continua legível sem JavaScript. A âncora `onde-estamos` é reservada antes dos blocos e `lintPage` recusa um bloco que tente usá-la. Post e obrigado não recebem a seção. Nada disso entra em `pages.blocks`, no catálogo ou na assinatura de composição: é dado do operador, como o botão flutuante de WhatsApp.

O perfil de rede social informado é lido fora da resposta, por `after()`, na criação e quando o campo muda no PATCH de `/settings`; `/api/admin/[tenant]/social` refaz a leitura sob pedido do operador. `lib/social-profile.ts` normaliza `@handle` e URL de Instagram ou página de empresa do LinkedIn, e `lib/ai/social.ts` lê nome, bio, seguidores e avatar das meta tags, copia o avatar para `tenants/<slug>/social/` no Blob e descreve a imagem pelo modelo crítico, com uma chamada por avatar novo (comparado por hash). O resultado fica em `tenants.brief.social`, separado de `intake`, com estado `lendo`, `ok` ou `inacessivel` e o motivo. Cada leitura recebe um `readId`; o resultado só é gravado se esse ID e a URL do intake continuarem vigentes. Troca, remoção ou releitura invalidam respostas anteriores, e um upload descartado é removido. O avatar anterior permanece referenciado durante a leitura para reutilização ou limpeza após a troca. A leitura é melhor esforço: o LinkedIn responde 999 em perfil pessoal e o Instagram devolve a tela de login em boa parte das contas; nesses casos o prompt recebe a instrução de tratar o perfil como lacuna. `read_reference` reaproveita esse registro por 24 horas em vez de reabrir a rede. Cada escritor de `brief` mescla apenas suas próprias chaves: intake, fontes, progresso, perfil ou briefing consolidado. O chat do site recebe tanto o intake e o perfil quanto as evidências, restrições e lacunas do briefing consolidado.

A exclusão de cliente em `/admin` e em Dados usa `deleteTenantAction`: adquire `FOR UPDATE` na linha do tenant, reconfirma estado e contatos, apaga o prefixo `tenants/<slug>/` no Blob e só então remove o registro na mesma transação. `pages`, `leads`, `events`, `campaign_spend`, `chat_messages` e `images` caem por `on delete cascade`. Todos os uploads do produto (fotos, logos, anexos e avatar social) usam `putTenantBlob`, que mantém `FOR KEY SHARE` durante o envio; o logo do cadastro é a exceção, porque sobe antes de existir linha para travar: a exclusão espera puts em andamento, e um upload que chega depois dela não encontra a linha nem grava arquivos. `lib/db.ts` mantém consultas comuns por HTTP e abre uma conexão WebSocket Neon por transação interativa, fechada no mesmo pedido, sem migração de schema. Os locks são de linha, portanto outros tenants continuam operando. Falha no Blob preserva o cadastro; uma limpeza parcial pode ser repetida. Cliente publicado ou com contato recebido exige o endereço digitado, conferido de novo dentro do lock. Não há lixeira nem restauração.

`lintSite` também aplica o piso de composição de `lib/taste/metrics.ts`: seção protagonista com duas fotos na home, imagem em toda página orgânica, cor de marca em uma seção, mais avisos de ritmo tonal, proporção incoerente com o layout e silhueta repetida. `lintPage` bloqueia tipos/props inválidos, duplicação de singletons, múltiplos heroes, baixa diversidade em páginas longas, ausência de decisões locais no perfil v2, headline estimada acima de 56 caracteres, subtexto acima de 20 palavras, copy genérico, placeholders, travessão e falta de conversão, com exceções para post/obrigado. Ausência de hero/nav/rodapé, orçamento de eyebrows e parte das regras de SEO são avisos. A estimativa textual de headline não mede quebra de linha no navegador. Fonte: `lib/taste/lint.ts`.

## Imagens e logos

A geração acontece no chat do site. `prepare_site_images` chama o estúdio (`lib/images/site-assets.ts`) com o guia do tenant: uma imagem GPT Image 2 por cena, crítica estruturada por imagem e falhas parciais reportadas. Na etapa de cenas a ferramenta aceita uma cena por chamada e exige a vaga que o plano pede; fora da geração aceita até seis por chamada e oito por turno. Ela recusa proporção incoerente com a composição do perfil e devolve o papel de cada cena. O orçamento é reservado antes do primeiro `await` e só é devolvido quando não houve tentativa de geração. `lib/images/generation-lock.ts` usa um advisory lock transacional no Postgres por tenant para recusar chamadas concorrentes, inclusive entre instâncias. Dentro dele a ferramenta relê a cobertura antes de gerar; esse lock não conflita com os locks de linha dos uploads e dispensa migração. O número da imagem é reservado dentro do próprio insert, porque a geração em paralelo colidia na unicidade de `(tenant_id, seq)`.

`lib/images/scene-plan.ts` traduz a direção num plano de vagas, sempre medido em três páginas orgânicas, e `sceneCoverage` casa a biblioteca disponível com essas vagas: primeiro pelo bloco, depois pelo que sobrevive ao recorte. `nextPhase` só fecha a etapa de cenas quando o plano inteiro tem foto disponível.

Logos podem ser criados ou modernizados a partir de referência por `generate_logo`, passam por Sharp e por um crítico específico de legibilidade/fidelidade. Fotos e logos retornam número e URL para uso imediato, sem aprovação. A crítica registra qualidade e problemas, mas não bloqueia a disponibilidade. A aplicação de um logo na marca continua exigindo pedido do usuário.

| Papel                      | Configuração no código                              |
| -------------------------- | --------------------------------------------------- |
| Chat do site               | `EIXU_MODEL` → `google/gemini-3.8-flash`            |
| Revisão visual do rascunho | Chromium + crítico Gemini, habilitados por padrão   |
| Críticos de foto e logo    | `EIXU_CRITIC_MODEL` → `EIXU_MODEL` → mesmo fallback |
| Cenas do site              | Uma chamada a `openai/gpt-image-2` por cena         |
| Logos                      | `openai/gpt-image-2`                                |

A rota do chat tem duração máxima de 800 segundos, com 760 no SDK, e limite de 32 passos na edição livre; as fases usam 12/2/24/32 passos. O último passo da revisão é reservado à conferência, e uma conferência completa sem erros após o refinamento encerra o loop. Modelo, raciocínio `high` e saída por tarefa vêm de `lib/ai/models.ts`; `lib/ai/agent.ts` é compartilhado com os runners. Erro de stream ou fase que não avançou encerra a sequência automática, preservando o progresso. Esses limites não provam conclusão.

O chat preserva quatro turnos recentes completos até 120.000 caracteres, com metadados do provedor. Material anterior vira recibo com erros e pendências, preservando instruções e respostas textuais. O loop ativo não é compactado. `lib/ai/usage.ts` registra modelo, versão do harness, tokens de raciocínio, cache, passos, tempo, motivo de término e custo retornado. A interface soma apenas respostas recebidas desde a abertura; críticos e imagens têm medições separadas. Não há faturamento consolidado por cliente.

Imagens novas são inseridas explicitamente com estado `disponivel`, inclusive
em bancos cujo default antigo continua sendo `candidata`; não é necessária
migração para ativar o fluxo. `candidata` e `aprovada` são estados legados
tratados como disponíveis. `rejeitada` continua no filtro próprio da galeria
e bloqueia publicação se usada. A API da biblioteca edita somente o texto
alternativo por PATCH; não existe ação de aprovar/recusar.

`update_image` resolve o número diretamente por `(tenant_id, seq)`, inclusive
fora das 200 imagens mais recentes da listagem. Usa os pixels originais como
referência, conserva a proporção, gera uma nova imagem numerada e mantém a
original no acervo. A geração compartilha o orçamento de oito imagens do turno
e o lock de cenas. `replaceDraftImage` reconfirma ambas as imagens dentro do
tenant e relê as páginas sob `FOR UPDATE` antes de trocar campos de imagem e
alt por URL exata, em uma transação. Links, textos, SEO, marca e snapshots
publicados não são alterados. A imagem nova continua na biblioteca se a
aplicação falhar, e a ferramenta informa a falha com o novo número.

A galeria mostra as imagens disponíveis e o atalho **Solicitar alteração**:
abre o chat com o número preenchido, sem enviar nem gerar automaticamente.
Remoção verifica uso em rascunhos, publicados e marca; falha no Blob conserva
o registro. Aplicar logo exige um pedido detectado na última mensagem e uma
imagem de tipo logo disponível; por `/settings`, exige logo da biblioteca do
tenant ou upload manual no caminho de logo daquele cliente. A home continua
exigindo duas fotos geradas distintas da biblioteca do tenant. Fontes:
`lib/ai/tools.ts`, `lib/images/queries.ts`, `lib/images/revise.ts`,
`lib/images/replacement.ts`, `lib/sites/generation.ts` e `lib/taste/site.ts`.

## Dados, conversão e tráfego

| Tabela              | Responsabilidade                                                        |
| ------------------- | ----------------------------------------------------------------------- |
| `tenants`           | Identidade, marca, vibe, dials, contatos e guia de imagem               |
| `pages`             | Rascunho, snapshot de blocos/SEO publicado e dados editoriais           |
| `images`            | Biblioteca, sequência por tenant, geração, crítica e disponibilidade    |
| `generation_runs`   | Execução da geração em etapas: estado, fase, saltos e origem            |
| `generation_events` | Linha do tempo que o painel mostra: fases, ferramentas, pausas          |
| `chat_messages`     | Texto da conversa do site; o canal `imagens` só guarda histórico antigo |
| `leads`             | Campos recebidos, origem e consentimento informado                      |
| `events`            | Eventos de primeira parte por tenant/página/campanha                    |
| `campaign_spend`    | Gastos manuais em centavos, com campanha, canal e período               |

O script de atribuição guarda primeiro/último toque, click IDs e identificador de visita em `localStorage`. Preenche campos de formulário e envia eventos para `/api/e`. Formulários nativos passam por honeypot, gravam contato e evento e redirecionam com 303. `/go/wa` registra clique e redireciona para `wa.me`; `?n=` escolhe outro WhatsApp do cadastro, e índice ausente ou inválido usa o principal.

O painel filtra eventos por datas inclusivas no horário de Brasília e calcula visitantes identificados, formulários recebidos e cliques no WhatsApp separadamente. O total de visitantes conta IDs distintos no período, sem somar campanhas. O ID de navegador é persistido em `localStorage`, não representa pessoa nem sessão com expiração. Cliques que passam por `/go/wa` são registrados apenas no redirecionador, com atribuição e ID levados pela URL; links diretos a `wa.me` usam o evento do navegador. A correção não deduplica eventos antigos.

Gastos de todos os canais da mesma campanha são somados, incluindo campanhas sem visita. Entram no custo apenas lançamentos integralmente contidos no filtro; períodos parcialmente sobrepostos são avisados e excluídos, sem rateio presumido. Os totais não dependem do limite de 50 campanhas exibidas. Custo por ação divide gastos por formulários mais cliques, não por pessoas. O CSV contém os últimos 5.000 contatos recebidos por formulário, de todos os períodos, e neutraliza fórmulas de planilha. O schema guarda IDs de GA4/Meta, mas esses campos, sozinhos, não significam integração ativa.

## Limites atuais

- **Conversa simultânea:** o run impede um turno de chat durante a geração, mas duas abas ainda podem abrir dois turnos livres para o mesmo cliente.
- **Exclusão:** definitiva, sem lixeira. O CDN pode servir um arquivo apagado por cerca de um minuto, e uma exclusão durante geração ativa derruba as ferramentas daquele turno por chave estrangeira.
- **Leitura de rede social:** depende do que a rede entrega a robôs e do IP de saída; o Instagram falha com frequência a partir de datacenter. Nome, bio e avatar lidos são material público, não verificação de identidade do cliente.
- **Acesso:** admin global, sem vínculo usuário–tenant ou RLS no schema versionado. Rotas administrativas, chats e rascunhos exigem sessão. Em produção, ausência de segredo e senha impede emissão/validação de sessão. `__tenant` continua disponível para resolver o conteúdo publicado; não autentica. Arquivos no Blob continuam públicos.
- **Domínios e SEO:** o host só resolve tenant em um subdomínio de `eixu.com.br` ou `.localhost`; nomes reservados e hosts numéricos não viram clientes. `lib/site.ts` ainda aponta para o endereço legado `chatgpt.site`, usado no sitemap/robots institucional. Esse endereço institucional não foi alterado pela revisão do admin.
- **Snapshot parcial:** mudar nome, contatos, marca, direção visual ou logo pode afetar o site ao vivo sem publicar páginas. As três cores do cadastro entram nessa categoria: alterá-las repinta o site publicado sem passar por pre-flight. Editar contatos em Dados troca rodapé, mapa e JSON-LD do site publicado na hora. A vibe é escolhida uma vez no cadastro e não tem edição pelo painel: mudá-la exigiria reconstruir as páginas. Título, tipo, metadados de post/inbound e parte do JSON-LD também usam dados compartilhados. As transações de `build_site` e publicação tornam seus lotes atômicos, mas não versionam esses campos.
- **Autorização do agente:** pedido para publicar é uma regra de prompt/tool description; o executor de `publish_page` não valida confirmação estruturada. Não há aprovação de imagens; a troca de logo por `set_site_logo` ainda usa regex sobre a última mensagem, sem garantia de interpretação de negação. As fases de geração não expõem ferramentas de publicação. Não confundir esses mecanismos com autorização formal.
- **Revisão visual:** Chromium captura até 12 páginas, em desktop e mobile, com cookie restrito à origem. O crítico recebe imagens binárias e retorna evidências por página/bloco. Medições de overflow e imagens quebradas entram no relatório. Falha ou cobertura parcial não encerra a geração; `EIXU_REVIEW_CAPTURE=0` só permite diagnóstico estrutural. O recibo em `brief.generation.review` precisa corresponder ao conteúdo, marca, contatos e imagens atuais. Um parecer do crítico não autoriza publicação.
- **Histórico e custos:** persistência textual dos últimos 60 itens por canal, sem trace completo, anexos ou recibos antigos. A compactação não resume decisões do operador. Conversas muito extensas são recusadas; recarregar retoma o histórico recente. Cache depende de provedor, prefixo e janela. O custo mostrado exclui imagens e críticas internas, falhas sem recibo e outras abas; não é uma conta consolidada.
- **Imagens antigas:** candidatas e aprovadas anteriores a esta entrega ficam disponíveis, inclusive as já usadas em página. Rejeitadas antigas permanecem no banco/Blob e no filtro Rejeitadas, fora dos prompts; não há limpeza automática. A listagem mostra as 200 imagens mais recentes; consulta por número não tem esse limite.
- **Medição:** eventos são atribuição de navegador e ações, não pessoas únicas, conversas confirmadas ou receita. Dados anteriores ao release podem conter cliques duplicados; não foram apagados. Gasto é lançamento manual sem conciliação ou integração com anúncios.

A [revisão do admin](admin-review.md) registra a validação desta entrega. Testes de contrato e ensaio controlado não constituem pentest, benchmark universal de qualidade ou geração completa em todos os modelos.

A política atual de identidade, raciocínio, contexto e revisão está em [Harness](harness.md). O recibo usa o JSONB existente; esta revisão não exige migração.
