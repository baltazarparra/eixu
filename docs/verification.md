# Validação e publicação

## Comandos existentes

Com dependências instaladas por `npm ci`, execute os checks separadamente para observar o resultado de cada um:

```bash
npm run lint
npm run test:sites
npm run test:admin
npx next typegen && npx tsc --noEmit
npm run build:vercel
git diff --check
```

Para incluir a prova de isolamento do cookie na captura, rode `test:admin` com `EIXU_CHROME_PATH` apontando para o executável local do Chrome. Sem ele, esse caso é pulado; os demais testes não precisam de navegador.

`tests/admin-concurrency.test.mjs` exige um PostgreSQL local descartável chamado `eixu_pr2_test`, indicado por `EIXU_TEST_POSTGRES_URL`. A suíte recusa hosts remotos, aplica `db/schema.sql` nesse banco e exercita o driver Neon e seus locks por um proxy WebSocket local; Blob, rede social e visão são simulados. Sem a variável, somente essa suíte de integração é pulada. Para incluí-la, execute `npm run test:admin` com a variável apontando para esse banco local.

`next typegen` prepara tipos de rotas e `next-env.d.ts` em um checkout limpo. O guia da versão instalada está em `node_modules/next/dist/docs/01-app/03-api-reference/06-cli/next.md`. O build pode precisar de rede para `next/font/google`. Nenhum desses comandos executa o seed, migrações ou chamadas de geração pagas.

Para documentação, confira links locais, comandos e fatos contra o código e rode:

```bash
npm run format -- --check README.md AGENTS.md docs
```

O projeto possui `test:sites` e `test:admin`, com testes de contrato sem banco e uma suíte opcional de concorrência em PostgreSQL local. Nenhum desses testes usa geração paga. Não possui script genérico `test`, `verify` ou CI versionada. Não trate um comando inexistente como gate nem substitua falhas por uma declaração do modelo.

## Upgrade para Opus 5, 10/09/2026

O fallback do chat, dos críticos de foto/logo, da descrição de avatar social e
dos dois runners passou a `anthropic/claude-opus-5`. O ID foi confirmado no
catálogo público e em `gateway.getAvailableModels()` com a credencial do EIXU.
O lockfile e o AI SDK 7 instalado foram preservados. Configurações explícitas
de `EIXU_MODEL` e `EIXU_CRITIC_MODEL` continuam prevalecendo sobre o fallback.

- `test:sites`: 63 passaram. `test:admin`: 26 passaram; captura com Chrome e
  integração Postgres foram puladas por ausência da configuração local.
- Tipos, build Next.js 16.3.3, lint dos seis arquivos de código alterados e
  formatação dos documentos alterados passaram. O lint global continua com os
  20 erros preexistentes em 13 arquivos fora do escopo.
- `eval-admin-cost` com Opus 5 e `--live`: três execuções corretas, com prompt
  e schemas reais, preservando toda a página exceto a altura do logo do
  cabeçalho. Tempos de 8,4, 9,4 e 11,3 segundos. O limite de 800 tokens de
  saída por chamada foi suficiente neste caso simples.
- Streaming real completou dois passos com chamada de ferramenta em memória
  e resposta textual. Outra chamada reconheceu a cor de uma imagem sintética
  e retornou a saída estruturada validada por Zod. Os cinco ensaios custaram
  aproximadamente US$ 0,87 no Gateway.

Os artefatos locais ficam em `outputs/admin-review/` e
`outputs/opus-5/compatibility.json`, ignorados pelo Git. Não houve escrita em
Neon/Blob, geração de fotos, alteração de variáveis remotas ou deploy. Esses
ensaios comprovam a integração básica; não avaliam a geração de um site
completo nem demonstram vantagem de qualidade ou custo sobre Opus 4.5.

## Revisão do admin, 10/09/2026

O escopo, comparação de custo, verificações e limitações estão em [Revisão do admin](admin-review.md). O manual de operação está em [Admin](admin.md). Os registros abaixo preservam as evidências de cada entrega anterior e não devem ser lidos como uma medição da versão atual.

## Referência documental de 09/09/2026

Checks executados em 09/09/2026 no código de `6a86807`, com Node.js 24.15.0:

| Check                                  | Resultado observado                                               |
| -------------------------------------- | ----------------------------------------------------------------- |
| `npx next typegen && npx tsc --noEmit` | Passou.                                                           |
| `npm run build:vercel`                 | Passou, Next.js 16.3.3/Turbopack.                                 |
| `npm run lint`                         | Falhou: 20 erros em 13 arquivos, anteriores à revisão documental. |

