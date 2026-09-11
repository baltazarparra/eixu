# Revisão do admin, 10/09/2026

Registro histórico de 10/09/2026. As medidas de custo e a compactação descritas abaixo documentam aquela entrega. A política vigente, orientada à qualidade com Gemini 3.8 Flash, está em [Harness](harness.md); a jornada atual está no [manual](admin.md). Os números históricos não são uma avaliação do harness atual.

A entrega reorganiza a operação de clientes, reduz o reenvio de contexto nos chats, mede o consumo informado pelo Gateway e corrige inconsistências de publicação, prévia, formulários administrativos e tráfego. Base revisada: `1cad6cd`, árvore inicialmente limpa. Modelo, limites de composição e pre-flight foram preservados.

## Cobertura e resultado

| Fluxo revisado                      | Implementação                                                                                                                                                                                                                                                                                                             |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Login, sessão e resolução de tenant | Sessão recusa payload inválido/expirado e falta de segredo em produção. Host só resolve subdomínios permitidos; `127.0.0.1` não vira tenant. O admin continua global.                                                                                                                                                     |
| Lista, cadastro e estados de falha  | Busca por nome/endereço, filtros, cadastro recolhido, erros de validação preservando campos, slug duplicado recusado, carregamento/erro/cliente inexistente com retorno à lista.                                                                                                                                          |
| Site e estado de publicação         | Navegação comum, seletor de página legível no celular, conversa/prévia alternáveis, erros globais e por página visíveis. Servidor e refresh usam a mesma função; mudanças só de SEO ficam pendentes.                                                                                                                      |
| Chat, histórico e custo             | Últimas 60 mensagens por canal reidratadas. Instruções e respostas finais preservadas; resultados antigos de ferramentas viram recibos e anexos antigos viram referências. Loop ativo intacto, cache automático, tokens/custo por resposta e interrupção da sequência após falha ou fase sem avanço.                      |
| Geração e qualidade                 | Quatro fases, mesmos modelos, catálogo, schemas, ferramentas de reparo e validadores. Consultas de leitura deixam de recarregar estado/iframe. Sugestões preenchem a caixa e aguardam envio.                                                                                                                              |
| Biblioteca, upload e logo           | Filtros com estado vazio específico, feedback HTTP, ações bloqueadas enquanto pendentes e confirmação de exclusão. Aplicação exige logo aprovado do tenant ou upload manual válido. Falha do Blob conserva a referência da imagem.                                                                                        |
| Dados e briefing                    | Formulário direto para nome, contatos e intake; upload/aplicação de logo final. Alterações simples dispensam uma chamada ao modelo. A interface explica os campos compartilhados com o site ao vivo.                                                                                                                      |
| Prévia e renderizador               | Rascunho exige sessão e recebe `noindex`. SEO e FAQ do JSON-LD usam o snapshot correspondente. Links preservam cliente/modo; formulários e tracking ficam desativados. A captura usa cookie restrito ao host, sem repassá-lo a recursos externos; página recusada não vira revisão bem-sucedida.                          |
| Tráfego, gastos e CSV               | Datas inclusivas em Brasília, IDs distintos no total, soma de canais, campanhas sem visita e totais independentes das 50 linhas exibidas. Gastos parcialmente sobrepostos são avisados e excluídos. WhatsApp usa apenas o redirecionador para o clique rastreado. CSV neutraliza fórmulas e explicita seu período/limite. |
| Documentação e release              | README, arquitetura, design, harness e verificação atualizados; plano criativo identificado como histórico. Novo [manual do operador](admin.md). Rubrica de qualidade completa preservada.                                                                                                                                |

Não houve migração, seed, troca de modelo, alteração de variáveis remotas, geração de imagens, aprovação de candidatas nem publicação de páginas de clientes nesta entrega. As escritas de interface foram simuladas; as chamadas reais de modelo usaram executores em memória.

## Custo medido

O ensaio pediu uma alteração pontual no logo do cabeçalho, de 28 para 52 px, mantendo o rodapé em 28 px e todas as outras props. Usou `anthropic/claude-opus-4.5`, prompt e schemas reais, limite de quatro passos e executores em memória. Os três resultados foram profundamente iguais ao estado esperado.

| Execução                              | Entrada | Saída | Entrada lida do cache | Passos |  Tempo | Custo retornado |
| ------------------------------------- | ------: | ----: | --------------------: | -----: | -----: | --------------: |
| Histórico completo, referência        |  31.653 |   128 |                     0 |      2 | 5,13 s |    US$ 0,161465 |
| Histórico compacto e cache automático |  23.385 |   139 |                11.635 |      2 | 5,11 s |    US$ 0,082725 |
| Repetição com cache reutilizado       |  23.385 |   132 |                23.381 |      2 | 4,74 s |   US$ 0,0150105 |

