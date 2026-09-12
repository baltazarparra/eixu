# Validação e publicação

## Conferência única com entrega do rascunho, 12/09/2026

Conferir passou a ter uma única passagem por geração. O SDK força a primeira
leitura e encerra na indisponibilidade visual, sem edições motivadas pela falha.
Erros conhecidos ainda permitem reparo e uma conferência focal no mesmo turno;
não há novas rodadas automáticas. Timeout, recusa ou pendências na conferência
entregam o rascunho com aviso, preservando os erros e o pre-flight de publicação.
O recibo `brief.generation.delivery` é separado do certificado visual e fica
inválido quando o rascunho muda. Não há migração de schema.

Verificação local:

- Tipos (`npx next typegen && npx tsc --noEmit`), lint global,
  `git diff --check` e build Next.js de produção passaram, incluindo os três
  checks dos artefatos de captura serverless.
- `EIXU_CHROME_PATH=/usr/bin/google-chrome npm run test:admin`: 120 casos,
  117 passaram e três integrações PostgreSQL foram puladas por ausência de
  `EIXU_TEST_POSTGRES_URL`. O SDK real com modelo simulado fez uma única chamada
  ao receber indisponibilidade, sem editar. O runner foi verificado com timeout,
  erro do provedor, ausência de avanço, limite de passos, reparo que deixou
  erro estrutural, pausa e retomada de execução legada.
- `npm run test:sites` com Chromium local: 125 casos passaram, incluindo os
  contratos de publicação e preservação do snapshot.
- Oito testes de navegador existentes passaram. O novo teste de entrega com
  revisão pendente passou após corrigir o seletor do iframe e abrir a aba
  Conversa no celular: em 1440 e 390 px, geração concluída, aviso visível, chat
  liberado, prévia preservada e nenhuma nova execução após recarga. Capturas em
  `outputs/generation/entrega-revisao-pendente-{1440,390}.png`.

Não houve geração paga, escrita de cliente ou deploy. O operador excluiu
`fiskprivate` durante o diagnóstico; o caso foi reproduzido com fixtures, sem
recriar o cliente. A causa específica da indisponibilidade do crítico naquele
run não foi confirmada pelos logs de produção.

## Cabeçalho único do editor, 12/09/2026

O handoff `design_handoff_cabecalho_unico` trocou os três cabeçalhos do editor
(página com 132 px, conversa com 46 px e prévia com 75 px) por uma barra de
64 px em `components/admin/navigation.tsx`. `TenantFrame` monta dois slots
(`.admin-bar-slot`, com `display: contents`) e `WorkspaceHeader` injeta por
portal o grupo PRÉVIA e o grupo de decisão. O seletor de página é um menu com
foco itinerante em `components/admin/page-picker.tsx`: mostra o caminho, marca
o rascunho e devolve o foco ao gatilho ao fechar. `Ver prévia` e `Abrir prévia`
viraram um único ícone que abre a página em foco. O diamante compacto passou a
32 px, no grupo de decisão, e `.admin-conversation-heading`,
`.admin-preview-controls` e `.admin-page-selector` saíram do CSS.

Desvio do handoff, medido no navegador: com o grupo PRÉVIA na barra, a régua
completa precisa de cerca de 1.520 px; sem o rótulo PRÉVIA, cabe até 1.280 px
com o caminho da página encurtando. Abaixo de 1.280 px o grupo volta para uma
faixa no topo da coluna da prévia e a barra fica em 52 px, sem a linha do
domínio; o handoff previa essa faixa só abaixo de 1.024 px. Entre 768 e
1.023 px as abas ocupam uma segunda linha (92 px); abaixo de 768 px a decisão
também ganha linha própria (132 px), como o cabeçalho anterior no celular.

Verificação na base `main`, com as alterações locais:

- `npx next typegen && npx tsc --noEmit`, `npm run lint`,
  `npm run format -- --check README.md AGENTS.md docs` e `git diff --check`:
  sem erros. O lint recusou `role="listbox"` em `ul`/`li`; o menu usa
  `role="menu"` com botões `menuitemradio`, sem desligar regra.
- `npm run build:vercel`: Next.js 16.3.3 compilou e os três checks dos
  artefatos serverless passaram. A fixture do handoff lê o CSS de
  `.next/static/chunks`, por isso o build precede o teste de navegador.
- `EIXU_CHROME_PATH=/usr/bin/google-chrome npm run test:admin:browser`: 8
  passaram. O teste do handoff agora mede a barra em 320, 390, 1280, 1440 e
  1920 px: nenhum item fora da largura nem sobreposto, um seletor visível por
  largura e altura de 64 px a partir de 1280 px. Também abre o seletor pelo
  teclado, escolhe `/servicos` com as setas, confere o `src` do iframe e o
  `title` do ícone de abrir, e verifica que Esc devolve o foco ao gatilho.
- `EIXU_CHROME_PATH=/usr/bin/google-chrome npm run test:admin`: 120 testes;
  117 passaram e 3 integrações com PostgreSQL foram puladas por falta de
  `EIXU_TEST_POSTGRES_URL`. `npm run test:sites`: 125 passaram. Tipos, lint,
  build e os três conjuntos foram repetidos depois do rebase sobre o `main`
  com a gramática por vibe e o diamante sem anel, num worktree limpo.
- Medição própria com a fixture do handoff em 320, 390, 768, 1024, 1280,
  1440, 1600 e 1920 px, com capturas: barra de 64 px de 1280 px para cima
  (folga de 62 px em 1280 e de 627 px em 1920), 52 px em 1024, 92 px em 768 e
  132 px em 320/390. Menu aberto em 1440 com três páginas (caminho em mono,
  título em segunda linha, rascunho marcado) e caminho longo
  `/servicos-planejados` inteiro em 1280. Captura da geração em execução em
  `outputs/generation/painel-rodando.png`, com o diamante compacto ao lado de
  Publicar.

## Correções da revisão do PR #26, 12/09/2026

Os cinco achados foram corrigidos antes do merge. A unicidade preserva a
comparação exata para perfis v2/v3 e aplica o limite proporcional só em v4;
layouts implícitos de outro cliente são resolvidos pela marca do respectivo
snapshot. A publicação pontual usa a marca publicada em todos os validadores,
enquanto publicação completa ou primeira publicação sem snapshot usa a marca
do rascunho. O piso de decisões de layout e apresentação também alcança v4.
Retomadas legadas conservam o plano de cenas, pedidos semânticos e cobertura;
prompt e crítico respeitam a mesma versão. A seção protagonista de v4 precisa
reunir duas fotos geradas distintas do cliente no próprio bloco permitido.

- Os 13 testes novos em `tests/site-vibe-regressions.test.mjs` passaram. Na
  versão original do PR, `ae8231a`, dez deles falharam. Os casos exercitam os
  validadores reais, publicação sem gravações quando recusada, `set_blocks`,
  versões v2/v3/v4, snapshots de marca, retomada nas quatro vibes e o contrato
  enviado ao crítico. Banco e modelo são simulados nesses testes.
- `EIXU_CHROME_PATH=/usr/bin/google-chrome npm run test:sites`: 125 passaram.
- `EIXU_CHROME_PATH=/usr/bin/google-chrome npm run test:admin`: 117 passaram;
  três integrações foram puladas por falta de `EIXU_TEST_POSTGRES_URL`.
- Tipos, lint e `npm run build:vercel`: aprovados, incluindo os três checks
  dos arquivos necessários à captura serverless.
- Navegador com Chrome local: 16 testes de sites e oito de admin passaram.
  Formatação de README, AGENTS, documentação e arquivos alterados, além de
  `git diff --check`, também passaram.
- A consulta SQL real de `compositionConflict` foi executada separadamente
  em PGlite temporário, fora das dependências do projeto: passou nos casos de
  marca publicada diferente do rascunho, exclusão do próprio tenant,
  igualdade exata legada, mudança de tom em v3 e similaridade em v4. Esse
  ensaio verifica a consulta, sem substituir as integrações Neon/WebSocket.

Não houve geração paga, acesso a dados de produção, migração nem publicação
de páginas de clientes. O teste do crítico verifica instruções e transporte,
sem avaliar a qualidade de uma chamada real do modelo.

## Gramática da vibe na composição, 12/09/2026

Diagnóstico medido no banco de produção, em leitura apenas: `chiquinho`
(artístico) e `tech` (ousado), com vibes e referências diferentes, tinham
quatro das cinco seções da home iguais, nos mesmos layouts e na mesma ordem, e
nenhum gate apontava nada. A silhueta medida pelos dois rascunhos dá 0,80 de
similaridade, acima do limite de 0,75 que passou a recusar a home.

A vibe passou a definir a silhueta: `VIBE_GRAMMAR` em `lib/design/vibes.ts`
guarda abertura, seção protagonista, aberturas internas, fechamentos, vetos e
alvos de cena; `scenePlan` deriva o repertório de fotos dessa gramática; o
pre-flight recusa a home que abra fora dela ou sem a seção protagonista da
vibe. Uma referência verificada deixou de pular a faixa inteira e passou a
liberar só os eixos do aspecto documentado. O perfil subiu para a versão 4, que
preserva a vibe no renderer; v2 e v3 continuam como foram publicados.

Verificação na base `main` com as alterações locais:

- `npx next typegen && npx tsc --noEmit`, `npm run lint`,
  `npm run format -- --check README.md AGENTS.md docs`: sem erros.
- `npm run test:sites`: 111 passaram, incluindo oito testes novos de gramática,
  silhueta, faixa por aspecto e catálogo por vibe.
- `npm run test:admin`: 115 passaram.
- `EIXU_CHROME_PATH=... npm run test:sites:browser`: 16 passaram, com o teste
  de referência conferindo no CSS real que a vibe permanece, que a superfície
  documentada não recebe a lavagem artística e que não há rolagem horizontal
  em 390 e 1440 px.
