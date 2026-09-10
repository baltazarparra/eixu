# Design dos sites gerados

Referências lidas em 10/09/2026: [Frontend Design, Anthropic](https://github.com/anthropics/claude-code/blob/main/plugins/frontend-design/skills/frontend-design/SKILL.md) e [Taste Skill v1](https://github.com/Leonxlnx/taste-skill/blob/main/skills/taste-skill-v1/SKILL.md). Para mudanças de frontend, use ambas como direção, respeitando o negócio, o contrato do repositório e o código disponível. Este documento registra a adaptação ao gerador, não substitui a leitura das referências ao mudar a direção visual.

## Direção e custo

A composição deve partir de conteúdo e imagens reais do cliente: uma seção protagonista, hierarquia de texto e variação de layout. Não há receita obrigatória de home nem criação automática de páginas por serviço. Serviços usam listas editoriais; números de ordem ficam em processos. Provas, garantias e resultados dependem de evidência do briefing.

As skills divergem: frontend-design recomenda movimento pontual e identidade específica; taste-v1 propõe animações contínuas e uma estética fixa para certos bentos. Neste gerador, prevalecem a marca e uma entrada breve do hero, sem adicionar bibliotecas de animação ou JavaScript de cliente. Dados inventados e fotos aleatórias sugeridos como placeholders na v1 não servem para sites de clientes reais.

`lib/taste/prompt.ts` contém a orientação operacional resumida. `catalogForPrompt()` deriva campos e enums diretamente dos schemas, em uma notação compacta; limites detalhados continuam no schema e em `describe_block`. O agente deve editar apenas o necessário, omitir opcionais vazios e não repetir leituras ou reconstruções sem necessidade. O histórico e o limite de passos foram preservados.

Em site novo ou reconstrução, `set_design` persiste briefing e direção de arte antes de `build_site`. Uma chamada define conceito, elemento-assinatura, cinco cores com papéis definidos, par tipográfico, composição do hero, navegação, ritmo, tratamento de imagem, superfície, motivo e os três dials. O agente não precisa gastar um turno descrevendo o plano em texto para depois traduzi-lo em ferramentas.

A rota `/api/chat` registra modelo, passos e tokens agregados de entrada/saída/total retornados pelo SDK no evento `[chat] usage`. Não registra conteúdo, nomes de clientes nem credenciais nesse evento. Contagens ausentes do provedor permanecem ausentes, não viram zero. Compare tarefas equivalentes e o total de passos; tamanho do prompt isolado não mede custo final nem qualidade da geração.

## Contrato visual v2

| Recurso            | Comportamento                                                                                                                                                                                                                                         |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Perfil persistido  | `brand.design`, versão 2, guarda conceito, elemento-assinatura e oito eixos estruturais. `tenant.brief` guarda público, oferta, objetivo, personalidade, evidências e restrições. Não exige migração porque ambos os campos já são JSONB.             |
| Tipografia         | Display: Geist, Fraunces, Space Grotesk, Manrope ou Geist Mono. Corpo: Geist, Newsreader, Space Grotesk ou Manrope. `next/font` auto-hospeda os arquivos e evita troca de fonte após o carregamento.                                                  |
| Paleta             | `ink`, `paper`, `surface`, `accent` e `accentAlt` têm papéis diferentes. A ferramenta recusa texto sem contraste AA em paper/surface e cores primária/secundária iguais; o render ainda ajusta acentos que não suportam texto legível.                |
| Composição global  | Cinco heroes, quatro navegações, quatro ritmos, quatro tratamentos de imagem, quatro superfícies e cinco motivos formam a gramática do cliente. Dials continuam controlando variância, densidade e uma entrada breve, respeitando movimento reduzido. |
| Apresentação local | Todo bloco aceita `presentation`: tom, largura, respiro, alinhamento e borda. Blocos comerciais oferecem layouts próprios, como cover/poster/offset, rail/cards/index, timeline/chapters, overlap/editorial, masonry/collage e poster/minimal.        |
| Imagens            | Hero aceita posição, `cover`/`contain` e ponto focal. O estúdio gera proporções distintas para hero cover, poster, editorial, offset, narrativa, bento, imagem e galeria. URL e alt continuam limitados a arquivos aprovados ou enviados.             |
| Navegação e FAQ    | Menu mobile e perguntas usam `details`/`summary` nativos, foco visível e interação por teclado.                                                                                                                                                       |
| Âncoras            | Todo bloco aceita `anchor` opcional, começando com letra minúscula, seguido de letras/números/hífens, até 64 caracteres. Link usa `#anchor`. Duplicação bloqueia publicação. Formulário sem âncora mantém `contato`.                                  |

## Unicidade e coerência

`set_design` compara oito decisões estruturais com os perfis dos outros tenants. A direção precisa diferir em pelo menos três eixos do perfil mais próximo. Nome, briefing, texto, imagens e identidade do outro cliente não são retornados ao agente.

A home também recebe uma assinatura de composição baseada em sequência de tipos, layout, tom e borda das seções. Texto, URL e imagem são ignorados. `build_site`, `set_blocks`, a ferramenta de publicação e a API administrativa recusam uma home com assinatura idêntica à de outro tenant. Páginas com menos de quatro blocos de conteúdo ficam fora dessa trava para não forçar diferenças artificiais em obrigado ou páginas curtas.

O pre-flight v2 exige decisões locais de layout e presentation em páginas comerciais. `build_site` calcula o lote inteiro antes da primeira escrita; um erro de schema, conteúdo ou composição recusa o lote sem substituir páginas válidas. Edições incrementais ainda podem produzir rascunho inválido, mas publicação continua bloqueada.

Novas imagens nos bentos seguem a biblioteca aprovada/URLs fornecidas. A proteção de exclusão consulta referências em rascunhos, páginas publicadas e logo, inclusive URLs aninhadas nos itens. A crítica de imagem continua separada da aprovação do operador.

## Alcance

A mudança atua nos componentes compartilhados de `(sites)`, nos agentes de site/imagem e no pre-flight. Institucional e painel mantêm seus próprios layouts/CSS. Sites já publicados sem `brand.design` continuam no contrato legado; o deploy não inventa uma direção nem reescreve seus blocos. Ao reconstruir um cliente antigo, o agente cria o perfil v2 e recompõe as páginas antes da nova publicação.

A prévia local de comparação usa três clientes sintéticos, sem gravar no tenant. Ela comprovou que o mesmo catálogo forma silhuetas distintas em desktop e mobile, mas não substitui uma avaliação de geração do modelo. Essa avaliação exige briefing controlado, tenant descartável e registro de qualidade, chamadas, latência e tokens.

No estado sintético usado em 10/09/2026, o prompt completo mediu 7.858 caracteres. A versão anterior media 8.285 e a primeira versão documentada, 10.988: redução de 5,2% e 28,5%, respectivamente. É tamanho de texto, não tokens faturados; o evento `[chat] usage` continua sendo a medida operacional.
