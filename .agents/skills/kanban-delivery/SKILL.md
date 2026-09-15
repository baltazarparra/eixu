---
name: kanban-delivery
description: Executa um card de desenvolvimento do Kanban da EIXU até uma PR validada. Use quando o usuário fornecer ou apontar um card pronto para implementação; não use para criar a spec nem para aprovar a própria PR.
---

# Desenvolver um card

Leve um card pronto de **A fazer** até uma PR em **Em revisão**. Esta fase é
indicada para GPT-5.6 Sol; a seleção do modelo acontece no Codex e não pode ser
inferida pela skill.

Leia [o fluxo AI Native](../../../docs/ai-native-development.md), o `AGENTS.md`,
o card completo e o código atual antes de planejar. Use `npm run kanban` para o
quadro; não escreva diretamente no banco.

## Assumir e planejar

1. Consulte `npm run kanban -- card <id>` e `npm run kanban -- board`. Confirme
   que o card está ativo e identifique sua coluna.
2. Compare a spec com a base atual. Se houver uma dúvida material ou uma
   contradição que altere o resultado, apresente a evidência e peça a decisão.
   Não reescreva critérios de aceite para acomodar uma implementação mais fácil.
3. Preserve alterações alheias. Crie branch ou worktree isolado a partir da base
   pedida; na ausência dela, use a branch padrão remota atual. Use o prefixo de
   branch definido pelo repositório.
4. Ao iniciar trabalho efetivo, mova o card para **Em andamento**. Uma mudança
   concorrente no quadro exige reler o estado antes de repetir o comando.
5. Crie seu próprio plano de execução a partir do código atual. Mantenha-o vivo
   durante o trabalho; não copie para ele uma solução hipotética que a spec não
   exige.

## Implementar e entregar

Percorra produtores, consumidores, autorização, persistência, interface,
documentação e release afetados. Faça a menor mudança completa que satisfaça a
spec. Valide conforme o risco e os comandos do repositório, incluindo o fluxo
real afetado quando compilação isolada não for evidência suficiente.

Antes da PR:

- revise o diff completo e confirme cada critério de aceite;
- registre checks executados, resultados e limites reais;
- atualize a documentação vigente afetada;
- confirme que o commit e a branch contêm somente o escopo do card.

Abra a PR com o ID do card, problema, comportamento final, critérios atendidos,
validações e limitações. Registre o HEAD exato que foi entregue. Depois de a PR
existir e os checks exigidos passarem, acrescente ao card um recibo compacto:

```markdown
## Entrega

- PR: <url>
- HEAD: `<sha completo>`
- Base: `<branch ou sha>`
- Validação: <checks e fluxo exercitado>
- Limitações: <nenhuma conhecida ou lacunas reais>
```

Use `update-card --append-description-file <arquivo>` e então mova o card:

```bash
npm run kanban -- move-card <id> --column "Em revisão"
```

Não marque como **Concluído** e não faça merge da própria PR. Commit novo após
uma revisão invalida o parecer anterior; mantenha o card em **Em revisão** e
solicite uma nova leitura do HEAD.
