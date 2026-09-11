# Arquitetura e limites do MVP

Mapa conferido no código em 10/09/2026. Descreve o comportamento implementado; os limites no fim deste arquivo não são funcionalidades entregues.

## Superfícies e dependências

| Superfície         | Rotas e fontes                                                                                                                      |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Institucional      | `/`, `/vibe-coding-para-producao`, `/cases/saldopix`, `/cases/naiacrm`; `app/(main)/`, `components/eixu.tsx`, `lib/site.ts`         |
| Operação           | `/admin`, `/admin/login`, `/admin/[tenant]`; `app/(admin)/admin/actions.ts` e `app/(admin)/admin/[tenant]/workspace.tsx`            |
| Imagens            | `/admin/[tenant]/imagens` (biblioteca), `/api/admin/[tenant]/images` e `/api/admin/[tenant]/upload`; a geração vive no chat do site |
| Dados e briefing   | `/admin/[tenant]/dados`, `/api/admin/[tenant]/settings`; validação em `lib/admin/tenant-input.ts`                                   |
| Tráfego e contatos | `/admin/[tenant]/trafego`, `/api/admin/[tenant]/contatos.csv`                                                                       |
| Site de cliente    | Host do tenant → `proxy.ts` → `/s/[tenant]/[[...slug]]`, com sitemap e robots próprios                                              |
| Conversão          | `/api/form`, `/api/e`, `/go/wa`; `lib/tracking.ts`                                                                                  |

Next.js roda páginas, Server Actions e Route Handlers. `lib/db.ts` cria o cliente Neon sob demanda; importar módulos no build não exige conexão ativa. O schema está em `db/schema.sql`, sem ORM. Imagens ficam em Blob público, e o banco guarda URL, estado, crítica e referência. O AI SDK usa o AI Gateway para modelos de texto e imagem.

O [contrato visual](design.md) descreve variantes, dials, âncoras e a aplicação das duas skills no gerador. Os grupos `(main)`, `(admin)` e `(sites)` têm layouts raiz e folhas de estilo próprios. O institucional usa componentes e efeitos próprios; os sites gerados combinam blocos renderizados no servidor, componentes interativos de Framer Motion, HTML nativo e um script de atribuição.

## Edição e publicação

