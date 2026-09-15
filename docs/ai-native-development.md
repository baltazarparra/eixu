# Desenvolvimento AI Native pelo Kanban

Este fluxo transforma um pedido em uma spec persistida, uma PR validada e uma
revisão independente. O Kanban em `/admin/kanban` é a passagem de contexto entre
conversas do Codex; o repositório, a PR e os checks continuam sendo as fontes de
verdade da implementação.

## Papéis e estados

| Estado           | Responsável e significado                                                                 |
| ---------------- | ----------------------------------------------------------------------------------------- |
| **A fazer**      | Astra criou e conferiu uma spec pronta para execução.                                     |
| **Em andamento** | Sol assumiu o card, criou seu plano e está implementando ou corrigindo a entrega.         |
| **Em revisão**   | Há uma PR validada e um HEAD explícito aguardando ou tendo passado pela revisão do Astra. |
| **Concluído**    | A PR foi integrada e os requisitos de release da própria spec foram verificados.          |

Use GPT-6 Astra para especificação e revisão, e GPT-5.6 Sol para implementação.
O esforço de raciocínio acompanha o risco da tarefa. Selecione o modelo ao abrir
cada conversa; texto dentro de uma skill não comprova qual modelo está ativo.
Cada passagem deve funcionar em uma conversa nova, sem memória da anterior.

As skills ficam no escopo do repositório:

- `$kanban-spec`: investiga a necessidade e cria ou refina o card;
- `$kanban-delivery`: lê o card, planeja, implementa, valida e abre a PR;
- `$kanban-pr-review`: revisa o HEAD da PR contra a spec antes do merge.

Skills são o mecanismo apropriado porque cada fase tem um gatilho e um resultado
próprios. O `AGENTS.md` guarda apenas as invariantes compartilhadas. Esta versão
não depende de hook: transição de coluna, checks, SHA e estado da PR precisam de
confirmação nos sistemas que realmente os armazenam.

## Contrato do card

O título identifica uma entrega. A descrição deve conter contexto suficiente
para um agente novo entender o problema e validar o resultado:

1. problema e evidência do estado atual;
2. resultado esperado em comportamento observável;
3. escopo incluído e exclusões relevantes;
4. critérios de aceite verificáveis;
5. base, fluxos, rotas, documentos ou arquivos já investigados;
6. restrições e decisões que precisam ser preservadas;
7. validação esperada;
8. dependências e lacunas ainda conhecidas.

O card não contém um plano de implementação obrigatório. O Sol cria o plano a
partir da base atual e pode escolher outra solução que cumpra o mesmo contrato.
Ele não altera os critérios para acomodar a implementação.

A descrição aceita até 12.000 caracteres, incluindo recibos posteriores. Se uma
entrega precisa de mais contexto, reduza repetição ou divida resultados
independentes em cards diferentes. Um documento ligado pode aprofundar a
evidência, mas as decisões essenciais permanecem no card.

## Cliente das rotas

`npm run kanban` chama as rotas administrativas existentes. O cliente em
`scripts/kanban.mjs` usa `KANBAN_AGENT_TOKEN`, um bearer aceito exclusivamente
pelas rotas do Kanban. O token não libera outras APIs administrativas, ignora
`Origin` porque não é uma credencial de navegador e continua bloqueado em host
de cliente. Em worktrees, o cliente também procura `KANBAN_AGENT_TOKEN` no
`.env.local` do checkout principal. Credenciais e valores de ambiente não são
exibidos. A sessão humana é aleatória, persistida e atribuída ao operador; não é
uma credencial válida para automação fora do navegador.

Produção em `https://eixu.com.br` é o destino padrão. Para um servidor local,
defina `EIXU_KANBAN_URL=http://localhost:3000`. Exemplos:

```bash
npm run kanban -- board
npm run kanban -- card 0001
npm run kanban -- create-card --title "Corrigir retorno do login" --column "A fazer" --description-file /tmp/spec.md --priority high
npm run kanban -- update-card 0001 --append-description-file /tmp/entrega.md
npm run kanban -- move-card 0001 --column "Em revisão"
```

