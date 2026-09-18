# EIXU

A EIXU reúne o site institucional e uma plataforma interna para criar e manter sites de clientes por conversa. O operador entra em `/studio`, cria, edita ou arquiva projetos e trabalha em uma única jornada de briefing, chat, prévia ao vivo, CMS leve, imagens e publicação em `cliente.eixu.com.br`.

O Studio gera projetos Next.js independentes. Cada cliente tem código, conteúdo versionado, Sandbox, projeto Vercel e histórico de releases próprios. A plataforma central conserva autenticação, gestão, leads, eventos, WhatsApp e o Kanban.

O piloto pertence ao workspace interno da EIXU. Cada tenant já carrega esse vínculo para permitir a separação futura por agência; autenticação e papéis por workspace ainda não fazem parte do piloto. O estado validado e publicado de cada entrega fica em [Execução do chat livre](docs/execucao-chat-livre.md).

## Jornada do operador

1. Em `/studio/novo`, cadastre nome, domínio, briefing, contatos, redes, site atual, referência, logo, cores e vibe.
2. Ao criar, o Studio abre o projeto e inicia sozinho o primeiro build.
3. O harness lê os dados e a fonte oficial, inspeciona a referência e registra contexto e direção de arte antes de escrever código.
4. O agente trabalha no Sandbox isolado; a prévia autenticada acompanha o workspace durante a execução e fixa o último checkpoint válido ao terminar.
5. A primeira versão que passa por typecheck, build e smoke é publicada automaticamente no subdomínio escolhido.
6. Pedidos posteriores no mesmo chat atualizam apenas o rascunho e a prévia. O domínio público muda quando o operador clica em **Publicar**.
7. Textos e imagens declarados em `content/schema.json` também podem ser mantidos no CMS leve e na aba de imagens.

A referência visual comanda composição, tipografia, ritmo, superfícies e movimento. A direção escolhida serve como fallback:

| Vibe       | Uso                                                                                        |
| ---------- | ------------------------------------------------------------------------------------------ |
| Comercial  | Clareza, confiança e ação principal visível, sem transformar o site em um template.        |
| Ousado     | Escala, contraste e ritmo mais expressivos, sempre sustentados pelo conteúdo e pela marca. |
| Referência | Prioriza o link informado para estrutura, tipografia, ritmo, imagem e movimento.           |

Essas referências orientam a leitura visual; não autorizam copiar marca, texto, imagens ou código.

## Harness

O chat usa AI SDK 7, `WorkflowAgent`, Vercel Workflow, AI Gateway e Vercel Sandbox. O catálogo de ferramentas é pequeno e tipado: leitura do contexto, inspeção de fontes, arquivos, comandos permitidos, artefatos, screenshots, imagens e checkpoints. Banco, Vercel e publicação ficam fora da autonomia do modelo e passam por serviços determinísticos.

A política `studio-gemini-3.8-flash-v1` usa `google/gemini-3.8-flash` pelo AI Gateway com reasoning `high`, o maior nível aceito pelo modelo, em todos os papéis. Geração e edição visual usam `openai/gpt-image-2.5-sunburst` por padrão. O operador não escolhe modelo ou effort. Consulte [Harness e modelos](docs/harness.md) e o [estudo do AI SDK](docs/estudo-ai-sdk-chat-livre.md).

## Arquitetura

```mermaid
flowchart LR
  A[Studio EIXU] --> B[API autenticada]
  B --> N[(Neon)]
  B --> W[Vercel Workflow]
  W --> G[AI Gateway]
  W --> S[Sandbox por projeto]
  S --> K[Checkpoint privado]
  K --> R[Release determinístico]
  R --> V[Projeto Vercel do cliente]
  V --> D[cliente.eixu.com.br]
  B --> O[(Vercel Blob)]
```

- `app/(main)`: institucional da EIXU;
- `app/(admin)/studio`: gerenciador e jornada principal do Studio;
- `app/(admin)/admin`: operação legada, relatórios e Kanban;
- `app/api/chat` e `lib/studio`: conversa durável e harness;
- `db/schema.sql`: tenants, mensagens, runs, artefatos, conteúdo e releases;
- `app/api/form`, `app/api/e` e `app/go/wa`: integrações públicas centrais;
- `scripts/reset-sites.mjs`: manifesto e reset controlado dos dados antigos.