Nesse caso, a primeira execução otimizada custou aproximadamente **49% menos**, e a repetição **91% menos**, com o mesmo resultado correto. O consumo total do ensaio foi US$ 0,2592005. A entrada caiu cerca de 26%; o payload de histórico caiu de 16.593 para 385 caracteres (97,7%), que é uma medida diferente de tokens faturados.

O cache depende de provedor, prefixo e janela; escrita e leitura podem ter preços distintos. A implementação usa a [opção oficial de cache do Gateway](https://vercel.com/docs/ai-gateway/models-and-providers/provider-options), seguindo o [funcionamento de prompt caching](https://vercel.com/academy/ai-gateway/prompt-caching). O painel usa custos efetivamente retornados por todos os passos; ausência de custo não vira zero.

Essa amostra demonstra uma edição correta, não economia fixa ou equivalência estética em geração completa. Nenhum modelo mais barato foi adotado. Geração de imagens, críticas internas, falhas sem recibo, outras abas e histórico anterior à abertura não entram na soma mostrada pelo chat. Consolidação contábil por cliente continua fora do MVP.

Reprodução:

```bash
npm run eval:admin-cost
# Três chamadas pagas; nenhuma ferramenta grava banco/Blob ou publica:
npm run eval:admin-cost -- --live
```

O modo seco grava `outputs/admin-review/token-eval-dry.json`; o modo pago grava `token-eval.json`. Não rodar a avaliação paga como check automático de toda edição.

## Verificação

- **37 testes de sites:** aprovação, isolamento por tenant, publicação, inbound, composição, reparos, proporções e progressão de fases.
- **18 testes de admin:** contexto preservado, SEO pendente, recusas, sessão, logos, datas/gastos, cache/custo, CSV, atribuição e captura. O teste de captura foi executado com Chromium local: sessão chegou à prévia e não ao recurso em outro host; 404 foi recusado. Sem `EIXU_CHROME_PATH`, somente esse teste é pulado.
- **24 verificações de navegador no build Next.js de produção:** seis estados/superfícies em 320, 390 e 1440 px; edição pronta/bloqueada/vazia, biblioteca, dados e tráfego. Foram exercitados seletor, troca de vista, pendências, sessão expirada, sugestão sem chamada automática, histórico enviado ao chat, interrupção após uma falha, filtro de imagens, confirmação/cancelamento de exclusão e salvamento simulado de briefing. Zero overflow de página e zero erros de runtime nesses casos.
- **20 verificações autenticadas/HTTP com o banco conectado:** lista e quatro áreas de cliente, estado, biblioteca, dados inválidos, logo externo recusado, mensagens inválidas, formulário de prévia recusado, prévia autenticada com navegação e metadados, publicado acessível e rascunho recusado sem sessão. Sem gravação de dados.
- **Consultas reais somente leitura:** os totais de tráfego coincidiram com uma consulta independente por data local. Cadastro com slug reservado e gasto inválido são exercitados sem alcançar o insert; erro deve preservar os campos.
- **Qualidade de código:** tipos, build Next.js e lint dos arquivos alterados aprovados. O lint global mantém os mesmos **20 erros em 13 arquivos** da base, em `components/ui/`, `components/terminal-headline.tsx` e `hooks/use-mobile.ts`; nenhuma regra foi desligada.

As capturas e os scripts locais ficam em `outputs/admin-review/`, ignorado pelo Git. A rota sintética de revisão é removida antes do build de release. O CSS foi conferido no build de produção depois de um cache antigo do desenvolvimento exibir dimensões incorretas.

## Limites e próximos critérios

O snapshot continua restrito a blocos/SEO; marca, contatos e metadados compartilhados podem mudar o site ao vivo. A autorização de publicação pelo chat livre continua baseada no prompt, e a de aprovação de imagens usa interpretação por regex. A interface direta e o pre-flight não transformam esses mecanismos em autorização estruturada. O [contrato de arquitetura](architecture.md#limites-atuais) registra os limites.

Os eventos antigos de WhatsApp não foram deduplicados e os gastos não foram reescritos. Não houve teste de envio real de contato, nova geração completa com imagens ou repetição estatística da rubrica estética nesta revisão. A geração completa deve ser avaliada separadamente com `eval:site`, recurso descartável e a [rubrica](eval-rubric.md).

A publicação desta entrega é de **código** via `main`/Vercel. O aceite do release exige o deployment do mesmo SHA em `READY`, aliases atribuídos e smoke de rotas públicas, autenticação e rascunho; um deployment anterior não serve de evidência.
