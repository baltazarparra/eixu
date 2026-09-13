# Evolução das vibes

Reconciliado em 13/09/2026 com `main` até o PR #58. O diagnóstico e o plano
originais estão no [arquivo histórico](archive/vibes-plan-2026-09-12.md).
Este documento mantém apenas a direção das próximas evoluções; o contrato
implementado está em [Design](design.md).

## O que já foi entregue

As quatro vibes multipágina têm três estruturas cada, um bloco autoral controlado
com doze layouts, plano de cenas coerente e verificação de ordem e composição.
V5 seleciona dentro da vibe. V6 dá prioridade à referência verificada na escolha
da estrutura e dos eixos visuais; a vibe permanece como voz e fallback. Landing
Page usa perfil v7 com jornada de página única. Perfis publicados mantêm sua
apresentação até uma recomposição e publicação explícitas.

A moderna já tem fio entre capítulos, painéis, pílula e rótulos em mono.
Iconografia contextual, fotos numeradas geradas/enviadas/importadas, edição de
texto e estilo na prévia e controles de moldura, recorte, largura e espaçamento
já existem. Não devem voltar ao backlog como funcionalidades ausentes.

## Propostas que continuam abertas

| Proposta                                      | Critério antes de implementar                                                                                                                                                                                                   |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mais expressão tipográfica por título         | Definir no schema peso, itálico, caixa e eventual ênfase parcial; validar legibilidade, tradução para o renderer e compatibilidade com a edição por campo. Os ajustes atuais de tamanho/cor não equivalem a estilo por palavra. |
| Ampliar a gramática de movimento de cada vibe | Partir dos gestos existentes e do conteúdo; demonstrar diferença de experiência, preservar movimento reduzido, teclado, toque e desempenho.                                                                                     |
| Avaliar variedade e qualidade entre negócios  | Comparar as doze estruturas em casos repetíveis de produto e serviço, além de Landing Page separadamente. Registrar saída automática, custo, latência e revisão humana pela rubrica.                                            |

Essas propostas não autorizam chamadas pagas nem mudanças em clientes existentes.
Um novo contrato precisa alinhar schema, catálogo, renderer, plano de cenas,
pre-flight e crítica, com estratégia explícita para perfis já publicados.

Na geração, os gates continuam exigentes. Na publicação solicitada, a política
atual converte achados editoriais em recomendações e mantém os erros técnicos
bloqueantes. Evoluir a avaliação não deve confundir esses dois caminhos.

## Como validar uma evolução

Use [Verificação](verification.md) para os checks correspondentes e a
[Rubrica](eval-rubric.md) para qualidade editorial e visual. Compare o mesmo
conteúdo confirmado entre direções e registre o que realmente foi executado.
Testes sintéticos e ausência de overflow não demonstram compreensão pelo público,
fidelidade à referência ou conversão comercial.
