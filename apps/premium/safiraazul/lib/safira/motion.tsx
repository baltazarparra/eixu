import type { CSSProperties } from 'react';

/**
 * Lapidação da letra.
 *
 * O título chega ao HTML inteiro e legível; aqui ele só é cortado em peças
 * para que a rolagem possa acender uma de cada vez, como a luz percorrendo as
 * facetas de uma pedra. Cada peça carrega o próprio índice, e é o CSS que
 * decide em que ponto da rolagem ela sobe — nenhum relógio, nenhum
 * observador. Sem suporte ao recurso, ou com movimento reduzido, as peças são
 * apenas palavras e letras num título comum.
 */

/**
 * O índice vira `--i`; o CSS o transforma em atraso dentro da própria faixa
 * de rolagem. Serve para a letra de um título e para o item de uma lista: em
 * ambos os casos é a ordem que escalona a entrada.
 */
export function step(index: number): CSSProperties {
  return { '--i': index } as CSSProperties;
}

const segmenter = new Intl.Segmenter('pt-BR', { granularity: 'grapheme' });

/**
 * Corte por palavra. Os espaços continuam sendo espaços de verdade, então a
 * linha quebra onde sempre quebraria e quem lê por leitor de tela ouve a
 * frase, não uma lista de fragmentos.
 */
export function Words({ text }: { text: string }) {
  const words = text.split(/\s+/).filter(Boolean);
  return (
    <>
      {words.map((word, index) => (
        <span key={`${word}-${index}`}>
          <span className="sa-w" style={step(index)}>
            {word}
          </span>
          {/* O espaço fica fora da caixa: dentro dela seria colapsado. */}
          {index < words.length - 1 ? ' ' : ''}
        </span>
      ))}
    </>
  );
}

/**
 * Corte por letra, reservado à abertura — é o gesto mais caro do site e só a
 * primeira dobra o paga. O texto acessível volta pelo `aria-label` de quem
 * chama: sem ele, um leitor de tela soletraria o título.
 */
export function Chars({ text }: { text: string }) {
  /*
   * O corte é por grafema, não por ponto de código: "ç" e as vogais acentuadas
   * do português podem chegar compostas, e dividir por caractere as partiria
   * ao meio. O índice continua correndo entre as palavras, para que a onda
   * atravesse o título inteiro em vez de recomeçar a cada espaço.
   */
  const cut = text
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => [...segmenter.segment(word)].map((part) => part.segment))
    .reduce<{ chars: string[]; start: number }[]>((words, chars) => {
      const previous = words.at(-1);
      const start = previous ? previous.start + previous.chars.length + 1 : 0;
      return [...words, { chars, start }];
    }, []);

  return (
    <span aria-hidden="true">
      {cut.map((word, wordIndex) => (
        <span key={`${word.start}-${wordIndex}`}>
          <span className="sa-w">
            {word.chars.map((char, charIndex) => (
              <span
                key={`${char}-${charIndex}`}
                className="sa-c"
                style={step(word.start + charIndex)}
              >
                {char}
              </span>
            ))}
          </span>
          {wordIndex < cut.length - 1 ? ' ' : ''}
        </span>
      ))}
    </span>
  );
}