- `EIXU_CHROME_PATH=... npm run test:admin:browser`: 8 passaram.
- `npm run build:vercel`: Next.js 16.3.3 compilou e os três checks dos
  artefatos serverless passaram.
- Script de leitura contra o banco de produção, sem escrita: confirmou a
  similaridade de 0,80, que os perfis v3 dos dois clientes não recebem
  apontamento novo e que, sob a versão 4, a mesma composição receberia
  `abertura-fora-da-vibe` e `protagonista-fora-da-vibe` nas duas homes.

Não houve avaliação de geração com o modelo. Recompor `chiquinho` e `tech` com
o perfil v4 é geração paga e depende de pedido do operador; os dois continuam
no ar com a composição atual.

## Ajuste do diamante e interação, 12/09/2026

O anel foi removido da cena, incluindo geometria, shaders e estado exclusivo.
A pedra usa 70% da escala anterior nas duas versões; a área compacta continua
com 40 px. A velocidade automática caiu de 0,55 para 0,275 rad/s durante a
geração e de 0,12 para 0,06 rad/s em espera. Mouse sobre a pedra e arraste por
toque acrescentam impulso horizontal, permitindo acelerar, frear e inverter
o giro, com retorno gradual à velocidade automática.

Tipos, lint global, build Next.js com os três checks serverless e os oito
testes de navegador do admin passaram. `test:sites` passou nos 104 casos;
`test:admin` passou nos 117 executados, com três integrações PostgreSQL puladas
por falta de `EIXU_TEST_POSTGRES_URL`.

Uma fixture local com o componente real e CSS do build foi conferida em Chrome
com SwiftShader, em 1000×800 e 390×844, com eventos nativos de mouse e toque
emulado. A cena contém apenas a pedra. O giro medido passou de 0,275 para
0,879 rad/s com o mouse, caiu para 0,383 com o gesto contrário e chegou a
-0,346 ao inverter. Por toque, acelerou para 0,949 e inverteu para -0,591.
A rolagem vertical continuou disponível e soltou a captura do ponteiro.
Também passaram liberação fora da pedra, versão compacta, giro em espera,
perda do contexto WebGL e movimento reduzido: manipulação direta sem giro
automático nem inércia, incluindo mudança da preferência com a página aberta.
Não houve erro de shader ou console.

Capturas, fixture e medições ficam em `outputs/diamond-check/`, ignorado pelo
Git. A verificação de toque usou emulação; não houve teste em aparelho físico.

O código funcional corresponde a `10099405ee53b373574778a4333d832bebe99d08`,
com deployment Vercel `dpl_Atx7TcjaKH4B28xAb17jQXuvPQ2j` em estado `READY`
no alvo de produção. O build remoto confirmou o mesmo commit e passou nos três
checks dos artefatos serverless. O smoke em `eixu.com.br` respondeu 200 na home
e no login administrativo; a consulta dos logs do deployment não encontrou
erros. A interação do diamante não foi repetida em produção porque exige sessão
e uma geração ativa; a prova interativa permaneceu na fixture local, sem
geração paga nem escrita em banco.

## Diamante da geração na prévia, 12/09/2026

A prévia vazia durante a geração passou a mostrar um diamante negro em WebGL
(`components/admin/generation-diamond.tsx`, com o `three` já instalado):
lapidação brilhante procedural, shader próprio com fresnel, refração com
dispersão e estúdio escuro, facetas que se fecham conforme o progresso e anel
em órbita com as três etapas do painel. Depois da primeira página, a versão
compacta fica na barra da prévia até a execução terminar. O progresso vem de
`creationProgress`, em `lib/generation/progress.ts`, que passou a concentrar
também `PRODUCT_STAGES` e `phaseProgress` usados pelo painel: só etapas feitas
e unidades medidas, sem porcentagem estimada pelo tempo.

Verificação na base `main`, com as alterações locais:

- `npx next typegen && npx tsc --noEmit`, `npm run lint`,
  `npm run format -- --check README.md AGENTS.md docs` e `git diff --check`:
  sem erros.
- `EIXU_CHROME_PATH=/usr/bin/google-chrome npm run test:admin`: 120 testes;
  117 passaram e 3 integrações com PostgreSQL foram puladas por falta de
  `EIXU_TEST_POSTGRES_URL`. Inclui o teste novo de `creationProgress`
  (briefing sem unidade, cenas, composição, pausa, revisão e concluída).
- `EIXU_CHROME_PATH=/usr/bin/google-chrome npm run test:sites`: 104 passaram.
- `npm run build:vercel`: Next.js 16.3.3 compilou e os três checks dos
  artefatos serverless passaram. O CSS gerado contém `.sr-only` e
  `.admin-preview-loader`.
- `EIXU_CHROME_PATH=/usr/bin/google-chrome npm run test:admin:browser`: 8
  passaram. O teste da geração agora afirma que, sem página, o loader mostra
  a mesma etapa e unidade do painel e declara `data-state` `live` ou
  `fallback`; com página e execução viva só o compacto permanece; concluída,
  nenhum indicador fica. Captura real do workspace em
  `outputs/generation/previa-diamante.png`.
- Harness isolado fora do repositório (esbuild + Chrome headless com
  SwiftShader, WebGL 2): os estados briefing, cenas, composição, revisão,
  concluída, aguardando e compacto renderizaram sem erro de shader ou console,
  inclusive com `prefers-reduced-motion: reduce`; sequência de quadros
  confirmou rotação, precessão do anel e variação dos brilhos. Capturas
  conferidas em 900×640, 830×880 e 1440×1000.

A revisão do diff apontou dois defeitos, corrigidos antes da publicação. O
diamante recebia `active` fixo em verdadeiro e anunciava etapa em execução
durante um turno livre do chat, contradizendo a pílula "Parada" do painel ao
lado; agora só a geração o move, e parado ele mostra "aguardando". E
`renderer.dispose()` não encerra o contexto WebGL, então cada montagem deixava
um contexto vivo numa aba que troca de cliente o dia todo; a limpeza passou a
chamar `forceContextLoss()`. O laço também deixou de alocar vetores por quadro
e trata `webglcontextlost` caindo para o texto da etapa.

Não houve geração paga, escrita em banco remoto, publicação nem deploy. O
desempenho do WebGL foi observado só em SwiftShader; em GPU real o custo é
menor, mas não foi medido. A vista **Prévia** no celular com o diamante não
foi fotografada; o layout usa as mesmas regras do desktop com altura mínima de
320 px.

## Admin, criação e revisão incremental, 12/09/2026

O fluxo administrativo foi revisto da entrada a Tráfego. A criação apresenta
três etapas de produto, cadastro compacto e quatro direções visuais comparáveis;
o servidor mantém checkpoints próprios para retomada. A revisão executa
pre-flight antes dos pixels, reutiliza recibos atuais por página, captura duas
páginas por vez com repetição local e preserva capturas válidas e achados
anteriores diante de falha técnica. Referências verificadas continuam com
prioridade visual; na ausência delas, os perfis v3 aplicam contratos radicais
das quatro vibes. A publicação promove apresentação global e dados editoriais
junto de blocos e SEO. O schema inicializa o snapshot de páginas e clientes que
já estavam publicados.

Verificação final na base `main` integrada:

- `npx next typegen && npx tsc --noEmit`, `npm run lint`, formatação dos
  arquivos alterados e `git diff --check`: sem erros.
- `EIXU_CHROME_PATH=/usr/bin/google-chrome npm run test:admin`: 119 testes;
  116 passaram e 3 integrações com PostgreSQL foram puladas porque
  `EIXU_TEST_POSTGRES_URL` não está disponível nesta máquina. Os dois testes de
  captura real com Chrome passaram.
- `EIXU_CHROME_PATH=/usr/bin/google-chrome npm run test:sites`: 104 testes
  passaram, sem pulos, incluindo captura externa em navegador real, voz por
  vibe, prioridade das referências, uso exato de imagens, contratos v3 e
  preservação do snapshot público.
- `npm run build:vercel`: Next.js 16.3.3 compilou e os três checks dos artefatos
  serverless de captura passaram.
- Navegador: os 8 testes de `test:admin:browser` e os 16 de
  `test:sites:browser` passaram, incluindo as quatro vibes, fontes reais,
  teclado, movimento reduzido, JavaScript desligado, contraste mínimo medido de
  4,608:1 e referência visual contra vibes conflitantes. O caso de referência
  foi repetido após explicitar o contrato de renderização v3.
- O cadastro foi inspecionado em 390 e 1440 px: quatro informações de negócio
  ficam visíveis, contexto/marca permanecem recolhidos, as quatro miniaturas
  têm silhuetas diferentes e não houve overflow. O painel mobile separa etapa,
  unidades e relógio, inclusive na segunda rodada da revisão. Capturas locais
  ficam em `outputs/admin-handoff/` e `outputs/generation/`, ignoradas pelo Git.

A integração revelou e corrigiu uma incompatibilidade: perfis v3 com referência
não eram reconhecidos pelo helper legado, e a mudança de `referenceDirection`
não alterava o fingerprint quando ainda não havia páginas. O renderer agora
aceita v2/v3, identifica a autoridade visual no DOM e impede que o CSS radical
da vibe sobreponha a referência; qualquer mudança dessa direção invalida o
recibo de revisão.

Não houve migração ou escrita em banco remoto, geração paga, publicação de
página de cliente nem deploy. A sintaxe nova do schema não foi exercitada em um
PostgreSQL local porque esse serviço não está disponível. A implantação deve
aplicar o schema antes do código. As fixtures comprovam contratos e
comportamento responsivo, mas não substituem a matriz paga de três briefings por
quatro vibes nem uma avaliação humana sem rótulos.

## Escrita simples e voz por vibe, 11/09/2026

O [contrato de escrita](copy.md) passou a orientar geração, edição e crítica.
Os validadores de página também apontam vocabulário e frases longas e recusam
rótulos de ação pouco claros da lista explícita. Os recibos anteriores são
invalidados pela nova versão do harness.

