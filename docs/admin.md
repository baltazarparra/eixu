# Manual do operador

## Encontrar ou cadastrar um cliente

Entre em `/admin` com a credencial do operador. A busca procura nome ou endereço; os filtros separam rascunhos e clientes com site publicado. Abra **Novo cliente** para cadastrar nome, endereço, contatos, briefing, vibe e marca. O endereço aceita letras minúsculas, números e hífens; nomes reservados e duplicados são recusados.

Em **Contatos**, tudo é opcional e vai direto para o site. Cada telefone é WhatsApp ou telefone comum: o primeiro WhatsApp vira o botão flutuante e os CTAs rastreados, os demais aparecem no rodapé, e o telefone comum vira link de ligação. O e-mail aparece no rodapé. Cada endereço vira a seção "Onde estamos", com mapa e link de rota, logo acima do rodapé de toda página comum; com mais de um, o visitante alterna entre eles. As redes sociais aparecem no rodapé com o ícone da rede, e o primeiro Instagram ou LinkedIn da lista é o perfil lido para o briefing.

Informe números internacionais com `+` e DDI, como `+55 11 99999-0000` ou
`+1 415 555 2671`. O sinal é preservado ao salvar e reabrir Dados. Telefones
locais podem ficar sem DDI; WhatsApp exige o código do país. Números
internacionais curtos já gravados sem o sinal precisam ser reinformados com
`+`, pois não é possível distingui-los de números locais só pelos dígitos.

Em **Vibe do site**, escolha a linguagem visual: **Comercial** é o padrão equilibrado entre prova e conversão; **Moderno** usa superfície escura, monocromia e capítulos espaçados; **Ousado** abre com tipografia enorme, muito branco e imagem de borda a borda; **Artístico** usa papel quente, display serifada e lavagens de cor. A vibe limita o que o agente pode escolher de tipografia, ritmo, superfície e tratamento de imagem. Ela é definida só no cadastro: mudar depois exige reconstruir as páginas na conversa do site.

Em Marca, envie o logo, opcional, e escolha três cores: a primária pinta seções e superfícies, a secundária alterna o ritmo e a de acento vai nos botões, links e destaques. Primária e secundária precisam ser diferentes. O agente respeita essas cores e decide só estrutura, tipografia e leitura; o site escurece sozinho uma cor que não alcança contraste mínimo.

O painel é uma operação administrativa global: quem tem a credencial pode acessar todos os clientes. Não compartilhe essa sessão com clientes finais.

## Preparar os dados

Dentro do cliente, a navegação reúne **Site**, **Imagens**, **Tráfego** e **Dados**. Em Dados, atualize diretamente contatos e briefing: telefones, e-mail, endereços, redes sociais, segmento, região, público, oferta, ação esperada, fatos confirmados, restrições e até três referências. A vibe aparece como informação, sem edição. A edição dos campos não usa o chat; a descrição de um avatar social novo pode consumir uma chamada ao modelo.

Todos os campos do briefing são opcionais e cada um traz a legenda do que registrar. **Fatos confirmados** é o que a empresa faz e comprova; o site só afirma o que estiver ali ou numa referência lida, e sem isso o agente declara lacunas. **Restrições** é o que ele não pode prometer nem mostrar.

**Redes sociais** aceita `@perfil`, o link da rede ou a página de empresa no LinkedIn; o primeiro Instagram ou LinkedIn da lista é o perfil lido. Ao salvar, o painel lê nome, bio e foto de perfil públicos e descreve o avatar para orientar marca e imagens. A leitura é melhor esforço: perfil pessoal do LinkedIn e boa parte das contas do Instagram respondem a tela de login, e o card mostra o motivo. Nesse caso, cole a bio em Fatos confirmados e envie a imagem em Logo do site. **Ler perfil novamente** repete a tentativa.

Trocar ou remover o perfil durante a leitura descarta a resposta anterior. Uma releitura com o mesmo avatar reaproveita a imagem e a descrição existentes. O gerador de imagens também recebe as restrições e evidências consolidadas no briefing do site.

Clientes antigos recuperam em Redes sociais o perfil que estava apenas no
briefing. Salvar outros dados conserva o perfil e o avatar já lidos. Remover
essa linha explicitamente continua removendo o perfil.

