# Plano de implementação: edição completa e precisa pelo chat

**Data:** 15/09/2026. **Base reconciliada:** `origin/main` em `69ce09c`.
**Branch de execução:** `codex/chat-complete`. **Estado:** implementado e
validado localmente.

## Problema

O chat trata alguns ajustes simples como se fossem pedidos de recomposição. No
caso do Supermercado Ravagio, o operador pediu `text-align: right` no Hero da
página Início. O agente encontrou o bloco, mas recusou a alteração e ofereceu
centralizar o texto ou inverter foto e conteúdo. Antes disso, uma tentativa
gravou um resultado impreciso e o comando “desfaz” restaurou outra página.

Há quatro causas no contrato atual:

1. alguns controles visuais internos não têm uma prop dedicada;
2. o agente confunde alinhamento do texto, alinhamento do grupo e variante do
   layout;
3. a página aberta prevalecia sobre a página e o conteúdo nomeados no pedido;
4. listas aceitam editar ou remover itens, mas não inserir e mover um item de
   maneira pontual.

## Resultado esperado

Todo estado publicável do site fica editável pelo chat: textos, tipografia,
cores, espaçamento, alinhamento, dimensões, bordas, sombras, disposição interna,
ordem, listas, blocos, páginas, imagens, links, formulários, navegação, SEO e
marca. Um pedido claro gera a menor mutação capaz de cumpri-lo, preserva o que
não foi citado, mede o resultado em desktop e celular e mantém o publicado
intacto até um pedido de publicação.

Essa liberdade usa dados declarativos validados. O modelo não grava seletores,
CSS, HTML, JavaScript, React ou SQL livres em um tenant. O schema aceita as
intenções visuais e o renderer produz o CSS escopado. Assim o agente consegue
alterar a apresentação completa sem abrir execução de código ou permitir que um
site afete outro.

## Arquitetura da solução

### 1. Resolver o alvo antes de editar

- página explicitamente nomeada vence a página em foco;
- “Início”, “home” e “página inicial” resolvem para `/`;
- um trecho entre aspas procura texto concatenado em todos os campos do bloco;
- uma correspondência única em outra página vence o foco;
- ambiguidade comprovada não grava;
- a mesma regra vale para conteúdo, estrutura e apresentação.

A rota injeta o snapshot, a revisão e os schemas da página resolvida no prompt.
O agente não precisa fazer uma leitura redundante antes de uma mutação simples.

### 2. Escolher o menor alcance

| Pedido                           | Operação declarativa                                   |
| -------------------------------- | ------------------------------------------------------ |
| Trocar uma frase                 | `replace_text` ou `set` no campo                       |
| Mudar só um texto                | `textStyles` no caminho exato                          |
| Alinhar todos os textos do bloco | `presentation.textAlign`                               |
| Alinhar texto, botões e grupo    | `presentation.textAlign` + `presentation.contentAlign` |
| Ajustar um elemento interno      | `presentation.elements` com alvo semântico             |
| Inserir ou mover um card         | `insert_item` ou `move_item`                           |
| Inserir ou mover uma seção       | `insert` ou `move` por ID relativo                     |
| Trocar a natureza da seção       | `replace_block`, com props completas válidas           |

O agente preserva o restante das props e agrupa as mudanças de uma página em
uma gravação atômica.

### 3. Cobrir qualquer elemento visual sem CSS livre

`presentation.elements` aceita até trinta regras por bloco. Cada regra escolhe
um alvo validado — seção, container, conteúdo, título, corpo, grupo de ações,
lista, item, mídia, imagem, formulário, ação ou campo — e um viewport `all`,
`mobile` ou `desktop`. `item` aceita índice para alcançar um box específico.

As propriedades cobrem:

- flex e grid, direção, quebra, distribuição e alinhamento;
- colunas, posição e span em grid, ordem e deslocamento;
- largura, altura mínima, espaçamento interno e externo e gap;
- alinhamento de texto, raio, opacidade, fundo, tinta, borda e sombra.

Enums, números limitados e cores hex formam o CSS. O schema rejeita chaves
desconhecidas, seletores, regras duplicadas e combinações de cor abaixo de
4,5:1. Todas as regras recebem um escopo gerado pelo renderer e não atravessam o
bloco.

### 4. Dar precisão tipográfica ao campo

Além da escala relativa, `textStyles` aceita tamanho em pixels, peso, altura de
linha, espaçamento de letras, transformação, itálico, cor e alinhamento. O
caminho identifica exatamente o título, parágrafo, legenda, botão ou item. O
alinhamento do campo prevalece sobre o alinhamento geral da seção.

### 5. Inserir e mover itens sem reenviar a lista

