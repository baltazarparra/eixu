# Arquitetura e limites do MVP

Mapa conferido no código em 09/09/2026. Descreve o comportamento implementado; os limites no fim deste arquivo não são funcionalidades entregues.

## Superfícies e dependências

| Superfície         | Rotas e fontes                                                                                                              |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| Institucional      | `/`, `/vibe-coding-para-producao`, `/cases/saldopix`, `/cases/naiacrm`; `app/(main)/`, `components/eixu.tsx`, `lib/site.ts` |
| Operação           | `/admin`, `/admin/login`, `/admin/[tenant]`; `app/(admin)/admin/actions.ts` e `app/(admin)/admin/[tenant]/workspace.tsx`    |
| Imagens            | `/admin/[tenant]/imagens`, `/api/images/chat`, `/api/admin/[tenant]/images` e `/api/admin/[tenant]/upload`                  |
| Tráfego e contatos | `/admin/[tenant]/trafego`, `/api/admin/[tenant]/contatos.csv`                                                               |
| Site de cliente    | Host do tenant → `proxy.ts` → `/s/[tenant]/[[...slug]]`, com sitemap e robots próprios                                      |
| Conversão          | `/api/form`, `/api/e`, `/go/wa`; `lib/tracking.ts`                                                                          |

Next.js roda páginas, Server Actions e Route Handlers. `lib/db.ts` cria o cliente Neon sob demanda; importar módulos no build não exige conexão ativa. O schema está em `db/schema.sql`, sem ORM. Imagens ficam em Blob público, e o banco guarda URL, estado, crítica e referência. O AI SDK usa o AI Gateway para modelos de texto e imagem.

O [contrato visual](design.md) descreve variantes, dials, âncoras e a aplicação das duas skills no gerador. Os grupos `(main)`, `(admin)` e `(sites)` têm layouts raiz e folhas de estilo próprios. O institucional usa componentes e efeitos próprios; os sites gerados usam blocos renderizados no servidor, HTML nativo e um script de atribuição.

## Edição e publicação

1. O operador autentica em `lib/auth.ts`: cookie `eixu_admin`, HMAC e validade de 12 horas. As páginas administrativas, ações e APIs verificam a sessão.
2. A criação do tenant grava nome, slug e contatos. O workspace carrega páginas e histórico textual do canal `site`; `useChat` envia a conversa da sessão atual para `/api/chat`, junto de tenant e página em foco.
3. A rota resolve o tenant, inclui briefing/direção no prompt e oferece `buildTools(tenant)`. Em site novo ou reconstrução, `set_design` persiste o perfil v2 e `build_site` aceita até 12 páginas com 1–20 blocos por página; ferramentas menores leem, alteram, movem ou removem blocos. As páginas são resolvidas dentro do tenant.
4. Schemas e catálogo vivem em `lib/blocks/registry.ts`; o perfil e as assinaturas ficam em `lib/design/`; `lib/blocks/render.tsx` despacha para `lib/blocks/components.tsx`. `build_site` recusa o lote inteiro antes de escrever quando o pre-flight falha ou a home duplica outra composição. Edições menores ainda podem salvar rascunho inválido, que é omitido no render e apontado por `lintPage`.
5. O painel atualiza `/api/admin/[tenant]/state` após resultados das ferramentas e recarrega o iframe com `preview=1&__tenant=...`.
6. A ferramenta `publish_page` e a API `/api/admin/[tenant]/publish` executam `lintPage` e a trava estrutural da home antes de copiar `blocks`/`seo` para `published_blocks`/`published_seo`. A API pode publicar páginas válidas e retornar outras em `blocked`: o lote não é uma transação única. O painel desabilita seu botão se houver erros.
7. A página pública usa os blocos publicados; sem publicação, retorna 404. Marca, título, tipo e `meta` não têm uma versão publicada própria.

`lintPage` bloqueia tipos/props inválidos, duplicação de singletons, múltiplos heroes, baixa diversidade em páginas longas, ausência de decisões locais no perfil v2, headline estimada acima de 56 caracteres, subtexto acima de 20 palavras, copy genérico, placeholders, travessão e falta de conversão, com exceções para post/obrigado. Ausência de hero/nav/rodapé, orçamento de eyebrows e parte das regras de SEO são avisos. A estimativa textual de headline não mede quebra de linha no navegador. Fonte: `lib/taste/lint.ts`.

## Imagens e logos

O chat de imagens usa `lib/images/prompt.ts` e `buildImageTools`. Fotos exigem guia de imagem e geram candidatas, com falhas parciais reportadas; cada resultado recebe crítica estruturada. Logos podem ser criados ou modernizados a partir de referência, passam por Sharp e por um crítico específico de legibilidade/fidelidade.

