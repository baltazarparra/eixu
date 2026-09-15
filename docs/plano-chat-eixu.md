# Plano de implementação — manual, soul e conversa do Eixu

**Estado:** implementado e validado na branch desta entrega

**Escopo:** conhecimento do gerador, comportamento do chat e refinamento do
compositor

**Resultado esperado:** o Eixu conversa e aconselha sem tratar toda mensagem
como ordem, executa somente instruções claras, conhece o produto por uma fonte
versionada e apresenta um foco visual único, discreto e acessível.

## Diagnóstico

O gerador já tinha contratos extensos em Arquitetura, Design, Harness, Manual do
operador e Edição pelo chat. Esse conhecimento estava distribuído e parte dele
existia apenas no código. O prompt conhecia o catálogo técnico, mas não havia uma
fonte única que o chat pudesse consultar para explicar todas as capacidades e
limites ao operador.

No site existente, `editPolicyFor` classificava praticamente qualquer texto
como edição. Assim, uma pergunta sobre a abertura recebia o mesmo conjunto de
ferramentas de uma ordem para alterá-la. O prompt também encerrava todo turno
como relatório de mudança. Isso tornava a conversa mecânica e deixava a
segurança depender demais da interpretação do modelo.

No compositor, a regra global de `:focus-visible` desenhava um retângulo no
`textarea`, enquanto `:focus-within` mudava a borda do contêiner arredondado. Os
dois indicadores simultâneos produziam o contorno duplo e agressivo observado.

## Decisões de arquitetura

1. **Manual versionado e consultável.** Consolidar o produto em
   `docs/manual-gerador-sites.md`, dividir o arquivo em seções estáveis e expor
   `read_generator_manual`. O prompt recebe apenas o índice; a ferramenta lê de
   uma a seis seções. O arquivo entra explicitamente no tracing das três rotas
   serverless que constroem o agente.
2. **Conversa como estado seguro.** Classificar a última fala antes de montar as
   ferramentas. Saudação, pergunta, hipótese, opinião, contexto solto e anexo
   sem comando ficam em conversa. Verbo direto, resultado desejado, pedido
   “pode fazer…?” ou confirmação contextual ficam em ação.
3. **Fronteira em código.** Conversa recebe apenas manual, estado, página,
   catálogo, imagens e lint. Mutação, publicação, registro de fato, geração
   paga, leitura externa e crítica visual não entram no runtime desse turno.
4. **Personalidade com critério.** Atualizar o `SOUL.md` existente como fonte
   única, sem criar outro arquivo concorrente. Eixu atua como designer de
   interfaces/frontend sênior e creative developer, dá opinião fundamentada,
   conversa em pt-BR e usa sarcasmo leve somente quando a situação comporta.
5. **Um único foco visual.** Remover o outline do `textarea` e transferir o
   indicador para a superfície arredondada do compositor com borda e halo
   sutis. Botões mantêm o foco próprio; modo de cores forçadas mantém um anel
   externo visível.

## Fases de implementação

### Fase 1 — inventário e manual

- reconciliar rotas, fluxos, vibes, versões, 12 estruturas, 30 blocos, 33
  ferramentas, imagens, logos, chat, publicação, SEO, tráfego e limites com o
  código atual;
- registrar a hierarquia de fontes e distinguir rascunho, snapshot publicado e
  deployment;
- ligar o manual ao índice de documentação vigente;
- adicionar contrato automatizado que falha quando um bloco ou ferramenta não
  aparece no manual.

**Aceite:** todas as seções carregam no runtime; os 30 `BLOCK_TYPES` e as 33
chaves de `buildTools` aparecem no documento; o arquivo está nos manifests do
build de produção.

### Fase 2 — soul e recuperação de conhecimento

- manter uma única identidade em `/SOUL.md`;
- explicitar conversa antes da execução, pensamento crítico, senioridade de
  design, factualidade e humor com limites;
- criar o leitor determinístico por seção e a ferramenta
  `read_generator_manual`;
- informar no prompt quando consultar o manual e quando usar o estado do tenant.

**Aceite:** o prompt de conversa contém identidade e índice do manual, omite o
catálogo de escrita e nunca instrui o agente a encerrar com uma mudança que não
ocorreu.

### Fase 3 — intenção e ferramentas

- criar `interactionModeFor` com normalização de acento, caixa e espaço;
- priorizar negação explícita e perguntas de capacidade sobre palavras soltas
  como “criar” ou “trocar”;
- reconhecer comandos, desejos concretos, pedidos diretos e confirmações de uma
  proposta executável do turno anterior;
- calcular `conversationOnly` antes de `editPolicyFor`;
- aplicar `conversationTools` depois dos filtros de escopo;
- preservar os caminhos determinísticos de publicar, andamento, continuar,
  desfazer e confirmação de remoção;
- usar fallback próprio para conversa em vez de um relatório de geração.

