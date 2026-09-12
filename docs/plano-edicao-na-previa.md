# Plano: edição de texto na prévia de um site publicado

Plano original de 12/09/2026, baseado em `main` (`8ab02d1`). Implementação das
fases 1 e 2 autorizada pelo objetivo desta tarefa, em checkout isolado a partir
de `eeff730`. A fase 3 continua opcional e fora desta entrega.

**Estado:** fases 1 e 2 implementadas; ver resultados em
[Verificação](verification.md). Salvar altera o rascunho e Publicar continua
separado. Nenhuma página de cliente real é publicada por esta implementação.

A validação do CSS refinou o cálculo de contraste para superfícies internas e
cores translúcidas. Títulos das abas do explorador são rótulos de controle e
não recebem estilo individual. Cores sobre foto sem painel uniforme permanecem
automáticas; a ilha mede também o fundo real do navegador. No modo de edição,
os textos dos menus e todos os painéis do explorador ficam acessíveis.

## 1. Pedido e resultado esperado

Depois que um site gerado é publicado, o editor mostra um botão **Editar**. Ao
clicar, a prévia entra em modo de edição: o operador altera o texto diretamente
na página, ajusta o tamanho e a cor de cada texto e, ao **Salvar**, o modo de
edição termina e a prévia volta ao normal.

O plano entrega:

- **Editar** na barra do editor, visível quando o cliente está publicado e não
  há geração nem turno de chat em andamento.
- Edição em lugar de todos os textos visíveis dos blocos, com rótulo do campo,
  contador de caracteres e os mesmos limites do catálogo e do pre-flight.
- Tamanho em cinco passos e cor por campo, dentro do contrato de tipografia
  fluida e de contraste que os sites já cumprem.
- **Salvar** grava no rascunho pela mesma validação e proteção de versão do
  `edit_page`; **Cancelar** descarta. Os dois saem do modo de edição.
- **Publicar** continua sendo a ação separada que leva a mudança ao site no ar.

## 2. Decisões e premissas

| Decisão                 | Escolha                                                                                            | Por quê                                                                                                                                           | Alternativa não adotada                                                                                                                 |
| ----------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Destino da gravação     | Rascunho (`pages.blocks`); `published_blocks` intocado                                             | Invariante de [AGENTS.md](../AGENTS.md): separação rascunho/publicado e pre-flight nos dois caminhos. Publicar já valida e promove atomicamente.  | Publicar ao salvar pularia o pre-flight de projeto. Um botão "Salvar e publicar" pode reutilizar `publishSite(tenant, slug)` na fase 3. |
| Granularidade do estilo | Por campo: o título inteiro, o parágrafo inteiro, a pergunta inteira                               | As props são strings simples, escapadas pelo React. Formatação de trecho exigiria marcação inline, parser, renderer, lint e `replace_text` novos. | Marcação restrita por trecho fica como fase futura, com contrato próprio.                                                               |
| Quando o botão aparece  | `tenant.status === 'published'`                                                                    | É o pedido. O mecanismo funciona igual em rascunho; a condição é uma linha no workspace.                                                          | Mostrar também em rascunho, se o operador quiser depois.                                                                                |
| Tamanho                 | Passos relativos `-2..2` = 80, 90, 100, 115 e 130% do tamanho atual do elemento                    | Responsividade é requisito de todas as vibes. A escala por vibe continua em `clamp()`; o passo multiplica o resultado em qualquer largura.        | Pixels ou `rem` fixos quebrariam a escala fluida e o celular.                                                                           |
| Cor                     | Hex de seis dígitos, contraste mínimo de 4,5:1 contra o fundo efetivo da seção, medido no servidor | Mesma regra de `presentation.foreground` e dos tokens em `lib/blocks/contrast.ts`. Nunca CSS livre.                                               | Aceitar qualquer cor e avisar depois deixaria o rascunho publicável com texto ilegível.                                                 |
| Executor                | `applyPageEdit` + gravação com comparação do JSONB, compartilhados com o chat                      | Já validam schema estrito, campos desconhecidos, lint e concorrência. Um segundo caminho de escrita divergiria.                                   | Escrita própria da rota administrativa.                                                                                                 |
| Persistência            | Prop opcional `textStyles` no JSONB de cada bloco                                                  | Sem migração; snapshot publicado versiona junto, como `presentation`.                                                                             | Coluna ou tabela nova.                                                                                                                  |

