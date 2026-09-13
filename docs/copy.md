# Escrita dos sites por vibe

O público tem pouca familiaridade com tecnologia e inglês. Todas as vibes usam
português do Brasil, palavras do dia a dia e explicações fáceis de acompanhar.
A personalidade muda; a dificuldade da leitura não. Linguagem simples é uma
forma de respeito, sem infantilizar a pessoa ou imitar erros de escrita.

## Cinco vozes

| Vibe      | Tom                           | Como constrói o texto                                                                      | O que evitar                                                                    |
| --------- | ----------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| Comercial | Direto, prestativo e seguro   | Apresenta a oferta, explica sua utilidade e responde dúvidas antes de convidar ao contato. | Pressão de venda, superlativos e urgência inventada.                            |
| Moderno   | Claro, preciso e tranquilo    | Nomeia o assunto e organiza a explicação em uma sequência curta e fácil de seguir.         | Inglês, linguagem de empresa de tecnologia e frases sem contexto.               |
| Ousado    | Firme, enérgico e curto       | Abre com uma frase forte sobre a oferta real e desenvolve a explicação logo abaixo.        | Gritos, provocação contra o leitor e promessa exagerada.                        |
| Artístico | Próximo, sensível e cuidadoso | Fala de material, cor, luz, textura e uso cotidiano com detalhes confirmados.              | Poesia abstrata, palavras difíceis e alegações de trabalho artesanal sem prova. |

Landing Page usa voz objetiva e convidativa: benefício concreto, dúvidas respondidas
e um único próximo passo repetido. Exemplo: “Uma mesa que cabe na sua rotina”.
Números, selos, citações e preços precisam de evidência; não invente urgência,
clientes ou resultados para preencher a sequência visual.

O mesmo negócio fictício, que vende mesas e cadeiras de madeira, pode abrir com
“Móveis de madeira para sua casa” na comercial, “Mesas e cadeiras de madeira” na
moderna, “Madeira na sua casa” na ousada e “A madeira perto de você” na artística.
Nas duas últimas, o texto de apoio precisa dizer imediatamente quais móveis são
oferecidos. A voz não pode esconder a oferta. Esses exemplos ilustram o tom;
não autorizam copiar uma oferta de móveis para outro cliente.

## Regras em comum

Comece pelo assunto, escreva uma ideia por frase e use parágrafos curtos. Prefira
até 20 palavras por frase sem transformar a contagem em prova de clareza ou
cortar informações necessárias. O piso de conteúdo das páginas continua valendo:
frases simples precisam responder às dúvidas, sem encher espaço.

Troque “download” por “baixar arquivo”, “feedback” por “opinião”, “deadline” por
“prazo” e “lead” por “pessoa interessada”. Preserve nomes oficiais, como WhatsApp,
Instagram e Pix. Um termo técnico indispensável ao assunto deve ter explicação
simples junto da primeira ocorrência em cada página. Escrever a sigla por extenso
não basta se a explicação continuar difícil. Citações reais não são reescritas
como se a pessoa tivesse usado outras palavras.

Botões e links dizem o que acontece: “Ver serviços”, “Pedir orçamento”, “Falar
pelo WhatsApp”, “Enviar mensagem”. O destino precisa cumprir o que foi escrito.
“Agendar visita” não serve para um botão que apenas inicia uma conversa sobre
disponibilidade. Clareza também vale para menus, perguntas e respostas, campos,
consentimento, confirmação, erros, legendas, texto alternativo, planos, rodapé,
busca e resumo de artigo. No chat, explique o resultado com palavras como página,
texto, imagem, rascunho e revisão, sem despejar nomes internos de ferramentas.

As orientações seguem as recomendações de [palavras claras](https://www.w3.org/WAI/WCAG2/supplemental/patterns/o3p01-clear-words/)
e [linguagem literal](https://www.w3.org/WAI/WCAG2/supplemental/patterns/o3p04-literal-language/)
do W3C. São referências de acessibilidade; não representam certificação de
conformidade nem validação de compreensão com pessoas do público.

## Aplicação no harness

`lib/copy/policy.ts` é a fonte comum do autor e do crítico, com regra geral,
perfil por vibe e exemplos. O prompt carrega só a voz escolhida, em todas as
fases e também nas edições. Cliente sem vibe continua comercial. A fonte é o
cadastro atual, sem uma segunda escolha de voz persistida no briefing.

`lib/copy/lint.ts` lê os campos destinados ao visitante, incluindo texto aninhado,
busca e resumo de artigo. URLs, enums, nomes internos de campos, nomes de autores
e campos de logo ficam fora da checagem de vocabulário. As regras entram em
`lintPage`, compartilhado pelo lote inicial, reparos, edição, estado do painel,
progresso da geração e serviço de publicação usado pela API e pelas ferramentas.

| Regra                   | Nível | Efeito                                                                                                                                                           |
| ----------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `acao-pouco-clara`      | Erro  | Recusa rótulos da lista explícita, como “Clique aqui”, “Saiba mais”, “Learn more” e “Submit”, em links e envio de formulário.                                    |
| `linguagem-vocabulario` | Aviso | Aponta termos do glossário e alternativas simples para avaliação em contexto. Não recusa uma marca ou um termo necessário bem explicado só por conter a palavra. |
| `linguagem-frase-longa` | Aviso | Aponta trechos com mais de 30 palavras sem pausa para revisão. É uma estimativa, não uma medida de compreensão.                                                  |

O crítico recebe os sinais junto dos textos completos e das capturas. O critério
`linguagem-simples` exige evidência e reescrita quando houver uma dificuldade real
de compreensão. `voz-da-vibe` avalia a coerência do tom; preferências de estilo
são avisos. Um erro material mantém a geração em revisão. Depois do reparo, é
necessária uma nova leitura do rascunho atual. A versão do harness invalida os
recibos anteriores a este contrato, inclusive localmente.

A publicação manual mantém o gate determinístico; a opinião do crítico governa
a conclusão automática e não concede autorização para publicar. A lista de
palavras não reconhece todo inglês, jargão ou ambiguidade, e o crítico também
pode errar. A avaliação de compreensão está na [rubrica](eval-rubric.md).
O contrato orienta novos textos e revisões; não reescreve nem republica sites
existentes por conta própria. Ajustes pontuais continuam limitados ao pedido.
