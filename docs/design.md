# Design dos sites gerados

Referências lidas em 10/09/2026: [Frontend Design, Anthropic](https://github.com/anthropics/claude-code/blob/main/plugins/frontend-design/skills/frontend-design/SKILL.md) e [Taste Skill v1](https://github.com/Leonxlnx/taste-skill/blob/main/skills/taste-skill-v1/SKILL.md). Para mudanças de frontend, use ambas como direção, respeitando o negócio, o contrato do repositório e o código disponível. Este documento registra a adaptação ao gerador, não substitui a leitura das referências ao mudar a direção visual.

## Direção e custo

A composição deve partir de conteúdo e imagens reais do cliente: uma seção protagonista, hierarquia de texto e variação de layout. Não há receita obrigatória de home nem criação automática de páginas por serviço. Serviços usam listas editoriais; números de ordem ficam em processos. Provas, garantias e resultados dependem de evidência do briefing.

As skills divergem: frontend-design recomenda movimento pontual e identidade específica; taste-v1 propõe animações contínuas e uma estética fixa para certos bentos. Neste gerador, prevalecem a marca e uma entrada breve do hero, sem adicionar bibliotecas de animação ou JavaScript de cliente. Dados inventados e fotos aleatórias sugeridos como placeholders na v1 não servem para sites de clientes reais.

`lib/taste/prompt.ts` contém a orientação operacional resumida. `catalogForPrompt()` deriva campos, limites e enums diretamente dos schemas, sem repetir descrições longas dos blocos. O schema completo permanece em `describe_block`. O agente deve editar apenas o necessário, omitir opcionais vazios e não repetir leituras ou reconstruções sem necessidade. O histórico e o limite de passos foram preservados.

A rota `/api/chat` registra modelo, passos e tokens agregados de entrada/saída/total retornados pelo SDK no evento `[chat] usage`. Não registra conteúdo, nomes de clientes nem credenciais nesse evento. Contagens ausentes do provedor permanecem ausentes, não viram zero. Compare tarefas equivalentes e o total de passos; tamanho do prompt isolado não mede custo final nem qualidade da geração.

## Contrato visual

| Recurso           | Comportamento                                                                                                                                                                                                        |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tema              | `lib/blocks/theme.ts` deriva cores, fonte, bordas e raio. `.site-theme` aplica o tema no elemento que o define, inclusive fundo e texto.                                                                             |
| Variância         | 1–3: colunas equilibradas. 4–10: proporções assimétricas, foto deslocada e lista de serviços em duas áreas no desktop.                                                                                               |
| Densidade         | 1–3: mais respiro. 4–7: normal. 8–10: compacto.                                                                                                                                                                      |
| Movimento         | 1–3: sem entrada automática. 4–10: uma entrada breve do hero; `prefers-reduced-motion` a remove. Não há parallax ou loops.                                                                                           |
| `hero.split`      | `layout` opcional: `split` ou `editorial` panorâmico. Sem imagem, composição tipográfica sem retângulo vazio. Dados antigos continuam válidos.                                                                       |
| `feature.bento`   | 2–6 itens, primeiro em destaque e última linha completa. Cada item aceita `image`/`imageAlt` opcionais.                                                                                                              |
| `narrative.split` | Foto e lista quando há imagem; lista editorial sem área vazia quando não há.                                                                                                                                         |
| Navegação e FAQ   | Menu mobile e perguntas com `details`/`summary` nativos, foco visível e interação por teclado.                                                                                                                       |
| Âncoras           | Todo bloco aceita `anchor` opcional, começando com letra minúscula, seguido de letras/números/hífens, até 64 caracteres. Link usa `#anchor`. Duplicação bloqueia publicação. Formulário sem âncora mantém `contato`. |

Novas imagens nos bentos seguem a biblioteca aprovada/URLs fornecidas. A proteção de exclusão consulta referências em rascunhos, páginas publicadas e logo, inclusive URLs aninhadas nos itens. A crítica de imagem continua separada da aprovação do operador.

## Alcance

A mudança atua nos componentes compartilhados de `(sites)` e no agente de sites. Institucional e painel mantêm seus próprios layouts/CSS. Um deploy de código altera o render dos sites existentes, mas não reescreve nem publica seus blocos. Variantes novas, imagens adicionais e âncoras explícitas precisam ser escolhidas na edição dos blocos. Links antigos sem destino não são inferidos automaticamente.

A prévia local de comparação usa conteúdo visível do exemplo público, sem gravar no tenant. Não valida as alegações comerciais desse conteúdo nem comprova ganho de qualidade por um modelo. A avaliação de geração exige briefing controlado, ambiente autorizado e comparação de resultado visual, chamadas, latência e tokens.
