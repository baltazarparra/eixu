# Validação e publicação

## Comandos existentes

Com dependências instaladas por `npm ci`, execute os checks separadamente para observar o resultado de cada um:

```bash
npm run lint
npx next typegen && npx tsc --noEmit
npm run build:vercel
git diff --check
```

`next typegen` prepara tipos de rotas e `next-env.d.ts` em um checkout limpo. O guia da versão instalada está em `node_modules/next/dist/docs/01-app/03-api-reference/06-cli/next.md`. O build pode precisar de rede para `next/font/google`. Nenhum desses comandos executa o seed, migrações ou chamadas de geração pagas.

Para documentação, confira links locais, comandos e fatos contra o código e rode:

```bash
npm run format -- --check README.md AGENTS.md docs
```

O projeto não possui script `test`, `verify` ou CI versionada. Não trate um comando inexistente como gate nem substitua falhas por uma declaração do modelo.

## Referência desta revisão

Checks executados em 09/09/2026 no código de `6a86807`, com Node.js 24.15.0:

| Check                                  | Resultado observado                                               |
| -------------------------------------- | ----------------------------------------------------------------- |
| `npx next typegen && npx tsc --noEmit` | Passou.                                                           |
| `npm run build:vercel`                 | Passou, Next.js 16.3.3/Turbopack.                                 |
| `npm run lint`                         | Falhou: 20 erros em 13 arquivos, anteriores à revisão documental. |

A dívida de lint compreende 3 diagnósticos de React Compiler, 14 de acessibilidade e 3 de expressões de template TypeScript. Afeta `components/ui/`, `components/terminal-headline.tsx` e `hooks/use-mobile.ts`. Reproduza com `npm run lint`; essa referência não é uma lista de exceções nem desliga regras. Uma entrega documental pode registrar essa falha preexistente com seu diff restrito; alteração funcional deve avaliar e corrigir os diagnósticos da área tocada. Não declarar o repositório inteiramente verde enquanto houver essa dívida.

Na mesma revisão, o build servido em `http://localhost:3100` passou em 22 verificações HTTP: 7 rotas públicas, 4 redirecionamentos administrativos, 10 recusas de API sem sessão e o bloqueio de acesso direto a `/s/*`. Formatação dos 5 documentos, 14 links locais, nomes dos scripts e preservação do bloco Next.js/import do Claude também foram conferidos. Isso não avalia chamadas pagas, fluxos autenticados ou qualidade comparativa dos modelos.

## Verificação pelo impacto

| Mudança                    | Evidência além do diff                                                                                                                                 |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| README/AGENTS/docs         | Links e comandos resolvem, fontes abertas sustentam as afirmações, instruções não duplicam ou contradizem contratos.                                   |
| Institucional ou CSS       | Build e navegador em desktop/mobile; navegação, CTA, metadados e ausência de regressão visual.                                                         |
| Blocos, lint ou publicação | Caso válido e inválido; API e ferramenta preservam snapshot ao recusar; render publicado e preview conferidos.                                         |
| Auth, tenant ou proxy      | Sessão ausente/expirada, cliente incorreto, host reservado, `/s/*`, query de preview e resposta pública. Ver limites atuais antes de afirmar proteção. |
| Formulário/tracking        | Em tenant de teste, um envio grava contato/evento, atribuição e consentimento e chega ao destino; conferir duplicação de clique.                       |
| Imagens ou ferramentas     | Falha parcial, candidata sem aprovação, aplicação de logo e remoção em uso; validar estado no banco/Blob de teste.                                     |
| Schema                     | Aplicar em banco isolado e reaplicar; conferir estruturas e consumidores, sem usar produção como teste.                                                |
| Modelo/prompt              | Casos de [avaliação do harness](harness.md#como-avaliar-mudanças-no-harness), com chamadas reais autorizadas e resultados registrados.                 |

O lint de código e o pre-flight `lintPage` têm funções distintas. Uma chamada real de chat pode escrever no banco e consumir créditos; um smoke HTTP não a substitui. Para fluxos com estado, prepare um tenant descartável e confirme o destino antes de executar. Não envie formulários reais ou clique em CTAs rastreados para validar uma mudança apenas documental.

## Publicação

O projeto Vercel `eixu` está ligado a `baltazarparra/eixu`, branch de produção `main`, Node.js 24.x e build `npm run build:vercel` (configuração conferida nesta revisão). Verifique novamente o vínculo e as regras Git antes do release.

1. Revise `git status` e o diff; execute os checks aplicáveis e registre falhas anteriores separadamente de regressões. Publique somente o escopo autorizado.
2. Faça commit e push pelo fluxo Git vigente. Se houver proteção/PR obrigatório, cumpra os checks e merge. Nunca use force-push para contornar proteção.
3. Localize o deployment e confira `meta.githubCommitSha`, branch e alvo. Aguarde o mesmo deployment chegar a `READY` e confirme os aliases atribuídos.
4. Faça smoke HTTP das rotas públicas e da barreira de autenticação. Para mudanças funcionais, também execute o fluxo afetado no navegador/ambiente apropriado.
5. Consulte os erros do deployment desde a publicação e entregue commit, URL, estado e limites do que foi verificado. Um `READY` anterior não valida o novo SHA.

Comandos de consulta, substituindo `URL_DO_DEPLOYMENT` pela URL retornada:

```bash
vercel project inspect eixu
vercel list eixu --environment production --format json
vercel inspect URL_DO_DEPLOYMENT --json
vercel logs URL_DO_DEPLOYMENT --level error --since 20m --json --no-branch
```

Para servir o build local, use `npx next start --hostname 127.0.0.1 --port 3100` e acesse `http://localhost:3100`; o proxy interpreta o host numérico `127.0.0.1` como tenant. Um smoke mínimo cobre `/`, cases, `/vibe-coding-para-producao`, `/admin/login`, redirecionamento de `/admin` sem sessão e 401 nas APIs administrativas e chats. Não exporte contatos nem imprima respostas autenticadas com dados de clientes.

Deploy de código não migra o banco e não publica rascunhos. Alterações de banco, Blob, domínio ou variáveis exigem seu próprio escopo operacional. Não use `db:seed-demo` ou `db:requantize-logos` como validação de release.

## Design do gerador, 10/09/2026

Validação local das alterações descritas em [Design dos sites gerados](design.md): tipos e build Next.js passaram, assim como lint dos arquivos funcionais alterados. O lint global reproduziu os 20 erros preexistentes acima. Foi necessário reconstruir sem o cache anterior para conferir que o CSS novo estava presente nos artefatos.

A fixture local usa texto e foto visíveis do site de exemplo, sem escrita no banco. Foram conferidos schemas legados e novos, recusa de props/layout/imagem inválidos, bloqueio de âncora duplicada, preservação do limite de headline, formulário com âncora padrão e personalizada, hero/lista sem imagem e bentos de 2–6 itens. No navegador: larguras de 320, 390, 768 e 1440 px sem overflow nos cenários visitados, menu mobile e FAQ nativos, destinos de âncoras, fontes e movimento reduzido. São verificações locais; não houve submissão de formulário, geração paga ou publicação remota.

No mesmo estado sintético de cliente, o prompt completo com catálogo passou de 10.988 para 8.285 caracteres, redução de 24,6%. Isso mede texto do prompt, não tokens faturados ou custo total. O evento `[chat] usage` permite a comparação futura de gerações equivalentes. Nenhuma avaliação comparativa de modelos foi executada.
