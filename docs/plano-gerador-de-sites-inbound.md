# Gerador de sites com foco em inbound — planejamento

Status: rascunho para discussão. Nada aqui foi implementado.
Data: 2026-09-09

## 0. O que foi possível analisar (e o que não foi)

| Referência | Situação | O que extraí |
|---|---|---|
| tasteskill.dev | Fetch direto bloqueado; analisado via fontes secundárias e repo `Leonxlnx/taste-skill` | Bundle MIT de `SKILL.md` para agentes de código (Cursor, Claude Code, Codex, v0…). Três "dials": `DESIGN_VARIANCE`, `MOTION_INTENSITY`, `VISUAL_DENSITY`. Lista de bans "anti-slop" (header centralizado, grid de 3 cards, botão gradiente, emoji em heading…). 7 variantes: core, redesign audit, soft UI, minimalist, brutalist, output enforcement, ponte com Google Stitch. Instalação `npx skills add Leonxlnx/taste-skill`. |
| Semrush geo-targeting | Fetch bloqueado; resumo via busca | Estrutura de URL (ccTLD > subpasta > subdomínio), hreflang, Google Business Profile como "espinha dorsal", páginas por área de serviço com keyword geográfica única, NAP consistente, rastreio de ranking por cidade e não por marca. |
| Screaming Frog location pages | Fetch bloqueado; resumo via busca | Conteúdo único por localidade para não virar doorway page, URL com identificador geográfico, CTA claro, mapa embutido, linkagem interna entre localidades, atualização periódica. |
| vynco.ai | **Sem presença indexada.** Buscas só retornam Vynco Industries (NZ), um app de networking e uma API suíça. | Nada. Preciso que você descreva o que o player faz ou cole o conteúdo da landing. |
| Vídeo YouTube `LdWFmal9Kcg` | Bloqueado, sem transcript indexado | Nada. |
| Slides Instagram | Bloqueado | Nada. |

Consequência: as três referências mais "opinativas" (Vynco, vídeo, slides) ficaram fora. As decisões abaixo se apoiam em Google Search Central, docs do Next 16.3 instalados no repo, docs da Vercel e no estado atual do repo. Onde eu discordo ou não tenho certeza, sinalizei.

## 1. Estado atual do repo

- Site institucional da EIXU em Next 16.3.3 / React 19.2, App Router, Tailwind 4, shadcn. Sem banco, sem auth, sem API.
- Duas trilhas de build coexistindo: `vinext` + Cloudflare Workers (gerado pelo OpenAI Sites, `vite.config.ts`, `.openai/hosting.json`) e `next build` na Vercel (`vercel.json`). O `SITE_URL` ainda aponta para `*.chatgpt.site`.
- SEO já tem base boa: metadata, canonical, OG, JSON-LD (WebSite, Organization, BreadcrumbList), sitemap e robots.
- `.oxlintrc`/`oxfmt` como tooling.

Ponto que precisa de decisão: manter as duas trilhas dobra o custo de manutenção e limita o que dá para usar (Cache Components exige runtime Node; Proxy roda em Node). Se a infra é Vercel, a trilha vinext/Cloudflare deveria sair. Você confirma?

## 2. Reenquadrando o pedido

"Wix ou Lovable dentro do /admin" admite duas leituras muito diferentes:

| | A. Lovable-like: a IA gera **código** por site | B. Wix/Framer-like: a IA gera **conteúdo + configuração** sobre um catálogo fixo de blocos |
|---|---|---|
| Lighthouse | Imprevisível a cada geração | Garantido pelo catálogo (testado uma vez) |
| Manutenção | N sites = N codebases | 1 codebase, N registros no banco |
| SEO técnico | Reimplementado a cada site, erra fácil | Centralizado (metadata, schema, sitemap) |
| Tracking / consent | Idem | Uma implementação para todos |
| Segurança | Executar código gerado por LLM em produção | Sem execução de código gerado |
| Liberdade visual | Alta | Média; mitigável com tokens de tema + variantes de bloco |