Nome, contatos e logo são compartilhados com o site ao vivo. Alterar o briefing orienta as próximas edições; não reescreve páginas automaticamente. Para trocar o endereço de um cliente existente, é necessária uma operação técnica; o formulário não altera o slug.

Envie um logo final em Dados ou escolha uma opção gerada na conversa do site. O arquivo enviado manualmente é aplicado ao terminar o upload. Uma opção gerada fica disponível em Imagens para **Usar como logo**, sem aprovação. Dados não altera as cores: peça a mudança na conversa do site.

## Excluir um cliente

A lixeira na lista e a seção **Excluir cliente** em Dados abrem a mesma confirmação, com o que será apagado: páginas, contatos recebidos, eventos, gastos, conversas, imagens e arquivos. Cliente com site publicado ou com contato recebido exige digitar o endereço para liberar o botão; o servidor confere de novo. Esc e **Cancelar** não apagam nada.

A exclusão é definitiva e não tem lixeira. Ao concluir, o site publicado passa a responder 404. Ela aguarda envios de arquivos já iniciados, impede novos envios e apaga os arquivos antes do cadastro: se essa etapa falhar, o cliente continua no painel e a operação pode ser repetida. Uma geração que terminar depois da exclusão não consegue enviar arquivos para esse cliente.

## Gerar e editar o site

Em Site, **Continuar** roda briefing e direção, cenas, composição e revisão, uma etapa por vez. O progresso é salvo entre elas e vem do estado gravado, não da conversa: recarregar a tela não perde o lugar. **Parar** interrompe a sequência; uma ferramenta já iniciada pode terminar e salvar seu resultado. O cancelamento não desfaz escritas. Se houver erro ou a etapa não avançar, a sequência para; leia a resposta antes de tentar de novo.

Na etapa de cenas o agente gera uma imagem por requisição e a sequência segue automaticamente enquanto o plano avança. As fotos ficam disponíveis com número e URL, sem aprovação. A crítica registra nota e problemas para orientar ajustes; nota baixa não abre uma fila de decisão.

O chat recebe o histórico textual recente do cliente. Escreva mudanças específicas e indique a página quando necessário. Sugestões apenas preenchem a caixa; **Enviar** executa o pedido. Enter envia, Shift+Enter quebra a linha. Imagens podem ser anexadas, coladas ou arrastadas para a conversa.

No computador, conversa e prévia ficam lado a lado. No celular, alterne **Conversa** e **Prévia**. Escolha a página no seletor e confira as larguras Desktop e Celular; **Abrir prévia** abre outra aba. Os links internos mantêm o modo de rascunho. A prévia exige sessão, não envia formulários e não registra eventos de tráfego.

Os textos das 60 mensagens mais recentes são recuperados ao abrir a tela. Ferramentas, anexos e contagens de custo antigos não são restaurados. Registre decisões duráveis no briefing; não dependa de uma conversa extensa como única fonte do negócio.

## Biblioteca e publicação

Imagens (`/admin/[tenant]/imagens`) reúne as imagens geradas, separadas em fotos e logos. Cada uma mostra um número, inclusive as candidatas antigas que agora estão disponíveis sem aprovação.

Para alterar uma imagem, escreva no chat: **“quero atualizar a imagem #5, quero outro carro”**. Ou clique em **Solicitar alteração** no cartão: o chat abre com o número preenchido; complete o pedido e envie. A geração usa a original como referência e preserva sua proporção. A nova versão ganha outro número, substitui a anterior nas páginas em rascunho e mantém ambas na biblioteca. O chat informa o novo número. A versão publicada continua até você publicar as páginas de novo.

O filtro **Rejeitadas** preserva imagens recusadas no fluxo antigo, que continuam indisponíveis para publicação. Troque a imagem do bloco pelo chat e depois apague.

**Apagar** pede uma segunda confirmação e recusa imagens referenciadas no rascunho, publicado ou logo. Cancelar conserva a imagem. **Usar no site**, em uma foto, copia um pedido para colar no chat do site; não altera o conteúdo sozinho. **Usar como logo**, em um logo disponível, aplica na navegação e no rodapé.

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
