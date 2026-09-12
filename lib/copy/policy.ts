import { VIBE_LABEL, type Vibe } from '@/lib/design/vibes';

/** Fonte comum do autor e do crítico. A vibe muda a voz, nunca a dificuldade. */
export const SIMPLE_LANGUAGE = `## Linguagem simples, em qualquer vibe
Escreva para adultos que têm pouca familiaridade com tecnologia e com inglês. Use português do Brasil, palavras do dia a dia e respeito. Não infantilize, não imite erros de escrita e não trate a pessoa como incapaz.
- Diga primeiro o que a empresa faz, para quem e como entrar em contato. Use frases em ordem direta, uma ideia por frase e parágrafos curtos. Prefira até 20 palavras por frase; esse número é orientação, não prova de clareza. Preserve informações úteis e condições da oferta ao encurtar.
- Troque inglês e jargão por palavras conhecidas: download por baixar arquivo, feedback por opinião, deadline por prazo, lead por pessoa interessada, dashboard por painel. Não use palavras difíceis só para parecer profissional.
- Preserve nomes oficiais de marcas, pessoas e produtos, como WhatsApp, Instagram e Pix. Quando um termo técnico for indispensável ao assunto, explique seu significado em português simples junto da primeira ocorrência em cada página. Uma sigla por extenso ainda pode precisar de explicação. Não acrescente uma capacidade à oferta só para explicar o termo.
- Títulos dizem o assunto. Botões e links dizem a ação ou o destino: Ver serviços, Pedir orçamento, Falar pelo WhatsApp, Enviar mensagem. O destino precisa fazer o que o texto promete. Evite Clique aqui, Saiba mais, Vamos lá e rótulos em inglês. Não prometa agendar, comprar ou receber algo se o destino só abre uma conversa.
- A regra vale para todos os textos: menus, títulos, parágrafos, perguntas e respostas, formulários, consentimento, erros, confirmação, legendas, texto alternativo das imagens, nomes de planos, rodapé, título/descrição de busca e resumo de artigo. Não simplifique só a abertura. Em descrição de imagem, descreva o que está visível, sem slogan.
- A conversa com o operador também usa linguagem simples: diga página, texto, imagem, botão, rascunho e revisão. Não exponha nomes de ferramentas, schemas, blocos ou etapas técnicas para explicar o resultado.
- Clareza e fatos prevalecem sobre o estilo. Não invente prova, preço, prazo, garantia, disponibilidade ou urgência. Não altere uma citação real para adequar a voz: preserve-a ou omita-a se não ajudar, e explique termos fora da citação.`;

type Voice = {
  tone: string;
  approach: string;
  avoid: string;
  example: { headline: string; body: string; cta: string };
};

/** Exemplos usam a mesma oferta fictícia para mostrar voz, sem mudar os fatos. */
export const VIBE_COPY: Record<Vibe, Voice> = {
  comercial: {
    tone: 'Direta, prestativa e segura.',
    approach:
      'Apresente a oferta, explique a utilidade na rotina e ajude a pessoa a decidir. Responda dúvidas concretas antes de convidar ao contato. O ritmo é de uma conversa de atendimento, sem pressão.',
    avoid:
      'Frases de vendedor, superlativos, urgência falsa, promessa de resultado e insistência para comprar.',
    example: {
      headline: 'Móveis de madeira para sua casa',
      body: 'Veja mesas e cadeiras de madeira. Escolha os modelos que combinam com o espaço da sua casa.',
      cta: 'Ver mesas e cadeiras',
    },
  },
  moderno: {
    tone: 'Clara, precisa e tranquila.',
    approach:
      'Organize a informação em uma sequência fácil de acompanhar. Nomeie o produto, explique o uso e mostre o próximo passo. Use títulos objetivos e explicações enxutas, com informação suficiente para quem está começando.',
    avoid:
      'Tom de empresa de tecnologia, inglês, siglas sem explicação, frieza e frases tão cortadas que escondem o sentido.',
    example: {
      headline: 'Mesas e cadeiras de madeira',
      body: 'Conheça os modelos. Veja como cada mesa e cada cadeira pode ser usada na sua casa.',
      cta: 'Ver os modelos',
    },
  },
  ousado: {
    tone: 'Firme, enérgica e curta.',
    approach:
      'Abra com uma frase curta sobre a oferta real. Use verbos diretos e pausas para dar força. Desenvolva a explicação abaixo do título; impacto não dispensa contexto.',
    avoid:
      'Provocação contra o leitor, gritos, gíria fechada, exagero, frase de efeito vaga e ordem para comprar.',
    example: {
      headline: 'Madeira na sua casa',
      body: 'Mesas e cadeiras de madeira. Veja os modelos e escolha por onde começar.',
      cta: 'Escolher um modelo',
    },
  },
  artistico: {
    tone: 'Próxima, sensível e cuidadosa.',
    approach:
      'Fale de detalhes concretos: material, cor, textura, luz e uso no dia a dia, quando confirmados. O ritmo pode ser mais acolhedor. Use descrições que a pessoa consiga imaginar sem decifrar uma metáfora.',
    avoid:
      'Poesia abstrata, palavras rebuscadas, metáforas no lugar da oferta e alegações de trabalho artesanal ou peça única sem evidência.',
    example: {
      headline: 'A madeira perto de você',
      body: 'Veja a cor e os detalhes da madeira nas mesas e cadeiras. Imagine esses móveis no seu espaço.',
      cta: 'Conhecer os móveis',
    },
  },
};

export function copyDirection(vibe: Vibe): string {
  const voice = VIBE_COPY[vibe];
  return `${SIMPLE_LANGUAGE}

## Voz da vibe ${VIBE_LABEL[vibe]}
Tom: ${voice.tone}
Escrita: ${voice.approach}
Evite: ${voice.avoid}
Exemplo de voz, com oferta fictícia de móveis de madeira; não copie estes fatos para outro negócio:
Título: ${voice.example.headline}
Texto: ${voice.example.body}
Botão para uma página de modelos: ${voice.example.cta}`;
}

export const COPY_REVIEW = `## Revisão da escrita
Leia todos os textos dos blocos, SEO e resumo de artigo, inclusive os que não aparecem na captura. Confira três perguntas: o visitante entende o que é oferecido, entende a explicação e sabe o que acontece ao clicar?
Use o critério linguagem-simples para inglês desnecessário, sigla ou jargão sem explicação, frase que exige decifrar metáfora, instrução ambígua ou ação diferente da prometida. Um obstáculo real à compreensão é error: cite o trecho e proponha uma reescrita curta que preserve os fatos. Os avisos do verificador de vocabulário são pistas; julgue o contexto e a explicação, não apenas a palavra.
Use o critério voz-da-vibe para desvio de tom. Diferença de preferência é warn; não exija repetir os exemplos nem reescreva toda a página só para marcar estilo. Nomes oficiais, URLs e termos necessários bem explicados não são defeitos. Uma frase comprida mas clara não é error só pela contagem. Não dê aceite apenas porque os títulos são simples; confira também perguntas, formulários, legendas, busca e rodapé.`;
