# Gerador: riqueza visual, movimento e inbound

Pedido de 10/09/2026. Entrega autorizada: analisar, implementar, validar e publicar.

## Diagnóstico inicial (histórico)

- Porto Pedras tem uma home comercial, um obrigado e uma única foto gerada aprovada. A home usa quase só fundos neutros e longas listas de texto.
- O perfil promete veios e materialidade, mas o renderer traduz isso em cantos genéricos. O dourado escolhido não conversa com o verde do logo.
- O contrato anterior evita bibliotecas de motion e páginas adicionais. Pre-flight mede quantidade de enums escolhidos, sem garantir imagens, percurso editorial ou páginas úteis.

## Entregas e aceite

1. Composição visual: hero com duas imagens e legenda, explorador visual interativo e recursos editoriais ligados a páginas. Paleta por papéis, contraste medido, componentes reutilizáveis sem forçar a mesma silhueta.
2. Framer Motion: entrada coordenada, microinterações e transições de seleção. Conteúdo inicial visível sem JS, teclado, touch e movimento reduzido verificados.
3. Contrato de site: no mínimo três páginas orgânicas substanciais com intenções diferentes e links válidos. Obrigado e landing de anúncio não contam. Home com pelo menos duas URLs distintas de fotos geradas pelo pipeline do tenant; publicação exige aprovação do operador.
4. Imagens: ferramenta do chat usa o gerador existente, guia coerente, crítica e candidatas persistidas. Não aprova imagens nem logos por inferência.
5. Porto Pedras: home, materiais e guia de escolha, preservando formulário/obrigado e dados verificáveis. Imagens de inspiração identificadas como tal, sem fingir obras executadas.
6. Validação: gates de projeto em ambos os caminhos de publicação, teste de recusa sem escrita, geração de modelo com ferramentas, screenshots desktop/mobile, interações e smoke. Git/Vercel no SHA exato.

## Sequência

Contratos e componentes; cenas pelo gerador; composição das páginas; validação técnica e visual; aprovação das candidatas pelo operador; publicação do código e das páginas autorizadas; smoke em produção.

## Publicação

A base funcional foi publicada em `03aa858`; a inspeção posterior identificou e corrigiu o carregamento do CSS criativo no build de produção. Após aprovação explícita das imagens e da composição, o [Porto Pedras](https://portopedras.eixu.com.br/) recebeu home, [materiais](https://portopedras.eixu.com.br/materiais), [guia de escolha](https://portopedras.eixu.com.br/guia-escolher-pedra) e obrigado. A home usa as fotos geradas #1, #4 e #5, todas aprovadas. Os resultados e limites das verificações estão em [Verificação](verification.md#riqueza-visual-motion-e-inbound-10092026).

## Critério de conclusão do gerador

O Porto Pedras é uma referência de aceite, não a entrega inteira. Uma composição ajustada manualmente demonstra o renderer, mas não comprova o gerador. A validação restante exige saídas automáticas do modelo para briefings de negócios diferentes, renderizadas sem correção manual, comparando identidade, coerência, imagens, motion, percurso entre páginas e tokens. As travas de assinatura detectam repetição estrutural; não garantem qualidade estética por si só.

A avaliação automática entre negócios foi executada e registrou limitações concretas do modelo atual. Foram corrigidos o overflow do hero offset, a aceitação de motion como única decisão visual, o reenvio integral de lotes recusados e a mensagem do painel que anunciava sucesso em uma recusa. A comparação adicional com Fable 5.1 não alterou o modelo de produção. As evidências e o que ainda não foi comprovado estão em [Verificação](verification.md#avaliação-entre-negócios-e-reparos-10092026).

A revisão posterior de operação e custo está em [Revisão do admin](admin-review.md). O diagnóstico inicial acima descreve o estado anterior às entregas desta página.
