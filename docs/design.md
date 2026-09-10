# Design dos sites gerados

Referências lidas em 10/09/2026: [Frontend Design, Anthropic](https://github.com/anthropics/claude-code/blob/main/plugins/frontend-design/skills/frontend-design/SKILL.md) e [Taste Skill v1](https://github.com/Leonxlnx/taste-skill/blob/main/skills/taste-skill-v1/SKILL.md). Para mudanças de frontend, use ambas como direção, respeitando o negócio, o contrato do repositório e o código disponível. Este documento registra a adaptação ao gerador, não substitui a leitura das referências ao mudar a direção visual.

## Direção e custo

A composição parte do briefing, da marca e de cenas coerentes com o cliente: uma seção protagonista, hierarquia de texto e variação de layout. Não há receita obrigatória de home. Cada projeto tem pelo menos três páginas orgânicas conectadas, com intenções de descoberta, consideração e conversão. Obrigado e landing de anúncio não completam esse mínimo. Serviços usam listas editoriais; números de ordem ficam em processos. Provas, garantias, equipamentos e capacidades operacionais dependem de evidência do briefing.

As skills divergem: frontend-design recomenda movimento pontual e identidade específica; taste-v1 propõe animações contínuas e uma estética fixa para certos bentos. Prevalecem a marca e o pedido atual do operador. Framer Motion realiza entradas coordenadas, revelações de seções, seleção visual e respostas a hover/toque em componentes de cliente isolados. O conteúdo sai visível do servidor, continua acessível sem JavaScript e respeita movimento reduzido. Dados inventados e fotos aleatórias sugeridos como placeholders na v1 não servem para sites de clientes reais.

`lib/taste/prompt.ts` contém a orientação operacional resumida. `catalogForPrompt()` deriva campos, enums, obrigatoriedade e limites de strings/arrays diretamente dos schemas, em uma notação compacta; `describe_block` oferece o schema completo. Esconder limites no catálogo causou rejeição e reenvio de lotes na avaliação. O agente deve editar apenas o necessário, omitir opcionais vazios e não repetir leituras ou reconstruções sem necessidade. O histórico e o limite de passos foram preservados.

Em site novo ou reconstrução, `set_design` persiste briefing e direção de arte antes de `build_site`. Uma chamada define conceito, elemento-assinatura, cinco cores com papéis definidos, par tipográfico, composição do hero, navegação, ritmo, tratamento de imagem, superfície, motivo e os três dials. Se faltarem as duas cenas geradas da home, `prepare_site_images` usa o pipeline do estúdio para criar candidatas. O agente não precisa gastar um turno descrevendo o plano em texto para depois traduzi-lo em ferramentas.

A rota `/api/chat` registra modelo, passos e tokens agregados de entrada/saída/total retornados pelo SDK no evento `[chat] usage`. Não registra conteúdo, nomes de clientes nem credenciais nesse evento. Contagens ausentes do provedor permanecem ausentes, não viram zero. Compare tarefas equivalentes e o total de passos; tamanho do prompt isolado não mede custo final nem qualidade da geração.

## Contrato visual v2

| Recurso              | Comportamento                                                                                                                                                                                                                                                                              |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Perfil persistido    | `brand.design`, versão 2, guarda conceito, elemento-assinatura e oito eixos estruturais. `tenant.brief` guarda público, oferta, objetivo, personalidade, evidências e restrições. Não exige migração porque ambos os campos já são JSONB.                                                  |
| Tipografia           | Display: Geist, Fraunces, Space Grotesk, Manrope ou Geist Mono. Corpo: Geist, Newsreader, Space Grotesk ou Manrope. `next/font` auto-hospeda os arquivos e evita troca de fonte após o carregamento.                                                                                       |
| Paleta               | `ink`, `paper`, `surface`, `accent` e `accentAlt` têm papéis diferentes. A ferramenta recusa texto sem contraste AA em paper/surface e cores primária/secundária iguais; o render ainda ajusta acentos que não suportam texto legível.                                                     |
| Composição global    | Seis heroes, quatro navegações, quatro ritmos, quatro tratamentos de imagem, quatro superfícies e cinco motivos formam a gramática do cliente. Dials controlam variância, densidade e motion. Atelier compõe ambiente e detalhe; não é padrão obrigatório.                                 |
| Apresentação local   | Todo bloco aceita `presentation`: tom (incluindo a cor secundária), largura, respiro, alinhamento, borda e motion (`none`, `reveal`, `stagger`, `image`). Use um a três momentos de movimento coerentes com a narrativa.                                                                   |
| Exploração e inbound | `feature.explorer` oferece seleção de aplicações com imagem, texto, fatos e CTA por aba; suporta teclado. `editorial.resources` conecta páginas com hierarquia editorial e imagem ou símbolo. Ambos oferecem layouts próprios.                                                             |
| Imagens              | Hero aceita posição, `cover`/`contain`, ponto focal e legendas; atelier aceita imagem secundária. A home exige duas fotos geradas distintas da biblioteca do tenant. Candidatas entram no rascunho; todas as imagens da biblioteca usadas na publicação precisam de aprovação do operador. |
| Navegação e FAQ      | Menu mobile e perguntas usam `details`/`summary` nativos, foco visível e interação por teclado.                                                                                                                                                                                            |
| Âncoras              | Todo bloco aceita `anchor` opcional, começando com letra minúscula, seguido de letras/números/hífens, até 64 caracteres. Link usa `#anchor`. Duplicação bloqueia publicação. Formulário sem âncora mantém `contato`.                                                                       |

## Unicidade e coerência

`set_design` compara oito decisões estruturais com os perfis dos outros tenants. A direção precisa diferir em pelo menos três eixos do perfil mais próximo. Nome, briefing, texto, imagens e identidade do outro cliente não são retornados ao agente.

A home também recebe uma assinatura de composição baseada em sequência de tipos, layout, tom e borda das seções. Texto, URL e imagem são ignorados. `build_site`, `set_blocks`, as ferramentas de publicação e a API administrativa recusam uma home com assinatura idêntica a um rascunho ou snapshot publicado de outro tenant. Páginas com menos de quatro blocos de conteúdo ficam fora dessa trava para não forçar diferenças artificiais em obrigado ou páginas curtas.

Essas verificações detectam repetição estrutural; não medem qualidade estética nem comprovam coerência semântica. A revisão visual precisa conferir a ligação entre briefing, imagens, silhueta, ritmo e elemento-assinatura. Trocar cores e fontes para vencer o gate não substitui uma direção própria. Uma empresa de pedras pode privilegiar matéria e aplicações; isso não obriga outros negócios a usar a mesma colagem ou as mesmas abas.

O pre-flight v2 exige decisões locais de layout e presentation em páginas comerciais. `build_site` valida páginas e projeto antes de gravar o lote em uma transação. Um erro não substitui páginas válidas. Edições incrementais podem produzir rascunho inválido, mas a publicação continua bloqueada.

`lintSite` exige três páginas orgânicas com pelo menos 100 palavras de conteúdo, intenções e SEO distintos, etapas de inbound, links/âncoras válidos e alcance a partir da home. Também confere duas fotos geradas distintas e uma seção de cor na home. A contagem de palavras impede páginas vazias, mas não prova utilidade editorial. `lib/sites/publish.ts` é compartilhado pela API, `publish_page` e `publish_site`: valida o estado que ficará ao vivo e publica o lote atomicamente. Uma publicação pontual não conta rascunhos de outras páginas como conteúdo publicado.

A proteção de exclusão consulta referências em rascunhos, páginas publicadas e logo, inclusive URLs aninhadas nos itens. A crítica de imagem continua separada da aprovação do operador. Cenas geradas ilustram a proposta; não são evidência de obras, equipe ou instalações reais.

## Alcance

A mudança atua nos componentes compartilhados de `(sites)`, nos agentes de site/imagem e no pre-flight. Institucional e painel mantêm seus próprios layouts/CSS. Sites já publicados sem `brand.design` continuam no contrato legado; o deploy não inventa uma direção nem reescreve seus blocos. Ao reconstruir um cliente antigo, o agente cria o perfil v2 e recompõe as páginas antes da nova publicação.

A prévia local de comparação usa três clientes sintéticos, sem gravar no tenant. Ela comprovou que o mesmo catálogo forma silhuetas distintas em desktop e mobile, mas não substitui uma avaliação de geração do modelo. Essa avaliação exige briefing controlado, tenant descartável e registro de qualidade, chamadas, latência e tokens.

No estado sintético usado em 10/09/2026, o prompt completo mediu 7.858 caracteres. A versão anterior media 8.285 e a primeira versão documentada, 10.988: redução de 5,2% e 28,5%, respectivamente. É tamanho de texto, não tokens faturados; o evento `[chat] usage` continua sendo a medida operacional.