A dívida de lint compreende 3 diagnósticos de React Compiler, 14 de acessibilidade e 3 de expressões de template TypeScript. Afeta `components/ui/`, `components/terminal-headline.tsx` e `hooks/use-mobile.ts`. Reproduza com `npm run lint`; essa referência não é uma lista de exceções nem desliga regras. Uma entrega documental pode registrar essa falha preexistente com seu diff restrito; alteração funcional deve avaliar e corrigir os diagnósticos da área tocada. Não declarar o repositório inteiramente verde enquanto houver essa dívida.

Na mesma revisão, o build servido em `http://localhost:3100` passou em 22 verificações HTTP: 7 rotas públicas, 4 redirecionamentos administrativos, 10 recusas de API sem sessão e o bloqueio de acesso direto a `/s/*`. Formatação dos 5 documentos, 14 links locais, nomes dos scripts e preservação do bloco Next.js/import do Claude também foram conferidos. Isso não avalia chamadas pagas, fluxos autenticados ou qualidade comparativa dos modelos.

## Cadastro de marca e cenas aprovadas no chat, 10/09/2026

### Correções da revisão do PR #3

Os quatro achados restantes da revisão receberam correção e regressão:
cadastro preservando cliente/logo diante de falha na leitura social; reserva
de orçamento antes de qualquer espera e exclusão de geração concorrente por
tenant; destaque com contraste medido por superfície; avaliação chegando à
revisão depois das aprovações, inclusive no atelier, e registrando término
incompleto quando o limite é esgotado.

- `test:sites`: 63 casos passaram, incluindo chamadas simultâneas, candidata
  posterior ao snapshot da rota, liberação de orçamento sem tentativa paga,
  contraste por tom e o fluxo do runner nos seis layouts com modelos simulados.
- `test:admin` com Chrome: 27 passaram; a integração Postgres foi executada
  separadamente, com 11 casos aprovados. Ela usou PostgreSQL local descartável
  e o driver Neon real, confirmando exclusão mútua entre conexões, independência
  entre tenants, coexistência com o lock de upload e liberação após rollback e
  commit. Blob e rede permaneceram simulados.
- Tipos, build Next.js 16.3.3, formatação e lint dos arquivos alterados passaram.
  O lint global continua com os 20 erros anteriores, nos mesmos 13 arquivos.
- O CSS do build foi aplicado a componentes reais com dados sintéticos no
  Chrome: 336 amostras de destaque em cada largura, 1440 e 390 px, com mínimo
  de 4,507:1; o par texto/fundo dos botões teve mínimo de 4,634:1. Nenhum
  overflow. A regra antiga que sobrescrevia a cor do FAQ aberto foi corrigida.
- O smoke HTTP local passou em oito casos: institucional/login em 200, APIs
  administrativas/chat sem sessão em 401, chat de imagens removido e acesso
  direto a site de cliente em 404.

Não houve chamada paga, escrita em Neon/Blob remoto nem publicação de páginas
de clientes. As medições do navegador usaram fixtures, não sites publicados.
O runner foi exercitado com fases simuladas; `eval:site --generate` com os
provedores reais continua pendente. O schema não mudou.

### Evidência anterior às correções

Tipos (`next typegen` + `tsc --noEmit`), `npm run test:sites` com 47 casos,
`npm run test:admin` com 22 executados e dois pulados (navegador e Postgres
local), build Next.js de produção e formatação passaram. O lint global manteve
os 20 erros preexistentes nos mesmos 13 arquivos, sem diagnóstico novo no
escopo alterado. A entrega foi integrada com a exclusão de cliente e a leitura
de rede social já mescladas em `main`; o upload do cadastro passou a usar o
mesmo helper de Blob daquela entrega.

Os testes novos cobrem o que a mudança decide: `sceneCoverage` casando vaga por
bloco e por proporção, recusando proporção errada, ausente ou fora do
vocabulário; a etapa de cenas aberta antes da composição e fechada depois;
candidata que não cobre vaga, entra na fila de decisão na ordem certa e
distingue a que já está no rascunho; as três cores do cadastro recusando
hexadecimal inválido e cores iguais; e o token de acento caindo na cor primária
num cliente sem `highlight`, que é o que preserva os sites já publicados.