Minha recomendação é **B com uma válvula de escape controlada**: o gerador de produção produz JSON validado por schema (padrão `json-render` da Vercel: catálogo de componentes em Zod, LLM gera spec restrita ao catálogo, render progressivo). Quando um site precisar de um bloco que não existe, isso vira uma tarefa de desenvolvimento com agente de código (aí sim com Taste Skill como `SKILL.md`), revisada em PR, e o bloco entra no catálogo para todos.

Se você realmente quer a leitura A (usuário final gerando código livre), a lista de requisitos de SEO, performance e tracking abaixo se torna quase impossível de garantir. Quero confirmar antes de seguir.

## 3. Onde o Taste Skill entra como harness

Taste Skill é escrito para agentes que escrevem código frontend, não para um gerador em runtime que produz JSON. Ele entra em duas camadas:

1. **Design-time (catálogo de blocos).** Instalado como skill no repo. Cada bloco novo é escrito por agente de código com as regras anti-slop e os dials aplicados. Aqui ele funciona exatamente como foi pensado.
2. **Runtime (gerador no /admin).** Traduzimos os três dials em parâmetros do tema por site (`variance`, `motion`, `density`) e a lista de bans em regras do prompt de sistema e em restrições do schema (ex.: heading não aceita emoji, seção "features" não pode ser grid de 3 cards com ícone gradiente, hero não é centralizado por padrão). A variante "output enforcement" vira um passo de crítica automática: um segundo modelo audita a spec gerada contra as regras antes de salvar.

Risco: o Taste Skill muda com frequência e o conteúdo é opinativo. Sugiro fixar uma versão (git submodule ou cópia versionada em `skills/`) e revisar mudanças manualmente.

## 4. O que um site inbound precisa (análise das ferramentas)

Levantei o que HubSpot, RD Station, Unbounce, Instapage, Landingi, Webflow e Framer entregam, cruzado com o que Google Ads, Meta Ads e GA4 exigem em 2026.

### 4.1 Captação e conversão
- Blocos de landing page: hero com proposta única, prova social, oferta, FAQ, formulário, CTA fixo mobile.
- Formulário com campos ocultos preenchidos automaticamente: `utm_*`, `gclid`, `gbraid`/`wbraid`, `fbclid`, `ttclid`, landing page, referrer, geo aproximada.
- Página de obrigado por formulário (é onde a conversão dispara; sempre `noindex`).
- Clique em WhatsApp e telefone como eventos de conversão (no Brasil isso costuma superar o formulário).
- Substituição dinâmica de texto por parâmetro de URL (keyword da campanha no headline), sem afetar o HTML indexado.
- Variantes A/B por página, decididas no `proxy.ts` (rewrite), com o resultado gravado no evento.
- Lead vai para uma tabela nossa, notifica por e-mail (Resend já está no seu stack) e sai por webhook para CRM. Pergunta: o CRM alvo é a naia? RD Station? Ambos?

### 4.2 Tracking sem destruir o Lighthouse
Este é o conflito central do projeto. Pixels no client (GTM + GA4 + Meta + Google Ads + Clarity) são a principal causa de INP e TBT ruins, e no App Router o `strategy="worker"` do `next/script` (Partytown) **não funciona** (confirmado nos docs bundled). Ao mesmo tempo, tracking só no client perde 30 a 50% das conversões por bloqueadores e iOS.

Proposta: **pipeline de eventos first-party, server-side primeiro.**
1. O site carrega um beacon próprio, minúsculo, que envia `page_view`, `form_submit`, `click_whatsapp`, `click_phone`, `scroll`, `cwv` para um Route Handler nosso.
2. O servidor grava o evento no banco (nossa fonte de verdade) e reencaminha: Meta Conversions API, GA4 Measurement Protocol, Google Ads (enhanced conversions / upload de conversão com `gclid`). Deduplicação por `event_id` gerado no servidor.
3. GTM/pixels client só são carregados quando o dono do site exigir (algumas agências insistem), sempre `afterInteractive` ou após primeira interação, e por padrão desligados.
4. Consent Mode v2 + banner LGPD como parte do catálogo, com o estado de consentimento propagado ao servidor.