1. O operador autentica em `lib/auth.ts`: cookie `eixu_admin`, HMAC e validade de 12 horas. As páginas administrativas, ações e APIs verificam a sessão.
2. A criação do tenant grava nome, slug, contatos e o briefing estruturado do formulário (segmento, região, público, oferta, objetivo, fatos confirmados, restrições e referências) em `tenants.brief.intake`, validado por `lib/tenant-intake.ts`. O mesmo formulário grava a marca em `tenants.brand`: cor primária em `accent`, secundária em `accentAlt`, acento em `highlight` e `paletteSource: 'operador'`. O logo opcional sobe ao Blob por `storeTenantFile` antes do insert, porque a rota de upload exige um cliente existente; endereço duplicado recusa o cadastro e apaga o arquivo. O workspace reidrata em `useChat` as 60 mensagens textuais mais recentes do canal, na ordem cronológica; cada envio inclui esse histórico e as mensagens novas, além de tenant e página em foco. Slug duplicado é recusado sem abrir ou sobrescrever o cliente existente.
3. A rota resolve o tenant, inclui intake, briefing e direção no prompt e oferece `buildTools(tenant, { origin, cookie })`. Com `phase` no corpo, ela abre só as ferramentas daquela etapa (`lib/taste/phases.ts`), ajusta o limite de passos, poda o contexto e recusa a fase que não tem o estado que ela pressupõe. Em site novo ou reconstrução, `read_reference` lê as referências informadas e registra o que ficou inacessível, `define_image_guide` fixa a direção de imagem, `set_design` persiste o perfil v2 preservando as cores do cadastro, `prepare_site_images` gera uma cena por requisição na etapa de cenas, `review_pages` mede o rascunho renderizado e `build_site` aceita até 12 páginas com 1–20 blocos por página, incluindo intenção/etapa de inbound em `meta`. `generate_logo` e `set_site_logo` também vivem no chat do site; aplicar logo exige pedido detectado na última mensagem do operador. Ferramentas menores leem, alteram, movem ou removem blocos. As páginas são resolvidas dentro do tenant.
4. Schemas e catálogo vivem em `lib/blocks/registry.ts`; o perfil e as assinaturas ficam em `lib/design/`; `lib/blocks/render.tsx` despacha para componentes de servidor e de interação. `build_site` valida páginas, contrato de projeto e duplicação da home antes de gravar o lote em uma transação. Um lote recusado fica apenas na memória da instância de ferramentas daquele tenant e turno; `repair_site` altera campos por slug/índice, revalida tudo pelo mesmo caminho e só grava se válido. Não altera snapshots nem páginas fora do lote e não publica. Edições menores ainda podem salvar rascunho inválido, que é omitido no render e apontado por `lintPage`.
5. O painel atualiza `/api/admin/[tenant]/state` após ferramentas de mutação e recarrega o iframe com `preview=1&__tenant=...`. Servidor e API usam `workspaceState`, incluindo pendências globais e comparação de blocos **e SEO** com o snapshot. Consultas de leitura não recarregam a prévia. O modo de rascunho exige sessão, recebe `noindex`, preserva o tenant nos links e desativa formulários e tracking. O cookie é passado somente ao capturador interno; não entra no prompt.
6. `publish_page`, `publish_site` e a API `/api/admin/[tenant]/publish` usam `lib/sites/publish.ts`. O serviço executa `lintPage`, `lintSite` e a trava estrutural antes de copiar os valores validados de `blocks`/`seo` para o snapshot em uma única transação. Um erro recusa o lote inteiro. Na publicação pontual, páginas fora do lote contam pelo snapshot publicado. O painel recebe também os erros de projeto e desabilita seu botão quando há erros.
7. A página pública usa os blocos publicados; sem publicação, retorna 404. Marca, título, tipo e `meta` não têm uma versão publicada própria.

`lintSite` também aplica o piso de composição de `lib/taste/metrics.ts`: seção protagonista com duas fotos na home, imagem em toda página orgânica, cor de marca em uma seção, mais avisos de ritmo tonal, proporção incoerente com o layout e silhueta repetida. `lintPage` bloqueia tipos/props inválidos, duplicação de singletons, múltiplos heroes, baixa diversidade em páginas longas, ausência de decisões locais no perfil v2, headline estimada acima de 56 caracteres, subtexto acima de 20 palavras, copy genérico, placeholders, travessão e falta de conversão, com exceções para post/obrigado. Ausência de hero/nav/rodapé, orçamento de eyebrows e parte das regras de SEO são avisos. A estimativa textual de headline não mede quebra de linha no navegador. Fonte: `lib/taste/lint.ts`.

## Imagens e logos

A geração acontece no chat do site. `prepare_site_images` chama o estúdio (`lib/images/site-assets.ts`) com o guia do tenant: uma candidata GPT Image 2 por cena, crítica estruturada por imagem e falhas parciais reportadas. Na etapa de cenas a ferramenta aceita uma cena por chamada e exige a vaga que o plano pede; fora da geração aceita até seis por chamada e oito por turno. Ela recusa proporção incoerente com a composição do perfil e devolve o papel de cada cena. O número da imagem é reservado dentro do próprio insert, porque a geração em paralelo colidia na unicidade de `(tenant_id, seq)`.

`lib/images/scene-plan.ts` traduz a direção num plano de vagas, sempre medido em três páginas orgânicas, e `sceneCoverage` casa a biblioteca aprovada com essas vagas: primeiro pelo bloco, depois pelo que sobrevive ao recorte. `nextPhase` só fecha a etapa de cenas quando o plano inteiro tem foto aprovada.