Cada card tem um número permanente e global, mostrado como `#0001` no quadro,
no editor e no arquivo. `card`, `update-card` e `move-card` aceitam `0001`, `1`,
`'#0001'` ou o UUID legado. Nas respostas, `number` é o número e `id` continua
sendo o UUID usado nas mutações da API. Números acima de 9999 crescem normalmente;
a largura de quatro dígitos é apenas apresentação. Exclusões e tentativas que
falham podem deixar lacunas; números nunca são reutilizados.

Para um pedido como **“revise o card 0001 e crie um plano de implementação”**,
leia `npm run kanban -- card 0001`, confira o código atual e entregue a análise
e o plano. Esse pedido sozinho não autoriza implementar, mudar a coluna ou
gravar um recibo no card. A revisão de uma spec e a revisão de uma PR são fases
diferentes; use `$kanban-pr-review` quando houver uma PR para revisar.

Cliente e prazo são opcionais: `--tenant <slug>` e `--due-date YYYY-MM-DD`.
Prioridades aceitas são `low`, `medium`, `high` e `urgent`. Em atualizações,
`none` remove cliente, prazo ou prioridade. O cliente usa a revisão do quadro e
a versão do cartão; conflito exige reler e reconciliar o estado antes de tentar
novamente. A criação repete uma vez após conflito estrutural com o mesmo UUID.

## Especificação com Astra

O Astra começa pelo pedido, `AGENTS.md`, documentação relevante e código atual.
Ele separa fato, decisão e lacuna, resolve ambiguidades materiais e escreve
critérios observáveis. A spec deve caber em uma PR coerente. Depois da revisão do
texto, cria ou atualiza o card em **A fazer** e entrega seu ID.

Exemplo de início de conversa:

```text
$kanban-spec Transforme este pedido em um card pronto para desenvolvimento: ...
```

## Implementação com Sol

O Sol recebe o ID, lê o card completo e confere se a base ainda sustenta a spec.
Ele preserva trabalho alheio, usa branch ou worktree isolado, move o card para
**Em andamento** e cria seu plano. Após implementar, percorre os consumidores da
mudança, atualiza documentação e executa os gates proporcionais ao risco.

A PR registra o ID do card, o comportamento entregue, critérios atendidos,
validações e limitações. O recibo no card contém URL da PR, HEAD completo, base e
evidências. Só então o Sol move a tarefa para **Em revisão**. Ele não faz o merge
nem marca o próprio trabalho como concluído.

Exemplo:

```text
$kanban-delivery Execute o card 0001 até uma PR validada.
```

## Revisão com Astra

A revisão ocorre em outra conversa. O Astra lê card, PR, HEAD, base, diff e
arquivos necessários fora do diff. Ele confronta cada critério de aceite com
evidência e verifica riscos de regressão, autorização, dados, concorrência,
acessibilidade e release conforme a mudança.

O parecer sempre identifica o SHA revisado. Com bloqueios, o card volta para
**Em andamento**; após as correções, um novo HEAD exige nova revisão. Sem
bloqueios, permanece **Em revisão** até o merge. Comentários no GitHub só são
publicados quando pedidos; o recibo do card continua obrigatório.

Exemplo:

```text
$kanban-pr-review Revise a PR <url> contra o card 0001 antes do merge.
```

Depois do merge, mova para **Concluído** somente quando a PR e, se exigido pela
spec, o deployment do mesmo SHA e seu smoke estiverem confirmados. Merge, deploy
de código e publicação de páginas de clientes são estados diferentes.

## Limites atuais

O quadro é global e não possui responsável individual nem reserva atômica de um
card. A distribuição entre agentes continua explícita: uma pessoa abre a tarefa
do Sol e entrega o ID. O histórico detalhado permanece no Git e na PR; o card
guarda o contrato e recibos compactos. Se colisões de execução virarem um
problema observado, autoria e claim devem ser modelados no produto antes de
automatizar a fila.