Veja [Arquitetura](docs/architecture.md) para os contratos completos.

## Desenvolvimento local

Requisitos: Node.js `>=22.17.0`, npm e recursos de desenvolvimento separados dos ambientes de produção.

```bash
npm ci
cp .env.example .env.local
npm run db:migrate
ADMIN_INITIAL_PIN='<pin-inicial>' npm run db:provision-admins
npm run dev:vercel
```

A tela principal fica em [localhost:3000/studio](http://localhost:3000/studio) e usa o login administrativo existente. Não copie credenciais ou dados pessoais de produção para o ambiente local.

Variáveis principais:

| Variável                                    | Uso                                                              |
| ------------------------------------------- | ---------------------------------------------------------------- |
| `DATABASE_URL`                              | Neon usado pela aplicação.                                       |
| `ADMIN_PIN_PEPPER` / `ADMIN_SESSION_SECRET` | Login e sessão dos operadores.                                   |
| `AI_GATEWAY_API_KEY`                        | Opcional fora da Vercel; deployments usam OIDC automaticamente.  |
| `BLOB_READ_WRITE_TOKEN`                     | Store público: logos, uploads e imagens em `tenants/`.           |
| `STUDIO_BLOB_STORE_ID`                      | ID do store privado usado por OIDC para artefatos em `studio/`.  |
| `EIXU_IMAGE_MODEL`                          | Modelo de imagem; padrão `openai/gpt-image-2.5-sunburst`.        |
| `EIXU_VERCEL_TOKEN`                         | API de projetos, deployments, domínios e promoção.               |
| `EIXU_VERCEL_TEAM_ID`                       | ID do time de publicação; configure também em produção.          |
| `VERCEL_PROJECT_ID`                         | ID nativo do projeto raiz, exposto pela Vercel.                  |
| `EIXU_VERCEL_ROOT_PROJECT_ID`               | Override do projeto raiz quando o ID nativo não está disponível. |
| `KANBAN_AGENT_TOKEN`                        | Bearer restrito às rotas do Kanban.                              |

O arquivo [.env.example](.env.example) contém a lista completa sem valores secretos.

`VERCEL_ORG_ID` continua aceito como fallback explícito do CLI, mas não é uma [variável de sistema do runtime](https://vercel.com/docs/environment-variables/system-environment-variables). O time de publicação precisa ser configurado no projeto da plataforma; uma alteração de ambiente só chega às funções depois de um novo deployment.

Crie dois stores Blob com modos de acesso distintos. O store público continua selecionado por `BLOB_READ_WRITE_TOKEN`; o privado deve ser conectado ao projeto com OIDC e identificado por `STUDIO_BLOB_STORE_ID`. O Studio obtém um token OIDC curto em cada operação e recusa IDs iguais, evitando que checkpoints caiam no store público. Configure recursos próprios para Preview e Production.

## Verificação

```bash
npx next typegen && npx tsc --noEmit
npm run lint
npm run test:studio
npm run test:admin
npm run build:vercel
```

`npm run test:sites` é o alias enxuto para os contratos do Studio. Chamadas de modelos, Sandbox remoto, deploy e reset não fazem parte desses checks locais. O procedimento completo está em [Verificação](docs/verification.md).

## Reset dos sites antigos

O reset preserva o workspace da EIXU, operadores, autenticação, Kanban e institucional. Ele remove tenants, projetos, imagens, conversas, leads, métricas, assets e projetos Vercel de clientes nos ambientes explicitamente selecionados.

O comando normal gera somente um manifesto. A execução exige o digest e o fingerprint desse manifesto, um deployment saudável do projeto raiz e uma referência de recuperação:

```bash
npm run db:reset-sites -- --environment=preview --manifest
```

O modo destrutivo também exige `--manifest-created-at` e só aceita um manifesto com até 30 minutos. Nunca execute sem revisar o inventário recém-gerado e confirmar o recurso exato. Produção e preview têm recibos separados.

## Documentação

O [índice](docs/README.md) separa contratos vigentes, estudo técnico e plano datado. [SOUL.md](SOUL.md) define a identidade e os critérios editoriais do Studio.