Logos podem ser criados ou modernizados a partir de referência por `generate_logo`, passam por Sharp e por um crítico específico de legibilidade/fidelidade. Nenhuma dessas ferramentas devolve a URL da imagem: a candidata não pode entrar no rascunho antes da decisão do operador.

| Papel                      | Configuração no código                               |
| -------------------------- | ---------------------------------------------------- |
| Chat do site               | `EIXU_MODEL` → `anthropic/claude-opus-4.5`           |
| Revisão visual do rascunho | Chromium na função, atrás de `EIXU_REVIEW_CAPTURE=1` |
| Críticos de foto e logo    | `EIXU_CRITIC_MODEL` → `EIXU_MODEL` → mesmo fallback  |
| Cenas do site              | Uma chamada a `openai/gpt-image-2` por cena          |
| Logos                      | `openai/gpt-image-2`                                 |

A rota do chat tem duração máxima de 300 segundos e limite de 30 passos na edição livre; as fases usam 6/2/12/10 passos. Erro de stream ou fase que não avançou encerra a sequência automática, preservando o progresso. Esses limites não provam conclusão.

O chat compacta resultados de ferramentas e anexos de **turnos anteriores**, preservando todas as instruções e respostas textuais; o loop ativo permanece intacto. Estado atual pode ser relido pelas ferramentas. `lib/ai/usage.ts` habilita cache automático do Gateway e registra modelo, fase, tokens, cache, passos, tempo e custo retornado. A interface soma somente as respostas recebidas desde a abertura; histórico textual não restaura esses recibos. Chamadas internas de imagens/críticos têm custo separado. Não existe faturamento consolidado por cliente.

O estado da biblioteca é `candidata`, `aprovada` ou `rejeitada`. A candidata aparece no painel para a decisão do operador, uma por vez: aprovar muda o estado pela API da biblioteca, recusar apaga Blob e registro. Uma candidata já referenciada em página não pode ser apagada; ela fica rejeitada e o bloco precisa ser trocado. Falha ao apagar o Blob mantém o registro da imagem e retorna erro. Remoção verifica uso nos blocos de rascunho, publicados e na marca.

O agente recebe apenas fotos aprovadas, com URL, mais a contagem do que aguarda decisão; `prepare_site_images`, `generate_logo` e `list_images` não devolvem URL de candidata. A rota recusa a fase de cenas enquanto houver imagem pendente. Aplicar logo exige um pedido detectado na última mensagem do operador e imagem de tipo logo já aprovada; por `/settings`, exige logo aprovado da biblioteca do tenant ou arquivo enviado manualmente ao caminho de logo daquele cliente. A home exige duas fotos geradas distintas da biblioteca do tenant; uploads não completam esse mínimo. Fontes: `lib/ai/tools.ts`, `lib/images/queries.ts`, `lib/sites/generation.ts`, `lib/taste/site.ts` e `app/api/admin/[tenant]/images/route.ts`.

## Dados, conversão e tráfego

| Tabela           | Responsabilidade                                                        |
| ---------------- | ----------------------------------------------------------------------- |
| `tenants`        | Identidade, marca, dials, contatos e guia de imagem                     |
| `pages`          | Rascunho, snapshot de blocos/SEO publicado e dados editoriais           |
| `images`         | Biblioteca, sequência por tenant, geração, crítica e aprovação          |
| `chat_messages`  | Texto da conversa do site; o canal `imagens` só guarda histórico antigo |
| `leads`          | Campos recebidos, origem e consentimento informado                      |
| `events`         | Eventos de primeira parte por tenant/página/campanha                    |
| `campaign_spend` | Gastos manuais em centavos, com campanha, canal e período               |

O script de atribuição guarda primeiro/último toque, click IDs e identificador de visita em `localStorage`. Preenche campos de formulário e envia eventos para `/api/e`. Formulários nativos passam por honeypot, gravam contato e evento e redirecionam com 303. `/go/wa` registra clique e redireciona para `wa.me`.

