# Arquitetura e limites do MVP

Mapa do admin e da geração atualizado em 11/09/2026. Descreve o comportamento implementado; os limites no fim deste arquivo não são funcionalidades entregues.

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

## Composição administrativa

O layout raiz consulta a sessão antes de montar a casca e entrega identidade do
operador e formulário de saída por contexto, desenhados nos cabeçalhos.
`adminTenant` deduplica a resolução do cliente durante o render com React
`cache`, sem persistir entre sessões. O
layout de `[tenant]` repete a autenticação e fornece cabeçalho e abas. O editor
insere suas ações no cabeçalho por um portal React, conservando a decisão de
publicação junto ao estado vivo do workspace. Publicar atualiza também os
layouts; a tela Dados faz o mesmo após salvar o cadastro. Quando a sessão vence,
as páginas guardam o caminho administrativo em `returnTo` e o login retorna à
tela de origem depois de validar que o destino permanece sob `/admin`.

`operationSummary` agrega leads de 30 dias e execuções ativas para a operação
global. A série de tráfego usa o ID do tenant, datas inclusivas de Brasília,
dias sem evento preenchidos com zero e deduplicação por navegador/dia. Contatos
na série exigem visita e ação no mesmo dia; cartões continuam mostrando ações
brutas e visitantes distintos do período. O limite de 366 dias restringe a
série. O relatório de tráfego não mudou nesta entrega.

O parâmetro `pedido` do editor preenche até 2.000 caracteres da conversa; não
envia mensagem sozinho. A imagem numerada em `imagem` tem precedência. O
formulário Dados conserva um snapshot local do último salvamento para
contagem de alterações e confirmação ao sair; nome, contatos, logo e vibe são
alterações do rascunho e só chegam ao site público na próxima publicação. A
biblioteca calcula referências exatas em blocos e logos do rascunho e do
snapshot publicado; seu atalho abre a conversa com o número da imagem, sem
presumir página ou hero.

## Edição e publicação

A leitura em `lib/tenant-queries.ts` recupera o WhatsApp legado e a rede de
`brief.intake.socialUrl` para clientes anteriores a `contacts`. A rede só é
recuperada quando a chave `contacts.social` ainda não existe; uma lista vazia
gravada pelo operador prevalece. Assim, o primeiro salvamento em Dados
conserva o perfil e o avatar, sem impedir a remoção explícita. Telefones
preservam o `+` informado em `contacts`; a coluna `whatsapp` e os destinos de
WhatsApp continuam recebendo apenas dígitos.