- `npx next typegen && npx tsc --noEmit` e `npm run lint`: sem erros.
- `npm run test:sites`: 95 testes passaram. Os dez novos cobrem as quatro
  vibes em todas as fases/edições, fallback legado, mudança de vibe invalidando
  recibo, leitura dos campos de texto, limites de palavra, exceções de contexto,
  publicação do site/página bloqueada antes da escrita e liberada após reparo,
  e envio de voz/textos/sinais ao crítico junto dos pixels.
- `npm run test:admin`: 106 testes passaram e cinco foram pulados por falta de
  configuração de Chrome (dois) e PostgreSQL local (três). A nova regressão usa
  a ferramenta real de revisão com captura e modelo simulados para conferir
  que erro de linguagem impede a conclusão e fica no recibo.
- `npm run build:vercel`: build de produção aprovado, incluindo os três testes
  dos arquivos de captura no artefato serverless.

Os testes de publicação usam o serviço e o validador de página reais, com banco,
acervo e validação global substituídos para isolar a regra de escrita. Os testes
do crítico substituem o modelo: comprovam o transporte e os controles, não a
qualidade da geração de texto. Não houve avaliação paga, teste de compreensão
com pessoas do público, escrita remota ou publicação neste ciclo. Conteúdos de
clientes existentes permanecem como estavam.

Para a entrega em produção, a branch incorporou a `main` em `1ec319e`, mantendo
a correção que permite publicar com avisos e recusa erros. O conflito neste
histórico foi resolvido preservando os dois registros. Na base integrada,
tipos e lint passaram; sites teve 95 testes aprovados e admin, 113 aprovados
com os mesmos cinco pulos de ambiente. O build Next.js de produção e os três
checks dos artefatos serverless foram repetidos antes da integração final.

## Correção do resumo da revisão no PR #22, 12/09/2026

O resumo silencioso contava nomes de ferramentas, incluindo recusas devolvidas
por `safe()` como `{ error }`. Uma edição de bloco inexistente, com zero
gravações, aparecia no chat como "aplicou 1 ajuste". O runner agora preserva os
resultados e conta somente edições confirmadas com `ok: true` e leituras com
captura e crítica completas. Uma leitura que encontra erros continua sendo
leitura válida; indisponibilidade, desativação e limite não viram conclusão.
O recibo do rascunho atual mantém a decisão de concluir ou continuar a geração.

A branch incorporou a `main` em `7f60691`, preservando o painel dentro da
conversa e os dois registros que conflitavam neste documento.

- As duas regressões falharam antes da correção e passaram depois. Uma executa
  o SDK instalado com modelo simulado e a ferramenta `update_block` real,
  confirmando zero gravações e zero ajustes. A outra cobre as seis ferramentas
  de edição e diferencia leitura com achados de revisão incompleta ou recusada.
- `npx next typegen && npx tsc --noEmit` e `npm run lint`: sem erros, com a
  configuração versionada do PR em checkout separado.
- `npm run test:admin`: 112 passaram, 5 pulados na execução inicial. Os dois
  casos de `tests/admin-capture.test.mjs` passaram depois com Chromium local;
  restam três testes de integração não executados por falta de PostgreSQL local.
- `npm run test:sites`: 85 passaram, sem pulos.
- `npm run build:vercel`: aprovado, incluindo os três checks dos artefatos de
  captura serverless.
- `npm run test:admin:browser` com Chromium local: oito testes passaram, sem
  pulos, usando o CSS do build e serviços sintéticos. Cobrem chat, publicação,
  geração, recarga, revisão em rodadas, início automático, cronômetro, consumo,
  navegação e handoff em desktop e celular.

Não houve geração paga, alteração de banco remoto ou publicação de páginas de
clientes. Os testes simulam o modelo; não constituem avaliação de geração real.

## Gate de publicação e mensagens da geração, 12/09/2026

Caso real do cliente portopedras, entre 00:37 e 00:55 UTC de 12/09/2026, lido
no banco de produção e nos logs da Vercel. A revisão em etapas terminou limpa:
recibo sem erros, próxima etapa "pronto", run encerrado como concluído. O botão
Publicar estava habilitado e a API respondeu "Bloqueado em /, /": o serviço de
publicação recusava qualquer achado do `lintSite`, inclusive os dois avisos de
proporção de imagem na home, enquanto o painel só conta erros. O aviso não
trazia o motivo; colado no chat, abriu um turno livre de dez minutos que alterou
a home e gerou uma foto, o que invalidou o recibo de revisão. O painel então
dizia "A execução terminou com etapas pendentes", culpando uma execução que
havia fechado sem pendência.

- `lib/sites/publish.ts`: só achados de nível erro recusam o lote; avisos não
  bloqueiam. A resposta agrupa os motivos por página, uma entrada por caminho.
- Painel: o aviso de publicação mostra os caminhos e o primeiro motivo, sem o
  prefixo da regra, e aponta para a lista de pendências ao lado da prévia.
- Painel: run concluído com etapa pendente passa a dizer que o rascunho ou o
  gerador mudaram depois e que a revisão precisa ser refeita com Continuar.
- Recibo do chat: depois da composição, informa páginas e fotos em vez de
  "3 de 6 cenas"; o caso pronto diz "concluída sem erros" e pede conferência
  antes de publicar.
- Runner: quando a revisão encerra na conferência limpa sem texto do agente, a
  resposta resume leituras, ajustes e sugestões restantes antes do recibo.

Verificação:

- `npx next typegen && npx tsc --noEmit` e `npm run lint`: sem erros.
- `npm run test:admin`: 110 testes passaram, 5 pulados por falta de PostgreSQL
  local e Chrome nesta máquina. Casos novos em `tests/admin-publish.test.mjs`
  cobrem avisos que publicam, erros agrupados por página sem gravação e slug
  inexistente; a suíte da geração cobre o recibo por etapa e o resumo da
  revisão silenciosa.
- `npm run test:sites`: 85 testes passaram, sem pulos.
- `npm run build:vercel`: build de produção e os três checks dos artefatos de
  captura serverless passaram.
- Com o código atual, o rascunho de portopedras não tem achado de lint nem
  silhueta duplicada; a publicação passa a depender só da confirmação do
  operador. A leitura do banco foi somente consulta: não houve publicação,
  geração paga, escrita remota nem execução dos testes de navegador.

Limite que permanece: a assinatura do recibo inclui o SHA do deploy, então
cada publicação de código invalida a revisão visual de todos os clientes, e o
botão Continuar reabre uma rodada paga por cliente. A comparação de silhueta
com outros clientes continua só no gate de publicação, fora do estado do
painel.

## Prioridade de referências no cadastro, 11/09/2026