O painel filtra eventos por datas inclusivas no horário de Brasília e calcula visitantes identificados, formulários recebidos e cliques no WhatsApp separadamente. O total de visitantes conta IDs distintos no período, sem somar campanhas. O ID de navegador é persistido em `localStorage`, não representa pessoa nem sessão com expiração. Cliques que passam por `/go/wa` são registrados apenas no redirecionador, com atribuição e ID levados pela URL; links diretos a `wa.me` usam o evento do navegador. A correção não deduplica eventos antigos.

Gastos de todos os canais da mesma campanha são somados, incluindo campanhas sem visita. Entram no custo apenas lançamentos integralmente contidos no filtro; períodos parcialmente sobrepostos são avisados e excluídos, sem rateio presumido. Os totais não dependem do limite de 50 campanhas exibidas. Custo por ação divide gastos por formulários mais cliques, não por pessoas. O CSV contém os últimos 5.000 contatos recebidos por formulário, de todos os períodos, e neutraliza fórmulas de planilha. O schema guarda IDs de GA4/Meta, mas esses campos, sozinhos, não significam integração ativa.

## Limites atuais

- **Acesso:** admin global, sem vínculo usuário–tenant ou RLS no schema versionado. Rotas administrativas, chats e rascunhos exigem sessão. Em produção, ausência de segredo e senha impede emissão/validação de sessão. `__tenant` continua disponível para resolver o conteúdo publicado; não autentica. Arquivos no Blob continuam públicos.
- **Domínios e SEO:** o host só resolve tenant em um subdomínio de `eixu.com.br` ou `.localhost`; nomes reservados e hosts numéricos não viram clientes. `lib/site.ts` ainda aponta para o endereço legado `chatgpt.site`, usado no sitemap/robots institucional. Esse endereço institucional não foi alterado pela revisão do admin.
- **Snapshot parcial:** mudar nome, contatos, marca, direção visual ou logo pode afetar o site ao vivo sem publicar páginas. As três cores do cadastro entram nessa categoria: alterá-las repinta o site publicado sem passar por pre-flight. Título, tipo, metadados de post/inbound e parte do JSON-LD também usam dados compartilhados. As transações de `build_site` e publicação tornam seus lotes atômicos, mas não versionam esses campos.
- **Autorização do agente:** pedido para publicar é uma regra de prompt/tool description; o executor de `publish_page` não valida confirmação estruturada. A aprovação de imagem saiu do agente e virou ação de painel, mas a troca de logo por `set_site_logo` ainda usa regex sobre a última mensagem, sem garantia de interpretação de negação. As fases de geração não expõem ferramentas de publicação. Não confundir esses mecanismos com autorização formal.
- **Revisão visual:** `review_pages` sempre devolve apontamentos estruturais. Com `EIXU_REVIEW_CAPTURE=1`, abre o rascunho em Chromium com o cookie da requisição e acrescenta medidas do navegador. As capturas não voltam ao modelo como imagem. O ambiente precisa permitir Chromium e acesso ao próprio preview.
- **Histórico e custos:** persistência textual dos últimos 60 itens por canal, sem trace completo, anexos ou recibos antigos. A compactação não resume decisões do operador. Conversas muito extensas são recusadas; recarregar retoma o histórico recente. Cache depende de provedor, prefixo e janela. O custo mostrado exclui imagens e críticas internas, falhas sem recibo e outras abas; não é uma conta consolidada.
- **Imagens antigas:** candidatas anteriores a esta entrega voltam na fila de decisão do painel, inclusive as já usadas em página. Imagens rejeitadas de antes continuam no banco e no Blob, fora da biblioteca e dos prompts; não há rotina de limpeza.
- **Medição:** eventos são atribuição de navegador e ações, não pessoas únicas, conversas confirmadas ou receita. Dados anteriores ao release podem conter cliques duplicados; não foram apagados. Gasto é lançamento manual sem conciliação ou integração com anúncios.

A [revisão do admin](admin-review.md) registra a validação desta entrega. Testes de contrato e ensaio controlado não constituem pentest, benchmark universal de qualidade ou geração completa em todos os modelos.
