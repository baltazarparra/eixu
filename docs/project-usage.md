# Consumo acumulado por projeto

`ai_usage` conserva o mesmo tenant na geração, conversão e manutenção Premium.
A tela `/admin/[tenant]/consumo` mostra o acumulado de toda a vida do projeto e,
no período escolhido, origem, fase, operações, modelos, tokens e custo em USD.
O histórico anterior à instrumentação de fase aparece como **Fase não
registrada**, sem reclassificar chamadas antigas pelo estado atual do site.

## Cobertura

- Chamadas do gerador, imagens, logos, leituras e críticos: coleta existente do
  Gateway, agora com a fase do tenant capturada no início de cada chamada.
- Desenvolvimento, diagnóstico, revisão e testes com IA no Codex/Claude:
  importação dos contadores de sessões dedicadas ao cliente.
- IA executada pelo próprio Premium, ferramentas pagas, hospedagem, domínio e
  outros serviços: recibo externo atribuído exclusivamente ao projeto. Custos
  sem tokens são aceitos. Um recibo deve representar o custo completo daquela
  unidade, não parcelas sucessivas com o mesmo identificador.
- Trabalho compartilhado no produto EIXU, contas compartilhadas e assinaturas:
  não se lança tudo em um cliente e não se presume rateio. Não há cálculo de
  preço de tabela ou conversão cambial. O valor precisa vir do fornecedor em USD.

O CMS determinístico não chama IA. Uso por assinatura pode ter tokens sem valor
por chamada. **Custo não informado não é zero**, e o total cobre somente os
recibos recebidos, não a fatura inteira nem sessões que ainda não foram coletadas.
Cache e raciocínio já estão contidos nos tokens normalizados; não somar de novo.

## Coleta no harness

A migração de `db/schema.sql` deve preceder o código. Não aplica migração nem
acessa banco no modo de prévia. Da raiz do repositório:

```bash
npm run usage:sync -- --source=codex --file=/caminho/rollout.jsonl --tenant=cliente --lifecycle=premium
npm run usage:sync -- --source=claude --file=/caminho/sessao.jsonl --tenant=cliente --lifecycle=premium
```

Revise o slug, fase (`generator`, `converting`, `premium`) e o conteúdo dos
recibos. Use exclusivamente arquivos cujo trabalho seja todo daquele cliente e
fase. Sessões mistas exigem recibos externos já separados por operação com
atribuição verificada; não existe rateio automático por arquivo editado.

Quando o banco de destino estiver autorizado, `--apply` persiste; exige também
`--database-host=<host-exato>` correspondente à `DATABASE_URL` do ambiente. Essa
credencial pertence ao operador na raiz, nunca ao app Premium. O token do
Kanban e o bearer público do Premium não concedem acesso ao ledger.

```bash
npm run usage:sync -- --source=codex --file=/caminho/rollout.jsonl --tenant=cliente --lifecycle=premium --apply --database-host=host-autorizado --watch
```

`--watch` relê a cada 30 segundos; Ctrl+C tenta uma última sincronização. Uma
sincronização final depois que a resposta do agente terminar é necessária para
incluir seu último recibo. O processo precisa permanecer ativo; não se instala
um serviço ou hook global. Reexecutar é seguro: uma identidade externa só pode
pertencer a um cliente e uma fase. Um conflito cancela o lote inteiro, inclusive um custo informado diferente
para o mesmo recibo. Informação ausente pode ser preenchida depois.

O parser Codex usa `last_token_usage`, deduplicado pelos contadores acumulados;
eventos repetidos não são novas chamadas. O acumulado não é somado como se fosse
consumo de cada interação. Logs reconhecidos como forks são recusados para não
cobrar contexto herdado. O modelo vem de `turn_context`, quando disponível.
O parser Claude agrupa pelo ID da mensagem, incluindo tokens de leitura e
escrita de cache na entrada, pois o formato os informa separadamente.
Respostas repetidas/streaming atualizam os contadores sem nova cobrança.
Os formatos foram conferidos em logs locais; mudanças do cliente podem exigir
atualizar o parser. Linha final ainda incompleta é avisada; corrupção no meio
recusa a importação.

Cada subagente ou ferramenta com log próprio exige outra coleta. Não se faz
varredura de todas as conversas do operador. Prompts, respostas, caminhos,
credenciais e conteúdo do cliente não são persistidos nem impressos pela coleta.
Erros e origens sem recibo precisam ser declarados na entrega do trabalho.

## Recibos externos

Um objeto JSON por linha, campos obrigatórios; use `null` para informação que o
fornecedor não entrega. `source` é sempre `external`; `externalId` precisa ser
estável e incluir o fornecedor, conta e identificador da operação/fatura para
não colidir. `model` identifica o modelo ou o serviço. `kind` é
`desenvolvimento`, `ia-runtime` ou `servico-externo`.

```json
{
  "source": "external",
  "externalId": "fornecedor:conta:operacao-123",
  "model": "fornecedor/modelo",
  "kind": "ia-runtime",
  "occurredAt": "2026-09-17T01:00:00Z",
  "inputTokens": 1000,
  "outputTokens": 200,
  "totalTokens": 1200,
  "cacheReadTokens": null,
  "cacheWriteTokens": null,
  "reasoningTokens": null,
  "costUsd": 0.01
}
```

Importe com `--source=external`. Não importe novamente uma chamada já coberta
pelo Gateway ou pelo coletor nativo. IDs de fontes distintas não permitem
reconhecer semanticamente uma duplicata. Para faturas agregadas, escolha entre
recibos individuais e total da fatura; nunca os dois.

Não há integração automática com faturamento de Vercel/Neon, conversão de BRL,
ou estimativa de assinatura. Uma despesa sem tokens mantém esses campos nulos;
o painel informa essa ausência. Não há atribuição retroativa sem evidência.