Não tenho certeza se você quer suportar o caminho GTM client como opção. Ele existe porque gestores de tráfego externos costumam pedir acesso ao container. Decisão sua.

### 4.3 SEO técnico (centralizado no catálogo)
- `generateMetadata` por página a partir do banco: title, description, canonical, OG/Twitter, `robots` por página (LPs de mídia paga podem ser `noindex` para não canibalizar orgânico).
- JSON-LD por tipo de página: `Organization`, `LocalBusiness` (com `areaServed`, `geo`, `openingHours`), `Service`, `FAQPage`, `BreadcrumbList`, `Article`.
- Sitemap e robots gerados por site. Gerenciador de redirects no admin (o que mais quebra SEO em manutenção).
- Blog/artigos como tipo de página (inbound orgânico sem conteúdo não existe).
- Verificação do Search Console e IndexNow por site.
- Imagens: upload passa por otimização (Vercel Blob + `next/image`), alt obrigatório no schema.
- Auditoria automática antes de publicar: Lighthouse CI na preview da página, checagem de headings, links quebrados, tamanho de imagem.

### 4.4 Geolocation SEO — onde eu discordo parcialmente da premissa
O que o Google diz explicitamente (Search Central, "locale-adaptive pages" e "multi-regional sites"): não adaptar conteúdo indexável por IP, não redirecionar por IP ou `Accept-Language`, porque o Googlebot rastreia de vários países e o redirect bloqueia o crawl. IP geolocation é "difícil e geralmente não confiável" para conteúdo.

O que funciona e é o que Semrush e Screaming Frog descrevem:
- **Uma URL por localidade** (`/servico/cidade` ou `/unidades/cidade`) com conteúdo realmente único: endereço/NAP, mapa, equipe, depoimentos locais, fotos locais, casos, horários, bairros atendidos. Templates com só o nome da cidade trocado são doorway pages e o Google penaliza.
- `LocalBusiness` schema por unidade, Google Business Profile ligado a cada página, linkagem interna entre localidades e para a página-mãe do serviço.
- hreflang só se houver variantes de idioma/país. Para um site pt-BR com várias cidades, hreflang **não** se aplica.
- Rastreio de ranking por cidade (Search Console filtrado por página + país/região).

Onde a geolocalização por IP entra de forma segura: **personalização não indexável.** No `proxy.ts` lemos `x-vercel-ip-city` / `x-vercel-ip-country` e passamos como header para o render; o bloco de CTA mostra o WhatsApp da unidade mais próxima, o hero pode ter um banner "Você está em Bauru? Veja nossa unidade" com link para a página da cidade. O HTML base é o mesmo para todos, e o pedaço geo é streamado dentro de um `Suspense` (Cache Components: shell estático + trecho dinâmico), então cache e crawl não são afetados.

Para o gerador: o admin precisa de um modelo de "unidade/área de serviço" e o LLM gera o rascunho da página por localidade a partir de dados reais fornecidos pelo dono (endereço, fotos, diferenciais locais), com um checklist de unicidade obrigatório antes de publicar. Se o dono não fornecer nada específico, a página não deveria ser publicada como indexável.

### 4.5 Dados e visualização
Não recriar o GA4. O painel do admin responde às perguntas que o inbound faz:
- Leads por dia, por canal (`utm_source/medium`), por campanha, por landing page, por localidade.
- Taxa de conversão por página e por variante A/B.
- Custo por lead, quando houver importação de gasto (Google Ads API e Meta Marketing API exigem app aprovado; fase 2).
- Orgânico: consultas e páginas do Search Console API (OAuth, mais simples que Ads).
- Core Web Vitals reais (CrUX + nosso beacon `cwv`), por página.
- Funil: sessão → engajamento → lead → qualificado (o status "qualificado" volta do CRM por webhook).

Fonte única: tabela de eventos no Postgres (Neon já está conectado neste ambiente) com views agregadas por dia. Recharts já está no repo.