1. O operador autentica em `lib/auth.ts`: cookie `eixu_admin`, HMAC e validade de 12 horas. As páginas administrativas, ações e APIs verificam a sessão.
2. A criação do tenant exige nome, slug, oferta e ação principal. O primeiro bloco mostra esses dados e a escolha visual; público, região, evidências, restrições, referências, contatos, logo e cores ficam em seções opcionais. O intake validado permanece em `tenants.brief.intake`. Telefones, endereços e redes sociais vão para `tenants.contacts`; o primeiro WhatsApp é derivado para `tenants.whatsapp`, e a primeira rede suportada alimenta a leitura de perfil. Cada vibe mostra uma amostra comparável e uma paleta sugerida. `paletteSource` só vira `operador` quando uma cor é editada; a sugestão pode ser adaptada pela direção de arte. Referências visuais verificadas decidem tipografia, imagens, ritmo e superfície, e suas decisões ficam em `brand.design.referenceDirection`; cada aspecto documentado libera só os eixos daquele aspecto. A vibe define a gramática da composição, o motivo e a voz. O logo opcional sobe ao Blob antes do insert e é limpo se o cadastro falhar. O workspace reidrata as 60 mensagens textuais mais recentes do canal. Slug duplicado é recusado sem abrir ou sobrescrever o cliente existente.
3. A interface apresenta três etapas: **Preparar**, **Criar** e **Conferir**. O servidor preserva quatro checkpoints (`briefing`, `cenas`, `composicao`, `revisao`) para retomar com precisão. Preparar lê referências com captura desktop/mobile, registra observações e lacunas, fixa o guia e persiste o perfil visual v4, o plano editorial e pedidos semânticos para todas as vagas de imagem. Se esses pedidos estão válidos, o runner executa `prepare_site_images` diretamente, sem um turno do coordenador apenas para repetir o plano. Criar monta até 12 páginas com 1–20 blocos e aplica a voz da vibe em linguagem simples; Conferir valida estrutura, texto, referências e pixels. O chat livre ainda oferece logos e ferramentas menores, sempre resolvidas dentro do tenant.
4. Schemas e catálogo vivem em `lib/blocks/registry.ts`; o perfil, a gramática por vibe e as assinaturas ficam em `lib/design/`; `lib/blocks/render.tsx` despacha para componentes de servidor e de interação. `build_site` valida páginas, contrato de projeto e a silhueta da home contra os outros clientes antes de gravar o lote em uma transação. Um lote recusado fica apenas na memória da instância de ferramentas daquele tenant e turno; `repair_site` altera campos por slug/índice, revalida tudo pelo mesmo caminho e só grava se válido. Não altera snapshots nem páginas fora do lote e não publica. Edições menores ainda podem salvar rascunho inválido, que é omitido no render e apontado por `lintPage`.
5. O painel atualiza `/api/admin/[tenant]/state` após mutações e recarrega o iframe somente quando `previewFingerprint` detecta mudança renderizada. Briefing operacional, recibos e imagens fora das páginas não recarregam a prévia. `workspaceState` distingue alteração global e por página, compara blocos e SEO com o snapshot e entrega cobertura, evidência, bloco e correção da revisão. O modo de rascunho exige sessão, recebe `noindex`, preserva o tenant nos links e desativa formulários e tracking. O cookie é passado somente ao capturador interno; não entra no prompt.
6. `publish_page`, `publish_site` e `/api/admin/[tenant]/publish` usam `lib/sites/publish.ts`. O serviço executa `lintPage`, `lintSite` e a trava estrutural antes de promover, na mesma transação, blocos, SEO, título, tipo, metadados, ordem de navegação e a apresentação global do tenant. Só erros recusam o lote inteiro; avisos permanecem no painel e no relatório. A resposta agrupa todos os motivos por página. Uma publicação pontual posterior preserva a apresentação global já publicada e usa essa marca nos três validadores. A publicação completa, ou a primeira sem snapshot, valida e promove a marca atual do rascunho.
7. A página pública exige blocos publicados e combina `published_blocks`/`published_seo` com os campos editoriais publicados e `tenants.published_snapshot`. A migração inicializa esses campos com a apresentação que já estava no ar. Mudar vibe, marca, nome, contatos ou logo no rascunho não redesenha o site publicado.

A geração em etapas não passa pelo chat. `POST /api/admin/[tenant]/generation` cria um run em `generation_runs` — um ativo por cliente, garantido por índice parcial — e envia run, slug e salto à Vercel Queues. O consumidor privado `/api/queues/generation`, registrado em `vercel.json`, reconfirma o tenant e reserva atomicamente o salto antes de executar a fase, com `maxDuration` de 800 segundos. A fila entrega uma invocação independente e espera a conclusão do trabalho; evita a recursão HTTP que causava 508. A chave de idempotência combina run e salto, e o banco impede trabalho duplicado mesmo em entregas simultâneas. Falha de envio só encerra a reserva que ainda pertence ao remetente. Localmente, `/api/admin/[tenant]/generation/step` mantém HTTP assinado, resposta 202 e `after()`, compartilhando `lib/generation/step.ts` com a fila.

