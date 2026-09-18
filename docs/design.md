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

## Vibes

| Vibe       | Leitura inicial                                                                                |
| ---------- | ---------------------------------------------------------------------------------------------- |
| Comercial  | Direta, acessível, orientada a confiança, oferta e ação principal.                             |
| Ousado     | Contraste, escala e ritmo mais expressivos, sem transformar ousadia em neon ou ruído gratuito. |
| Referência | Prioriza estrutura, tipografia, densidade, imagem e movimento do link visual informado.        |

Referência exige um link. Nas demais vibes, o link continua sendo a fonte visual mais específica quando existe; a vibe resolve os eixos que ele não deixa claros.

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

O contrato segue a [Taste Skill v1](https://github.com/Leonxlnx/taste-skill/blob/main/skills/taste-skill-v1/SKILL.md). Seus exemplos orientam a crítica, mas o resultado deve continuar preso ao conteúdo, à marca e às restrições técnicas do projeto.

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