Modelo, raciocínio e fluxo de geração não mudam; o catálogo injetado no prompt
apenas ganha a prop nova. A ilha de edição só existe na prévia autenticada; a
página pública recebe exatamente o HTML de hoje quando nenhum estilo foi
aplicado.

## 3. O que já existe e será reaproveitado

- **Prévia.** O iframe abre `/s/[tenant]/[slug]?preview=1&__tenant=` em
  [workspace.tsx](<../app/(admin)/admin/[tenant]/workspace.tsx>), exige sessão,
  recebe `noindex`, mantém links no tenant por `lib/sites/preview.ts` e
  desativa formulários e tracking. `nonce` recarrega o iframe quando
  `previewRevision` muda ([review/state.ts](../lib/review/state.ts)).
- **Cabeçalho.** `WorkspaceHeader` injeta por portal os grupos `preview` e
  `decision` ([navigation.tsx](../components/admin/navigation.tsx)); Publicar
  vive em `decision`. É onde Editar, Salvar e Cancelar entram.
- **Executor.** `applyPageEdit` ([page-edits.ts](../lib/ai/page-edits.ts))
  confere a revisão (sha256 dos blocos), aplica `set` por caminho, valida o
  bloco com schema estrito e campos desconhecidos. `savePageEdit`, hoje função
  interna de `buildTools` ([tools.ts](../lib/ai/tools.ts)), recusa novos erros
  de `lintPage` e grava com `where blocks = <anterior>`, devolvendo conflito
  quando outra aba escreveu. O [contrato de edição](chat-edits.md) descreve o
  comportamento.
- **Renderer.** Cada bloco sai em `.site-block[data-block][data-block-id]`
  ([render.tsx](../lib/blocks/render.tsx)); cores locais em
  `sectionColorVars`; tons em `site.css` (`[data-tone]`, linhas 249–306);
  ritmo alternado e superfície de contraste pintam `--surface` em seções sem
  tom; a lavagem artística é uma mistura clara do papel.
- **Escala tipográfica.** `typography.css` define `--type-*` por papel e vibe;
  o hero usa `.site-headline` com `clamp()` por vibe, versão e comprimento.
- **Validação.** `lintPage` (headline até duas linhas estimadas, subtexto até
  20 palavras, travessão, texto genérico, placeholders), `lintCopy` e
  `lintSite` com a marca ([lint.ts](../lib/taste/lint.ts),
  [copy/lint.ts](../lib/copy/lint.ts), [taste/site.ts](../lib/taste/site.ts)).
- **Testes.** `page-edit-fixture.mjs` executa os executores reais com I/O
  simulado; `admin-handoff-fixture.mjs` monta o workspace em Vite com API
  simulada; `navigation-fixture.mjs` serve HTML de servidor, hidratação real e
  CSS do build para o Chromium.

## 4. Contrato de dados e renderização

### 4.1 `textStyles`

Prop comum a todos os blocos, ao lado de `anchor` e `presentation`, em
[registry.ts](../lib/blocks/registry.ts):

```ts
textStyles?: { field: string; size?: -2 | -1 | 0 | 1 | 2; color?: string }[];
```

- `field` é o caminho de um campo de texto do bloco, no mesmo formato de
  `edit_page` (`headline`, `items.0.title`); regex
  `^[a-zA-Z0-9_]+(\.[a-zA-Z0-9_]+)*$`, até 40 entradas, sem caminho repetido.
- `color` segue `/^#[0-9a-fA-F]{6}$/`. Uma entrada sem `size` nem `color` é
  inválida.
- A validação estrutural fica no schema. A semântica (campo existe, é
  estilizável, passo mínimo do papel, contraste) fica em `lib/blocks/fields.ts`
  e no lint, descritos abaixo.
- `catalogForPrompt` passa a listar `textStyles` na linha comum, para o agente
  atender pedidos como "aumente o título" pelo mesmo `edit_page`. A descrição
  da ferramenta ganha uma frase; o prompt não muda.

### 4.2 Inventário de campos (`lib/blocks/fields.ts`)

Fonte única para renderer, ilha, lint e rota. Para cada tipo de bloco, lista os
caminhos de texto com rótulo em português (Título, Texto de apoio, Pergunta 2,
Parágrafo), `max` lido do schema, `multiline`, `editable`, `stylable` e
`minStep`. Um teste renderiza cada bloco com props de fixture e confere que
todo caminho `editable` aparece no DOM como `[data-field]`, e nada além disso.

