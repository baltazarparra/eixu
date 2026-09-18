# Design dos projetos do Studio

## Princípio

O Studio não escolhe uma página em um catálogo. Ele transforma conteúdo real, marca e referência em uma direção própria e escreve o projeto do cliente. Liberdade de composição exige critérios explícitos para evitar repetição automática.

## Hierarquia das fontes

1. **Dados cadastrados e site oficial:** fatos, história, serviços, produtos, contatos e linguagem do cliente.
2. **Logo, cores e imagens do cliente:** identidade e restrições de marca.
3. **Referência visual informada:** layout, tipografia, densidade, superfícies, ritmo, imagem e movimento.
4. **Direção cadastrada:** fallback para eixos que a referência não resolve.
5. **Julgamento do agente:** composição final, sempre verificável pela prévia.

A referência não fornece fatos nem ativos reutilizáveis. Copiar marca, texto, imagens, código ou uma página inteira é proibido.

## Direções de fallback

| Direção      | Referência                                                   | Leitura inicial                                          |
| ------------ | ------------------------------------------------------------ | -------------------------------------------------------- |
| Comercial    | [Minatel Brotas](https://minatelsupermercados.com.br/brotas) | Direta, acessível, orientada a oferta e confiança.       |
| Moderno      | [Reflect](https://reflect.app/)                              | Precisa, silenciosa, produto em primeiro plano.          |
| Ousado       | [Manesco](https://manesco.com.br/)                           | Contraste alto, escala forte e cortes inesperados.       |
| Artístico    | [Actionline](https://actionline.io/)                         | Composição autoral, ritmo expressivo e imagem narrativa. |
| Landing Page | [Nubank Ultravioleta](https://nubank.com.br/ultravioleta)    | Jornada concentrada, prova e uma ação principal.         |

A Landing Page descreve também objetivo e forma. Ela não impede que outra linguagem visual seja cadastrada.

## Método de direção de arte

O artefato `art_direction` deve converter observação em decisões aplicáveis:

- ideia visual central;
- hierarquia e silhueta das páginas;
- pares tipográficos e escala;
- grid, margens e variação de densidade;
- paleta, contraste e uso do logo;
- papel e proporção das imagens;
- superfícies, bordas, raios e sombras;
- transições, scroll, reveal e estados;
- adaptação intencional para mobile;
- padrões genéricos que o projeto deve evitar.

“Moderno”, “premium” ou “bonito” isolados não formam direção de arte.

## Anti-slop

Evite defaults recorrentes sem relação com o cliente: hero centralizado, gradiente violeta, cards arredondados em todas as seções, glassmorphism, bento grid decorativo, pills excessivas, ícones aleatórios, métricas e depoimentos inventados.

Varie ritmo e proporção. Use cards somente quando agrupamento ou interação exigirem. Títulos devem carregar conteúdo específico. Imagens precisam de função editorial, não de preenchimento. Cor, sombra e raio formam um sistema coerente.

## Conteúdo editável

Todo texto ou imagem que o operador provavelmente trocará deve ter uma chave estável em `content/schema.json` e valor correspondente em `content/values.json`. O código lê o contrato e mantém HTML semântico. Campos podem ser texto curto, texto longo, URL ou imagem, com limites definidos.

O CMS leve não substitui alterações estruturais. O chat muda composição, componentes e motion; o CMS atualiza conteúdo dentro do contrato.

## Responsividade e acessibilidade

O projeto deve:

- renderizar conteúdo essencial no servidor;
- manter navegação utilizável aberta e fechada;
- preservar foco visível, ordem de tab e alvos de toque;
- evitar overflow e texto ilegível em telas estreitas;
- tratar alturas pequenas, teclado móvel e conteúdo variável;
- usar alt coerente e labels em controles;
- respeitar `prefers-reduced-motion`;
- não depender de animação para revelar conteúdo ao leitor ou crawler.

A prévia desktop/mobile é parte da revisão, mas uma aprovação visual também precisa exercitar teclado, toque e tamanhos limítrofes.

## Refinamento

O passe final ajusta microtipografia, respiros, alinhamentos, recortes, estados de hover/focus, transições e entrada no scroll. Motion explica hierarquia e continuidade. Se não melhorar compreensão ou caráter, remova.
