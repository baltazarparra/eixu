# Operação do EIXU Studio

O `/studio` oferece uma jornada única para criar, revisar, editar, arquivar e publicar o site de um cliente. No piloto, todos os operadores ativos da EIXU enxergam os projetos do workspace interno; autoria e atividade continuam individuais.

## 1. Gerenciar projetos

Em `/studio`, pesquise projetos ativos, abra um projeto, edite seus dados, arquive ou reative. Arquivar retira o domínio público do ar sem apagar histórico, código, conteúdo ou imagens.

Crie o cliente em `/studio/novo` e registre:

Registre:

- nome e slug;
- história, posicionamento, serviços, produtos e diferenciais verificáveis;
- telefones, WhatsApp, e-mail, endereço e redes sociais;
- site oficial atual, quando existir;
- vibe Comercial, Ousado ou Referência;
- link de referência visual e estrutural, obrigatório na vibe Referência;
- logo e cores primária e secundária;
- IDs de mensuração necessários.

O site oficial é fonte factual. A referência visual é fonte de layout, tipografia, ritmo e tratamento. Em Referência, o link informado recebe prioridade sobre a vibe genérica, sem autorizar cópia de marca, texto, imagem ou código.

## 2. Criar pelo chat

A criação redireciona para `/studio/[tenant]` e envia o primeiro pedido automaticamente. A página reúne conversa, prévia e conteúdo; o operador não precisa repetir o briefing.

O widget de progresso acima do campo de mensagem concentra a etapa atual e o tempo de execução. A conversa mostra os pedidos e as respostas do agente, sem repetir a lista de ferramentas e etapas. Chamadas internas continuam no histórico canônico para retomada e auditoria.

O primeiro build segue uma ordem obrigatória:

1. lê o cadastro e os assets;
2. consulta o site oficial e registra fatos, lacunas e tom;
3. registra o artefato de contexto;
4. captura e analisa a referência visual;
5. registra a direção de arte;
6. implementa o projeto, o contrato editorial e os refinamentos;
7. executa typecheck e build antes do checkpoint;
8. inicia a primeira publicação automaticamente e acompanha o resultado no painel.

A aba pode ser fechada depois que o Workflow foi iniciado. Ao voltar, o chat retoma o stream persistido. **Parar** solicita cancelamento do run; ferramentas já concluídas permanecem registradas e um novo turno parte do último checkpoint válido.

Anexos de imagem enviados pelo chat entram no acervo numerado do cliente. O servidor aceita somente URLs Blob no prefixo desse tenant.

## 3. Revisar a prévia

A prévia abre em desktop ou mobile. Durante o trabalho do agente, acompanha o workspace e recebe as alterações conforme os arquivos são escritos; durante typecheck/build ela pode pausar e retomar. Ao terminar, passa a mostrar o último checkpoint validado. É temporária, autenticada por token efêmero e marcada para não indexação. Atualizar a prévia não publica o site.

Confira pelo menos:

- conteúdo e grafia;
- navegação, links, formulários e WhatsApp;
- larguras desktop e mobile;
- telas estreitas e baixas;
- teclado, foco e toque;
- movimento reduzido;
- hierarquia, contraste, imagens e ritmo;
- consistência com a referência sem cópia literal.

Peça os ajustes no mesmo chat. O operador não precisa escolher modelo ou etapa técnica.

## 4. Editar conteúdo e imagens

A visão **Conteúdo** mostra os campos declarados pelo projeto em `content/schema.json`. Salvar cria uma revisão imutável e atualiza `content/values.json` com controle de revisão e hash. Se outra edição venceu a corrida, o painel recusa a gravação e pede recarga.

O CMS leve edita textos e URLs de imagem previstos pelo projeto. Mudanças estruturais, de layout ou de animação são pedidas pelo chat. A biblioteca `/studio/[tenant]/imagens` conserva números estáveis para pedidos como “use a imagem #4 no hero” e reúne uploads e imagens geradas.

## 5. Publicar

A primeira versão é publicada automaticamente depois do checkpoint. Nas alterações seguintes, **Publicar** cria uma release com o checkpoint de código e a revisão de conteúdo atuais. O serviço:

1. congela os artefatos;
2. cria ou reutiliza o projeto Vercel dedicado `eixu-site-{slug}` e protege seus previews com Vercel Auth;
3. envia arquivos por digest e cria um deployment candidato;
4. espera o estado READY;
5. verifica o marcador da revisão e o site com um bypass de automação exclusivo do projeto;
6. vincula `tenant.eixu.com.br` ao projeto;
7. promove o deployment;
8. repete o smoke sem bypass no domínio canônico público;
9. grava a release ativa no banco.

Uma falha conserva a versão anteriormente ativa. O painel acompanha o estado da publicação. Rollback cria outra release a partir de uma versão válida anterior e passa pelos mesmos gates.

## 6. Arquivar, restaurar e excluir

Arquivar o cliente retira o domínio do projeto dedicado. Restaurar recoloca o vínculo, promove a release ativa e executa smoke. Excluir remove o projeto Vercel dedicado depois das verificações de propriedade; o projeto raiz da EIXU é protegido por ID e nunca pode ser alvo.

## 7. Leads e métricas

Formulários, eventos e links de WhatsApp dos sites publicados chamam a plataforma central. A API só aceita origem vinculada ao host canônico de um tenant com projeto e release ativos. Campos e parâmetros têm limites de tamanho.

## 8. Limites atuais

- O painel é interno. Os tenants já pertencem ao workspace da EIXU, mas ainda não existe login de agência, portal ou permissão granular.
- O Studio cobre sites institucionais e landing pages. Aplicações autenticadas, pagamentos e regras de negócio próprias exigem outro escopo.
- Sandbox, imagem e modelos podem gerar custo; os checks locais não os acionam.
- O reset de dados antigos é uma operação separada, com manifesto e confirmação específicos para cada ambiente.