| Grupo                                                                        | Campos                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Editáveis e estilizáveis                                                     | `headline`, `subtext`, `eyebrow`, `title`, `lead`, `body`, `quote`, `author`, `role`, `q`, `a`, `tagline`, `legal`, `caption`, `imageCaption`, `secondaryCaption`, `category`, `note`, `price`, `plans.*.name`, itens e passos (`title`, `body`, `headline`, `caption`, `facts.*`), `facts.*.label/value`, `items.*.value/label` das estatísticas, `features.*`, `bullets.*`, `logos.*` |
| Editáveis, não estilizáveis (mantêm o par de contraste do botão ou controle) | `cta.label`, `secondary.label`, `links.*.label`, `plans.*.cta.label`, `items.*.cta.label`, `submitLabel`, `consentText`, `fields.*.label`, `fields.*.options.*`, `logoText`, `address`                                                                                                                                                                                                  |
| Fora do modo de edição                                                       | `href`, `anchor`, `layout`, `presentation`, ícones, imagens e textos alternativos (não aparecem na página), `media.map.query`, `editorial.postList` (dinâmico), `editorial.postBody` (marcação; fase 3), textos automáticos de contatos, localização e WhatsApp                                                                                                                         |

`minStep` é `-1` para campos de leitura corrida (`body`, `a`, `legal`,
`note`, `consentText`, legendas) e `-2` para os demais. O piso protege o
tamanho legível no celular exigido pelo
[contrato responsivo](../lib/design/responsive.ts).

`multiline` vale só para `editorial.text.body` na fase 1: o renderer já separa
parágrafos por `\n\n`. Os demais corpos são um parágrafo; Enter é ignorado.

### 4.3 Âncoras e estilos no DOM

Um helper `textAttrs(textStyles)` em [components.tsx](../lib/blocks/components.tsx)
e [explorer.tsx](../lib/blocks/explorer.tsx) marca cada elemento de texto com
`data-field="<caminho>"` e, quando o campo tem partes, `data-part="n"`. Quando o
campo tem estilo, o texto é envolvido por
`<span class="site-styled" data-scale="1" style="color:#…">`.

- A escala usa porcentagem no span (`.site-styled[data-scale='1'] { font-size: 115% }`
  em `typography.css`), relativa ao tamanho já calculado do elemento. Assim o
  passo funciona sobre qualquer regra de vibe, versão ou comprimento sem
  disputa de especificidade e sem refatorar os `clamp()` do hero.
- A cor entra como estilo inline no span, como `sectionColorVars` já faz no
  invólucro da seção. Sem estilo, não há span: o HTML dos sites atuais não muda.
- `logoText`, links de navegação e outros campos renderizados duas vezes
  (barra e painel mobile) recebem o mesmo `data-field`; a ilha mantém as
  cópias sincronizadas e a gravação é por caminho.
- Em `EditorialText`, a chave dos parágrafos passa a ser o índice; o prefixo de
  40 caracteres colide quando duas partes começam iguais.

### 4.4 Fundo efetivo e contraste

`sectionBackgrounds(presentation, brand)` em
[section-colors.ts](../lib/blocks/section-colors.ts) devolve os fundos contra os
quais uma cor de texto precisa passar, usando os mesmos tokens de
`themeVars(brand)` que o CSS aplica:

| Seção                     | Fundos avaliados                                                                                                                   |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `presentation.background` | a própria cor                                                                                                                      |
| `tone: paper`             | papel da marca                                                                                                                     |
| `tone: soft`              | `--surface`                                                                                                                        |
| `tone: ink`               | tinta da marca                                                                                                                     |
| `tone: accent`            | primária ajustada por `accessibleAccent`                                                                                           |
| `tone: secondary`         | secundária ajustada                                                                                                                |
| sem tom                   | papel e `--surface` (ritmo alternado e superfície de contraste); a lavagem artística é mistura clara do papel e não muda a decisão |

A regra `texto-contraste` (erro) nasce em `lintTextStyles(page, brand)`,
chamada por `lintSite`, que já recebe a marca no painel e na publicação, e pelo
executor na gravação. Também confere campo inexistente, campo não estilizável e
passo abaixo do mínimo. `lintPage` não muda de assinatura. A ilha mostra a
razão medida no navegador contra o fundo calculado do bloco; o servidor decide.

## 5. Executor compartilhado e rota administrativa

