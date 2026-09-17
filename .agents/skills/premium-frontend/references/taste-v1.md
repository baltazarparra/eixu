# Taste v1 adaptada aos projetos Premium

Fonte de direção: [High-Agency Frontend Skill v1](https://github.com/Leonxlnx/taste-skill/blob/main/skills/taste-skill-v1/SKILL.md), consultada em 16/09/2026. Esta adaptação preserva a intenção anti-SLOP e resolve os pontos em que a referência genérica conflita com o produto, o briefing ou a acessibilidade da EIXU.

## Controles de composição

Use `variance`, `motion` e `density` como decisões explícitas. O ponto de partida da referência é 8/6/4, mas o assunto e o pedido do cliente comandam. Registre os valores ou a interpretação equivalente na direção visual do projeto.

- Variância alta pede assimetria controlada, proporções distintas e espaço com intenção. No celular, a leitura volta a uma coluna estável.
- Movimento médio responde à navegação e explica mudança de estado. Movimento contínuo só entra quando comunica algo; não é preenchimento. Respeite `prefers-reduced-motion`.
- Densidade baixa ou média usa agrupamento por espaço e divisores. Cartões aparecem somente quando a superfície ou a elevação têm significado.

## Correções de viés

- Escolha tipografia pelo negócio e pela voz. Evite recorrer automaticamente a Inter, ao mesmo grotesco ou ao contraste serifado editorial em todo projeto.
- Use uma paleta coerente e contida. Gradiente, brilho, vidro, bento e preto quase absoluto não são uma direção por si mesmos.
- Evite hero centralizado, três cartões iguais, etiquetas em caixa-alta, setas decorativas e animações de entrada repetidas quando forem apenas hábitos do gerador.
- Uma interação marcante deve ser isolada, performática e útil. Não misture motores de animação no mesmo componente.
- Anime `transform` e `opacity`; evite trabalho contínuo em scroll, filtros caros e re-renderização React por quadro.

## Conteúdo e interface

- Conteúdo concreto vence texto de demonstração. Nunca invente métricas, pessoas, depoimentos, clientes ou provas para deixar a página mais convincente.
- Nomeie ações pelo resultado: “Salvar e publicar” precisa salvar e publicar; o retorno usa o mesmo vocabulário.
- Formulários mantêm rótulo visível, ajuda quando necessária e erro junto do campo.
- Loading acompanha a geometria que chegará. Estados vazios e falhas dizem o que aconteceu e qual ação resolve.

## Pre-flight visual

Antes de entregar, confirme:

- a abertura nasce do universo do cliente e tem uma ação legível;
- a tipografia tem escala, largura de linha e pesos deliberados;
- a silhueta não depende de um kit genérico de cartões;
- a página estreita não cria rolagem horizontal nem perde navegação;
- foco, toque, contraste e movimento reduzido funcionam;
- imagens têm enquadramento, dimensões, `sizes` e texto alternativo adequados;
- toda dependência foi verificada e todo efeito possui limpeza;
- a passagem final removeu pelo menos um excesso real ou justificou por que nada deveria sair.
