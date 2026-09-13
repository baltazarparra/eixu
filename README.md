# EIXU

Site institucional da EIXU e MVP de uma plataforma operada por agentes para criar sites de clientes, captar contatos e acompanhar tráfego. O operador trabalha em `/admin`; cada cliente tem conteúdo e imagens próprios no mesmo banco e aplicação, com endereço previsto em `cliente.eixu.com.br`.

## Qualidade dos agentes

O modelo interno é **Gemini 3.8 Flash**, com raciocínio `high`. O harness prioriza plano editorial, contexto recente preservado e composição com espaço para reparo. A geração termina quando as páginas são montadas; a revisão é humana pela prévia, com ajustes pelo chat. Não há etapa automática Conferir nem estado de revisão visual pendente. Os erros de publicação continuam valendo. [SOUL.md](SOUL.md) define a identidade e entra no prompt; [harness](docs/harness.md) explica políticas, limites e avaliações.

## O que já existe

- Institucional com home, oferta de passagem de vibe coding para produção e cases de SaldoPix e NaiaCRM.
- Painel com login de operador, busca e filtros de clientes, cadastro compacto com cinco direções visuais comparáveis, geração em Preparar/Criar, chat com histórico recente, prévia em desktop/mobile, dados e briefing editáveis e publicação.
- Páginas orgânicas, landing pages pagas, posts e páginas de agradecimento compostas por blocos com schemas Zod. O agente edita conteúdo por ferramentas; o painel também permite ajustar dados do cliente e gerenciar imagens.
- Edição direta na prévia de clientes publicados: texto, tamanho e cor por campo, com contraste validado. Salvar altera o rascunho; Publicar leva as mudanças ao site no ar.
- Imagens geradas na conversa ou enviadas pelo painel, disponíveis no mesmo acervo sem aprovação. O upload aceita várias fotos JPG, PNG, WebP ou AVIF de até 4 MB cada; a geração usa o guia do cliente e a crítica. A biblioteca em `/admin/[tenant]/imagens` mantém números para pedir alterações, como “atualize a imagem #5 com outro carro”. A nova versão substitui a anterior nos rascunhos e ambas ficam salvas.
- Estúdio de logo durante o briefing: limpa fundo e margens, prepara altura, SVG quando fiel, ícones e imagem de compartilhamento. A modernização fiel aprovada pelos gates pode entrar no rascunho automaticamente, com original numerado e reversão pelo chat. Outras aplicações exigem pedido; o site público só muda ao publicar.
- Contatos do cadastro renderizados sozinhos no site: telefones, e-mail e redes sociais no rodapé, e uma seção de localização com mapa acima dele quando há endereço.
- Cinco vibes com contratos próprios de tipografia, abertura, navegação, ritmo, superfície, iconografia, imagem e [voz de escrita](docs/copy.md). As quatro vibes multipágina oferecem três estruturas cada e uma composição autoral. Landing Page usa perfil v7, uma home indexável e uma página de obrigado, com ação única, prova confirmada e formulário curto. Referências visuais verificadas prevalecem na direção visual; a voz continua usando a vibe e linguagem simples.
- Formulários, WhatsApp rastreado, atribuição de campanhas, exportação de contatos em CSV e painel de tráfego com gastos informados à mão.