Referências do cadastro passaram a orientar estrutura, tipografia, imagens e
ritmo acima da vibe, com leitura visual separada e aplicações persistidas para
composição e crítica. O fallback de clientes sem leitura visual preserva a
faixa, e a direção aplicada impede que o CSS da vibe volte a impor outro estilo.
A implementação e seus limites estão em [Design](design.md#referências-acima-da-vibe).

- Tipos, lint global e build Next.js de produção passaram, incluindo os três
  checks dos artefatos de captura serverless.
- Sites: 103 testes passaram, sem pulos. A regressão cobre leitura obrigatória,
  fonte removida ou bloqueada, evidência só textual, prioridades contrárias à
  vibe, paleta do operador, contraste e gravação no tenant correto. O plano
  persiste em todas as fases e sua alteração invalida a revisão anterior.
- Admin: 115 testes passaram; três integrações foram puladas por ausência de
  PostgreSQL local. Os testes de captura com Chrome foram executados.
- Navegador: 16 testes passaram, sem pulos. O caso novo mede as três vibes
  restritivas com direção por referência em 390/1440 px, usando componentes e
  CSS do build. Superfície, família tipográfica declarada e posição do hero
  seguem a direção; não houve overflow. A suíte existente também verifica as
  fontes reais, teclado, contraste e comportamento sem JavaScript.
- O teste de captura externa executa CSS e JavaScript em navegador real,
  verifica desktop/mobile, corte de altura, recusa de POST e rede privada,
  inclusive após redirect. Uma página pesada no desktop não consome o
  orçamento do mobile. Os testes de análise e crítica usam substitutos do
  modelo e conferem bytes como partes de imagem, sem base64 no histórico.
- Uma leitura pública do Linear confirmou extração textual e capturas nas duas
  larguras. Recursos bloqueados/ausentes e corte de altura limitam essa leitura;
  não a tratamos como observação integral da fonte. As capturas sintéticas e
  desse ensaio ficam em `outputs/references/`, ignorado pelo Git.

Sem migração, escrita remota, geração paga, publicação de código ou publicação
de páginas de clientes. Os checks confirmam o contrato e a apresentação do
renderer; a qualidade de uma geração completa com referências pelo Gemini
continua sem avaliação real neste ciclo.

## Progresso da geração dentro da conversa, 11/09/2026

O andamento ocupava a faixa superior da coluna direita e empurrava a prévia para
baixo, e o rail de clientes tomava 252 px em toda tela do painel. Esta entrega
move o painel de geração para dentro da conversa, como bloco compacto logo
abaixo do cabeçalho dela, devolve a altura inteira à prévia e troca o rail por um
botão de voltar no cabeçalho do cliente. A identidade do operador e a saída
passam a viajar por contexto e são desenhadas nos cabeçalhos da lista e do
cliente. Nada de novo aparece: os mesmos dados, rótulos e estados do painel,
reorganizados. O nome e o resultado de cada fase saem das trilhas e viram o
`title` delas; a linha do tempo continua trazendo o mesmo conteúdo.

- `npx next typegen && npx tsc --noEmit`: sem erros.
- `npm run lint`: zero apontamentos.
- `npm run test:admin`: 110 testes, 105 passaram e 5 pularam por falta de
  PostgreSQL local. A asserção de `railClients` saiu junto com a consulta.
- `npm run test:sites`: 85 testes, sem pulos.
- `npm run build:vercel`: aprovado, incluindo os três testes dos arquivos de
  captura no artefato serverless.
- `npm run test:admin:browser` com Chrome local: 8 testes, todos passaram. O
  caso do handoff passou a navegar pela linha da lista e a voltar pelo botão do
  cabeçalho, conferindo que não existem mais rail nem barra móvel e que a saída
  aparece uma vez por tela. O caso da geração passou a exigir o bloco com altura
  real na vista Conversa do celular, no lugar da faixa que foi removida.
- Capturas do painel real, com o CSS do build, em `outputs/generation/`
  (execução, conclusão, início automático, celular e consumo) e em
  `outputs/admin-handoff/` (lista, editor, imagens, dados e tráfego em 390 e
  1440 px).

Limite assumido: no celular, na vista **Prévia**, não há indicador de execução —
a faixa que duplicava o painel foi removida com ele. O andamento continua na
vista **Conversa**. Sem migração, seed, geração paga, escrita remota ou
publicação de cliente neste ciclo.

## Iconografia e tipografia das quatro vibes, 11/09/2026

O gerador ganhou 14 famílias tipográficas e 26 símbolos semânticos, com
tratamento regular, leve, forte ou duotone conforme a vibe. Catálogo, schemas,
faixas, prompts e renderer foram atualizados juntos. A descrição do sistema
e dos pareamentos está em [Design](design.md#tipografia-e-iconografia-por-vibe).

- `npm run lint` e `npx next typegen && npx tsc --noEmit`: sem erros.
- `npm run test:sites`: 85 testes passaram, sem pulos. Os quatro casos novos
  exercitam os 70 pares de display/corpo no schema e nos tokens, as faixas das
  vibes, clientes legados, os 26 SVGs em quatro estilos e os ícones em todas
  as variantes de serviços, bento, explorer e recursos. SVG arbitrário continua
  sendo recusado pelo schema.
- Admin: 124 testes passaram, sem pulos, com Chrome e PostgreSQL 14 descartável
  em `127.0.0.1`. Execução serial com `node --test --test-concurrency=1
tests/admin-*.test.mjs`, `EIXU_CHROME_PATH` e `EIXU_TEST_POSTGRES_URL`.
- `npm run build:vercel`: Next.js de produção e os três checks dos artefatos
  de captura serverless passaram.
- `EIXU_CHROME_PATH=… npm run test:sites:browser`: 15 testes passaram, sem pulos.
  A fixture usa os componentes reais, CSS e fontes do build, com dados sintéticos.
  As quatro vibes foram medidas em 320, 390, 768, 1440 e 1920 px sem overflow
  horizontal. Capturas de 390/1440 px foram inspecionadas.
- Os pares de demonstração carregaram somente as duas famílias usadas em cada
  página; as 14 famílias do catálogo foram carregadas e verificadas com texto
  em português. Abas e FAQs funcionaram por teclado; foco/hover responderam,
  e movimento reduzido desativou as transições. Texto, SVGs e disclosure nativo
  continuaram disponíveis com JavaScript desligado. Sem erros de hidratação.
- A regressão existente mediu contraste mínimo de 4,608:1 nos 60 pares de
  texto/fundo do hero artístico e localização, em desktop e celular. Isso
  não equivale a medir toda possível combinação de marca e conteúdo.
- Smoke local do build: institucional e login responderam 200, `/admin` chegou
  a `/admin/login` no navegador sem sessão e a API de estado respondeu 401.

A inspeção corrigiu uma regra antiga de lead que sobrepunha escala/entrelinha,
preservou os ícones semânticos nas abas mobile e fez o desligamento de motion
prevalecer sobre o reset global. Capturas, medições e comparação interativa
ficam em `outputs/visual-system/`, ignorado pelo Git. Não há rota de demonstração
no produto.

Na revisão para publicação, a inserção do ícone como terceiro filho do grid de
depoimento `split` foi corrigida: símbolo e citação formam a primeira coluna,
com autoria alinhada à direita no desktop e abaixo no celular. O teste de
navegador reproduziu a falha antes da correção e verifica as quatro vibes
em 390/1440 px.

A validação local não exigiu migração, escrita remota ou geração paga. Os testes não
avaliam uma geração completa pelo modelo nem páginas reais de clientes.
Os snapshots persistidos permanecem intactos; a apresentação passará a usar
o novo renderer quando esse código for implantado.

## Handoff do painel administrativo, 11/09/2026

Implementação das seis telas do handoff com navegação lateral, cabeçalho por
cliente, fontes locais, formulário com descarte, acervo numerado e série diária
de tráfego. A referência de estados virou componentes, sem rota de demonstração.
A branch incorpora `ee97843` da main e conserva a revisão em rodadas e seus
controles. As decisões de adaptação estão em [Design](design.md#painel-administrativo).

- Lint global e `npx next typegen && npx tsc --noEmit`: sem erros.
- `npm run test:sites`: 81 testes passaram, sem pulos.
- Admin: 124 testes passaram, sem pulos, com Chrome e PostgreSQL 14 local
  descartável. Execução serial com `node --test --test-concurrency=1
tests/admin-*.test.mjs`, `EIXU_CHROME_PATH` e `EIXU_TEST_POSTGRES_URL`.
  Os casos novos exercitam SQL real para isolamento por tenant, limite diário
  de Brasília, repetição de visitas/ações, dias vazios e gastos parciais.
- Navegador: oito testes passaram, sem pulos. Cobertura de chat, geração,
  revisão em rodadas, pausa, recarga, relógio e consumo por teclado;
  navegação, filtros, estados vazios, criação de fatos, validação de cores,
  descarte de campos repetidos, falha e sucesso de salvamento, confirmação
  de exclusão, retorno de foco e atualização dos layouts após publicar.
- As seis telas foram medidas em 320, 390, 1280, 1440 e 1920 px, sem overflow
  horizontal da página. Capturas em 390/1440 px foram revisadas. O teste exige
  que seletor e botões da prévia não se sobreponham. O consumo foi conferido
  em 1440×900, 390×844 e 375×667, inclusive a última linha por teclado.
- `npm run build:vercel`: Next.js de produção e três verificações dos
  artefatos serverless aprovados. O CSS desse build alimenta as fixtures de
  navegador, que renderizam os componentes reais com serviços sintéticos.
- Smoke do build Next.js: institucional e login disponíveis; cinco rotas
  administrativas redirecionaram à entrada sem exibir a navegação privada;
  credencial inválida recusada; state, images e CSV responderam 401 sem
  sessão. Login em 390/1440 px com fontes carregadas, sem overflow nem
  exceções no navegador. O institucional manteve seu layout próprio.
- Contraste dos pares principais medido em sRGB: apoio/superfície 5,04:1,
  texto/fundo 17,16:1, botão primário 8,38:1 e destrutivo 6,20:1. Movimento
  reduzido desliga o pulso; o gráfico tem tabela diária alternativa.

A revisão encontrou e corrigiu sobreposição dos controles no celular, status do
cabeçalho desatualizado depois de publicar e altura dos detalhes de consumo.
Capturas locais ficam em `outputs/admin-handoff/` e `outputs/generation/`,
ignoradas pelo Git. Os fixtures isolados dos testes antigos agora dão altura ao
root, conforme a cadeia flex do layout do produto; as asserções de consumo
permanecem completas.

Não houve migração, escrita em banco remoto, geração paga, publicação de
páginas de clientes ou avaliação de qualidade do modelo. A sessão real foi
verificada sem credencial válida; os fluxos internos usam dados sintéticos,
SQL em PostgreSQL local e substitutos das APIs no navegador.

## Continuidade da revisão em rodadas, 11/09/2026

O runner anterior foi exercitado com o mesmo estado sintético usado na
regressão: depois de 32 passos e uma leitura gravada, retornou `continue`;
o segundo salto falhou com `A etapa "Revisão" não avançou`, sem uma segunda
chamada do modelo. Repetir o nome da fase era tratado como ausência de avanço.
O marcador agora compara leituras registradas e fingerprint do rascunho e
permite até três rodadas, mantendo a exigência de revisão completa e atual.

- Os 122 testes de admin passaram, sem pulos, com Chrome e PostgreSQL 14
  descartável em `127.0.0.1`. A execução foi sequencial entre arquivos para
  evitar concorrência na aplicação do schema. As regressões cobrem avanço por
  leitura ou alteração, teto, ausência de avanço, conclusão na última rodada,
  erros visuais no motivo da parada e recibo após texto parcial.
- O teste de timeout usa o `ToolLoopAgent` do AI SDK instalado e um
  `MockLanguageModelV4` que respeita o sinal de aborto. `totalMs` produz
  `TimeoutError`; o runner continua somente com avanço persistido. A pausa do
  operador prevalece mesmo quando o turno termina por timeout.
- Os testes de fila usam substitutos do runner; os de PostgreSQL exercitam
  reservas, feed e SQL com duas conexões reais. A lógica de rodadas é testada
  no runner real com persistência e agente simulados. Esses níveis de teste
  não equivalem a uma geração paga completa na Vercel.
- Os 81 testes de sites e sete testes de navegador passaram, sem pulos. O
  painel mostra a segunda rodada com a contagem de leituras reiniciada em
  desktop e celular e preserva o número após recarga. Há cobertura do feed
  reduzido e de chamadas recusadas sem exibir uma quarta leitura de três.
  Captura local: `outputs/generation/revisao-rodada-2-mobile.png`.
- Lint global, tipos, formatação documental, `git diff --check` e
  `npm run build:vercel` passaram. Os três testes de artefatos serverless
  confirmaram os arquivos de identidade e captura do chat, etapa HTTP e fila.
  Os testes de navegador foram concluídos após o build; um rebuild concorrente
  havia removido temporariamente o CSS consumido por dois casos.

A produção consultada antes da entrega estava em `32a0b51`, deployment
`dpl_8fnC6kDC6VT3xZJKKMqztpUTnUeL`, com estado `READY`. Esta validação não
executou geração paga nem alterou banco remoto ou snapshots de clientes. Não
há migração. O timeout do SDK não impõe cancelamento a ferramentas que ignorem
seu sinal; a convergência do crítico real e a nova tentativa do cliente continuam
dependendo de um ensaio pago autorizado após a publicação do código.

## Entrega das etapas sem recursão HTTP, 11/09/2026

O log de produção registrou 508 no despacho que deveria iniciar a revisão,
depois de salvar seis cenas e quatro páginas. Cada função chamava novamente
a mesma rota HTTP, padrão sujeito à [proteção contra loops da Vercel](https://vercel.com/docs/errors/infinite_loop_detected).
O limite de passos havia encerrado o turno de composição; ele não comprovava
revisão concluída. O despacho passa pela Vercel Queues, com consumidor privado
e a mesma reserva atômica no PostgreSQL. Os limites do agente e a exigência de
revisão completa do rascunho atual permanecem vigentes.

- A regressão do dispatcher falhou no transporte HTTP anterior com 508.
- Os 110 testes de admin passaram com Chrome e PostgreSQL 14 local descartável,
  sem pulos. A suíte foi executada com `node --test --test-concurrency=1
tests/admin-*.test.mjs`, pois os dois arquivos de integração reaplicam o
  schema no mesmo banco. A execução paralela travou esses preparativos.
- O consumidor e o executor compartilhado foram exercitados em quatro fases,
  entregas duplicadas, pausa, tenant incorreto, falha de envio e resposta
  perdida. Duas conexões PostgreSQL confirmaram que erro de um salto antigo
  não encerra a reserva seguinte e que a falha preserva o progresso.
- Os 81 testes de sites e seis testes de navegador passaram, sem pulos.
  Lint global, tipos e `npm run build:vercel` passaram; os três artefatos
  serverless incluem identidade e binários da captura, inclusive o da fila.
- No preview temporário `dpl_2juYnFFMpYhPLARFsELjoXCBw1oQ`, o dispatcher real
  enviou seis mensagens sintéticas em sequência ao consumidor privado. Os logs
  registraram os saltos 0 a 5 e a conclusão em aproximadamente 1,4 segundo,
  sem 508. O acesso HTTP direto ao consumidor respondeu 404. A instrumentação
  temporária tinha chave própria, prazo de expiração e limite de seis saltos;
  foi removida do código entregue. Esse ensaio valida a fila na plataforma,
  sem executar o runner pago nem acessar o banco de clientes.

Esses testes usam dados sintéticos e substitutos dos modelos. Não houve
geração paga, escrita em banco remoto nem publicação de páginas de clientes.

## Cronômetro da geração, 11/09/2026

Os tempos da etapa e do total ficavam em `0:00` quando o relógio do navegador
estava atrás do servidor, porque valores negativos eram truncados para zero. O
feed agora informa a hora do servidor e o cliente usa essa referência para
continuar a contagem local. A primeira fase usa o início do run enquanto seu
timestamp específico ainda não foi gravado.

O teste de navegador reproduziu a falha com dez minutos de diferença entre os
relógios e exige que os dois cronômetros saiam de `0:00` e continuem avançando.
Os seis testes de navegador, os 99 testes de admin com PostgreSQL local, os 81
testes de sites, lint, tipos e o build Vercel passaram sem pulos ou falhas.

## Correções da revisão do PR #15, 11/09/2026

O início automático agora considera tentativas anteriores à tabela de execuções:
o marcador em `brief.generation` e mensagens do canal `site` também impedem a
retomada sem comando. A consulta de existência usa o ID do tenant e independe
do cursor. O detalhamento de consumo ganhou rolagem própria e entra na área
visível ao abrir; telas baixas permitem rolar a coluna para acessar os controles.

- As regressões de histórico e consumo falharam no código anterior à correção.
- `npm run test:admin`: 99 testes passaram, sem pulos, com Chrome e PostgreSQL
  14 local descartável. O feed real distinguiu cliente novo, marcador legado,
  mensagens anteriores ao cursor e histórico de outro tenant/canal.
- `npm run test:sites`: 81 testes passaram, sem pulos.
- `npm run test:admin:browser`: cinco testes passaram. O feed real preservou
  o comando manual ao abrir e recarregar clientes com histórico legado. A
  tabela com 15 recibos permaneceu acessível, inclusive até a última linha
  por teclado, em 1440×900, 390×844 e 375×667; fechar os detalhes permitiu
  voltar ao controle de pausa. As capturas ficam em `outputs/generation/`.
- Lint global, `npx next typegen && npx tsc --noEmit` e `npm run build:vercel`
  passaram, incluindo os dois testes do artefato de captura serverless.

Os testes usam dados sintéticos e substitutos dos serviços pagos. A entrega
não exige migração, geração paga ou publicação de rascunhos de clientes.

## Painel de geração e início automático, 11/09/2026

A tela de criação do site começava com um botão **Gerar site** e a pergunta
"O que este cliente precisa?" num cliente que tinha acabado de ser cadastrado,
mostrava o andamento como uma lista de rótulos entre 11 e 13 px, imprimia
"Briefing e direção: em andamentover" na faixa do celular e não exibia mais
nenhum custo, porque a geração passou a rodar no servidor e o recibo do stream
deixou de existir. Esta entrega troca o botão pelo início automático em cliente
novo, reescreve o painel de andamento, refaz a escala tipográfica da conversa e
volta a medir o consumo, agora incluindo as fases do servidor.

- `npx next typegen && npx tsc --noEmit`: sem erros.
- `npx oxlint app components lib tests scripts`: zero apontamentos. O `npm run
lint` sem argumentos também varre `.ds-sync/`, diretório não versionado
  presente na árvore de trabalho e alheio a esta entrega.
- `npm run test:admin` com `EIXU_CHROME_PATH`: 83 testes, 81 passaram e 2
  pularam por falta de PostgreSQL local. Casos novos: o recibo de consumo
  gravado no fim da fase, a recusa de payload de consumo malformado, a soma
  que junta fases do servidor e turnos do stream, a medição de duração por
  fase e a espera do briefing pela leitura do perfil social.
- `npm run test:sites`: 81 testes, sem pulos.
- `npm run build:vercel`: aprovado, incluindo os dois testes dos arquivos de
  captura no artefato serverless.
- `npm run test:admin:browser` com Chrome local: três testes passaram. O caso
  novo abre a tela de um cliente sem execução anterior, sem página e com o
  briefing pendente: a geração começa sem clique, uma única vez, sem passar
  pelo chat, e recarregar a página acompanha o mesmo run em vez de abrir
  outro. O mesmo teste confere que "Gerar site" e "O que este cliente
  precisa?" saíram da tela. Os outros dois preservam o acompanhamento após
  recarga, a retomada pelo comando textual, a paginação de mensagens, a
  atualização da prévia e o recibo do chat livre.
- Capturas do painel real, com o CSS do build, em `outputs/generation/`
  (início automático, execução, conclusão e celular) e em
  `outputs/chat-recovery/`. Elas apontaram três defeitos corrigidos aqui: a
  dica do compositor truncada, "1 páginas" no resumo final e o aviso de
  revisão pendente sobrepondo o botão Publicar em 390 px.

Sem migração: o recibo por fase usa a coluna `payload`, que já é JSONB. Este
ciclo não executou geração paga, não escreveu em banco remoto e não publicou
rascunho de cliente. O início automático foi exercitado contra o servidor
sintético dos testes; em produção ele depende do `everRan` devolvido pelo feed.

## Correções da revisão do PR #14, 11/09/2026

Cinco regressões receberam correção e cobertura: o acompanhamento parado após
iniciar pela própria aba, o despacho repetido encerrando uma execução ativa,
a prévia sem atualização, os bloqueios de publicação escondidos em repouso e
o cursor pulando mensagens do chat.

- `npm run test:admin`: 91 testes passaram, sem pulos, com Chrome e PostgreSQL
  14 local descartável. Duas conexões disputaram o mesmo run e salto; apenas
  uma reserva venceu, e a repetição preservou o run ativo. O feed entregou
  lotes a partir de zero, incluindo uma mensagem inserida entre leituras,
  sem misturar tenants. Recibos preservaram ferramentas e metadados do stream.
- `npm run test:sites`: 81 testes passaram, sem pulos. Lint global,
  `npx next typegen && npx tsc --noEmit` e `npm run build:vercel` passaram,
  incluindo os dois testes dos arquivos de captura no artefato serverless.
- `npm run test:admin:browser`, com Chrome local: os dois testes passaram.
  O painel real acompanhou o início e a conclusão sem recarga, drenou mais
  de 60 mensagens, retomou pelo comando textual e recarregou o iframe quando
  o conteúdo mudou, preservando-o nas consultas seguintes. Desktop e celular
  mantiveram os controles; as pendências ficaram visíveis sem run ativo.
- O build de produção servido localmente respondeu 200 no institucional e
  no login, e 401 sem sessão no chat e nas rotas de consulta, início, etapa
  e pausa da geração.

Os testes usaram dados sintéticos e substitutos dos serviços pagos. Este
ciclo não repetiu uma geração com modelos reais, não alterou banco remoto
nem publicou rascunhos de clientes.

## Geração em etapas no servidor, 11/09/2026

A criação do cliente `iterum` expôs o custo de orquestrar as fases no
navegador. A reconstrução pelos logs da Vercel, pelo histórico do chat e pelo
estado do cliente mostra que nenhum dos travamentos foi do servidor: às
12:52:24 uma recarga durante a terceira cena matou o laço da aba; a cena em
curso terminou no servidor às 12:52:41 e a quarta nunca foi pedida. Seguiram-se
onze recargas em um minuto e a pergunta "travou?". A resposta mandava usar
**Continuar**, botão que ficava no topo de uma lista que rola sozinha para o
fim e que, no celular com páginas existentes, estava escondido por CSS. O
operador digitou "continuar": o chat tratava a palavra como edição e abriu um
turno livre de 339 s e 16 passos (US$ 0,22). Durante esse turno houve novas
recargas e uma segunda mensagem, com dois `POST /api/chat` simultâneos no mesmo
cliente e sem exclusão mútua.

A execução passou a ser um registro em `generation_runs`, com um run ativo por
cliente garantido por índice parcial, fases encadeadas por invocações próprias
de `/api/admin/[tenant]/generation/step` e linha do tempo em
`generation_events`. Detalhes do desenho estão em [Harness](harness.md).

**Ensaio real, cliente sintético `ensaio-runner`, servidor local com Chromium
do sistema e modelos de produção:**

A execução terminou sozinha em **872 s**, com recibo de revisão completo
(`visual: complete`, 0 erros, 2 rodadas), cinco fotos, três páginas orgânicas
mais a de obrigado e nenhum erro de pre-flight. Nenhuma etapa dependeu de aba
aberta: o único cliente do run foi um script lendo o mesmo `GET` que o painel
usa.

| Etapa              | Tempo | Observação                                                                                 |
| ------------------ | ----- | ------------------------------------------------------------------------------------------ |
| Briefing e direção | 110 s | duas recusas de `set_design` pelo catálogo antes do aceite, registradas como tentativa     |
| Cenas              | 165 s | cinco vagas do plano em **uma** chamada, em lotes paralelos de três com crítica por imagem |
| Composição         | 180 s | um reparo antes do lote válido                                                             |
| Revisão            | 407 s | duas rodadas: captura, crítica, correções e conferência                                    |

No `iterum` a mesma etapa de cenas custou cinco requisições sequenciais de 60 a
77 s. O total de 872 s é o número medido, não um teto prometido: a revisão
domina o tempo e varia com o número de correções.

O ensaio também mostrou dois defeitos de texto, corrigidos: o rótulo repetia a
barra do caminho (`Lendo //contato`) e o recibo entre etapas mandava “usar
Continuar” enquanto a etapa seguinte já ia começar sozinha.

**Gates:** `npx next typegen && npx tsc --noEmit`, `npx oxlint lib tests app
components scripts`, `npm run test:sites` (81), `npm run test:admin` (70, 3
pulados por falta de Postgres de teste), `npm run build:vercel` e os dois testes
de navegador com `EIXU_CHROME_PATH`. O teste de artefato passou a cobrir também
`/api/admin/[tenant]/generation/step` e reprovou a primeira tentativa de
inclusão: os colchetes da rota dinâmica são classe de caracteres no glob de
`outputFileTracingIncludes`, e o Chromium não entrava no pacote — a revisão
visual falharia só em produção.

## Depoimentos no bloco de cases da home, 11/09/2026

O bloco `05 / Cases` passou a mostrar a citação de quem contratou, no lugar do
subtítulo genérico de cada card. Fernanda Tessetore (Saldo) e Fernando Zullo
(Naia) autorizaram nome, cargo, foto e as frases; o operador transmitiu os textos
e as imagens. A edição foi limitada a acentuação e pontuação. As fotos entraram
como `public/cases/saldo-fernanda-tessetore.webp` e `naia-fernando-zullo.webp`,
recortadas em 224 px e servidas a 52 px. São pessoas reais com autorização, não
cenas geradas; o número da Saldo é acumulado e convive com o valor mensal já
publicado em `/cases/saldopix`.

- Tipos, lint e `build:vercel` aprovados. `test:sites`: 80, sem falhas.
- Navegador real em 1440 e 390 px: os dois cards mantêm altura igual (1031 px e
  812 px), sem rolagem horizontal, com as fotos em 200 e o link "Ver projeto"
  preservado. Contraste medido sobre o papel do card: citação 15,0, nome 16,5 e
  cargo 5,6, todos acima do piso AA.
- As páginas `/cases/saldopix` e `/cases/naiacrm` não foram alteradas.

## Estabilidade da captura visual, 11/09/2026

O ensaio autenticado do pedido de cabeçalho em produção confirmou quatro edições
restritas, com todos os demais campos preservados. A crítica recebeu oito
capturas, mas apontou sobreposição que não existia na abertura das páginas. A
reprodução revelou `scrollY` ainda entre 50 e 410 px ao capturar: o retorno ao topo
usava a rolagem suave do site, e 250 ms não bastavam. Barras fixas apareciam
deslocadas na imagem da página inteira.

A captura agora usa movimento reduzido, rolagem instantânea e confere o retorno
ao topo. Uma regressão com Chromium verifica os pixels de uma barra fixa numa
página longa com scroll suave, em desktop e mobile. Isso estabiliza a evidência
da crítica; interações e movimento continuam cobertos pelos testes de navegador.
O teste reproduziu a falha com o código anterior e passou com a correção.
Lint, tipos e build Next.js aprovados; 73 testes de admin com PostgreSQL e
Chromium, sem skips.

## Edições pontuais, navegação e galeria, 11/09/2026

Um pedido de cabeçalho fixo, escuro e semitransparente acionou reconstrução de
quatro páginas. A navegação ainda não tinha propriedade de posição fixa, e
a galeria filmstrip criava oito colunas mesmo com duas fotos. Foram acrescentadas
as propriedades de navegação, corrigidas as colunas e restringidas as ferramentas
e os campos editáveis para esse pedido. O conteúdo da galeria é preservado.

- Tipos, lint e build Next.js aprovados. `test:sites`: 80; `test:admin` com
  PostgreSQL local e Chrome: 72 aprovados, sem skips.
- Cinco regressões novas verificam capacidades removidas, preservação integral
  dos campos fora do pedido, recusa de props inválidas antes da escrita e
  separação entre edição, site novo e reconstrução explicitamente solicitada,
  mantendo ajustes pontuais de marca disponíveis na edição geral.
- Navegador real e CSS do build: posição após rolagem, espaço reservado ao
  cabeçalho/menu mobile, opacidade, galerias com 2/3/8 fotos e ausência de colunas
  vazias em 1440/390 px. Sete testes de sites no navegador aprovados.
- O pedido original, com histórico anterior de construção, foi repetido com
  Gemini 3.8 Flash e ferramentas reais, em memória. Oito passos, quatro cabeçalhos
  fixos, tom escuro e opacidade de 90%; comparação integral confirmou marca,
  dials, imagens e todos os demais campos preservados. Foram 80.672 tokens de
  entrada e 2.800 de saída em 151 segundos. A revisão visual ficou indisponível
  nesse ensaio e o modelo a relatou, sem editar os outros blocos. Esse ensaio
  comprova precisão da edição, não conclusão da crítica visual.

Evidências locais em `outputs/chat-recovery/`. Não houve geração de imagens
nesses testes. Os snapshots usados no diagnóstico do cliente real permanecem
locais e fora do Git.

## Andamento e recuperação do chat, 11/09/2026

A investigação de uma criação real encontrou uma composição recuperada após
entradas de ferramenta inválidas, salva em cerca de 135 segundos. Uma pergunta
posterior de andamento abriu outro turno de edição, que consumiu 32 passos em
cerca de 390 segundos e terminou sem texto. O painel ocultava raciocínio sem
mostrar atividade e o histórico persistia apenas o texto final do modelo.
Isso não comprova um travamento do servidor: os logs mostram execuções concluídas.

O painel agora mostra atividade, tempo e consulta de progresso. Perguntas curtas
de andamento consultam o estado salvo sem geração paga. Turnos encerrados em
ferramentas recebem um recibo textual do banco; a mesma resposta é persistida.
Erros de ferramenta recuperáveis não anunciam falha da geração inteira.

- Lint, tipos e build Next.js aprovados, incluindo o teste do artefato Chromium.
- `test:sites`: 80 aprovados. `test:admin`, com Chrome e PostgreSQL 14.24 local
  descartável: 67 aprovados, sem testes pulados.
- Cinco regressões novas exercitam a rota HTTP e o AI SDK reais: consulta de
  andamento sem modelo, autenticação, schema inválido seguido de recuperação e
  recibo, preservação de texto e término prematuro do stream.
- `test:admin:browser` usa o Workspace, useChat e transporte SSE reais com
  provedor e persistência sintéticos. Confere atividade durante raciocínio,
  leitura de progresso sem nova geração, continuação composição → revisão,
  recibos, erro recuperável, pergunta “travou?” e layout em 1440/390 px.

Os ensaios novos não geram fotos nem alteram páginas de clientes. A investigação
do cliente real usa leitura de banco e logs; as alterações feitas pela sessão
do operador não são resultados destes testes. Evidências locais ficam em
`outputs/chat-recovery/`, ignorado pelo Git.

## Correções dos gates e ensaio remoto, 11/09/2026

Esta revisão resolve os 20 erros de lint registrados nas entregas anteriores,
sem desativar regras. Estado de media queries e Embla é observado com
`useSyncExternalStore`; os componentes básicos usam elementos e conteúdo
acessíveis, e os gráficos tratam `dataKey` funcional sem transformá-lo em chave
de configuração.

- Lint global, tipos e build Next.js aprovados.
- `test:sites`: 80 aprovados. `test:admin`, com Chrome e PostgreSQL 14.24 local
  descartável: 62 aprovados, nenhum pulado. A integração usa schema real e o
  driver Neon pelo proxy WebSocket local; dependências externas são simuladas.
- `test:sites:browser`: seis testes aprovados, sem erro de hidratação/navegador.
  Cobrem teclado, label, paginação, carrossel, mobile, movimento reduzido e
  desmontagem/remontagem. O contraste mantém 60 pares por largura em 1440/390 px,
  com mínimo de 4,608:1.
- No deployment de produção `55ff763`, login e cadastro passaram pelo formulário.
  O cadastro único confirmou o recurso Neon remoto, PostgreSQL 18.6. Uma edição
  do CTA da home passou pelo chat real com Gemini 3.8 Flash, preservou exatamente
  os demais campos e persistiu as duas mensagens no histórico.

O primeiro ensaio remoto encontrou a revisão visual indisponível, com zero
capturas. A inspeção do manifesto de tracing revelou os binários ausentes.
Isso corrige a afirmação do registro anterior: verificar os arquivos na
instalação local do pacote não comprovava sua inclusão na função publicada.
`outputFileTracingIncludes` inclui agora os quatro arquivos do Chromium em
`/api/chat`, conforme o [contrato de arquivos da Vercel](https://vercel.com/kb/guide/how-can-i-use-files-in-serverless-functions).
O novo `tests/build-runtime.test.mjs`, executado por `build:vercel`, reproduziu
a ausência no artefato anterior e passa a bloquear esse defeito antes do deploy.

O ensaio remoto usa um cliente sintético criado para cada execução e uma fixture
de composição com fotos já existentes. Não gera imagens nem publica páginas de
clientes. A exclusão pelo painel e a ausência de páginas, imagens e mensagens
órfãs são verificadas no final. Evidências locais, ignoradas pelo Git, ficam em
`outputs/quality-gates/`. O PostgreSQL local e o remoto têm versões diferentes;
o ensaio remoto complementa a integração local, sem alegar paridade de versão.

## Harness focado em qualidade, 11/09/2026

Esta revisão sucede os registros abaixo. O chat, os críticos e a leitura de
avatar usam a política comum de Gemini 3.8 Flash com raciocínio alto. O agente
compartilhado usa schemas completos na composição/revisão, conserva contexto
recente, executa ferramentas em sequência e transfere um lote salvo sem erros
para a revisão visual. Avisos não provocam reconstruções para zerar contagens.
O recibo visual precisa corresponder ao rascunho atual; captura ausente ou falha
do crítico não encerra a geração. `SOUL.md` é carregado no prompt e incluído no
artefato Next.js.

- `test:sites`: 80 casos aprovados. `test:admin` com Chrome: 51 aprovados e
  somente a integração opcional com PostgreSQL pulada, sem banco local configurado.
- Tipos e build de produção Next.js 16.3.3 aprovados. O tracing inclui `SOUL.md`
  e Chromium. Lint dos arquivos alterados aprovado; lint global continua com
  os 20 erros anteriores em 13 arquivos, sem desligar regras.
- `test:sites:browser`: aprovado em 1440 e 390 px, 60 pares de texto/fundo por
  largura, contraste mínimo de 4,608:1.
- O build servido localmente passou em 16 checks HTTP: institucional, login,
  redirecionamento administrativo, APIs sem sessão em 401, bloqueio de caminhos
  internos/artefatos e recusa de tenant inexistente após autenticação real, antes
  de qualquer escrita. Registro em `outputs/harness/http-local.json`.
- O POST real do chat, com sessão e persistência em memória, concluiu streaming
  SSE e a edição exata do logo do cabeçalho para 52 px, preservando todos os
  demais blocos e o rodapé. Persistiu a mensagem e a resposta, com uso e motivo
  de término. Foram 4 passos, 33.270 tokens de entrada, 1.443 de saída, dos quais
  1.286 de raciocínio, em 55,7 segundos. Artefato: `outputs/harness/chat-stream.json`.
- O ensaio histórico de edição isolada também passou em 3/3 execuções reais
  com Gemini e a nova política. Seus números não formam comparação controlada
  com os modelos e prompts dos registros anteriores.

A crítica multimodal real leu oito capturas do caso de pedras, em quatro
páginas e dois viewports, e apontou a quebra indevida de uma palavra no CTA da
home, também observada na inspeção das capturas. Retornou caminhos/IDs válidos,
com 14.504 tokens de entrada e 4.692 de saída, em 41,5 segundos. O Gateway
recusou o schema com enum de todos os IDs; o contrato usa enum de páginas e
verifica o par página/bloco no servidor, sem descartar achados inválidos.

O caso de pedras concluiu o aceite automático na retomada final, sem edição
manual das páginas geradas. A revisão executou 16 passos e duas leituras visuais
em 286 segundos. Fez três edições pontuais, incluindo a correção do título que
quebrava uma palavra no desktop, e encerrou na conferência do rascunho atual.
As quatro páginas passaram nos oito pares página/viewport, sem overflow,
imagens quebradas ou erros materiais. Permaneceram sugestões sobre repetição
de foto, destaque de botão e proporção nominal, registradas sem ocultação.
O loop principal consumiu 412.459 tokens de entrada, com 331.626 em cache,
e 13.869 de saída; as duas críticas separadas consumiram 28.908 de entrada e
11.060 de saída. Artefatos: `outputs/harness/1789106894362-pedras/`, incluindo
`summary.json`, saída automática e oito capturas. A retomada verifica a revisão
completa sobre a composição produzida nos ensaios anteriores; não equivale a
uma execução nova de todas as fases nem a uma nota humana da rubrica.

O Chromium do pacote serverless também executou uma captura local em dois
viewports, sem depender do Chrome instalado. Seus quatro binários estão no
diretório incluído pelo tracing, conforme `outputs/harness/serverless-capture.json`.
O preview do código `66b92d1` ficou `READY`, com home em 200 e POST do chat sem
sessão em 401. A execução da captura dentro da Vercel ainda não foi exercitada.

Os ensaios preliminares identificaram reenvios do lote para eliminar avisos,
um timeout no orçamento anterior e cache JSX incompatível no runner. O controle
de transição, o orçamento e o isolamento do cache foram corrigidos. Outro ensaio
consumiu os 24 passos de revisão corrigindo achados e terminou com recibo antigo,
corretamente bloqueado. A revisão passou a 32 passos, com o último reservado à
conferência e parada externa após a conferência bem-sucedida do refinamento.
As fotos da
fixture antiga de aquecimento retornam 404: o rascunho foi gerado, mas sua revisão
ficou bloqueada por imagens quebradas. Esse caso não comprova qualidade visual
positiva. Os artefatos e falhas anteriores permanecem em `outputs/harness/`.

Os ensaios usam dados sintéticos e fotos de fixtures. Não houve migração,
seed, geração de fotos, escrita editorial em Neon/Blob ou publicação de páginas
de clientes. Eles verificam o modelo e os contratos dentro do escopo de cada
runner; não substituem teste de persistência remota ou revisão humana da rubrica.

## Troca para Gemini 3.8 Flash, 11/09/2026

O fallback do chat, dos críticos de foto/logo, da descrição de avatar social e
dos dois runners de avaliação passou a `google/gemini-3.8-flash`. O ID foi
confirmado no catálogo público do AI Gateway e na documentação oficial da
Vercel e do Google. O AI SDK 7 e o lockfile foram preservados.

- `test:sites`: 75 passaram. `test:admin` com Chrome: 27 passaram; a suíte
  de concorrência em PostgreSQL ficou pulada por ausência de configuração.
- Tipos e build Next.js 16.3.3 de produção passaram. O lint dos seis arquivos
  de código alterados passou; o lint global mantém os 20 erros preexistentes
  em 13 arquivos fora deste escopo.
- `eval:admin-cost` sem `--live` passou e registrou o novo modelo em
  `outputs/admin-review/token-eval-dry.json`, ignorado pelo Git. Essa execução
  verifica o payload, sem chamar o modelo ou medir sua qualidade e seu custo.

Este checkout não tinha arquivo de ambiente nem credencial do Gateway. Não
houve ensaio real de streaming, ferramentas ou visão com Gemini, alteração de
variáveis remotas ou deploy. `EIXU_MODEL` e `EIXU_CRITIC_MODEL` explícitos ainda
prevalecem sobre o fallback e precisam apontar para o novo modelo no ambiente
de destino. Os registros históricos abaixo preservam os modelos e as medições
que realmente foram executados.

## Imagens sem aprovação e alterações por número, 11/09/2026

O fluxo disponibiliza fotos e logos assim que são gerados, preserva candidatas
legadas na biblioteca e aceita alterações por número no chat. A nova versão
mantém a original e troca as ocorrências apenas nos rascunhos do tenant.

- `test:sites`: 75 passaram, incluindo disponibilidade sem aprovação,
  alterações com a imagem original como referência, substituição de URL e alt,
  isolamento por tenant, snapshot preservado e falhas sem alteração de páginas.
- `test:admin` com Chrome: 27 passaram; a suíte de concorrência em PostgreSQL
  local ficou pulada por ausência de configuração. Tipos e build Next.js
  16.3.3 de produção passaram.
- Lint dos arquivos alterados e formatação passaram. O lint global continua
  com os 20 erros preexistentes em 13 arquivos fora deste escopo.
- Os componentes reais do painel, com CSS emitido pelo build e dados sintéticos,
  foram conferidos em 320, 390 e 1440 px: sem overflow ou erro de navegador,
  com imagens legadas visíveis e sem ações de aprovação. O atalho da #5
  preencheu o chat sem enviar. Com chat/estado simulados, o painel completou
  briefing, seis cenas do atelier, composição e revisão em nove chamadas;
  uma cena sem progresso interrompeu a sequência com aviso.
- O build servido localmente passou em 11 verificações HTTP: páginas públicas,
  redirecionamentos administrativos ao login (via streaming), APIs sem sessão
  em 401 e bloqueio de acesso direto a site de cliente e aos artefatos da fixture.

As evidências locais ficam em `outputs/images-no-approval/`, ignorado pelo Git.
Não houve geração paga, escrita em Neon/Blob remoto ou deploy. A persistência
da substituição foi exercitada com conexão simulada, não com PostgreSQL real;
o resultado visual de uma alteração por GPT Image 2 ainda depende de ensaio real.
Os registros anteriores abaixo preservam o comportamento e as medições da época.

## Comandos existentes

Com dependências instaladas por `npm ci`, execute os checks separadamente para observar o resultado de cada um:

```bash
npm run lint
npm run test:sites
npm run test:admin
npx next typegen && npx tsc --noEmit
npm run build:vercel
npm run test:admin:browser
npm run test:sites:browser
git diff --check
```

Para incluir a prova de isolamento do cookie na captura, rode `test:admin` com `EIXU_CHROME_PATH` apontando para o executável local do Chrome. Sem ele, esse caso é pulado; os demais testes não precisam de navegador.

`test:sites:browser` também usa `EIXU_CHROME_PATH` e deve rodar depois de
`build:vercel`, pois aplica o CSS emitido pelo Next.js aos componentes reais
renderizados com dados sintéticos. Confere contraste do hero e da localização
em desktop/mobile, destinos dos contatos e regressões de hidratação, teclado e
estado dos componentes básicos. No teste de contraste, requisições externas são
interceptadas; não usa banco nem geração paga. Sem Chrome, os casos são pulados.

`build:vercel` executa `tests/build-runtime.test.mjs` depois do Next.js. O check
lê o manifesto real de `/api/chat` e exige `SOUL.md` e os binários do Chromium,
incluindo fontes e bibliotecas serverless. Ter o pacote em `node_modules` não
basta: os arquivos precisam estar listados no artefato enviado para a função.

`test:admin:browser` também precisa de `EIXU_CHROME_PATH` e do build Next.js.
Usa apenas o CSS emitido para o admin, preservando sua separação das outras
superfícies. Modelo, banco e prévia são sintéticos; o hook de chat, o endpoint,
o protocolo e o loop de ferramentas usam as implementações reais.

`tests/admin-concurrency.test.mjs` exige um PostgreSQL local descartável chamado `eixu_pr2_test`, indicado por `EIXU_TEST_POSTGRES_URL`. A suíte recusa hosts remotos, aplica `db/schema.sql` nesse banco e exercita o driver Neon e seus locks por um proxy WebSocket local; Blob, rede social e visão são simulados. Sem a variável, somente essa suíte de integração é pulada. Para incluí-la, execute `npm run test:admin` com a variável apontando para esse banco local.

`next typegen` prepara tipos de rotas e `next-env.d.ts` em um checkout limpo. O guia da versão instalada está em `node_modules/next/dist/docs/01-app/03-api-reference/06-cli/next.md`. O build pode precisar de rede para `next/font/google`. Nenhum desses comandos executa o seed, migrações ou chamadas de geração pagas.

Para documentação, confira links locais, comandos e fatos contra o código e rode:

```bash
npm run format -- --check README.md AGENTS.md docs
```

O projeto possui `test:sites` e `test:admin`, com testes de contrato sem banco e uma suíte opcional de concorrência em PostgreSQL local. Nenhum desses testes usa geração paga. Não possui script genérico `test`, `verify` ou CI versionada. Não trate um comando inexistente como gate nem substitua falhas por uma declaração do modelo.

## Contatos, localização e vibes, 11/09/2026

A entrega acrescenta a coluna `tenants.contacts`, a seção automática de
localização, a coluna de contato no rodapé e as quatro vibes de site.

### Correções da revisão do PR #5

Salvar os Dados de um cliente antigo preserva a rede social e o avatar do
briefing; a remoção explícita continua apagando essa associação. Os telefones
internacionais mantêm o `+` entre cadastro, armazenamento, edição e link
`tel:`, inclusive países com números de até 11 dígitos. Os destinos de
WhatsApp continuam usando somente dígitos.

No artístico, o cartão do hero offset segue o tom da seção. A superfície
suave é calculada antes das cores de texto, com fallback para o papel quando
a mistura perde contraste. A branch também incorpora `main` em `d581366`,
preservando as imagens sem aprovação, o Gemini 3.8 Flash e os registros de
verificação das entregas anteriores.

- Tipos (`next typegen` e `tsc --noEmit`) e build Next.js 16.3.3 passaram.
- `test:sites`: 80 casos passaram. `test:admin` com Chrome: 38 passaram e
  somente a integração Postgres foi pulada, sem `EIXU_TEST_POSTGRES_URL`.
- `test:sites:browser`: passou com componentes reais e CSS do build em
  1440 e 390 px. São 60 pares de texto/fundo por largura, com contraste mínimo
  de 4,608:1, além dos destinos de telefone e WhatsApp.
- O lint global mantém os 20 erros anteriores em 13 arquivos fora do escopo.
  Lint dos arquivos alterados, formatação e `git diff --check` passaram.

Esta revisão não executou migração, escrita em banco remoto nem geração paga.
Os testes de dados usam dependências simuladas; os testes de navegador usam
conteúdo sintético e interceptam a rede. A evidência anterior de migração e
smoke abaixo foi preservada e não representa nova verificação do banco.

### Evidência anterior às correções

**Migração aplicada em 11/09/2026** no banco de `.env.local`, autorizada pelo
operador: `npm run db:migrate`, 20 statements idempotentes, coluna
`tenants.contacts jsonb not null default '{}'` criada. Os quatro clientes
existentes seguiram com `contacts` vazio e o WhatsApp já gravado, que
`contactsOf` reaproveita como primeiro telefone: o rodapé deles passa a exibir
esse número assim que o código for publicado. Deploy só depois da migração;
antes dela, criar cliente e salvar Dados falhariam com a mensagem genérica, sem
gravar linha parcial.

Checks executados em 11/09/2026, com Node.js 24.15.0:

| Check                  | Resultado observado                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------ |
| `npx tsc --noEmit`     | Passou.                                                                              |
| `npm run test:sites`   | 67 casos, todos passaram.                                                            |
| `npm run test:admin`   | 34 casos, 32 passaram e 2 pularam sem `EIXU_TEST_POSTGRES_URL` e `EIXU_CHROME_PATH`. |
| `npm run build:vercel` | Passou, Next.js 16.3.3/Turbopack.                                                    |
| `npm run lint`         | Falhou com os mesmos 20 erros preexistentes; nenhum nos arquivos tocados.            |

Cobertura nova: normalização de telefone, endereço e rede social, incluindo a
recusa de esquema que não seja `http(s)`; pareamento de telefone e tipo por
índice no formulário, com linha vazia descartada; leitura tolerante da coluna
ausente e do cliente anterior à mudança; faixa de cada vibe aceitando e
recusando direções, com a mensagem apontando o eixo; recusa de `set_design`
fora da faixa e consulta de unicidade restrita à mesma vibe; prompt declarando
vibe e contatos; âncora `onde-estamos` reservada no pre-flight; `/go/wa?n=`
escolhendo o segundo WhatsApp e caindo no principal com índice inválido;
JSON-LD com telefone em E.164, e-mail, endereços e redes.

### Smoke em navegador, 11/09/2026

Quatro clientes sintéticos `smoke-*`, um por vibe, com o mesmo conteúdo e os
mesmos blocos, publicados por SQL e apagados ao fim do smoke; o banco voltou
aos quatro clientes reais, sem página órfã. Nenhuma chamada paga de geração.

- As quatro páginas responderam 200 e renderizaram todos os blocos, sem bloco
  descartado por schema. `data-vibe` correto em cada uma.
- Sem overflow horizontal em 1440 nem em 390: `scrollWidth` igual ao
  `clientWidth` nas duas larguras.
- Mapa do Google carregou com o pino no endereço nas quatro vibes, com o
  cartão do endereço resolvido. O filtro escuro do moderno produz um mapa
  escuro legível, com o pino visível.
- Troca de endereço: as abas alternam rótulo, texto, `src` do mapa e o link de
  rota. Dois endereços, um iframe por vez.
- Rodapé: WhatsApp por `/go/wa?n=0` com `data-track`, telefone comum em `tel:`,
  e-mail em `mailto:`, atalho para `#onde-estamos` e os três ícones de rede.
- Cadastro pelo formulário do admin, com credencial descartável passada por
  variável de ambiente em vez da senha real: duas linhas de telefone com tipos
  diferentes gravaram `contacts` na ordem, `whatsapp` derivado do número
  marcado como WhatsApp, `brand.vibe`, e o `socialUrl` do briefing derivado da
  lista de redes. Dados reabriu todos os campos preenchidos e mostrou a vibe.

Dois defeitos foram encontrados **pelo** smoke e corrigidos nesta entrega:

1. As linhas de telefone e endereço se esmagavam no formulário, porque
   `.admin-input` fixa `width: 100%` e vence o utilitário de largura dentro do
   flex. Passaram a usar `flex-basis`, que é quem controla a medida do item.
2. Um número sem DDI era exibido como `+1133334444`, que se lê como código de
   país 1. `formatPhone` passou a distinguir número com e sem DDI, e
   `phoneE164` só devolve `+` quando há código de país; o campo ganhou a
   legenda pedindo o DDI no WhatsApp.

**Defeito preexistente observado, não corrigido aqui:** `lib/tracking.ts`
reescreve os `href` de `/go/wa` antes da hidratação, e o React registra
incompatibilidade de atributo no console. Acontece em cliente publicado sem
nenhuma mudança desta entrega, inclusive no botão flutuante; o link continua
funcionando porque o próprio script já aplicou a atribuição. Fica registrado
para uma correção própria.

**Não verificado:** geração de site pelo agente em cada vibe, que depende de
chamada paga. As páginas do smoke foram
compostas à mão para isolar o CSS e o render; elas não medem a qualidade da
direção que o modelo produz dentro de cada faixa.

## Histórico: upgrade para Opus 5, 10/09/2026

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
| Imagens ou ferramentas     | Falha parcial, uso sem aprovação, alteração por número, isolamento e snapshot preservado; aplicação de logo e remoção em uso.                          |
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