- `savePageEdit` sai de `buildTools` para `lib/sites/edits.ts` como
  `savePageEdit({ tenant, page, blocks, brand })`: recusa novos erros de
  `lintPage` e de `lintTextStyles`, grava com comparação do JSONB e devolve o
  mesmo recibo de hoje. `edit_page` passa a chamá-lo com `activeBrand`; os
  mutadores legados também. Os testes de `tests/admin-page-edits*.test.mjs`
  continuam valendo sem alteração de comportamento.
- Nova rota `POST /api/admin/[tenant]/edit`, ao lado das demais em
  `app/api/admin/[tenant]/`: sessão obrigatória, tenant resolvido por slug no
  servidor, página por `(tenant_id, slug)`; a home usa slug vazio, por isso o
  slug vai no corpo e não na URL.

```ts
{ page: string; revision: string; blocks: { id: string; text?: Record<string, string>; textStyles?: TextStyle[] }[] }
```

O servidor converte o corpo em operações de `applyPageEdit` (`set` por caminho
de texto; `set` ou `unset` de `textStyles` por bloco) e grava por
`savePageEdit`, sem `editPolicy`, porque é ação direta do operador. Respostas:

| Código  | Situação                                                                                       |
| ------- | ---------------------------------------------------------------------------------------------- |
| 200     | `{ ok, changed, revision, preflight, existingErrors, changes }`, o mesmo recibo do `edit_page` |
| 400     | Corpo inválido                                                                                 |
| 409     | Revisão antiga ou gravação concorrente; nenhuma alteração salva                                |
| 422     | Validação: `{ error, fields: [{ block, path, message }] }`, para a ilha destacar os campos     |
| 401/404 | Como as demais rotas administrativas                                                           |

Na página ([page.tsx](<../app/(sites)/s/[tenant]/[[...slug]]/page.tsx>)),
quando `isPreview && query.edit === '1'`: o invólucro recebe
`data-editing="true"`, os dials de movimento são forçados a parado e a ilha
`<InlineEditor page revision fields />` é renderizada depois de `RenderBlocks`,
com `pageRevision(page)` e o inventário calculados no servidor. A página
pública nunca recebe a ilha; `edit` sem `preview` é ignorado.

## 6. A ilha de edição

`lib/blocks/inline-editor.tsx` (componente de cliente) e
`lib/blocks/inline-editor.css`, carregados somente com a ilha. Responsabilidades:

- Encontrar `[data-block-id] [data-field]`, cruzar com o inventário, tornar os
  elementos `contenteditable="plaintext-only"` (com `true` e colagem em texto
  puro como fallback), com `role="textbox"`, `aria-label` do rótulo,
  `aria-multiline`, contorno visível e ordem de Tab.
- Suspender o que atrapalha editar: cliques em links, botões e abas não
  navegam nem trocam painel (captura de `click`); movimento parado; botão
  flutuante de WhatsApp oculto; menu mobile fechado.
- Guardar o estado por `${blockId}:${path}` com valor original, atual e estilo.
  O DOM é a vista; o mapa é a fonte da verdade. `input` sincroniza cópias do
  mesmo campo; um `MutationObserver` reaplica o valor se um componente de
  cliente remontar o nó. Leitura sempre por `textContent`, nunca HTML; espaços
  normalizados. Enter em campo de uma linha é ignorado; em `multiline`, cria
  uma nova parte clonando o parágrafo, e Backspace no início mescla com a
  anterior.
- Barra flutuante junto ao campo em foco, ancorada no rodapé da viewport
  abaixo de 640 px: rótulo, contador `n/max` (o headline mostra também as
  linhas estimadas, 28 caracteres por linha), A− e A+ com o passo atual, cores
  Automático, Tinta, Apoio, Destaque, Primária e Secundária mais um seletor
  hex, razão de contraste medida com ✓ ou ✗, e **Restaurar** para voltar ao
  texto e estilo originais do campo.
- Validação local antes de habilitar Salvar: máximo do schema, campo vazio,
  headline em duas linhas, subtexto em 20 palavras, travessão e contraste. O
  servidor continua decidindo.

Protocolo entre iframe e workspace por `postMessage`, com
`event.origin === location.origin` conferido dos dois lados e
`type: 'eixu-edit/1'`:

| Sentido          | Mensagem                                                                  |
| ---------------- | ------------------------------------------------------------------------- |
| ilha → workspace | `ready { page, revision, fields }`                                        |
| ilha → workspace | `state { changed, invalid: [{ block, path, message }] }` a cada alteração |
| ilha → workspace | `changes { page, revision, blocks }` em resposta a `collect`              |
| ilha → workspace | `save` quando o operador usa Ctrl/Cmd+S dentro da prévia                  |
| workspace → ilha | `collect`, `errors { fields }` após um 422, `discard`                     |

## 7. Workspace

Em [workspace.tsx](<../app/(admin)/admin/[tenant]/workspace.tsx>):

- Estado `editing: 'off' | 'on' | 'saving'`. **Editar** entra no grupo
  `decision`, antes de Publicar, quando
  `site.tenant.status === 'published'`, há página em foco e `!locked && !generating`.
  Ao entrar, o celular muda para a vista **Prévia** e o iframe recarrega com
  `&edit=1`; a barra mostra a pílula `editando /slug` depois do `ready`.
- Durante a edição, `decision` mostra **Salvar** (primário, habilitado com
  `changed` e sem `invalid`) e **Cancelar**; Publicar some. O compositor fica
  desabilitado com a dica "Salve ou cancele a edição na prévia para usar a
  conversa"; o seletor de página fica desabilitado; Desktop/Celular continua
  funcionando, porque só muda a largura do iframe; abrir em outra aba abre sem
  `edit`.
- Salvar: `collect` → `POST /edit` → 200 mostra "Alterações salvas no
  rascunho. Publique para levar ao site no ar.", chama `refresh()`,
  `previewRevision` muda, o iframe recarrega sem `edit` e o modo termina. 409
  mostra o motivo com o botão **Recarregar a prévia**, avisando que as
  alterações não salvas serão perdidas. 422 encaminha `errors` à ilha e mantém
  o modo.
- Cancelar com alterações pede confirmação, como o formulário de Dados; depois
  recarrega sem `edit`. `beforeunload` protege a aba enquanto houver alteração.
- Enquanto `editing !== 'off'`, `applySite` não incrementa `nonce`: uma
  mudança vinda de outra aba ou de um refresh do laço de geração recarregaria o
  iframe e apagaria a edição. O incremento fica pendente e um aviso diz que a
  página mudou; ao salvar, o servidor responde 409 e o fluxo acima trata.

## 8. Fora do escopo da fase 1

- Formatação de trecho (negrito, cor em uma palavra), família de fonte,
  alinhamento e espaçamento.
- `editorial.postBody` (títulos `##` e listas), `editorial.postList`, textos
  automáticos de contatos e localização, imagens e textos alternativos, que
  continuam pela biblioteca e pelo chat.
- Histórico ou desfazer além de **Restaurar** por campo; edição simultânea (a
  proteção de versão detecta e recusa, não mescla).
- Publicar ao salvar; edição fora da prévia autenticada.

## 9. Riscos e mitigações

| Risco                                                                                                                          | Mitigação                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Texto em nós geridos pelo React (dentro de `MotionLink`, explorer, menu mobile); uma remontagem apaga o que o operador digitou | Mapa de valores como fonte da verdade, `MutationObserver` reaplicando, abas e menu suspensos em edição; teste de navegador passa o mouse no CTA e tenta trocar aba com texto alterado |
| Recarga da prévia no meio da edição, por outra aba ou pelo laço de geração                                                     | Fila do `nonce` e aviso (seção 7); o servidor recusa revisão antiga                                                                                                                   |
| Contraste medido no cliente diverge do calculado no servidor em seções sem tom                                                 | Servidor decide; a ilha mostra a medição; o teste compara os dois para todos os tons explícitos e para seções sem tom nas quatro vibes                                                |
| Especificidade das regras de hero por vibe e comprimento                                                                       | Escala em porcentagem dentro do elemento; o teste mede `font-size` calculado antes e depois em quatro vibes e exige passo 0 idêntico ao atual                                         |
| Bundle da página pública                                                                                                       | Ilha e CSS entram só na prévia com `edit=1`; teste confere que o HTML público sem estilos é igual ao atual                                                                            |
| `strings()` do lint percorre `textStyles` (caminho e cor)                                                                      | Caminhos e hex não casam com filler nem placeholders; teste cobre                                                                                                                     |
| `plaintext-only` sem suporte em algum navegador                                                                                | Fallback `contenteditable="true"` com `paste` em texto puro e leitura por `textContent`                                                                                               |
| Operador digita além do limite ou apaga um campo obrigatório                                                                   | Contador, bloqueio do Salvar e destaque do campo; 422 do servidor como segunda barreira                                                                                               |