`insert_item` recebe caminho, índice e valor; `move_item` recebe caminho,
origem e destino. O executor trabalha sobre uma cópia, valida o bloco completo e
só grava se todas as operações do lote passarem. Índices inexistentes recusam o
lote. A guarda de perda de conteúdo continua impedindo que um pedido de mover
seja convertido em remoção.

### 6. Desfazer a mudança realmente mais recente

O atalho de chat procura a revisão reversível mais recente do tenant, identifica
a página dessa revisão e restaura os mesmos blocos, IDs, textos e posições. O
foco atual não interfere. O botão da prévia continua local à página aberta.
Nenhum dos dois altera o snapshot publicado.

### 7. Verificar o efeito renderizado

Depois de editar apresentação ou tipografia, o Chromium abre a prévia em 1440 e
390 px. A medição compara o CSS computado com as propriedades solicitadas,
confere presença do alvo, colunas, largura percentual, tipografia, alinhamentos,
contraste e overflow. Divergência aparece no recibo; captura indisponível é
relatada sem inventar sucesso visual.

## Matriz de aceite

| Cenário                                        | Resultado obrigatório                                                |
| ---------------------------------------------- | -------------------------------------------------------------------- |
| Hero da Início nomeado com outra página aberta | A home recebe a edição e a página aberta permanece igual.            |
| “Alinhe esse texto à direita”                  | Apenas o campo recebe `text-align: right`.                           |
| “Todo o conteúdo à direita”                    | Texto, grupo e controles vão para o fim sem inverter mídia ou DOM.   |
| “Segundo box à direita, menor e com sombra”    | Somente o item 2 recebe largura, margem e sombra no viewport pedido. |
| “No celular, uma coluna”                       | A regra mobile vence a regra desktop sem overflow.                   |
| “Mova o terceiro card para primeiro”           | `move_item` conserva o card e o restante da lista.                   |
| “Insira este card depois do primeiro”          | `insert_item` acrescenta um item válido sem reenviar os existentes.  |
| Campo à esquerda dentro da seção à direita     | O estilo do campo prevalece.                                         |
| Propriedade desconhecida ou seletor livre      | O schema recusa o lote inteiro.                                      |
| CSS da vibe vence a escolha explícita          | A medição reprova o recibo.                                          |
| “Desfaz” após trocar de página                 | A página da última revisão é restaurada.                             |
| Estado já satisfaz o pedido                    | Não há escrita nem histórico fictício.                               |
| Site já publicado recebe edição                | Só o rascunho muda.                                                  |

## Entregas

1. schemas comuns de tipografia e apresentação interna;
2. geração de CSS escopado e renderer para todos os blocos;
3. `insert_item` e `move_item` no contrato atômico de `edit_page`;
4. resolução de página e conteúdo nomeados para qualquer edição;
5. prompt e catálogo instruindo execução fiel, sem alternativas inventadas;
6. medição determinística dos estilos computados;
7. restauração global da última página editada pelo chat;
8. testes unitários, de integração e navegador em desktop e celular;
9. atualização dos manuais de edição, design, arquitetura, harness e
   verificação.

## Gates

```bash
npx next typegen && npx tsc --noEmit
npm run lint
npm run test:sites
npm run test:admin
npm run build:vercel
EIXU_CHROME_PATH=/usr/bin/google-chrome node --test \
  tests/browser/site-element-styles.test.mjs \
  tests/browser/site-hero-placement.test.mjs \
  tests/browser/site-inline-edit.test.mjs \
  tests/browser/admin-desfazer-apontar.test.mjs
git diff --check
```

O teste PostgreSQL usa `EIXU_TEST_POSTGRES_URL`; sem essa variável, o runner o
marca como pulado. Validação local não autoriza migração, mutação no tenant de
referência, publicação, push ou deploy.

### Resultado em 15/09/2026

- tipos, lint, formato e `git diff --check`: aprovados;
- sites: 308 aprovados e 2 dependentes de ambiente pulados;
- admin: 303 aprovados e 8 dependentes de Chrome/PostgreSQL pulados;
- matriz afetada com Chrome: 7 aprovados, incluindo CSS de produção em 1440 e
  390 px;
- build Vercel: aprovado, com 4 verificações de artefatos serverless aprovadas.

## Referência e limite de reprodução

`https://eixu.com.br/admin/supermercadoravagio` redireciona uma sessão anônima
para o login. A implementação não depende de credencial nem de dados do cliente:
o caso é reproduzido com fixtures equivalentes, a rota real, os mesmos schemas e
o CSS de produção. A validação remota autenticada fica fora deste plano porque o
pedido não autorizou credenciais, escrita no tenant ou publicação.
