# Manual do operador

## Encontrar ou cadastrar um cliente

Entre em `/admin` com a credencial do operador. A busca procura nome ou endereço; os filtros separam rascunhos e clientes com site publicado. Abra **Novo cliente** para cadastrar nome, endereço, contatos e briefing. O endereço aceita letras minúsculas, números e hífens; nomes reservados e duplicados são recusados.

O painel é uma operação administrativa global: quem tem a credencial pode acessar todos os clientes. Não compartilhe essa sessão com clientes finais.

## Preparar os dados

Dentro do cliente, a navegação reúne **Site**, **Imagens**, **Tráfego** e **Dados**. Em Dados, atualize os contatos e o briefing sem gastar tokens: segmento, região, público, oferta, ação esperada, rede social, fatos confirmados, restrições e até três referências.

Todos os campos do briefing são opcionais e cada um traz a legenda do que registrar. **Fatos confirmados** é o que a empresa faz e comprova; o site só afirma o que estiver ali ou numa referência lida, e sem isso o agente declara lacunas. **Restrições** é o que ele não pode prometer nem mostrar.

**Rede social** aceita `@perfil` do Instagram ou a página de empresa no LinkedIn. Ao salvar, o painel lê nome, bio e foto de perfil públicos e descreve o avatar para orientar marca e imagens. A leitura é melhor esforço: perfil pessoal do LinkedIn e boa parte das contas do Instagram respondem a tela de login, e o card mostra o motivo. Nesse caso, cole a bio em Fatos confirmados e envie a imagem em Logo do site. **Ler perfil novamente** repete a tentativa.

Nome, contatos e logo são compartilhados com o site ao vivo. Alterar o briefing orienta as próximas edições; não reescreve páginas automaticamente. Para trocar o endereço de um cliente existente, é necessária uma operação técnica; o formulário não altera o slug.

Envie um logo final em Dados ou aprove e aplique uma opção da biblioteca. O arquivo enviado manualmente é aplicado ao terminar o upload. Uma opção gerada precisa estar aprovada antes de **Usar como logo**.

## Excluir um cliente

A lixeira na lista e a seção **Excluir cliente** em Dados abrem a mesma confirmação, com o que será apagado: páginas, contatos recebidos, eventos, gastos, conversas, imagens e arquivos. Cliente com site publicado ou com contato recebido exige digitar o endereço para liberar o botão; o servidor confere de novo. Esc e **Cancelar** não apagam nada.

A exclusão é definitiva e não tem lixeira. O site publicado sai do ar na hora e passa a responder 404. Os arquivos são apagados antes do cadastro: se essa etapa falhar, o cliente continua no painel e a operação pode ser repetida. Uma exclusão durante uma geração em andamento faz as ferramentas daquele turno falharem.

## Gerar e editar o site

Em Site, **Gerar site** inicia briefing e direção, cenas, composição e revisão. O progresso é salvo entre as etapas. **Parar** interrompe a sequência; uma ferramenta já iniciada pode terminar e salvar seu resultado. O cancelamento não desfaz escritas. **Continuar** consulta o estado e retoma a etapa necessária. Se houver erro ou a etapa não avançar, a sequência para; leia a resposta antes de tentar de novo.

O chat recebe o histórico textual recente do cliente. Escreva mudanças específicas e indique a página quando necessário. Sugestões apenas preenchem a caixa; **Enviar** executa o pedido. Enter envia, Shift+Enter quebra a linha. Imagens podem ser anexadas, coladas ou arrastadas para a conversa.

No computador, conversa e prévia ficam lado a lado. No celular, alterne **Conversa** e **Prévia**. Escolha a página no seletor e confira as larguras Desktop e Celular; **Abrir prévia** abre outra aba. Os links internos mantêm o modo de rascunho. A prévia exige sessão, não envia formulários e não registra eventos de tráfego.

Os textos das 60 mensagens mais recentes de cada canal são recuperados ao abrir a tela. Ferramentas, anexos e contagens de custo antigos não são restaurados. Registre decisões duráveis no briefing; não dependa de uma conversa extensa como única fonte do negócio.

## Revisar imagens e publicar

A biblioteca separa fotos/logos e seus estados: candidata, aprovada ou rejeitada. A nota da crítica de IA ajuda na escolha, mas não aprova nada. Confira conteúdo, recorte e fidelidade antes de aprovar. Fotos usadas no rascunho também aparecem como pendência na conversa do site.

**Apagar** pede uma segunda confirmação e recusa imagens referenciadas no rascunho, publicado ou logo. Cancelar conserva a imagem. **Usar no site**, em uma foto aprovada, copia um pedido para colar no chat do site; não altera o conteúdo sozinho.

Antes de publicar, abra as pendências. Erros de página ou projeto bloqueiam a publicação; recomendações continuam disponíveis para revisão. Mudanças de blocos ou SEO tornam a página pendente. **Publicar** valida o projeto no servidor e atualiza o snapshot de páginas atomicamente; um erro preserva a versão anterior.

O snapshot inclui blocos e SEO. Marca, contatos, título, tipo e outros metadados têm limites de versionamento descritos na [arquitetura](architecture.md#limites-atuais). Publicar o código na Vercel não publica automaticamente os rascunhos dos clientes.

## Acompanhar consumo

Depois de uma resposta, abra **Uso nesta sessão**: entrada, saída, entrada lida do cache, passos, duração e custo em dólar quando informado pelo Gateway. O painel soma as respostas recebidas desde a abertura daquela tela, sem converter para reais.

Essa contagem não inclui geração de imagens, críticas internas, outras abas ou falhas sem recibo. Consulte o Gateway para conciliar o consumo total. Cache reduz processamento repetido quando o provedor encontra um prefixo reutilizável; não garante economia fixa. O modelo e os validadores de qualidade foram mantidos.

Para evitar desperdício, use Dados para alterações cadastrais, descreva o ajuste desejado, confira a página em foco e trate a causa de uma falha antes de repetir geração. Não repita a geração completa para corrigir um detalhe.

## Tráfego e contatos

O filtro usa datas inclusivas no horário de Brasília, inicialmente os últimos 30 dias. Visitantes identificados são IDs de navegador; formulários e cliques no WhatsApp são ações. Um clique não confirma conversa. Dados anteriores à revisão podem conter cliques duplicados.

Gastos são inseridos manualmente por campanha, canal e período. Lance cada gasto uma vez: os valores são somados. Só entram no custo lançamentos inteiramente contidos no filtro. O painel avisa quando um lançamento cruza as datas; amplie o filtro para incluí-lo inteiro. Não há rateio automático, edição/exclusão de gasto ou integração com plataformas de anúncios nesta tela.

O custo por ação divide os gastos por formulários mais cliques no WhatsApp. Os totais incluem todas as campanhas, mesmo quando a tabela mostra só as 50 principais. **Todos os contatos (CSV)** exporta os últimos 5.000 contatos de formulário, independentemente do filtro de datas.

## Quando algo falhar

Aviso de sessão expirada exige entrar novamente pelo painel. Erros de rede não comprovam que uma escrita falhou: recarregue o estado antes de repetir uma operação que possa duplicar gasto ou geração. Um erro de carregamento oferece nova tentativa; cliente inexistente tem retorno à lista. A revisão técnica e seus limites estão em [Revisão do admin](admin-review.md).