## 10. Fases e aceite

### Fase 1: contrato, renderer e rota (PR A, sem interface)

1. `textStyles` no schema e no catálogo do prompt.
2. `lib/blocks/fields.ts` com o inventário e o teste inventário ↔ DOM.
3. `textAttrs` em todos os componentes; `.site-styled` em `typography.css`;
   chave por índice nos parágrafos.
4. `sectionBackgrounds` e `lintTextStyles`, ligados em `lintSite` e no executor.
5. `savePageEdit` em `lib/sites/edits.ts`; `edit_page` e mutadores legados
   passam a usá-lo.
6. Rota `POST /api/admin/[tenant]/edit`.

Aceite: `test:sites` e `test:admin` verdes, incluindo novos casos para schema,
inventário, contraste por tom, passo mínimo, HTML público inalterado sem
estilos, rota em 401/404/409/422/200 e `published_blocks` intocado; lint global,
tipos e `build:vercel` passam. Esta fase já permite pedidos de tamanho e cor
pelo chat.

### Fase 2: ilha e workspace (PR B)

1. `page.tsx` com `edit=1`, `data-editing` e movimento parado.
2. `InlineEditor` e seu CSS; protocolo `postMessage`.
3. Botões, estados, avisos e proteções no workspace.

Aceite em navegador, com HTML de servidor, hidratação real e CSS do build:

- Sites (`tests/browser/site-inline-edit.test.mjs`, fixture a partir de
  `navigation-fixture.mjs`): entrar no modo, editar headline e parágrafo,
  Enter criando parte, colar texto com marcação virando texto puro, cópias
  sincronizadas do menu, tamanho medido por passo nas quatro vibes, cor com
  contraste aprovado e recusado, links e abas bloqueados, teclado (Tab, Esc,
  Ctrl+S), `collect` devolvendo só o que mudou, em 1440 e 390 px, sem overflow
  nem erro de console.
- Admin (`tests/browser/admin-handoff.test.mjs`, com a API simulada
  respondendo `/edit`): Editar só com cliente publicado; troca para
  Salvar/Cancelar; Publicar e compositor bloqueados; 200 sai do modo e
  recarrega; 409 e 422 mostram os avisos previstos; Cancelar com alteração
  pede confirmação.
- Ensaio manual com `next dev`, banco de desenvolvimento e um cliente de
  teste: editar, salvar, ver o rascunho recarregado, publicar e conferir a
  página pública. Capturas em `outputs/inline-edit/`.

### Fase 3: opcional

`editorial.postBody` com partes marcadas por prefixo; **Salvar e publicar**
reutilizando `publishSite(tenant, slug)`; Editar também em rascunho; casos de
tamanho e cor no `eval:edits`.

## 11. Validação

Os comandos são os já registrados em [Verificação](verification.md#comandos-existentes):

```bash
npm run lint
npm run test:sites
npm run test:admin
npx next typegen && npx tsc --noEmit
npm run build:vercel
npm run test:sites:browser
npm run test:admin:browser
git diff --check
npm run format -- --check README.md AGENTS.md docs
```

Sem migração, seed, geração paga ou escrita em cliente real. A publicação do
código segue o fluxo Git/Vercel documentado e não publica páginas de clientes.
Testes com dados sintéticos não substituem o ensaio manual da fase 2.

## 12. Documentação a atualizar na entrega

- [Manual do operador](admin.md): seção "Editar na prévia" em "Gerar e editar o
  site", com limites e o passo Publicar.
- [Arquitetura](architecture.md): item de edição e publicação, rota na tabela
  de superfícies e limites (sem trecho, sem post, sem desfazer).
- [Design](design.md): `textStyles`, `.site-styled` e o fundo efetivo em "Piso
  de composição"; a barra de edição em "Interface de operação do admin".
- [Contrato de edição](chat-edits.md): executor compartilhado e `textStyles`
  no `edit_page`.
- [Verificação](verification.md): registro da validação com evidências.
- [README](../README.md): uma linha em "O que já existe".
- [AGENTS.md](../AGENTS.md): nada previsto. Se o contrato virar invariante,
  uma linha em "Invariantes do produto" sobre tamanho por passo e cor com
  contraste, nunca CSS livre.