Uma revisão adversarial do diff apontou quatro defeitos, corrigidos antes da
entrega: `set_design` recusava cliente antigo sem `paletteSource` porque a
paleta existente não era lida; o laço parava em qualquer etapa diante de
candidata antiga, travando até o briefing; a recusa tratava falha ao apagar o
arquivo como imagem em uso; e a cobertura aceitava proporção desconhecida,
o que dava o plano por coberto sem foto utilizável.

O build servido em `127.0.0.1:3100` respondeu 200 no institucional, nos cases e
no login, 404 em `/api/images/chat` e no acesso direto a `/s/`, e 401 nas APIs
administrativas e no chat sem sessão. O CSS de produção emite `--highlight` em
29 regras e `--highlight-ink` em 6, preservando `var(--accent)` nas
superfícies.

Não foi executada geração paga nesta entrega. O ciclo de aprovação com chamada
real ao modelo, o `eval:site --generate` com a aprovação pelo runner e a
conferência visual dos sites publicados com o token de acento continuam
pendentes. Também não houve verificação em banco: os testes de contrato rodam
sem Neon e sem Blob.

## Exclusão de cliente, rede social no briefing e briefing explicado, 10/09/2026

Tipos, `npm run test:sites` com 44 casos, `npm run test:admin` com 20 casos mais
um pulado sem Chrome, build Next.js de produção e formatação passaram. O lint
global manteve os mesmos 20 erros preexistentes nos 13 arquivos da referência,
sem diagnóstico novo no escopo alterado.

No painel local, com sessão de operador, dois clientes descartáveis exercitaram
a exclusão. O rascunho confirmou em um clique; o publicado, com uma página e um
contato, exigiu digitar o endereço, e o botão continuou travado com um endereço
errado. Depois de excluir, a consulta de leitura mostrou zero registros, zero
páginas e contatos órfãos e zero arquivos no prefixo do Blob; o host do cliente
respondeu 404 e os demais clientes continuaram em 200. A rota nova de rede
social respondeu 401 sem sessão.

A leitura de perfil foi medida contra as redes reais, sem chamada de modelo:

| Perfil                        | Resultado                                       |
| ----------------------------- | ----------------------------------------------- |
| `linkedin.com/company/vercel` | nome, seguidores, tagline e avatar              |
| `@natgeo`                     | nome, seguidores, bio e avatar                  |
| `@padariasantaluzia`          | bloqueado: o Instagram devolveu a tela de login |
| `linkedin.com/in/<pessoa>`    | bloqueado: 999, perfil pessoal                  |

Três defeitos apareceram nessa medição e foram corrigidos com teste. O padrão
de meta tag passou a exigir que o conteúdo fique dentro da própria tag, porque
a versão com backreference atravessava tags e capturava metade do documento.
As descrições são lidas em português e inglês, e o cabeçalho de idioma saiu:
em português o Instagram troca o texto por um resumo sem bio. O decodificador
ganhou uma segunda passada, porque o LinkedIn entrega a bio codificada duas
vezes e `&amp;#39;` chegava literal ao briefing.

