---
name: kanban-spec
description: Cria ou refina uma spec de desenvolvimento autossuficiente no Kanban interno da EIXU. Use quando o pedido for transformar uma necessidade, bug ou ideia em card pronto para outro agente executar; não use para implementar o card.
---

# Especificar um card

Produza um contrato de resultado que outro agente consiga executar em uma nova
conversa, sem depender do histórico que originou o pedido. Esta fase é indicada
para GPT-6 Astra; a seleção do modelo acontece no Codex e não pode ser inferida
pela skill.

Leia [o fluxo AI Native](../../../docs/ai-native-development.md) e o `AGENTS.md`
antes de gravar. Use somente as rotas do Kanban por meio de `npm run kanban`;
não escreva diretamente no banco.

## Construir a spec

1. Confira o estado atual do repositório, o fluxo afetado e a documentação
   vigente. Registre referências concretas, com commit ou branch quando isso
   evitar ambiguidade temporal.
2. Separe fatos observados, decisões já tomadas e lacunas. Pergunte somente
   quando a resposta mudar produto, escopo, dados, custo ou resultado; continue
   a investigação independente enquanto isso.
3. Delimite uma entrega que caiba em uma PR coerente. Se o pedido reunir
   resultados independentes, proponha cards separados em vez de esconder a
   divisão numa lista extensa.
4. Escreva critérios de aceite observáveis. Cubra o caminho principal, os erros
   relevantes e as invariantes que podem regredir. Não prescreva arquivos ou uma
   solução técnica sem evidência de que são parte do contrato.
5. Revise a spec procurando contradições, termos vagos, dependências implícitas
   e alegações sem fonte.

Use esta estrutura, removendo campos que realmente não se aplicam:

```markdown
## Problema e contexto

<estado atual, pessoas/fluxos afetados e evidência>

## Resultado esperado

<comportamento final observável>

## Escopo

- Inclui: ...
- Fora desta entrega: ...

## Critérios de aceite

- [ ] ...

## Evidência técnica

- Base consultada: <branch e SHA>
- Fluxos, rotas, arquivos ou documentos relevantes: ...

## Restrições e decisões

- ...

## Validação esperada

- ...

## Dependências e lacunas

- Nenhuma conhecida. | ...
```

O limite atual da descrição é 12.000 caracteres. Preserve todas as decisões
necessárias, corte narrativa repetida e deixe espaço para os recibos de entrega
e revisão. A spec define o que deve ser verdade; o plano de implementação será
criado pelo agente executor depois de reler o código atual.

## Gravar no Kanban

Para criar, salve a descrição em um arquivo temporário e execute:

```bash
npm run kanban -- create-card --title "<título>" --column "A fazer" --description-file <arquivo>
```

Prioridade, prazo e cliente são opcionais. Vincule um cliente apenas quando a
tarefa for específica daquele tenant; o Kanban também recebe trabalho interno
de engenharia. Para refinar um card existente, releia sua versão antes de usar
`update-card`; conflito de versão exige nova leitura e reconciliação, nunca
sobrescrita cega.

Encerre informando ID, título, coluna e qualquer lacuna que ainda dependa de
decisão. Não implemente o card nesta fase.