`lib/generation/runner.ts` monta o mesmo agente, ferramentas e prompt do chat (`lib/generation/context.ts`), exceto no lote de cenas já planejado, executado diretamente. Autentica a captura com uma sessão emitida no servidor e grava início/fim de fase e ferramenta em `generation_events`, correlacionando cada chamada por ID e duração. Eventos incluem versão do fluxo/harness, modelo, SHA, espera de fila e motivo de parada; captura e crítico registram seu avanço em unidades. Ao terminar, `generationState` decide o próximo salto. O banco continua sendo a fonte do progresso e da retomada.

`GET` devolve run, eventos, estado, `previewRevision`, a hora do servidor e as mensagens gravadas desde um id. A hora sincroniza os cronômetros sem depender da configuração do aparelho. O cursor vem do último registro entregue e lotes de 60 são drenados sem saltar mensagens. Mensagens internas que abrem uma fase não são persistidas como pedidos do operador. Enquanto um run está ativo, `/api/chat` responde 409. O `GET` informa ainda `everRan`; com ele, o painel inicia sozinho apenas um cliente sem tentativa, conversa ou página anterior.

Fora dos blocos, o render monta duas coisas a partir do cadastro. O rodapé recebe uma coluna de contato com e-mail, telefones (WhatsApp pelo redirecionador rastreado, comum em `tel:`) e redes sociais com ícone. Com endereço cadastrado, `lib/blocks/location.tsx` acrescenta a seção "Onde estamos" como último elemento de `<main>`, com o endereço, o link de rota e o mapa do Google carregado sob demanda; acima de um endereço, uma ilha de cliente alterna entre eles e o conteúdo continua legível sem JavaScript. A âncora `onde-estamos` é reservada antes dos blocos e `lintPage` recusa um bloco que tente usá-la. Post e obrigado não recebem a seção. Nada disso entra em `pages.blocks`, no catálogo ou na assinatura de composição: é dado do operador, como o botão flutuante de WhatsApp.

O perfil de rede social informado é lido fora da resposta, por `after()`, na criação e quando o campo muda no PATCH de `/settings`; `/api/admin/[tenant]/social` refaz a leitura sob pedido do operador. `lib/social-profile.ts` normaliza `@handle` e URL de Instagram ou página de empresa do LinkedIn, e `lib/ai/social.ts` lê nome, bio, seguidores e avatar das meta tags, copia o avatar para `tenants/<slug>/social/` no Blob e descreve a imagem pelo modelo crítico, com uma chamada por avatar novo (comparado por hash). O resultado fica em `tenants.brief.social`, separado de `intake`, com estado `lendo`, `ok` ou `inacessivel` e o motivo. Cada leitura recebe um `readId`; o resultado só é gravado se esse ID e a URL do intake continuarem vigentes. Troca, remoção ou releitura invalidam respostas anteriores, e um upload descartado é removido. O avatar anterior permanece referenciado durante a leitura para reutilização ou limpeza após a troca. A leitura é melhor esforço: o LinkedIn responde 999 em perfil pessoal e o Instagram devolve a tela de login em boa parte das contas; nesses casos o prompt recebe a instrução de tratar o perfil como lacuna. `read_reference` reaproveita esse registro por 24 horas em vez de reabrir a rede. Cada escritor de `brief` mescla apenas suas próprias chaves: intake, fontes, progresso, perfil ou briefing consolidado. O chat do site recebe tanto o intake e o perfil quanto as evidências, restrições e lacunas do briefing consolidado.

A exclusão de cliente em `/admin` e em Dados usa `deleteTenantAction`: adquire `FOR UPDATE` na linha do tenant, reconfirma estado e contatos, apaga o prefixo `tenants/<slug>/` no Blob e só então remove o registro na mesma transação. `pages`, `leads`, `events`, `campaign_spend`, `chat_messages` e `images` caem por `on delete cascade`. Todos os uploads do produto (fotos, logos, anexos e avatar social) usam `putTenantBlob`, que mantém `FOR KEY SHARE` durante o envio; o logo do cadastro é a exceção, porque sobe antes de existir linha para travar: a exclusão espera puts em andamento, e um upload que chega depois dela não encontra a linha nem grava arquivos. `lib/db.ts` mantém consultas comuns por HTTP e abre uma conexão WebSocket Neon por transação interativa, fechada no mesmo pedido, sem migração de schema. Os locks são de linha, portanto outros tenants continuam operando. Falha no Blob preserva o cadastro; uma limpeza parcial pode ser repetida. Cliente publicado ou com contato recebido exige o endereço digitado, conferido de novo dentro do lock. Não há lixeira nem restauração.

