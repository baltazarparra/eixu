# Good Bom

Projeto Premium da EIXU convertido do snapshot publicado c7898cb09842bbd1c11890c2f9ea5c95e4284a9c01fb95259cb092486132d6ac. A URL canônica permanece https://goodbom.eixu.com.br.

## Direção visual

A composição adota a linguagem editorial do conceito Minatel Brotas, por decisão
do operador: papel quente (`#f8f7f1`), verde-pinho (`#284d3d`), display DM Serif
Display com itálico no acento, corpo Outfit, hero em duas colunas com moldura de
canto assimétrico, réguas de filete, abas com filete inferior e faixa de conversão
como painel sobre papel.

A camada vive em `app/minatel.css`, importada depois das folhas de bloco e antes
de `operator.css`, para que escolhas explícitas do operador continuem vencendo.
Os tokens de marca ficam em `content/site.json` (`tenant.brand`) e os dois papéis
tipográficos estão registrados em `lib/design/typography.ts` e `app/layout.tsx`.

Os fatos permanecem os do Good Bom: 1932, Casa Gigo, 13 lojas, 7 cidades. Só a
direção visual foi transplantada; nenhum conteúdo do Minatel foi copiado.
