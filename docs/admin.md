# Manual do operador

## Encontrar ou cadastrar um cliente

Entre em `/admin` com a credencial do operador. A busca procura nome ou endereço; os filtros separam rascunhos e clientes com site publicado. Abra **Novo cliente** para cadastrar nome, endereço, contatos, briefing e marca. O endereço aceita letras minúsculas, números e hífens; nomes reservados e duplicados são recusados.

Em Marca, envie o logo, opcional, e escolha três cores: a primária pinta seções e superfícies, a secundária alterna o ritmo e a de acento vai nos botões, links e destaques. Primária e secundária precisam ser diferentes. O agente respeita essas cores e decide só estrutura, tipografia e leitura; o site escurece sozinho uma cor que não alcança contraste mínimo.

O painel é uma operação administrativa global: quem tem a credencial pode acessar todos os clientes. Não compartilhe essa sessão com clientes finais.

## Preparar os dados

Dentro do cliente, a navegação reúne **Site**, **Imagens**, **Tráfego** e **Dados**. Em Dados, atualize os contatos e o briefing sem gastar tokens: segmento, região, público, oferta, ação esperada, fatos confirmados, restrições e até três referências.

Nome, contatos e logo são compartilhados com o site ao vivo. Alterar o briefing orienta as próximas edições; não reescreve páginas automaticamente. Para trocar o endereço de um cliente existente, é necessária uma operação técnica; o formulário não altera o slug.

Envie um logo final em Dados ou aprove uma opção gerada na conversa do site. O arquivo enviado manualmente é aplicado ao terminar o upload. Uma opção gerada precisa estar aprovada antes de **Usar como logo**. Dados não altera as cores: peça a mudança na conversa do site.

## Gerar e editar o site

Em Site, **Continuar** roda briefing e direção, cenas, composição e revisão, uma etapa por vez. O progresso é salvo entre elas e vem do estado gravado, não da conversa: recarregar a tela não perde o lugar. **Parar** interrompe a sequência; uma ferramenta já iniciada pode terminar e salvar seu resultado. O cancelamento não desfaz escritas. Se houver erro ou a etapa não avançar, a sequência para; leia a resposta antes de tentar de novo.

Na etapa de cenas o agente gera uma imagem e para. Ela aparece no fim da conversa com a nota da crítica e os problemas apontados. **Aprovar** guarda a imagem na biblioteca e a sequência segue sozinha para a próxima cena. **Recusar e gerar outra** apaga o arquivo e o registro; o que você escrever em "o que mudar" vira o pedido da próxima tentativa. A crítica da IA ajuda a decidir, não aprova nada.

O chat recebe o histórico textual recente do cliente. Escreva mudanças específicas e indique a página quando necessário. Sugestões apenas preenchem a caixa; **Enviar** executa o pedido. Enter envia, Shift+Enter quebra a linha. Imagens podem ser anexadas, coladas ou arrastadas para a conversa.

No computador, conversa e prévia ficam lado a lado. No celular, alterne **Conversa** e **Prévia**. Escolha a página no seletor e confira as larguras Desktop e Celular; **Abrir prévia** abre outra aba. Os links internos mantêm o modo de rascunho. A prévia exige sessão, não envia formulários e não registra eventos de tráfego.

Os textos das 60 mensagens mais recentes são recuperados ao abrir a tela. Ferramentas, anexos e contagens de custo antigos não são restaurados. Registre decisões duráveis no briefing; não dependa de uma conversa extensa como única fonte do negócio.

## Biblioteca e publicação

Imagens é a biblioteca do que você aprovou, separada em fotos e logos. A geração e a decisão acontecem na conversa do site; aqui ficam o acervo e as ações sobre ele.

**Apagar** pede uma segunda confirmação e recusa imagens referenciadas no rascunho, publicado ou logo. Cancelar conserva a imagem. **Usar no site**, em uma foto, copia um pedido para colar no chat do site; não altera o conteúdo sozinho. **Usar como logo**, em um logo aprovado, aplica na navegação e no rodapé.

As pendências para publicar aparecem no fim do fluxo, quando ainda sobra algo. Erros de página ou projeto bloqueiam a publicação; recomendações continuam disponíveis para revisão. Mudanças de blocos ou SEO tornam a página pendente. **Publicar** valida o projeto no servidor e atualiza o snapshot de páginas atomicamente; um erro preserva a versão anterior.

O snapshot inclui blocos e SEO. Marca, contatos, título, tipo e outros metadados têm limites de versionamento descritos na [arquitetura](architecture.md#limites-atuais). Publicar o código na Vercel não publica automaticamente os rascunhos dos clientes.

## Acompanhar consumo

Depois de uma resposta, abra **Uso nesta sessão**: entrada, saída, entrada lida do cache, passos, duração e custo em dólar quando informado pelo Gateway. O painel soma as respostas recebidas desde a abertura daquela tela, sem converter para reais.

Essa contagem não inclui geração de imagens, críticas internas, outras telas ou falhas sem recibo. Consulte o Gateway para conciliar o consumo total. Cache reduz processamento repetido quando o provedor encontra um prefixo reutilizável; não garante economia fixa. O modelo e os validadores de qualidade foram mantidos.

Para evitar desperdício, use Dados para alterações cadastrais, descreva o ajuste desejado, confira a página em foco e trate a causa de uma falha antes de repetir geração. Não repita a geração completa para corrigir um detalhe.

## Tráfego e contatos

O filtro usa datas inclusivas no horário de Brasília, inicialmente os últimos 30 dias. Visitantes identificados são IDs de navegador; formulários e cliques no WhatsApp são ações. Um clique não confirma conversa. Dados anteriores à revisão podem conter cliques duplicados.

Gastos são inseridos manualmente por campanha, canal e período. Lance cada gasto uma vez: os valores são somados. Só entram no custo lançamentos inteiramente contidos no filtro. O painel avisa quando um lançamento cruza as datas; amplie o filtro para incluí-lo inteiro. Não há rateio automático, edição/exclusão de gasto ou integração com plataformas de anúncios nesta tela.

O custo por ação divide os gastos por formulários mais cliques no WhatsApp. Os totais incluem todas as campanhas, mesmo quando a tabela mostra só as 50 principais. **Todos os contatos (CSV)** exporta os últimos 5.000 contatos de formulário, independentemente do filtro de datas.

## Quando algo falhar

Aviso de sessão expirada exige entrar novamente pelo painel. Erros de rede não comprovam que uma escrita falhou: recarregue o estado antes de repetir uma operação que possa duplicar gasto ou geração. Um erro de carregamento oferece nova tentativa; cliente inexistente tem retorno à lista. A revisão técnica e seus limites estão em [Revisão do admin](admin-review.md).