### 4.6 Performance
- Cache Components (`cacheComponents: true`, PPR por padrão): shell estático por página, trechos dinâmicos (geo, A/B) em Suspense.
- Publicação invalida por `cacheTag` (`site:<id>`, `page:<id>`), sem rebuild.
- Sem JS de terceiros por padrão; blocos client só onde há interação.
- Fontes self-hosted via `next/font`, imagens via `next/image` com dimensões obrigatórias no schema.
- Meta: Lighthouse 95+ nas quatro categorias em toda página do catálogo, verificado no CI.

## 5. Arquitetura proposta (alto nível)

```
/admin (auth)                        Sites públicos
├── Sites                            proxy.ts: host → site_id, geo headers, A/B rewrite
├── Páginas (editor JSON + preview)  app/(sites)/[domain]/[...slug]
├── Gerador (chat + AI Gateway)      ├── render do catálogo de blocos
├── Localidades                      ├── generateMetadata + JSON-LD
├── Leads                            ├── sitemap.xml / robots.txt por site
├── Integrações (pixels, CRM, GSC)   └── /api/events (beacon → DB → CAPI/GA4/Ads)
└── Dashboard inbound
```

- **Multi-tenant** na Vercel: wildcard `*.eixu.com.br` para previews/sites sem domínio, domínios próprios via Vercel Domains API (padrão "Vercel for Platforms" / platforms-starter-kit).
- **Banco**: Neon Postgres. Tabelas mínimas: `sites`, `pages` (versionadas, draft/published), `blocks` embutidos no JSON da página, `locations`, `leads`, `events`, `integrations`, `experiments`.
- **IA via AI Gateway** (AI SDK): modelo forte para estruturar/gerar conteúdo (Claude Sonnet 5 ou Opus 5), modelo barato para classificação de lead e crítica anti-slop, `generateObject` com o schema do catálogo. Geração de imagem só se você quiser (hero/OG); pergunta aberta.
- **Auth do /admin**: quantas pessoas? Só a EIXU ou o cliente final também edita? Isso define se é login simples ou multi-org com papéis.

## 6. Fases sugeridas

1. **Fundação** (sem IA): catálogo com 8 a 10 blocos usando Taste Skill, tema por tokens, render multi-tenant, metadata/schema/sitemap, beacon + tabela de eventos, formulário → lead → e-mail. Lighthouse CI. Migrar o próprio site da EIXU para o catálogo como primeiro tenant (prova real).
2. **Gerador**: chat no admin que produz sites/páginas como JSON via AI Gateway, com crítica automática e preview.
3. **Inbound**: Meta CAPI, GA4 MP, Google Ads conversion, Consent Mode v2, A/B por proxy, dashboard de leads.
4. **Geo**: modelo de localidades, gerador de páginas por cidade com checklist de unicidade, personalização por IP não indexável, `LocalBusiness` schema.
5. **Integrações externas**: Search Console API, importação de gasto (Ads/Meta), webhook CRM bidirecional.

## 7. Perguntas abertas (preciso das respostas antes de qualquer implementação)

1. Leitura A (gera código) ou B (gera conteúdo sobre catálogo)? Minha recomendação é B.
2. Para quem é: sites da EIXU para clientes (agência) ou produto SaaS que terceiros usam? Quem loga no /admin?
3. Podemos remover a trilha vinext/Cloudflare e ficar só com Vercel?
4. Vynco.ai: o que ele faz? Pode colar o texto da landing ou descrever o que te chamou atenção?
5. Vídeo e slides: pode colar a transcrição / os pontos principais? Sem isso não consigo incorporar.
6. CRM de destino dos leads: naia, RD Station, HubSpot, outro?
7. GTM client-side como opção para gestores de tráfego externos: sim ou não?
8. Mercado: só Brasil / pt-BR? Isso define se hreflang entra no escopo.
9. Banco: Neon Postgres está ok? Domínio-raiz para wildcard (`*.eixu.com.br`?) já existe na Vercel?
10. Geração de imagens pela IA: dentro ou fora do escopo?
