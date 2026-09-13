# Edição de sites gerados pelo chat

## Diagnóstico e plano

O estudo de 12/09/2026 encontrou uma leitura obrigatória da página em cada
edição, substituição integral de objetos/listas em `update_block`, posições
numéricas em inserção/movimento e ausência de cor exclusiva por seção. Além
disso, o renderer agrupava todo conteúdo antes do rodapé, mesmo quando a
ordem salva colocava um bloco depois dele. Serializar ferramentas do mesmo
turno não protegia a página de outra aba.

O plano implementado reúne o pedido de uma página em uma operação validada,
entrega o snapshot atual no contexto do agente, preserva posição e campos não
alterados, permite uma paleta local e confere concorrência na gravação. A
melhoria de latência buscada é eliminar viagens desnecessárias entre modelo e
ferramentas; o modelo e o raciocínio `high` permanecem iguais. Não há parser de
frases que finja entender toda linguagem natural, nem revisão visual automática.

## Contrato

`edit_page` recebe página, revisão e operações. `set`/`unset` alteram caminhos
de props, inclusive itens de listas. `replace_text` troca texto literal,
preservando maiúsculas, acentos e o restante do campo; sua contagem esperada é
um por padrão. Ambiguidade retorna os blocos/campos candidatos sem gravar.
Em pedidos curtos contendo apenas uma troca entre dois textos entre aspas,
a rota detecta múltiplas ocorrências e pergunta antes de chamar o modelo. O
executor repete essa proteção para que IDs escolhidos pelo modelo não a
contornem. Esse reconhecimento é restrito; pedidos compostos ou com alvo
explícito continuam sendo interpretados pelo agente.
URLs, âncoras e configuração não entram na busca textual. `insert` e `move`
aceitam antes/depois de um ID ou início/fim; `remove` remove o alvo indicado.
`replace_block` troca o tipo e as props completas mantendo o ID, quando a
mudança de variante exige outro schema; ajustes de layout usam `set`.

A rota injeta snapshot e schemas da página em foco, lidos no servidor neste
turno. Outra página exige `get_page`. O agente reúne as mudanças em uma chamada
por página e conclui usando o recibo; uma pergunta necessária de alvo continua
sendo preferível a alterar o lugar errado. A edição geral deixa de expor os
quatro mutadores antigos. Geração/revisão e o escopo específico de cabeçalho
conservam seus consumidores compatíveis.
Se o loop terminar após ferramentas sem resposta textual, o stream produz
um recibo das edições salvas e recusadas, preservado no histórico.

## Andamento e atualização da prévia

Durante uma edição, a atividade e o tempo ficam fora da área rolável do
histórico, junto do compositor. A prévia também mostra a atividade, inclusive
com a conversa recolhida e na aba Prévia do celular. Os rótulos acompanham o
pedido recebido, as ferramentas em execução e a preparação da resposta final;
não estimam porcentagem nem expõem raciocínio privado.

Após um recibo de escrita confirmada, `completeChatStream` envia o evento
transitório `data-preview-update`. Ele não depende da resposta final do modelo
nem de uma nova leitura do banco e não entra no histórico do agente.
`changesPreview` reconhece os mutadores e recusa leituras, resultados
preliminares, falhas e operações sem mudança. Cada chamada sinaliza uma vez.

O editor recarrega o iframe imediatamente e consulta o estado do painel em
paralelo. A revisão recebida nessa consulta não repete a recarga já pedida;
respostas antigas continuam sendo descartadas. O fim ou a interrupção do
turno mantém a releitura de segurança, e o feed da geração continua usando
a revisão do rascunho para detectar alterações.

A edição direta de textos conserva sua referência ao iframe e o protocolo
de salvamento. Enquanto há uma sessão de edição direta, sinais de mudança
avisam sobre o novo estado sem recarregar ou descartar textos não salvos.

O iframe informa **Atualizando prévia** e só confirma **Prévia atualizada**
quando carrega o documento do site. Erro, redirecionamento de sessão ou espera
maior que 20 segundos oferecem nova tentativa. A rolagem é preservada em
edições da mesma página; escolher outra página começa uma prévia nova.

## Integridade da edição

O executor prepara o lote em memória, valida os blocos tocados e recusa novos
erros de `lintPage` e `lintTextStyles`. Erros anteriores fora do pedido permanecem no recibo. A
escrita compara `blocks` em JSONB e usa ID da página e do tenant; se outra aba
gravou, retorna conflito. Os mutadores antigos também usam essa gravação.
Nenhum snapshot publicado é alterado. A atomicidade vale por página, não por
um pedido com várias páginas. Uma repetição com revisão antiga é recusada; não
é um mecanismo de desfazer ou histórico de versões.

`presentation.background` aceita hex de seis dígitos e preserva a cor pedida.
O renderer calcula texto, apoio e links legíveis localmente.
`presentation.foreground` é opcional e exige fundo explícito e contraste de
4,5:1. Sem essas props o comportamento anterior permanece. A ordem salva é
respeitada após o footer, com um único `main` e localização automática antes do
rodapé. A seção extra posterior fica fora de `main`.

`savePageEdit` fica em `lib/sites/edits.ts` e é compartilhado pelo chat, pelos
mutadores legados e pela rota administrativa de edição direta. A prop
`textStyles` permite pedidos de tamanho e cor pelo mesmo `edit_page`, por
exemplo `set` de `textStyles` com `[{"field":"headline","size":1}]`. Os
limites e o contraste são os do [contrato visual](design.md#texto-por-campo).
O chat não muda de modelo, raciocínio ou fluxo por causa dessa prop.

## Validação reproduzível

- `EIXU_CHROME_PATH=... node --test tests/browser/admin-chat-edits.test.mjs`
  usa o POST, stream, SDK, executores e editor reais com I/O/modelo em memória
  e CSS do build Next.js. Segura resposta final, consulta de estado e iframe
  separadamente para verificar a atualização imediata, etapas, rolagem,
  interrupção, recusas, ausência de mudança e recuperação em desktop/celular.
- `node --test tests/admin-page-edits.test.mjs tests/admin-edit-scope.test.mjs`
  confere operações reais, recusas, preservação e os scopes.
- `EIXU_TEST_POSTGRES_URL=... node --test tests/admin-page-edits-db.test.mjs`
  aceita apenas PostgreSQL local descartável `eixu_pr2_test`; força duas
  leituras da mesma versão e verifica o conflito no SQL real.
- `npm run eval:edits -- --live` usa Gemini configurado, prompt e executores
  reais sobre páginas sintéticas em memória. Registra exatidão, chamadas,
  passos, duração, consumo e saída em `outputs/page-edits/`. Não acessa Neon,
  Blob nem publicação. `--case=text|nested|color|insert|move|ambiguous` filtra.

Os resultados medidos e as limitações da entrega ficam em
[Verificação](verification.md). Testes determinísticos não provam que toda
formulação em linguagem natural será interpretada corretamente, e uma
medição de chamadas não equivale a comparação estatística de latência.