`lintSite` também aplica o piso de composição de `lib/taste/metrics.ts`: seção protagonista com duas fotos na home, imagem em toda página orgânica, cor de marca em uma seção, mais avisos de ritmo tonal, proporção incoerente com o layout e silhueta repetida. No perfil v4 aplica também a gramática da vibe: abertura e seção protagonista da home são erro, aberturas internas, fechamentos e seções vetadas são aviso. `lintPage` bloqueia tipos/props inválidos, duplicação de singletons, múltiplos heroes, baixa diversidade em páginas longas, ausência de decisões locais no perfil versionado, headline estimada acima de 56 caracteres, subtexto acima de 20 palavras, copy genérico, placeholders, travessão e falta de conversão, com exceções para post/obrigado. Ausência de hero/nav/rodapé, orçamento de eyebrows e parte das regras de SEO são avisos. A estimativa textual de headline não mede quebra de linha no navegador. Fonte: `lib/taste/lint.ts`.

## Imagens e logos

A geração acontece no estúdio compartilhado com o chat. `prepare_site_images` recebe todas as vagas ausentes numa chamada e executa lotes concorrentes de até três cenas: uma imagem GPT Image 2 por cena, crítica estruturada e falhas parciais reportadas. Fora da geração aceita até seis cenas por chamada e oito por turno. Recusa proporção incoerente, reserva o orçamento antes do primeiro `await` e devolve apenas o que não chegou a tentar. O advisory lock por tenant impede lotes concorrentes; dentro dele a cobertura é relida antes de gerar. O número da imagem é reservado no próprio insert.

`lib/images/scene-plan.ts` traduz a direção num plano de vagas, sempre medido em três páginas orgânicas. O briefing novo anexa assunto e página a cada vaga; `sceneCoverage` casa a biblioteca disponível primeiro pelo bloco e depois pelo recorte. `nextPhase` só fecha a etapa quando o plano inteiro tem foto disponível.

Logos podem ser criados ou modernizados a partir de referência por `generate_logo`, passam por Sharp e por um crítico específico de legibilidade/fidelidade. Fotos e logos retornam número e URL para uso imediato, sem aprovação. A crítica registra qualidade e problemas, mas não bloqueia a disponibilidade. A aplicação de um logo na marca continua exigindo pedido do usuário.

| Papel                      | Configuração no código                              |
| -------------------------- | --------------------------------------------------- |
| Chat do site               | `EIXU_MODEL` → `google/gemini-3.8-flash`            |
| Revisão visual do rascunho | Chromium + crítico Gemini, habilitados por padrão   |
| Críticos de foto e logo    | `EIXU_CRITIC_MODEL` → `EIXU_MODEL` → mesmo fallback |
| Cenas do site              | Uma chamada a `openai/gpt-image-2` por cena         |
| Logos                      | `openai/gpt-image-2`                                |

A rota do chat tem duração máxima de 800 segundos, com 760 no SDK, e limite de 32 passos na edição livre; os checkpoints usam 12/4/24/32 passos. A revisão admite uma avaliação e uma conferência focal por turno. A primeira avaliação completa sem erro material já encerra; sugestões opcionais permanecem no relatório. Modelo, raciocínio `high` e saída por tarefa vêm de `lib/ai/models.ts`; `lib/ai/agent.ts` é compartilhado com os runners.

