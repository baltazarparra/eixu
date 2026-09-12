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

| Medida                                      | Mínimo                              |
| ------------------------------------------- | ----------------------------------- |
| Páginas orgânicas conectadas                | 3                                   |
| Palavras úteis por página orgânica          | 100                                 |
| Fotos geradas distintas na home             | 2                                   |
| Páginas orgânicas com pelo menos uma imagem | todas                               |
| Seção protagonista na home                  | 1                                   |
| Estrutura v5 escolhida e preservada         | 1 das 3 da vibe                     |
| Composição autoral v5                       | 1, com duas fotos e papéis próprios |
| Tons distintos na home                      | 3, um deles accent ou secondary     |
| Momentos de motion                          | 1 a 3                               |
| Erros de `lintPage` e `lintSite`            | 0                                   |
| Overflow horizontal em 1440 e 390           | nenhum                              |

## Rubrica, 0 a 3

0 não atende, 1 atende de forma genérica, 2 atende, 3 atende com decisão
própria e coerente. O aceite é média 2 sem nenhum critério em 0.

1. **Identidade ligada ao negócio.** Paleta, tipografia e motivo respondem ao
   que a empresa faz, não a um gosto genérico. A direção não serviria sem
   alteração para outro cliente e cumpre a vibe escolhida no cadastro, que o
   relatório registra em `report.vibe`.
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
10. **Linguagem simples.** A oferta, as explicações e as ações são entendidas
    sem conhecer tecnologia ou inglês. Avalie também perguntas, formulários,
    legendas, busca e rodapé. Termo necessário vem explicado; nome oficial é
    preservado. Frase curta ou glossário limpo não provam compreensão.
11. **Voz da vibe.** O texto segue o [perfil escolhido](copy.md) com coerência,
    preservando clareza e fatos. Não exige repetir os exemplos do contrato.
12. **Estrutura e assinatura.** A estrutura escolhida responde à jornada, e a
    `signature.composition` transforma conteúdo, cenas, papéis e ação daquele
    cliente em uma seção reconhecível. Trocar apenas cores ou texto num arranjo
    repetido não atende.

Clareza e voz precisam de nota pelo menos 2, além da regra geral de aceite.
Uma média alta em aparência não compensa texto difícil.

Para avaliar a escrita e a variação estrutural, use a mesma oferta confirmada
nas quatro vibes e execute as três estruturas de cada uma. Inclua
um negócio de serviço e um de produto; repita a geração e uma edição pontual.
Registre textos automáticos antes de qualquer intervenção. Inclua nomes oficiais,
um termo técnico necessário e explicado, e casos com inglês desnecessário,
sigla sem explicação, metáfora confusa e botão que promete outra ação. A revisão
deve separar esses casos sem apagar informação ou inventar oferta.

Na avaliação com pessoas do público, peça que expliquem com suas palavras o que
a empresa oferece e o que esperam que aconteça ao clicar no botão. Registre as
dúvidas sem ensinar a resposta antes. Marque essa etapa como não executada se
houver apenas revisão técnica ou crítica de IA.

## Registro obrigatório

Modelo exato, commit, caso, se houve `--generate`, tokens de entrada e saída
por fase, tempo, ferramentas recusadas, rodadas de revisão e qualquer
intervenção manual. Saída com acabamento manual não comprova o gerador.

## Harness de qualidade, 11/09/2026

Use `npm run eval:harness -- --live --case=... --assets=... --repeat=2` para ensaios com modelos, executores e renderer reais, I/O em memória e fotos de fixture. Registre o nível de raciocínio, orçamento por fase, versão do harness, motivo de término e tokens de raciocínio. A saída sem edição manual, capturas e relatório ficam em `outputs/harness/`.

O aceite automático exige pre-flight sem erros e recibo visual completo, sem erro material e referente ao rascunho atual. Crítica de IA e medições não preenchem automaticamente as notas humanas de 0 a 3 acima. Uma execução aprovada não demonstra superioridade universal; compare as mesmas fixtures e repita. Custo e latência são diagnósticos secundários, nunca compensam uma falha de factualidade, fluxo ou legibilidade.
