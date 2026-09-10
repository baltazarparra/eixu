# EIXU

Site institucional da EIXU e MVP de uma plataforma operada por agentes para criar sites de clientes, captar contatos e acompanhar tráfego. O operador trabalha em `/admin`; cada cliente tem conteúdo e imagens próprios no mesmo banco e aplicação, com endereço previsto em `cliente.eixu.com.br`.

## O que já existe

- Institucional com home, oferta de passagem de vibe coding para produção e cases de SaldoPix e NaiaCRM.
- Painel com login de operador, cadastro de clientes, chat de edição, preview em desktop/mobile, upload de logo e publicação.
- Páginas orgânicas, landing pages pagas, posts e páginas de agradecimento compostas por blocos com schemas Zod. O agente edita conteúdo por ferramentas; o painel também permite ajustar dados do cliente e gerenciar imagens.
- Estúdio de imagens com guia por cliente, geração de fotos e logos, crítica, aprovação, rejeição e remoção. Aprovar um logo e aplicá-lo são ações distintas.
- Formulários, WhatsApp rastreado, atribuição de campanhas, exportação de contatos em CSV e painel de tráfego com gastos informados à mão.

É um MVP de operação centralizada: há uma credencial administrativa compartilhada, sem contas ou permissões por cliente, cobrança ou integração automática com plataformas de anúncios. Os [limites atuais](docs/architecture.md#limites-atuais) fazem parte do contrato de desenvolvimento.

## Rodar localmente

Use Node.js 24.x para acompanhar a Vercel; o mínimo declarado é 22.13.0. O gerenciador é npm, com versões resolvidas em `package-lock.json`.

```bash
npm ci
npm run dev:vercel
```

O institucional e a tela de login abrem sem banco. Para usar o painel e os sites, configure `.env.local` com recursos de desenvolvimento:

| Variável                | Uso                                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------------------ |
| `DATABASE_URL`          | Conexão Postgres/Neon das rotas dinâmicas e scripts de banco.                                    |
| `ADMIN_USER`            | Usuário do operador; fallback `admin`.                                                           |
| `ADMIN_PASSWORD`        | Senha do operador. Produção recusa login se estiver ausente.                                     |
| `ADMIN_SESSION_SECRET`  | Segredo de assinatura da sessão; configure um valor próprio. O código usa a senha como fallback. |
| `AI_GATEWAY_API_KEY`    | Autenticação explícita do AI Gateway, útil localmente. O SDK também aceita OIDC da Vercel.       |
| `EIXU_MODEL`            | Modelo dos dois chats; fallback no código: `anthropic/claude-opus-4.5`.                          |
| `EIXU_CRITIC_MODEL`     | Modelo da crítica visual; fallback em `EIXU_MODEL`, depois Opus 4.5.                             |
| `BLOB_READ_WRITE_TOKEN` | Upload, geração e remoção de imagens no Vercel Blob.                                             |

Crie o arquivo localmente, sem versionar credenciais. Se já tiver acesso ao projeto Vercel, `vercel link --project eixu` e `vercel env pull .env.local --environment=development` são uma alternativa; confira o destino de `DATABASE_URL` antes de qualquer escrita. O nome do ambiente Vercel não garante que o banco conectado seja de desenvolvimento.

No banco de desenvolvimento escolhido, aplique o schema e inicie o servidor:

```bash
npm run db:migrate
npm run dev:vercel
```

Entre em [localhost:3000/admin](http://localhost:3000/admin) com as credenciais configuradas. Apenas em desenvolvimento, sem `ADMIN_PASSWORD`, o código permite a senha `1234` para `ADMIN_USER` (ou `admin`); esse fallback não serve para ambientes compartilhados.

Após criar o tenant, veja seu rascunho em `http://localhost:3000/s/cliente?preview=1&__tenant=cliente`. A versão publicada fica em `http://cliente.localhost:3000` ou `http://localhost:3000/s/cliente?__tenant=cliente`. `__tenant` resolve o cliente; `preview=1` seleciona o rascunho. Essas flags não são autenticação.

## Stack e mapa do projeto

Produção usa Next.js 16.3.3, React 19.2.6, TypeScript, Tailwind 4, AI SDK 7, AI Gateway, Neon e Vercel Blob. A origem do projeto em Sites/Vinext continua na configuração Vite/Cloudflare e nos scripts sem sufixo `:vercel`.

| Área                  | Entrada                                                                                      |
| --------------------- | -------------------------------------------------------------------------------------------- |
| Institucional         | `app/(main)/`, `components/eixu.tsx`, `lib/site.ts`                                          |
| Painel e autenticação | `app/(admin)/`, `lib/auth.ts`, `app/api/admin/`                                              |
| Sites por tenant      | `proxy.ts`, `app/(sites)/`, `lib/tenant-queries.ts`                                          |
| Blocos e qualidade    | `lib/blocks/`, `lib/taste/`                                                                  |
| Agentes do produto    | `app/api/chat/`, `app/api/images/chat/`, `lib/ai/`, `lib/images/`                            |
| Dados e atribuição    | `db/schema.sql`, `lib/db.ts`, `lib/tracking.ts`, `app/api/form/`, `app/api/e/`, `app/go/wa/` |

Os três grupos de rotas têm layouts e CSS próprios. A publicação copia blocos e SEO do rascunho para os campos publicados depois de `lintPage`; isso não versiona a marca inteira. Veja o [mapa de arquitetura](docs/architecture.md).

## Comandos e validação

| Comando                                              | Efeito                                                                                                                  |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `npm run dev:vercel`                                 | Desenvolvimento em Next.js, caminho usado para este MVP.                                                                |
| `npm run build:vercel`                               | Build de produção configurado em `vercel.json`.                                                                         |
| `npx next start`                                     | Serve o build Next.js local já gerado.                                                                                  |
| `npx next typegen && npx tsc --noEmit`               | Gera tipos das rotas e verifica TypeScript.                                                                             |
| `npm run lint`                                       | Analisa código com oxlint; não executa o pre-flight dos sites.                                                          |
| `npm run format -- --check README.md AGENTS.md docs` | Confere a formatação da documentação sem reescrever arquivos.                                                           |
| `npm run db:migrate`                                 | Aplica statements idempotentes de `db/schema.sql`; escreve no banco.                                                    |
| `npm run db:seed-demo`                               | Sobrescreve e publica home/obrigado do tenant `vertice` já existente; altera marca e dials. Use só em demo descartável. |
| `npm run db:requantize-logos`                        | Recomprime logos de todos os tenants do banco conectado, sobrescrevendo arquivos no Blob.                               |
| `npm run dev` / `npm run build` / `npm start`        | Caminho Vinext/Cloudflare herdado; não valida o deploy Next.js da Vercel.                                               |

Não há suíte de testes nem workflow de CI versionados. Na revisão de 09/09/2026, tipos e build passaram; o lint apresentou 20 erros preexistentes em 13 arquivos. O [guia de validação](docs/verification.md) registra a referência e os checks por tipo de mudança. Build aprovado não equivale a fluxo com banco ou IA testado.

## Agentes e modelos de desenvolvimento

GPT-6 Astra e Claude Fable 5.1 são os modelos de trabalho considerados pelo [harness de desenvolvimento](docs/harness.md). Eles seguem o mesmo [AGENTS.md](AGENTS.md); `CLAUDE.md` importa esse arquivo, sem duplicar as regras. Selecionar um modelo no editor não altera `EIXU_MODEL` nem os geradores de imagem do produto. Os fallbacks documentados acima vêm do código, não de uma leitura das variáveis de produção.

## Publicação

O repositório [baltazarparra/eixu](https://github.com/baltazarparra/eixu) está ligado ao projeto `eixu` da Vercel, com `main` como branch de produção e `npm run build:vercel` como build. Valide o diff, publique pelo fluxo Git e confira o deployment do mesmo SHA até `READY`, seguido de smoke no domínio servido. O [procedimento completo](docs/verification.md#publicação) inclui os comandos.

Publicar código na Vercel e publicar páginas de clientes são operações distintas. O deploy não executa migrações, não roda o seed e não publica rascunhos. Subdomínios dependem de domínio, DNS e certificado configurados na Vercel.