**Aceite:** perguntas e hipóteses não recebem qualquer executor de escrita;
ordens diretas preservam o fluxo existente; “sim” isolado não libera ação sem
uma proposta executável anterior.

### Fase 4 — compositor refinado

- trocar o label para “Mensagem para o Eixu”;
- comunicar no placeholder que a caixa aceita pergunta, ideia e ajuste;
- aplicar foco somente quando o textarea está `:focus-visible`, evitando que o
  foco de um botão ilumine também a caixa inteira;
- preservar indicador perceptível em cores forçadas;
- conferir desktop e celular com CSS compilado.

**Aceite:** o textarea tem outline computado `none`/`0px`; o contêiner muda
borda e recebe um halo único; foco dos demais controles permanece visível; não
surge overflow.

### Fase 5 — documentação e entrega

- atualizar Manual do operador, Arquitetura, Harness, Edição pelo chat e índice;
- registrar testes e limitações reais neste plano;
- revisar o diff completo, preservar trabalho alheio e abrir PR a partir da
  `main` atual;
- conferir os checks da PR e relacionar resultado ao SHA da branch.

## Matriz de validação

| Risco                               | Evidência                                                                |
| ----------------------------------- | ------------------------------------------------------------------------ |
| Pergunta alterar o rascunho         | testes de frases + conjunto exato de ferramentas do runtime              |
| Ordem deixar de funcionar           | casos diretos, desejo concreto, pedido “pode…” e confirmação contextual  |
| Manual incompleto ou fora do bundle | cobertura de blocos/ferramentas + teste dos manifests `.nft.json`        |
| Prompt continuar mecânico           | snapshot sem catálogo de escrita, com modo Conversa e fechamento natural |
| Regressão do chat/edição            | suíte `test:admin` e fluxos de navegador afetados                        |
| Regressão de renderer/site          | suíte `test:sites`                                                       |
| Outline duplo                       | estilos computados e captura do compositor focado                        |
| Incompatibilidade Next/Vercel       | typegen, TypeScript, lint e `build:vercel`                               |

Comandos obrigatórios:

```bash
npx next typegen && npx tsc --noEmit
npm run lint
npm run test:sites
npm run test:admin
npm run build:vercel
EIXU_CHROME_PATH=... npm run test:admin:browser
```

Os testes de navegador podem ser reduzidos aos fluxos afetados depois que a
suíte contratual completa passar, desde que usem o CSS do build Next. Não são
necessárias chamadas pagas, Neon remoto, Blob remoto, seed ou publicação de
página de cliente para validar esta mudança.

## Rollout e reversão

A alteração não migra banco nem modifica tenant. O maior risco é uma frase de
ação ser classificada como conversa; nesse caso nada é salvo e o operador pode
reformular diretamente. Telemetria existente de turnos e ferramentas permite
observar a proporção de conversas sem registrar prompt ou conteúdo em log.

Se houver regressão, a fronteira pode ser revertida removendo
`conversationOnly` e o filtro de ferramentas, sem tocar páginas ou snapshots.
O manual e o soul permanecem úteis de forma independente. O CSS pode voltar à
borda anterior sem qualquer migração.

## Registro da execução

- Branch: `codex/chat-manual-soul`, criada a partir da `origin/main` em
  `85af97b`. O SHA da entrega e a PR são registrados depois do primeiro push,
  pois ainda não existem antes de este documento entrar no Git.
- `npx next typegen && npx tsc --noEmit`: passou.
- `npm run lint`: passou.
- `npx oxfmt --check` nos 24 arquivos desta entrega: passou. O check global
  também encontrou 37 arquivos antigos fora do diff com formatação pendente;
  eles foram preservados.
- `npm run test:admin`: 299 testes, 291 passaram e 8 opt-ins de infraestrutura
  foram pulados; nenhuma falha.
- `npm run test:sites`: 303 testes, 301 passaram e 2 opt-ins de captura foram
  pulados; nenhuma falha.
- `npm run build:vercel`: compilação Next.js 16.3.3, TypeScript, 15 páginas
  estáticas e 4 contratos do artefato serverless passaram. O manual consta nos
  três manifests esperados.
- `EIXU_CHROME_PATH=/usr/bin/google-chrome npm run test:admin:browser`: 21 de
  21 fluxos passaram. O ensaio encontrou e corrigiu também a colisão entre o
  seletor de página e “Desktop” em 320 px.
- A captura `outputs/chat-recovery/composer-focus.png` foi observada: há uma
  única borda arredondada com halo discreto, sem o retângulo interno do
  `textarea`. O anexo temporário original não estava disponível no filesystem;
  a reprodução e a validação usaram o compositor atual do produto.
- Nenhuma chamada paga, escrita em Neon/Blob, seed, migração, publicação de
  tenant ou deployment foi necessária para os checks locais.