No servidor, Conferir tem uma única passagem por geração: uma avaliação e, quando houver reparo, uma conferência focal dentro do mesmo turno. Indisponibilidade encerra a tentativa imediatamente; limite ou pendências não abrem outro turno. O rascunho entregue recebe `brief.generation.delivery` com fingerprint e data, separado de `brief.generation.review`. A entrega atual encerra a geração sem marcar a revisão como aprovada; alterações no rascunho invalidam o recibo de entrega. Erros determinísticos continuam bloqueando publicação. `review_pages` executa pre-flight antes de pixels, reaproveita recibos por página e recaptura somente páginas sem cobertura atual. Um Chromium atende o lote, duas páginas por vez; cada viewport espera fontes/imagens, tem repetição local e preserva capturas boas quando outro alvo falha. Achados mantêm ID, página, bloco, viewport, evidência, correção e estado. Erro material cuja âncora veio inválida continua como pendência técnica. O certificado só é atual quando todas as páginas têm desktop e mobile da versão vigente.

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

A galeria mostra as imagens disponíveis, onde cada URL aparece no rascunho e
no publicado, e dois atalhos: **Usar no site** e **Solicitar alteração** abrem
o chat com o número preenchido, sem enviar nem gerar automaticamente.
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
| `tenants`           | Identidade, rascunho e snapshot da apresentação global                  |
| `pages`             | Rascunho e snapshot publicado de conteúdo, SEO e dados editoriais       |
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
- **Snapshot:** publicações novas versionam apresentação global, título, tipo, metadados e ordem junto de blocos/SEO. O schema cria um snapshot inicial para clientes e páginas que já estavam publicados; a aplicação da migração precisa anteceder o código. GA4 e Meta Pixel continuam cadastro operacional fora do snapshot visual.
- **Autorização do agente:** pedido para publicar é uma regra de prompt/tool description; o executor de `publish_page` não valida confirmação estruturada. Não há aprovação de imagens; a troca de logo por `set_site_logo` ainda usa regex sobre a última mensagem, sem garantia de interpretação de negação. As fases de geração não expõem ferramentas de publicação. Não confundir esses mecanismos com autorização formal.
- **Revisão visual:** Chromium captura até 12 páginas, em desktop e mobile, com cookie restrito à origem. O crítico recebe imagens binárias e retorna evidências por página/bloco. Medições de overflow e imagens quebradas entram no relatório. Falha ou cobertura parcial não encerra a geração; `EIXU_REVIEW_CAPTURE=0` só permite diagnóstico estrutural. O recibo v2 é incremental e precisa cobrir cada página e imagem usada da versão atual. Um parecer do crítico não autoriza publicação.
- **Histórico e custos:** persistência textual dos últimos 60 itens por canal, sem trace completo, anexos ou recibos antigos. A compactação não resume decisões do operador. Conversas muito extensas são recusadas; recarregar retoma o histórico recente. Cache depende de provedor, prefixo e janela. O custo mostrado exclui imagens e críticas internas, falhas sem recibo e outras abas; não é uma conta consolidada.
- **Imagens antigas:** candidatas e aprovadas anteriores a esta entrega ficam disponíveis, inclusive as já usadas em página. Rejeitadas antigas permanecem no banco/Blob e no filtro Rejeitadas, fora dos prompts; não há limpeza automática. A listagem mostra as 200 imagens mais recentes; consulta por número não tem esse limite.
- **Medição:** eventos são atribuição de navegador e ações, não pessoas únicas, conversas confirmadas ou receita. Dados anteriores ao release podem conter cliques duplicados; não foram apagados. Gasto é lançamento manual sem conciliação ou integração com anúncios.

A [revisão do admin](admin-review.md) registra a validação desta entrega. Testes de contrato e ensaio controlado não constituem pentest, benchmark universal de qualidade ou geração completa em todos os modelos.

A política atual de identidade, raciocínio, contexto e revisão está em [Harness](harness.md). O recibo continua no JSONB existente; o snapshot completo exige reaplicar `db/schema.sql` antes do código que lê as novas colunas.