| Papel                     | Configuração no código                                        |
| ------------------------- | ------------------------------------------------------------- |
| Chats de site e imagem    | `EIXU_MODEL` → `anthropic/claude-opus-4.5`                    |
| Críticos de foto e logo   | `EIXU_CRITIC_MODEL` → `EIXU_MODEL` → mesmo fallback           |
| Candidatas de foto padrão | Duas chamadas a `openai/gpt-image-2` e uma a `bfl/flux-2-pro` |
| Logos                     | `openai/gpt-image-2`                                          |

As rotas dos chats têm duração máxima de 300 segundos e limites de 30 passos (site) e 14 (imagens). Esses limites encerram a geração; não provam conclusão.

O estado da biblioteca é `candidata`, `aprovada` ou `rejeitada`. Nas ferramentas, aprovar e aplicar logo exigem um pedido detectado na última mensagem do operador; aplicar também exige imagem de tipo logo já aprovada. A API da biblioteca aceita a ação direta de um operador autenticado. Remoção verifica uso nos blocos de rascunho, publicados e na marca. O agente de site lista apenas imagens aprovadas, mas também aceita URLs enviadas pelo operador. Fontes: `lib/ai/image-tools.ts`, `lib/images/queries.ts` e `app/api/admin/[tenant]/images/route.ts`.

## Dados, conversão e tráfego

| Tabela           | Responsabilidade                                               |
| ---------------- | -------------------------------------------------------------- |
| `tenants`        | Identidade, marca, dials, contatos e guia de imagem            |
| `pages`          | Rascunho, snapshot de blocos/SEO publicado e dados editoriais  |
| `images`         | Biblioteca, sequência por tenant, geração, crítica e aprovação |
| `chat_messages`  | Texto das conversas, separado em canais `site` e `imagens`     |
| `leads`          | Campos recebidos, origem e consentimento informado             |
| `events`         | Eventos de primeira parte por tenant/página/campanha           |
| `campaign_spend` | Gastos manuais em centavos, com campanha, canal e período      |

O script de atribuição guarda primeiro/último toque, click IDs e identificador de visita em `localStorage`. Preenche campos de formulário e envia eventos para `/api/e`. Formulários nativos passam por honeypot, gravam contato e evento e redirecionam com 303. `/go/wa` registra clique e redireciona para `wa.me`.

O painel chama de “Leads” a soma de envios de formulário e cliques de WhatsApp; isso não é contagem de pessoas únicas nem de contatos confirmados. O CSV contém até 5.000 contatos recebidos por formulário. O schema guarda IDs de GA4/Meta, mas esses campos, sozinhos, não significam integração ativa.

## Limites atuais

- **Acesso e preview:** admin global, sem vínculo usuário–tenant ou RLS no schema versionado. `preview=1` não verifica sessão e `__tenant` não é limitado ao ambiente de preview. Não trate rascunhos acessíveis por essas URLs como privados.
- **Domínios e SEO:** `proxy.ts` infere tenant pelo formato do host, sem allowlist de sufixo; o host `127.0.0.1` é interpretado como tenant `127`, portanto use `localhost` no navegador. `lib/site.ts` ainda aponta para o endereço legado `chatgpt.site`, usado no sitemap/robots institucional. Metadados do preview podem usar SEO publicado; não há `noindex` dedicado ao modo preview. Conferir esses caminhos antes de prometer isolamento por domínio ou SEO pronto para lançamento.
- **Snapshot parcial:** mudar marca, direção visual ou logo pode afetar o site ao vivo sem publicar páginas. Título, tipo, metadados de post e parte do JSON-LD também usam dados compartilhados. Publicação em lote e a escrita de um `build_site` válido não são transações únicas.
- **Autorização do agente:** pedido para publicar é uma regra de prompt/tool description; o executor de `publish_page` não valida uma confirmação estruturada. A detecção de aprovação de imagem usa regex de palavras, sem garantia de interpretação de negação ou intenção. Não confundir esses mecanismos com autorização formal.
- **Histórico:** o banco guarda texto, não o trace completo de ferramentas ou raciocínio. O histórico exibido não é reidratado em `useChat`; recarregar o painel não restaura a conversa completa do modelo. Não há evals ou suíte E2E versionados.
- **Medição:** cliques de WhatsApp podem ser registrados no navegador e no redirecionador. As consultas não filtram o período informado no gasto; os totais usam até 50 campanhas e o mapa de gasto por campanha não agrega canais repetidos. Validar deduplicação e denominadores antes de usar conversão/CPL como base decisória.

Esses pontos foram identificados por leitura de código; não constituem pentest ou validação de todos os fluxos em produção. A ordem de evolução sugerida é acesso a rascunhos, consistência da publicação, continuidade/observabilidade do agente e qualidade das métricas, com testes dos contratos afetados.
