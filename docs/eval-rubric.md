# Rubrica de avaliação do gerador

Contrato revisado em 13/09/2026. Serve para comparar saídas automáticas entre si e com a
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
gerar novas fotos. As chamadas de texto/crítica continuam pagas. Com
`--generate`, também há geração real de cenas. O runner usa os executores
do produto em um laço próprio; não testa a entrega da Vercel Queues.

O runner escreve no banco mesmo sem `--generate`; o reaproveitamento de fotos
lê também o tenant de origem. Ele recusa slug que não comece com `eval-` e
nunca publica. `--fresh` exclui o tenant do caso antes de criá-lo novamente.
Confirme destino e escopo autorizado antes de executar.

## Piso estrutural

Medido por `siteMetrics` e pelo lint da geração. Este piso orienta o aceite do experimento. Na publicação pedida pelo operador, os achados editoriais classificados em `lib/sites/publication-policy.ts` viram recomendações; erros técnicos continuam bloqueando a transação. Publicar não equivale a atingir a rubrica nem a confirmar fatos.

| Medida                                      | Mínimo                                               |
| ------------------------------------------- | ---------------------------------------------------- |
| Páginas orgânicas conectadas                | 3 em multi; 1 home + obrigado em landing             |
| Palavras úteis por página orgânica          | 100; 180/220 na home comercial ampla; 250 na landing |
| Fotos disponíveis distintas na home         | 2                                                    |
| Páginas orgânicas com pelo menos uma imagem | todas                                                |
| Seção protagonista na home                  | 1                                                    |
| Estrutura v5 ou v6 escolhida e preservada   | 1 da vibe ou 1 das 12 pela referência                |
| Composição autoral v5/v6                    | 1, com duas fotos e papéis próprios                  |
| Tons distintos na home                      | 3 sem referência; ritmo da fonte no v6               |
| Momentos de motion                          | 1 a 3 sem referência; ritmo da fonte no v6           |
| Erros de `lintPage` e `lintSite`            | 0                                                    |
| Overflow horizontal em 1440 e 390           | nenhum                                               |
| Palavra visível partida em qualquer captura | nenhuma                                              |

Em comercial v5/v6, a profundidade do briefing define o piso entre cinco e oito
seções: quatro evidências acrescentam uma, e seis evidências mais dois números ou
história acima de 1.500 caracteres acrescentam outra. Só contam camadas opcionais
sustentadas pelos dados e na ordem da estrutura. Seis seções pedem 180 palavras;
sete ou mais, 220. A contagem evita uma home desproporcional, mas não substitui a
nota humana de utilidade, factualidade e jornada.

Para `landing` (perfil v7), estrutura v5/v6 e composição autoral não se aplicam.
A home tem 6–11 seções, protagonista com duas fotos, prova confirmada e uma ação
repetida no hero, meio e fim. Verifique formulário de 2–4 campos, destino de
obrigado, menu por âncoras, alvo de 48 px, botão fixo sem encobrir formulário/menu
e leitura em 320 px e em tela baixa. O caso `landing.json` é sintético.

A validação em memória e no navegador não prova qualidade editorial do modelo,
fidelidade a uma referência ou conversão comercial. Geração real e medições de
latência/custo precisam de autorização para o recurso e tenant usados.

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
9. **Mobile.** Hierarquia e ação continuam legíveis desde 320 px. Confira
   menu aberto/fechado, toque, teclado, foco e rolagem também em tela baixa.
   A captura padrão de 390 px não cobre sozinha esse contrato.
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
nas quatro vibes multipágina e execute as três estruturas de cada uma. Avalie Landing Page separadamente, com jornada de página única. Inclua
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

## Ensaio do harness e conclusão do produto

Use `npm run eval:harness -- --live --case=... --assets=... --repeat=2` para ensaios com modelos, executores e renderer reais, I/O em memória e fotos de fixture. Registre o nível de raciocínio, orçamento por fase, versão do harness, motivo de término e tokens de raciocínio. A saída sem edição manual, capturas e relatório ficam em `outputs/harness/`.

No `eval:harness`, o aceite do experimento exige pre-flight sem erros e recibo visual completo, sem erro material e referente ao rascunho atual. Crítica de IA e medições não preenchem automaticamente as notas humanas de 0 a 3 acima. Uma execução aprovada não demonstra superioridade universal; compare as mesmas fixtures e repita. Custo e latência são diagnósticos secundários, nunca compensam uma falha de factualidade, fluxo ou legibilidade.

A geração do produto e `eval:site` encerram pela composição/entrega, sem
exigir esse recibo visual. `eval:harness` solicita a revisão explicitamente
para medir qualidade. Conclusão de geração, aprovação do ensaio e autorização
para publicar são estados distintos.
