# Rubrica de avaliação do gerador

Escrita em 10/09/2026. Serve para comparar saídas automáticas entre si e com a
referência, sem confundir contagem com qualidade. A nota é de revisão humana; o
runner mede o que dá para medir e registra o resto como evidência.

## Como rodar

```
npm run eval:site -- <caso> [--fresh] [--generate]
```

Os casos ficam em `evals/cases/`. O runner cria um tenant `eval-*` descartável,
roda as mesmas fases e ferramentas do painel e grava o relatório em
`outputs/evals/<data>/`. Sem `--generate`, a biblioteca é semeada com fotos de
um tenant existente e a fase de cenas é pulada: dá para comparar composição sem
geração paga. Com `--generate`, o fluxo é o de produção inteiro.

O runner escreve no banco. Ele recusa slug que não comece com `eval-`, e nunca
publica.

## Piso estrutural

Medido por `siteMetrics` e pelos gates; abaixo disso a saída nem chega à
revisão humana.

| Medida                                      | Mínimo                          |
| ------------------------------------------- | ------------------------------- |
| Páginas orgânicas conectadas                | 3                               |
| Palavras úteis por página orgânica          | 100                             |
| Fotos geradas distintas na home             | 2                               |
| Páginas orgânicas com pelo menos uma imagem | todas                           |
| Seção protagonista na home                  | 1                               |
| Tons distintos na home                      | 3, um deles accent ou secondary |
| Momentos de motion                          | 1 a 3                           |
| Erros de `lintPage` e `lintSite`            | 0                               |
| Overflow horizontal em 1440 e 390           | nenhum                          |

## Rubrica, 0 a 3

0 não atende, 1 atende de forma genérica, 2 atende, 3 atende com decisão
própria e coerente. O aceite é média 2 sem nenhum critério em 0.

1. **Identidade ligada ao negócio.** Paleta, tipografia e motivo respondem ao
   que a empresa faz, não a um gosto genérico. A direção não serviria sem
   alteração para outro cliente.
2. **Decisão de abertura.** O hero carrega escala, recorte ou contraste
   próprios, além de cor e fonte.
3. **Seção protagonista.** Existe uma seção que mostra o negócio em imagem e
   dá o que explorar, não uma lista de benefícios intercambiáveis.
4. **Ritmo tonal.** A página alterna superfícies com intenção, sem faixa
   escura por hábito nem um tom só do começo ao fim.
5. **Imagens por página.** Cada página orgânica tem imagem que explica o
   assunto dela, não a mesma foto repetida.
6. **Enquadramento.** A proporção da foto corresponde ao que o layout exibe; o
   assunto sobrevive ao recorte em desktop e mobile.
7. **Copy fundamentada.** Cada afirmação vem do intake ou de uma referência
   lida. Lacuna aparece como lacuna, não como promessa.
8. **Jornada.** Descoberta, consideração e conversão se conectam por links
   reais, e cada página responde a uma intenção diferente.
9. **Mobile.** Hierarquia e ação continuam legíveis em 390 px.

## Registro obrigatório

Modelo exato, commit, caso, se houve `--generate`, tokens de entrada e saída
por fase, tempo, ferramentas recusadas, rodadas de revisão e qualquer
intervenção manual. Saída com acabamento manual não comprova o gerador.
