# Verificação

A validação deve provar o comportamento alterado no nível mais próximo possível e depois confirmar que a aplicação continua compilável. Build não prova acesso remoto, IA, Sandbox, banco ou release.

## Gate local obrigatório

```bash
npx next typegen && npx tsc --noEmit
npm run lint
npm run test:studio
npm run test:admin
npm run build:vercel
```

- `next typegen` compila os workflows e gera tipos de rota antes do TypeScript.
- `test:studio` cobre contratos, checkpoint/restauração com serviços simulados, conclusão e retomada do stream, seleção de stores e disponibilidade pública durante edições. O SELECT de disponibilidade é exercitado em SQLite local com o SQL real; não substitui os ensaios PostgreSQL.
- `test:admin` cobre autenticação, limites de entrada pública/administrativa e reset.
- `build:vercel` é o artefato de produção. Não substitua por Vinext, Vite ou outro bundler.

Use `npm run test:sites` quando a mudança estiver limitada aos contratos puros do Studio. Rode ambos os grupos quando a alteração cruzar painel, autenticação ou APIs públicas.

Também confira:

```bash
node --check scripts/reset-sites.mjs
node --check scripts/reset-sites-lib.mjs
npm audit
```

Formatar somente arquivos tocados evita reescrever o repositório inteiro:

```bash
npx oxfmt --check <arquivos>
```

## Verificação por área

### Chat e Workflow

Prove:

- cliente envia só a nova mensagem;
- servidor reconstrói o histórico autorizado;
- partes inválidas, payload grande e Blob de outro tenant são recusados;
- somente um run fica ativo por projeto;
- stream exige operador ativo e Workflow registrado; cancelamento também confere o tenant informado;
- conclusão, falha e cancelamento persistem mensagem e estado;
- uso registra o modelo real de cada passo.

No ambiente Vercel isolado, feche a aba durante um turno, retorne e confirme retomada sem chamada duplicada. Cancele durante uma ferramenta longa e confirme que ferramentas futuras não iniciam.

### Primeiro build

Use dados sintéticos com logo, site oficial e referência. Confirme a ordem de contexto e direção de arte pelos eventos/artefatos. O checkpoint deve falhar se qualquer artefato obrigatório faltar.

Valide o projeto gerado em desktop, mobile, teclado, toque e movimento reduzido. Verifique que `content/schema.json` inclui os textos e imagens de operação frequente.

### Sandbox e arquivos

Tente path absoluto, `..`, symlink, arquivo excessivo, arquivo protegido e comando fora da allowlist. Todos devem falhar antes do efeito. Restaure o Sandbox do digest do checkpoint e compare os arquivos protegidos.

Remova o Sandbox e restaure um checkpoint que contém lockfile, mas não `node_modules`: typecheck, build e prévia precisam funcionar após `npm ci`. `.gitignore` original deve passar no checkpoint; uma alteração deve ser recusada.

### Preview

Sem sessão administrativa, a rota central deve recusar. A URL do banco não pode conter token. Token inválido ou expirado deve falhar; token válido cria cookie efêmero e a página deve receber `noindex`, referrer policy e frame ancestor da EIXU.

Depois de uma edição falha/cancelada, abra a prévia: compare código e revisão de conteúdo com o último checkpoint e confirme a ausência de arquivos extras. Hash de arquivo compactado divergente ou instalação recusada não pode criar sessão de prévia.

### CMS

Salve uma revisão válida, tente editar com revisão antiga e confirme conflito. Valide tipo, tamanho, chave desconhecida e hash. A publicação precisa materializar exatamente a revisão congelada, mesmo se houver uma edição posterior.

### Publicação

Em projeto descartável autorizado:

1. confirme team e root project IDs;
2. crie o projeto dedicado;
3. confirme Vercel Auth restrita a `preview` e o bypass de automação exclusivo do projeto;
4. verifique uploads por digest e o deployment candidato protegido;
5. confirme `READY` e o marcador de revisão usando o bypass;
6. confirme vínculo do domínio no projeto dedicado;
7. promova;
8. execute smoke sem bypass no host canônico;
9. compare deployment SHA/revisão e ponteiro ativo no banco;
10. simule falha após promoção e rode reconciliação;
11. exerça rollback pelo mesmo pipeline.

Nunca considere um alias genérico ou um deployment anterior como prova da release atual.

### APIs públicas

Exercite origin/host válido, ausente quando permitido e divergente. Teste limites de JSON, nomes/campos, attribution, campaign e redirecionamento. Um tenant sem projeto/release ativa deve receber 404 ou recusa equivalente.

Mantenha uma release ativa e edite seu rascunho: formulário, eventos e WhatsApp devem continuar disponíveis com projeto `building`, `ready` ou `failed`. Arquivar o tenant/projeto ou remover a release ativa deve bloquear o tráfego.

## Banco

`npm run db:migrate` escreve no recurso indicado. Antes:

- identifique host/database sem imprimir credenciais;
- confirme o ambiente autorizado;
- confira se a migração é aditiva;
- faça backup/ponto de recuperação apropriado ao ambiente.

A compatibilidade relevante desta entrega é o acervo antigo poder repetir `batch_id`; a chave única do Studio é `studio_request_key` e só vale quando não nula.

## Reset

Gerar manifesto é leitura remota e não apaga dados:

```bash
npm run db:reset-sites -- --environment=preview --manifest
npm run db:reset-sites -- --environment=production --manifest
```

Revise timestamp, fingerprint, contagens preservadas, pares exatos de ID/nome dos projetos Vercel e inventário Blob com modo de acesso e ID de cada store. O store público exige `BLOB_READ_WRITE_TOKEN`; o privado exige `STUDIO_BLOB_STORE_ID` e OIDC válido. Os stores precisam ser distintos. Se o escopo mudar, descarte o manifesto. A execução exige `--scope-digest`, `--database-fingerprint` e `--manifest-created-at` do mesmo manifesto, confirmação do ambiente, `EIXU_RESET_PLATFORM_DEPLOYMENT_ID` READY e `EIXU_RESET_RECOVERY_REF`. O timestamp expira em 30 minutos.

Depois, o recibo precisa mostrar:

- zero registros em todas as tabelas de sites;
- operadores, sessões/autenticação e Kanban preservados;
- cards sem referência a tenants removidos;
- projetos de cliente ausentes e projeto raiz existente;
- prefixos Blob vazios;
- institucional e login respondendo;
- manutenção desligada somente após toda a verificação.

Produção e preview recebem manifestos próprios. Se compartilham um time Vercel, planeje a remoção de projetos uma vez e reconcilie o segundo manifesto antes de executar.

## O que exige serviço real

Os checks locais não comprovam:

- disponibilidade dos IDs/modelos GPT-5.6 no Gateway da conta;
- billing e metadata de custo;
- durabilidade do Workflow beta;
- política de rede e tempo do Sandbox;
- permissões de projeto/domínio/deployment na Vercel;
- schema aplicado em Neon;
- entrega DNS do wildcard.

Registre essas limitações literalmente. Não declare “validado em produção” quando houve apenas build local.