É um MVP de operação centralizada: há uma credencial administrativa compartilhada, sem contas ou permissões por cliente, cobrança ou integração automática com plataformas de anúncios. Os [limites atuais](docs/architecture.md#limites-atuais) fazem parte do contrato de desenvolvimento.

## Rodar localmente

Use Node.js 24.x para acompanhar a Vercel; o mínimo declarado é 22.13.0. O gerenciador é npm, com versões resolvidas em `package-lock.json`.

```bash
npm ci
npm run dev:vercel
```

O institucional e a tela de login abrem sem banco. Para usar o painel e os sites, configure `.env.local` com recursos de desenvolvimento:

| Variável                 | Uso                                                                                                        |
| ------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`           | Conexão Postgres/Neon das rotas dinâmicas e scripts de banco.                                              |
| `ADMIN_USER`             | Usuário do operador; fallback `admin`.                                                                     |
| `ADMIN_PASSWORD`         | Senha do operador. Produção recusa login se estiver ausente.                                               |
| `ADMIN_SESSION_SECRET`   | Segredo de assinatura da sessão; configure um valor próprio. O código usa a senha como fallback.           |
| `AI_GATEWAY_API_KEY`     | Autenticação explícita do AI Gateway, útil localmente. O SDK também aceita OIDC da Vercel.                 |
| `EIXU_MODEL`             | Modelo do chat do site; fallback no código: `google/gemini-3.8-flash`.                                     |
| `EIXU_CRITIC_MODEL`      | Modelo da crítica visual e leitura de avatar social; fallback em `EIXU_MODEL`, depois Gemini 3.8 Flash.    |
| `EIXU_LOGO_CRITIC_MODEL` | Modelo de leitura e crítica do logo; prevalece sobre os fallbacks descritos em [Harness](docs/harness.md). |
| `EIXU_LOGO_IMAGE_MODEL`  | Gerador de logos; padrão `openai/gpt-image-2`.                                                             |
| `EIXU_LOGO_AUTO_APPLY`   | `0` desativa a aplicação automática do estúdio; as propostas continuam disponíveis.                        |
| `BLOB_READ_WRITE_TOKEN`  | Upload, geração e remoção de imagens no Vercel Blob.                                                       |
| `EIXU_REVIEW_CAPTURE`    | Captura e crítica visual ligadas por padrão; `0` permite só diagnóstico estrutural, sem conclusão visual.  |
| `EIXU_CHROME_PATH`       | Caminho do Chrome local para a captura em desenvolvimento.                                                 |

Crie o arquivo localmente, sem versionar credenciais. Se já tiver acesso ao projeto Vercel, `vercel link --project eixu` e `vercel env pull .env.local --environment=development` são uma alternativa; confira o destino de `DATABASE_URL` antes de qualquer escrita. O nome do ambiente Vercel não garante que o banco conectado seja de desenvolvimento.

No banco de desenvolvimento escolhido, aplique o schema e inicie o servidor:

```bash
npm run db:migrate
npm run dev:vercel
```

Entre em [localhost:3000/admin](http://localhost:3000/admin) com as credenciais configuradas. Apenas em desenvolvimento, sem `ADMIN_PASSWORD`, o código permite a senha `1234` para `ADMIN_USER` (ou `admin`); esse fallback não serve para ambientes compartilhados.

Após criar o tenant, veja seu rascunho em `http://localhost:3000/s/cliente?preview=1&__tenant=cliente`. A versão publicada fica em `http://cliente.localhost:3000` ou `http://localhost:3000/s/cliente?__tenant=cliente`. `__tenant` resolve o cliente; `preview=1` seleciona o rascunho. O rascunho exige uma sessão administrativa válida e recebe `noindex`; as flags sozinhas não dão acesso. A prévia mantém os links internos no cliente e desativa formulários e tracking.

## Stack e mapa do projeto

Produção usa Next.js 16.3.3, React 19.2.6, TypeScript, Tailwind 4, AI SDK 7, AI Gateway, Neon, Vercel Blob e Vercel Queues. A origem do projeto em Sites/Vinext continua na configuração Vite/Cloudflare e nos scripts sem sufixo `:vercel`.

Na Vercel, as etapas da geração são entregues pela fila `eixu-generation-steps`, com autenticação OIDC automática. O trigger de `vercel.json` registra o consumidor privado em `/api/queues/generation`. No servidor local, o despacho continua por HTTP assinado, sem acessar a fila remota. O banco mantém o estado e a reserva de cada etapa; a fila cuida da entrega.

| Área                  | Entrada                                                                                      |
| --------------------- | -------------------------------------------------------------------------------------------- |
| Institucional         | `app/(main)/`, `components/eixu.tsx`, `lib/site.ts`                                          |
| Painel e autenticação | `app/(admin)/`, `lib/auth.ts`, `app/api/admin/`                                              |
| Sites por tenant      | `proxy.ts`, `app/(sites)/`, `lib/tenant-queries.ts`                                          |
| Blocos e qualidade    | `lib/blocks/`, `lib/taste/`                                                                  |
| Agentes do produto    | `app/api/chat/`, `lib/ai/`, `lib/images/`                                                    |
| Dados e atribuição    | `db/schema.sql`, `lib/db.ts`, `lib/tracking.ts`, `app/api/form/`, `app/api/e/`, `app/go/wa/` |

Os três grupos de rotas têm layouts e CSS próprios. A publicação valida páginas
e projeto por `lintPage` e `lintSite`, incluindo a forma do site (três páginas de inbound ou uma landing com obrigado) e duas
fotos disponíveis na home, e promove conteúdo, SEO, dados editoriais e apresentação
global para um snapshot coerente na mesma transação. Veja o
[mapa de arquitetura](docs/architecture.md).

## Comandos e validação

| Comando                                                      | Efeito                                                                                                                                                                 |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev:vercel`                                         | Desenvolvimento em Next.js, caminho usado para este MVP.                                                                                                               |
| `npm run build:vercel`                                       | Build de produção e verificação dos arquivos de identidade/Chromium no artefato serverless. Configurado em `vercel.json`.                                              |
| `npx next start`                                             | Serve o build Next.js local já gerado.                                                                                                                                 |
| `npx next typegen && npx tsc --noEmit`                       | Gera tipos das rotas e verifica TypeScript.                                                                                                                            |
| `npm run lint`                                               | Analisa código com oxlint; não executa o pre-flight dos sites.                                                                                                         |
| `npm run test:sites`                                         | Testa o contrato de páginas, imagens, alterações por número e links sem banco ou chamadas pagas.                                                                       |
| `npm run test:sites:browser`                                 | Depois do build Next.js, verifica contraste, contatos, hidratação, teclado, carrossel e preferências do navegador. Requer `EIXU_CHROME_PATH`.                          |
| `npm run test:admin`                                         | Testa contexto, estado editorial, autenticação, logos, datas, custos, CSV e tracking sem banco ou chamadas pagas. Captura requer `EIXU_CHROME_PATH`.                   |
| `npm run test:admin:browser`                                 | Depois do build Next.js, exercita o painel real no Chrome: andamento da geração, início automático, conversa e consumo. Requer `EIXU_CHROME_PATH`.                     |
| `npm run eval:harness`                                       | Orienta o ensaio de qualidade; `--live --case=... --assets=... --repeat=2` chama modelos reais com ferramentas em memória e capturas do renderer. Não grava Neon/Blob. |
| `npm run eval:admin-cost`                                    | Compara o payload de histórico em memória; `-- --live` executa três chamadas pagas controladas, sem escrever no banco/Blob.                                            |
| `npm run eval:site -- <caso>`                                | Roda a geração real num tenant descartável e mede o resultado pela rubrica.                                                                                            |
| `npm run format -- --check README.md AGENTS.md SOUL.md docs` | Confere a formatação da documentação sem reescrever arquivos.                                                                                                          |
| `npm run db:migrate`                                         | Aplica statements idempotentes de `db/schema.sql`; escreve no banco. Coluna nova exige rodar antes do deploy do código que a usa.                                      |
| `npm run db:seed-demo`                                       | Sobrescreve e publica home/obrigado do tenant `vertice` já existente; altera marca e dials. Use só em demo descartável.                                                |
| `npm run db:requantize-logos`                                | Recomprime logos de todos os tenants do banco conectado, sobrescrevendo arquivos no Blob.                                                                              |
| `npm run db:prepare-logo-assets -- --slug=cliente`           | Diagnóstico sem escrita por padrão. `--apply` prepara assets só do rascunho, com crítica da versão branca; exige escopo autorizado. `--all` seleciona todos.           |
| `npm run dev` / `npm run build` / `npm start`                | Caminho Vinext/Cloudflare herdado; não valida o deploy Next.js da Vercel.                                                                                              |

Há testes dos contratos de sites e admin; não há workflow de CI versionado. O lint global deve passar. O [guia de validação](docs/verification.md) registra as referências e os checks por tipo de mudança, incluindo integração em PostgreSQL descartável. Build aprovado não equivale a fluxo com banco ou IA testado.

O [manual do operador](docs/admin.md) explica a jornada de cadastro, geração, revisão, publicação e acompanhamento. A [revisão do admin](docs/admin-review.md) registra o escopo e a comparação controlada de custo.

## Agentes e modelos de desenvolvimento

GPT-6 Astra e Claude Fable 5.1 são os modelos de trabalho considerados pelo [harness de desenvolvimento](docs/harness.md). Eles seguem a identidade de [SOUL.md](SOUL.md) e o mesmo [AGENTS.md](AGENTS.md); `CLAUDE.md` importa esse arquivo, sem duplicar as regras. Selecionar um modelo no editor não altera `EIXU_MODEL` nem os geradores de imagem do produto. Os fallbacks documentados acima vêm do código, não de uma leitura das variáveis de produção.

## Publicação

O repositório [baltazarparra/eixu](https://github.com/baltazarparra/eixu) está ligado ao projeto `eixu` da Vercel, com `main` como branch de produção e `npm run build:vercel` como build. Valide o diff, publique pelo fluxo Git e confira o deployment do mesmo SHA até `READY`, seguido de smoke no domínio servido. O [procedimento completo](docs/verification.md#publicação) inclui os comandos.

Publicar código na Vercel e publicar páginas de clientes são operações distintas. O deploy não executa migrações, não roda o seed e não publica rascunhos. Subdomínios dependem de domínio, DNS e certificado configurados na Vercel.
