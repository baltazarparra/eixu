<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Orientação do projeto

Não concorde por conveniência. Verifique código, dados e serviços antes de assumir. Comunique-se em português do Brasil, com objetividade.

A EIXU reúne o institucional, o Studio interno em `/studio` e a operação administrativa em `/admin`. O operador cria e gerencia projetos no Studio por uma única jornada de dados, chat, preview, CMS leve, imagens e publicação. Cada cliente recebe um projeto Next.js independente e continua acessível em `cliente.eixu.com.br`.

Leia [README.md](README.md) para setup, [SOUL.md](SOUL.md) para identidade e [docs/README.md](docs/README.md) para o mapa da documentação.

## Contexto sob demanda

| Ao trabalhar em                           | Leia                                                                          |
| ----------------------------------------- | ----------------------------------------------------------------------------- |
| Rotas, dados, publicação ou tenancy       | [Arquitetura](docs/architecture.md) e os produtores/consumidores afetados     |
| Prompts, ferramentas, modelos ou Workflow | [Harness](docs/harness.md) e [SOUL.md](SOUL.md)                               |
| Frontend ou direção visual                | [Design](docs/design.md)                                                      |
| Validação e release                       | [Verificação](docs/verification.md)                                           |
| Cards e PRs                               | [Fluxo AI Native](docs/ai-native-development.md) e a skill `kanban-*` da fase |
| Neon/schema                               | `db/schema.sql`, `lib/db.ts` e a skill Neon relevante                         |
| APIs Next.js                              | O guia correspondente em `node_modules/next/dist/docs/`                       |

Carregue apenas o material necessário. Preserve trabalho alheio e nunca toque em `.claude/worktrees/`.

## Como executar

1. Confira `git status`, pedido, branch e código atual.
2. Percorra o fluxo completo: entrada, autorização, persistência, efeito externo, consumidor e documentação.
3. Faça a menor mudança completa. Análise e plano permanecem leitura até haver autorização de implementação.
4. Resolva escolhas rotineiras com evidência. Pergunte quando faltar informação que mude escopo, dados, custo ou resultado.
5. Valide conforme o risco, revise o diff e atualize os contratos afetados.

Use npm e o lockfile existente. Não imprima nem versione segredos, cookies, `.env*` ou dados pessoais.

## Fluxo AI Native pelo Kanban

Quando o pedido partir de um card, use `$kanban-spec` com GPT-6 Astra para especificar, `$kanban-delivery` com GPT-5.6 Sol para implementar e abrir a PR, e `$kanban-pr-review` com GPT-6 Astra para revisão independente. O modelo selecionado no editor é a única evidência do modelo em uso.

O card é o contrato entre conversas. Use `npm run kanban` pelas rotas; não escreva diretamente nas tabelas. Registre PR, HEAD e validações antes de mover para **Em revisão**. Commit novo invalida o parecer anterior. Só conclua depois de merge e release exigidos pelo card.

## Invariantes do Studio

- O servidor resolve operador e tenant. Slug, UUID ou metadata enviados pelo cliente ou modelo não provam acesso.
- O cliente envia apenas a nova mensagem. O servidor carrega o histórico canônico, valida `UIMessage` e persiste partes tipadas.
- `WorkflowAgent` coordena o loop durável. Ferramentas com efeitos usam steps, leases e chaves idempotentes.
- A primeira criação lê `/dados` e a fonte oficial antes de produzir o artefato de contexto; depois inspeciona a referência e registra direção de arte. Build exige ambos.
- Logo e screenshots entram como partes multimodais. Base64 em texto não comprova análise visual.
- `google/gemini-3.8-flash` atende todos os papéis com reasoning `high`; geração visual usa `openai/gpt-image-2.5-sunburst` por padrão. A política está em `lib/studio/models.ts`; não invente modelo ou effort fora dela.
- Ferramentas não recebem credenciais. Paths passam pela política de workspace, symlinks são rejeitados e comandos são enumerados.
- Sandbox é efêmero. Checkpoints e código de release ficam em Blob privado; uma sessão não é a fonte de verdade.
- `content/schema.json` e `content/values.json` formam o contrato do CMS. Cada edição cria revisão imutável com hash e controle otimista.
- Preview exige sessão administrativa e token efêmero cujo hash fica no banco. Durante um run, acompanha o workspace autorizado; ao terminar, volta ao checkpoint validado. A URL persistida não contém o token.
- A primeira criação validada inicia publicação automaticamente. Alterações posteriores só publicam por ação explícita. Toda publicação congela código e conteúdo, executa build e smoke e só então promove. Um projeto Vercel por cliente; o projeto raiz nunca é alvo.
- Formulários, eventos e WhatsApp públicos exigem tenant, projeto e release ativos e usam a integração central.
- Erro técnico, isolamento, autoria e gates de release são garantias de código, não instruções de prompt.

## Identidade e conteúdo

A fonte oficial do cliente sustenta fatos. A referência visual principal sustenta layout, tipografia, ritmo e movimento. A direção cadastrada serve de fallback. Não copie marca, texto, imagens ou código de referência.

Siga [SOUL.md](SOUL.md) e os princípios anti-slop de [Taste Skill](https://www.tasteskill.dev/): identidade específica, hierarquia intencional, texto concreto e refinamento que serve à leitura. Responsividade, teclado, toque, movimento reduzido e HTML útil no servidor são requisitos.

## Segurança e operação

Rotas administrativas e chats exigem sessão. As rotas do Kanban também aceitam `KANBAN_AGENT_TOKEN`, restrito ao quadro e com autoria de agente. O piloto usa o workspace interno da EIXU e o admin continua global; ainda não há papéis por workspace ou tenant.

Antes de migração, reset, geração paga, Sandbox remoto, deploy ou outra escrita remota, confirme recurso e escopo já autorizados. O reset de sites preserva operadores, autenticação, Kanban e institucional; exige manifesto fresco, digest, fingerprint, deployment raiz READY e referência de recuperação. Nunca use `DROP DATABASE`, `DROP SCHEMA` ou `TRUNCATE ... CASCADE` genérico.

## Validação e entrega

Execute, conforme o risco:

```bash
npx next typegen && npx tsc --noEmit
npm run lint
npm run test:studio
npm run test:admin
npm run build:vercel
```

Verifique o fluxo afetado além da compilação. Não adicione testes que apenas repetem a implementação. Para publicação, confirme commit, deployment READY e smoke no domínio canônico. Diferencie código validado, código publicado e comportamento realmente exercitado.