Uma execução paga autorizada leu a página da Vercel no LinkedIn em 4,1 segundos
num tenant descartável: copiou o avatar para `tenants/<slug>/social/` no Blob e
descreveu a imagem pelo modelo crítico ("triângulo branco centralizado sobre
fundo preto"), gravando tudo em `brief.social`. O tenant e o arquivo foram
apagados em seguida pelo mesmo caminho da exclusão. Uma chamada de visão por
avatar novo não é um custo medido por cliente.

O contraste do botão de exclusão foi medido, não estimado: texto claro sobre o
vermelho de erro dá 3,02, e o tom escuro da marca dá 4,71. O botão usa o tom
escuro. O diálogo precisou de `margin: auto` porque o reset do Tailwind zera a
margem e tira a centralização do `dialog` modal. Cadastro e Dados foram
conferidos em 390 px, com as legendas quebrando sem overflow.

Não foram executados: leitura do Instagram a partir de um IP da Vercel, que
tende a falhar mais que a máquina local, e geração de site com o perfil lido no
prompt. O prompt foi conferido por leitura nas três variações (lido, bloqueado
e pendente).

## Verificação pelo impacto

As correções da revisão do PR #2 acrescentam regressões para merge por chave e preservação do briefing consolidado no prompt de imagens. Os testes de concorrência conferem troca de URL, releitura da mesma URL, remoção durante leitura, clear atrasado, reutilização do avatar sem repetir visão, descarte após upload, as duas ordens de upload/exclusão, isolamento entre tenants, falha no Blob e confirmação pelo estado atual.

Na validação local dessas correções, os 46 testes de site e 30 testes de admin passaram, com um caso de captura pulado sem Chrome. A integração usou PostgreSQL 18.4 descartável e o driver Neon instalado, sem banco remoto, Blob real ou geração paga. Tipos, build Next.js de produção e oito verificações HTTP passaram: institucional, login, redirecionamento do admin, quatro recusas de API sem sessão e bloqueio de acesso direto a `/s/*`. O lint global manteve os 20 erros preexistentes em 13 arquivos, sem diagnóstico nos arquivos alterados. O schema do produto permaneceu inalterado.

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

Validação local das alterações descritas em [Design dos sites gerados](design.md): tipos e build Next.js passaram, assim como lint dos arquivos funcionais alterados. O lint global reproduziu os 20 erros preexistentes acima. Uma consulta somente leitura confirmou a execução da comparação de silhuetas no Neon, sem retornar conteúdo de outros tenants.

Três fixtures sintéticas reutilizaram os mesmos componentes em direções deliberadamente diferentes: capa fotográfica para logística, pôster editorial para restaurante e composição técnica deslocada. Foram inspecionadas em 390 e 1440 px, sem overflow, com fontes, hierarquia, contraste, recortes e assinaturas visuais distintos. A home legada de Mais Um também foi servida pelo build de produção e permaneceu funcional. As fixtures e capturas não são versionadas e não escreveram no banco.

Os checks puros confirmaram aceitação e recusa de schemas, distância estrutural, bloqueio de página v2 genérica e assinatura de composição independente de texto e imagem. Uma execução real do modelo configurado, com um briefing sintético de climatização e imagens já resumidas no contexto, chamou `set_design` e `build_site`, gerou uma página com sete blocos, sete decisões de layout e quatro de apresentação, consumindo 16.840 tokens de entrada e 2.194 de saída. Não houve escrita porque as ferramentas foram substituídas por coletores na avaliação.

O prompt-base com catálogo mede 7.858 caracteres, contra 8.285 na revisão anterior e 10.988 antes da compactação do catálogo. A geração passou a receber até oito imagens aprovadas no primeiro contexto, eliminando uma rodada de `list_images` no caso comum. Os números de tokens observados em execuções com quantidades diferentes de páginas não formam um benchmark controlado; o evento `[chat] usage` continua sendo a fonte para comparar gerações equivalentes.

## Riqueza visual, motion e inbound, 10/09/2026

`npm run test:sites` passou em 14 casos: mínimo orgânico, imagens distintas do tenant, candidatura/aprovação, imagens ocultas ou inválidas, conteúdo/SEO/intenção repetidos, links e âncoras, ciclos desconectados e estado prospectivo de publicação pontual. Os testes não usam banco nem geração paga. Uma chamada real de publicação no Porto Pedras antigo retornou bloqueios e preservou o hash dos snapshots antes/depois; a consulta de duplicação também foi executada no Neon, incluindo rascunhos e publicados.

Tipos, build Next.js/Turbopack, formatação e lint do escopo alterado passaram. O lint global reproduziu os 20 erros preexistentes nos 13 arquivos da referência, sem diagnósticos novos. O build servido localmente passou em 14 verificações HTTP de páginas, sites legados, redirecionamento administrativo e recusas sem sessão; a rota temporária respondeu 404. Mais Um e EIXU foram conferidos no navegador em desktop/mobile, sem overflow ou erro de console. Com sessão autenticada, API e ferramenta recusaram a publicação do Porto Pedras antigo (zero páginas publicadas, cinco bloqueios cada); um lote inválido de `build_site` também foi recusado. O hash de rascunhos e snapshots permaneceu igual antes/depois desses checks.

A composição de revisão do Porto Pedras tem home, materiais, guia de escolha e obrigado. Home/materiais/guia foram inspecionados em 1440 e 390 px; a home também em 320 e 768 px, sem overflow horizontal. Foram exercitados menu mobile, clique e setas nas abas, hover dos botões, transição de imagem e movimento reduzido. A medição registrou deslocamento de hover e opacidades intermediárias no crossfade; com movimento reduzido não havia animação rodando após a seleção. Sem JavaScript, a home manteve texto visível, imagens, formulário e links alternativos do explorador. Uma divergência de `tabIndex` na hidratação foi corrigida e a repetição ficou sem erros de console.

Duas avaliações reais usaram `anthropic/claude-opus-4.5`, briefing do Porto Pedras e ferramentas substituídas por coletores/validadores, sem publicar nem gravar páginas. A primeira consumiu 117.566 tokens de entrada e 17.250 de saída; erros no lote induziram tentativas de editar páginas inexistentes. Após explicitar limites e recuperação, a segunda chegou a quatro páginas válidas com `set_design`, dois `build_site` e `lint_site`: 96.975 tokens de entrada e 16.701 de saída. Houve reenvio por campos obrigatórios e limite de texto. Esses números não demonstram economia controlada nem custo resolvido. A saída do modelo foi renderizada em desktop/mobile; a revisão editorial encontrou capacidades operacionais sem evidência, que foram removidas da proposta de publicação e explicitamente proibidas no prompt. O relatório de `build_site` passou a incluir pendências de publicação para evitar uma leitura redundante. Essas últimas orientações não receberam uma terceira avaliação paga.

O pipeline real gerou duas fotos candidatas complementares no Blob/Neon e executou a crítica, mantendo o status `candidata`. A proposta passou no gate de rascunho; sua publicação depende da aprovação explícita dessas imagens pelo operador. A crítica não foi usada como aprovação. Capturas e saídas completas da avaliação ficam em `outputs/creative-v3/`, ignorado pelo Git; a rota temporária de revisão é removida antes do build de produção. A validade deste registro visual não equivale à publicação das páginas do cliente.

Após a aprovação explícita do operador em 10/09/2026, as fotos #4 e #5 do Porto Pedras foram aprovadas, a direção mineral foi aplicada e as quatro páginas foram publicadas pelo serviço compartilhado. A consulta posterior confirmou os snapshots iguais aos rascunhos, três páginas orgânicas com intenções distintas, três fotos geradas aprovadas usadas na home e nenhum erro de `lintPage`/`lintSite`. Home, materiais, guia, obrigado, sitemap e robots retornaram 200 no domínio público; o sitemap contém as três páginas orgânicas e obrigado permanece com `noindex`. O código funcional corresponde a `03aa858dda592946500c0e996e5229fad82fe692`, com deployment Vercel `READY` e alias de produção conferidos. Essa publicação foi restrita ao Porto Pedras; os demais clientes não tiveram seus rascunhos republicados.

A inspeção do build público detectou que `creative.css`, importado por `@import` depois do Tailwind, não estava no CSS de produção. O carregamento foi movido para um import direto no layout de `(sites)`. O build Next.js passou a emitir os seletores de atelier, explorador e recursos editoriais. A checagem visual precisa usar o build de produção e conferir estilos computados em desktop/mobile; a prévia de desenvolvimento não detectou essa regressão.

## Avaliação entre negócios e reparos, 10/09/2026

Duas gerações automáticas, sem editar a saída para a captura, usaram briefings controlados de aquecimento residencial e pedras naturais. As ferramentas de escrita foram substituídas por coletores com schemas, `lintPage`, `lintSite` e validação de direção; fotos existentes foram reutilizadas sem gerar, aprovar ou publicar imagens. O renderer e o CSS do build Next.js serviram as quatro páginas de cada caso, com inspeção das três orgânicas em 1440/390 px. Não houve overflow, imagem quebrada ou erro de console. Essa avaliação do modelo não executa a persistência real do chat.

O Opus 4.5 gerou o primeiro caso com 38.093 tokens de entrada e 6.149 de saída. No segundo, a ausência de presentation induziu o reenvio das quatro páginas: 84.740 de entrada e 12.434 de saída. A revisão encontrou capacidades comerciais sem evidência e um elemento-assinatura descrito, mas pouco realizado na composição. O prompt passou a delimitar oferta também no SEO/FAQ e exigir uma assinatura traduzida nas opções reais. A repetição do primeiro caso usou hero editorial e 71.173/7.397 tokens; houve passos de ferramenta recusados antes da execução. A composição mudou, mas o recorte horizontal prejudicou uma foto vertical e o texto ainda supôs visita. Não há evidência de custo resolvido nem de qualidade uniforme com esse modelo.

`repair_site` foi acrescentado para o desperdício observado: mantém o lote apenas durante o turno e aceita reparos por campo, preservando páginas inalteradas. Os 20 testes de contrato cobrem isolamento entre instâncias, ausência de lote, alvo inválido sem mutação parcial, mescla de apresentação, remoção de props inválidas e revalidação. O caminho de gravação continua compartilhado com `build_site`; aprovação de imagem e publicação não são inferidas. O teste não grava um lote válido no Neon. O painel também distingue retorno recusado de projeto salvo; não anuncia pre-flight aprovado quando `ok=false`. Os artefatos de avaliação continuam em `outputs/creative-v3/`, ignorados pelo Git.

Uma avaliação adicional com `anthropic/claude-fable-5.1`, confirmado no catálogo do Gateway, produziu quatro páginas válidas com o mesmo briefing de aquecimento: 84.523 tokens de entrada, 11.527 de saída e 156 segundos. O modelo pediu uma cena de detalhe complementar e tentou corrigir dois avisos de eyebrow; o coletor recusou geração de imagem e edição posterior, portanto as capturas representam o primeiro lote válido. A revisão encontrou melhor preservação da oferta e recorte vertical, mas overflow na variante offset. O renderer ganhou largura explícita da imagem, colunas que podem encolher e ordem mobile compatível com o contêiner de fotos. O modelo de produção permanece inalterado; o ensaio não comprova vantagem de custo nem o fluxo completo com geração de imagens.

O replay determinístico do lote de pedras demonstrou a correção exata com 14 reparos: 1.456 caracteres de entrada contra 14.077 no reenvio completo. O resultado reconstruído foi profundamente igual ao segundo lote do modelo. Essa redução de payload não é uma medição de tokens faturados nem comprova que o modelo sempre escolherá o reparo.

Após a correção, as homes automáticas de aquecimento (offset) e pedras (atelier) foram verificadas novamente no build de produção em 1440/390 px: largura da página igual à viewport e zero erros de console. A rota temporária foi removida antes do build de release. O lint global segue com os mesmos 20 erros preexistentes; tipos, os 20 testes e lint do escopo passaram.

## Altura do logo pelo chat, 10/09/2026

`nav.bar` e `footer.compact` passaram a aceitar `logoHeight` opcional de 16 a 160 px. Os 21 testes passaram, incluindo compatibilidade de props legadas, limites numéricos no catálogo e aceitação/recusa no schema e no pre-flight. Tipos, build Next.js e lint do escopo passaram; o lint global manteve os 20 erros em 13 arquivos anteriores, sem diagnóstico novo.

O HTML dos componentes reais, com props parseadas pelo schema e CSS emitido pelo build de produção, foi servido em fixture isolada. Foram medidas 35 combinações por viewport em 1440, 390 e 320 px: quatro variantes de navegação, três de rodapé, logos quadrados/largos, tamanho máximo e defaults legados. A altura solicitada de 50 px foi preservada, logos largos couberam no espaço disponível, o menu mobile abriu e não houve overflow nem erro de console. A fixture não foi adicionada às rotas do produto.

Uma chamada real de `anthropic/claude-opus-4.5` recebeu “deixa o logo maior, 50px height”, com os schemas e o prompt do produto e executores substituídos por coletores em memória. Chamou apenas `get_page` e `update_block` com `logoHeight: 50` no cabeçalho; preservou as outras props e o rodapé. Consumiu 32.248 tokens de entrada e 186 de saída. Esse ensaio confirma a escolha da ferramenta, sem testar persistência real do chat nem publicar páginas de clientes. Artefatos locais ficam em `outputs/logo-height/`, ignorado pelo Git.

## Piso de composição e geração em etapas, 10/09/2026

Tipos, `npm run test:sites` com 36 casos, build Next.js de produção e formatação
passaram. O lint global manteve os 20 erros preexistentes nos mesmos 13
arquivos, sem diagnóstico novo no escopo alterado. O build servido em
`127.0.0.1:3100` respondeu 200 no institucional, no login e nas páginas de
cliente com `__tenant`, e 401 nas APIs administrativas sem sessão; o acesso
direto a `/s/` sem reescrita continua 404.

As regras novas foram aplicadas por leitura aos dois tenants reais, sem
escrever nada. O contraste é o esperado e reproduz o diagnóstico manual:

| Medida                       | Mecânica Sabiá  | Porto Pedras       |
| ---------------------------- | --------------- | ------------------ |
| Erros de composição          | 3               | 0                  |
| Home: seções, fotos, tons    | 5, 2, três tons | 6, 3, quatro tons  |
| Seção protagonista na home   | nenhuma         | `feature.explorer` |
| Páginas orgânicas sem imagem | 2               | 0                  |
| Avisos de proporção          | 2               | 6                  |

Os dois avisos do Sabiá são exatamente os defeitos observados no site
publicado: foto 4:3 num hero editorial que exibe 16:9 e foto 4:5 numa narrativa
editorial que exibe o mesmo 16:9. Os seis avisos do Porto Pedras mostram que
nem a composição manual acertou o enquadramento por bloco; são avisos, não
bloqueios.

A captura da revisão foi exercitada com Chromium local contra o build de
produção: quatro capturas em 10 segundos, 450 kB, sem overflow e sem imagem
quebrada em 1440 e 390. Contra o site publicado do Porto Pedras, seis capturas
em 15 segundos. A primeira versão da medição acusava imagens quebradas em
`loading="lazy"` ainda decodificando; a checagem passou a exigir `complete` com
`naturalWidth` zero.

### Geração completa, 10/09/2026

Com créditos restabelecidos, o caso `mecanica-sabia` rodou o fluxo inteiro em
tenant descartável, com `anthropic/claude-opus-4.5`. As duas correções acima
resolveram o ciclo: a composição caiu de doze passos e mais de 300 mil tokens,
sem gravar nada, para seis passos que gravaram o projeto.

| Fase               | Passos | Entrada | Saída  | Tempo |
| ------------------ | ------ | ------- | ------ | ----- |
| Briefing e direção | 3      | 18.422  | 2.458  | 50 s  |
| Composição         | 6      | 94.167  | 15.340 | 177 s |
| Revisão            | 10     | 117.417 | 2.841  | 92 s  |

Cada fase coube nos 300 segundos da função. A fase de revisão exerceu o ciclo
completo: chamou `review_pages`, leu a página, corrigiu blocos, chamou
`review_pages` de novo e conferiu. Numa das rodadas ela detectou que a home
tinha perdido a seção protagonista, removeu o bloco responsável e inseriu uma
galeria com as duas fotos, zerando os erros.

Resultado automático, sem edição manual entre a geração e a medição: três
páginas orgânicas, home com sete seções, duas fotos, quatro tons e seção
protagonista, 270 palavras; `/servicos` com seis seções, duas fotos e três
momentos de motion; `/duvidas-frequentes` com seis seções e uma foto. Zero
erros de projeto, zero erros de página e zero avisos estruturais. Em 1440 e
390 px não houve overflow nem imagem quebrada.

A comparação com a saída anterior do mesmo negócio é direta: a home tinha cinco
seções, três delas só texto, duas fotos concentradas na abertura, nenhuma seção
protagonista e duas subpáginas sem imagem alguma.

### Segundo negócio, com geração real de cenas

O caso `aquecimento` rodou o fluxo inteiro em tenant descartável, desta vez
gerando as imagens em vez de reaproveitar biblioteca existente.

| Fase               | Passos | Entrada | Saída | Tempo |
| ------------------ | ------ | ------- | ----- | ----- |
| Briefing e direção | 3      | 17.062  | 2.280 | 33 s  |
| Cenas              | 2      | 9.027   | 612   | 76 s  |
| Composição         | 3      | 37.079  | 7.366 | 85 s  |

Total de 118.878 tokens de entrada, 10.777 de saída e 226 segundos. A fase de
cenas produziu cinco fotos em uma chamada, nas proporções que os blocos exibem:
4:5 para o hero offset, 4:3 para as duas cenas do explorador, 5:6 para a
narrativa e 16:9 para a imagem solta. A composição teve uma recusa por
`ritmo-generico` e foi corrigida por `repair_site` no mesmo turno.

Resultado automático: três páginas orgânicas, home com seis seções, três fotos,
quatro tons e `feature.explorer` como seção protagonista; `/aquecedor-residencial`
com sete seções e `/como-funciona` com cinco. Zero erros de projeto e de página.

A execução expôs um laço: a fase de revisão repetiu três vezes sem ter o que
corrigir. A causa era o cálculo de progresso contar a aprovação de imagem
pendente como erro bloqueante, e ela é decisão do operador, não trabalho do
agente. Corrigido, com teste que compara o progresso com as mesmas páginas e
imagens candidatas ou aprovadas.

As cinco imagens desse caso aparecem aprovadas na biblioteca. Não há caminho de
código que aprove imagem automaticamente: `setStatus` só é chamado pelas
ferramentas do estúdio, que exigem pedido do operador, e pela API do painel,
que é ação direta dele. A aprovação veio pelo checkpoint do painel.

### Contraste das seções de cor

A primeira geração expôs um defeito real do renderizador, não do agente: o
texto de apoio das seções coloridas vinha de uma mistura fixa no CSS. Medido na
paleta gerada, dava 3,56 contra a cor de marca, abaixo do mínimo AA. Como o
contrato agora empurra seções em accent e secondary, o defeito aparecia em toda
página. O token passou a ser calculado por medição, como já era feito na paleta
base, com um valor por tom.

| Tom       | Texto de apoio | Fundo   | Contraste |
| --------- | -------------- | ------- | --------- |
| paper     | #68707d        | #f8fafc | 4,78      |
| soft      | #5d6675        | #e2e8f0 | 4,70      |
| ink       | #b2b7be        | #1e293b | 7,25      |
| accent    | #251b19        | #ea580c | 4,72      |
| secondary | #eef3fd        | #2563eb | 4,65      |

No mesmo ciclo, a legenda do card em destaque da grade bento caía sobre a foto
e ficava ilegível quando a seção tinha cor; o bloco de texto ganhou fundo
próprio.

### Captura em pixels foi medida e recusada

A revisão chegou a devolver as capturas ao modelo como imagem. A tentativa
falhou antes do primeiro passo: 697.374 tokens de entrada contra 200.000 de
limite do modelo, porque o conteúdo em base64 permanece no histórico a cada
passo da fase. `review_pages` passou a devolver só a medição do navegador
(largura da página, overflow e imagens quebradas por viewport), que é o que a
revisão estrutural não alcança. O módulo de captura continua no repositório e
serve à avaliação local, onde as imagens são gravadas em arquivo.

### Tentativas anteriores e limites da avaliação

A avaliação de geração ficou incompleta. A fase de briefing rodou por inteiro
no caso `mecanica-sabia`: 3 passos, 18.422 tokens de entrada, 2.458 de saída,
50 segundos, produzindo guia de imagem com paleta, sujeitos e proibições, mais
uma direção v2 com distância estrutural aceita.

A fase de composição falhou duas vezes seguidas. Em cada tentativa o modelo
gastou dez a doze chamadas de `describe_block` antes de montar, e depois entrou
em ciclo: `build_site` recusava o lote inteiro por pendência de projeto,
`repair_site` não conseguia resolver e o lote era reenviado. Resultado por
tentativa: 12 passos, 283 e 308 segundos, 327.544 e 290.645 tokens de entrada.
Nenhuma página foi gravada. A terceira tentativa parou com falta de créditos no
AI Gateway.

Duas correções foram feitas a partir dessa evidência. `describe_block` saiu da
fase de composição, porque o catálogo daquela fase já traz as props. Pendência
de projeto deixou de recusar a gravação: página com props inválidas continua
recusando o lote inteiro, mas o lote válido é gravado e as pendências voltam no
campo `pendencias`, para o agente resolver antes de encerrar. A publicação
continua exigindo `lintSite` limpo, em ambos os caminhos.

A avaliação parou nesse ponto por falta de créditos no Gateway. Os resultados
depois de restabelecidos estão nas seções anteriores.

Continua sem comprovação a nota pela rubrica de `docs/eval-rubric.md`, que
depende de revisão humana, e a repetição do mesmo caso, para separar acerto de
variação entre execuções. Uma queda de DNS do banco interrompeu uma das rodadas de
revisão no meio, e a rodada seguinte terminou o trabalho: o fluxo é retomável,
mas isso não prova tolerância a falhas dentro de cada ferramenta. A revisão posterior do admin interrompe a sequência ao receber erro e permite retomada explícita.

### Publicação

O código funcional corresponde a `f4850498cabf0d76dc76e33cd44304acaf9ad8de`,
com deployment Vercel `dpl_DjtgoseArPLZ9GcXwvoH5yWmJHTi` em estado `READY` no
alvo de produção. O smoke público respondeu 200 no institucional, no login do
painel, na home do Porto Pedras e em uma página interna do Mecânica Sabiá.
Nenhuma página de cliente foi republicada e nenhum rascunho foi alterado por
esta entrega: ela muda o gerador, não o conteúdo já publicado.

`EIXU_REVIEW_CAPTURE` não foi configurada em produção. Sem ela a revisão é
estrutural; para ligar a captura, defina a variável no projeto e confira o
tempo da função na primeira execução.
