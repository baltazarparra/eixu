# Plano: envio de imagens pelo painel, sem restrições

> Histórico: diagnóstico, proposta ou ensaio daquela versão. Não é contrato vigente nem confirmação de produção. Consulte o [índice](../README.md) e a [verificação atual](../verification.md). Artefatos de `outputs/` são locais e podem não acompanhar o checkout.

Pedido de 12/09/2026: a página de imagens (`/admin/[tenant]/imagens`) deve
permitir o envio de uma imagem do computador do operador, sem restrições.
Análise original sobre `main` (`8ab02d1`). **Estado posterior:** o upload da biblioteca foi entregue no PR #43, com limites de 4 MB, 40 megapixels e formatos estáticos JPG/PNG/WebP/AVIF. O texto abaixo preserva a proposta original, inclusive alternativas que não viraram produto. O contrato vigente está no [manual](../admin.md#biblioteca-e-publicação) e na [arquitetura](../architecture.md#imagens-e-logos).

## 1. O que existe hoje

- A página `app/(admin)/admin/[tenant]/imagens/page.tsx` carrega guia, acervo,
  logo e uso; `images-library.tsx` renderiza filtros (Todas, Fotos, Logos,
  Rejeitadas), cartões numerados e as ações **Usar como logo**, **Usar no
  site**, **Solicitar alteração** e **Apagar**. Não há entrada de arquivo. As
  fotos numeradas vêm da geração; logos e anexos também podem ser enviados
  pelos caminhos descritos abaixo, sem entrar no acervo.
- `app/api/admin/[tenant]/images/route.ts` atende GET (estado da biblioteca),
  PATCH (só `alt`, até 140 caracteres) e DELETE (recusa imagem em uso por
  `referenceReason`, apaga o Blob e depois a linha).
- Já existe um envio de arquivo em `app/api/admin/[tenant]/upload/route.ts`:
  `formData`, cinco tipos em `UPLOAD_TYPES`, teto de 8 MB em
  `UPLOAD_MAX_BYTES`, gravação por `putTenantBlob` sob `FOR KEY SHARE`. É usado
  pelos anexos do chat (`workspace.tsx`) e pelo logo em Dados
  (`settings-form.tsx`). O arquivo vai para `tenants/<slug>/media/` ou
  `tenants/<slug>/logo/` e **não entra na tabela `images`**: não ganha número,
  não aparece no acervo, não pode ser pedido por número no chat.
- A tabela `images` (`db/schema.sql`) exige `model`, `prompt_final`,
  `batch_id`, `request_text` e `ratio`; `width` e `height` existem e nunca são
  preenchidos. `insertImage` reserva o número no próprio insert e grava
  `disponivel`.
- `lib/images/generate.ts` converte toda foto gerada em WebP de até 1600 px
  (qualidade 82) antes de subir, para não derrubar o LCP do site do cliente, e
  grava em `gerado/<batch>/<n>.webp`. `generatedPhotos` em `lib/taste/metrics.ts`
  só conta `blobPath` com `/gerado/`; o piso da home ("2 fotos geradas
  distintas") exclui uploads por construção. `sceneCoverage` em
  `lib/images/scene-plan.ts` cobre uma vaga com qualquer imagem cuja proporção
  esteja em `RATIOS`.
- O agente enxerga a biblioteca por `list_images` e pelo resumo no prompt
  (`lib/taste/prompt.ts`). `update_image` chama `reviseImage`, que exige
  proporção em `RATIOS` e baixa a original por `fetchReference`, com teto de
  8 MB.
- Acesso: sessão obrigatória, tenant resolvido no servidor pelo slug, escopo
  por `tenant_id`. `canApplyLogo` aceita logo da biblioteca ou arquivo no
  caminho `tenants/<slug>/logo/`. Arquivos no Blob são públicos.

## 2. O que "sem restrições" significa aqui

| Cai                                                     | Fica, porque é invariante do produto e não regra do envio                                             |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Lista de cinco tipos aceitos                            | Sessão obrigatória e escopo do tenant: o arquivo só entra no prefixo `tenants/<slug>/`                |
| Teto de 8 MB                                            | Exclusão bloqueada enquanto a imagem estiver em rascunho, publicado ou logo                           |
| Aprovação ou crítica antes de ficar disponível          | Snapshots publicados não mudam; uma imagem nova só entra no site por edição ou publicação             |
| Dependência do guia de imagem                           | O arquivo precisa ser imagem: `image/*` ou extensão conhecida de imagem (heic, tif, psd, raw, bmp...) |
| Limite de quantidade por envio ou proporção obrigatória | Numeração, uso por número no chat e "nova versão preserva a original" continuam iguais                |

Limites de objeto, partes, memória e duração pertencem à plataforma e precisam
ser verificados no destino antes de implementar. A versão web continua proposta
como melhor esforço (§3.2); “sem restrições” não significa capacidade infinita. Recusar arquivo que
não é imagem é a única regra mantida; se o operador quiser aceitar qualquer
arquivo, é uma linha em `lib/images/upload.ts` (§6).

## 3. Desenho

### 3.1 Caminho do arquivo: do navegador direto ao Blob

Passar o arquivo pela função (`formData`) sujeita o envio ao limite de corpo
configurado na plataforma e mantém o arquivo em memória. O caminho proposto
é enviar do navegador diretamente ao Blob com token de cliente, evitando o
corpo da função, mas ainda sujeito aos limites do serviço. O SDK
instalado oferece esse fluxo pelo export `@vercel/blob/client`. Confira os
limites e a API da versão resolvida antes da implementação.

1. O operador escolhe ou arrasta N arquivos. A interface cria um `batchId`
   (`crypto.randomUUID()`) para o lote.
2. Para cada arquivo, `upload()` de `@vercel/blob/client` com
   `handleUploadUrl: /api/admin/<slug>/images/upload`, `multipart` a partir de
   10 MB, `clientPayload` com `kind`, `batchId` e índice, e `onUploadProgress`
   alimentando a barra do arquivo. Os envios rodam em série, um arquivo por vez,
   para não disputar banda e para manter a numeração previsível.
3. Rota nova `app/api/admin/[tenant]/images/upload/route.ts` executa
   `handleUpload`. Em `onBeforeGenerateToken`: exige sessão, resolve o tenant
   pelo slug e valida o `pathname` contra
   `tenants/<slug>/enviadas/<batchId>/<n>-<nome-limpo>.<ext>` (regex, sem `/`
   extra, nome por `uploadFileName`). Não define `allowedContentTypes` nem
   `maximumSizeInBytes`; `validUntil` de uma hora, `addRandomSuffix: false`,
   `allowOverwrite: false`. O evento `blob.upload-completed` não é usado: o
   callback não alcança `localhost` e o registro explícito do passo 4 é o único
   caminho de escrita no banco.
4. Registro: `POST /api/admin/[tenant]/images` com `pathname`, `url`, `kind`,
   `name`, `size`, `type`, `width` e `height` (dimensões lidas no navegador
   quando ele consegue decodificar; são dica, não fonte de verdade). O servidor
   exige sessão, resolve o tenant, confere o prefixo do `pathname` e o host
   `*.public.blob.vercel-storage.com`, chama `head(url)` para obter tamanho e
   content-type do próprio Blob e, sob `withTenantLock(tenantId, 'upload')`,
   gera a versão web (§3.2) e chama `insertImage` com `origin: 'enviada'`. Se o
   tenant não existe mais (`TenantRemovedError`), apaga o arquivo enviado e
   responde 404. Resposta 201 com a imagem; a interface recarrega a biblioteca
   e o cartão aparece com número.
5. Falha em qualquer etapa fica no item daquele arquivo, com o motivo; os demais
   continuam. Um arquivo enviado ao Blob cujo registro falhou é apagado pelo
   servidor quando a falha é dele; quando o navegador fecha antes do registro,
   fica um órfão no prefixo do tenant (§6).

### 3.2 Versão web e original

A geração já protege o LCP convertendo para WebP de até 1600 px. O envio segue
a mesma regra, sem tocar no arquivo do operador: o original fica guardado e a
versão web é a URL que o site usa.

| Caso                                                 | `url` (usada no site)               | `original_url`  | Cartão                                               |
| ---------------------------------------------------- | ----------------------------------- | --------------- | ---------------------------------------------------- |
| Foto em JPEG, PNG, WebP, TIFF ou AVIF                | WebP ≤ 1600 px, qualidade 82        | Arquivo enviado | Prévia, proporção, **Baixar original**               |
| GIF                                                  | Arquivo enviado (preserva animação) | null            | Prévia                                               |
| SVG                                                  | Arquivo enviado                     | null            | Prévia                                               |
| Logo, qualquer formato                               | Arquivo enviado, sem recompressão   | null            | Prévia em fundo xadrez, **Usar como logo**           |
| Sem decodificação (HEIC/HEIF, PSD, RAW, BMP...)      | Arquivo enviado                     | null            | Sem prévia; nome, tamanho e aviso de formato         |
| Falha ou teto do Sharp (memória, `limitInputPixels`) | Arquivo enviado                     | null            | Prévia se o navegador exibir; aviso "sem versão web" |

A versão web é melhor esforço: acima de 80 MB ou quando o Sharp falha, o
original vira a `url` e o cartão avisa que o site pode carregar devagar ou não
exibir o formato. O Sharp pré-compilado do projeto decodifica JPEG, PNG, WebP,
GIF, TIFF, AVIF e SVG; não decodifica HEIC (HEVC), PSD nem RAW. `putImage`
(otimização pela Vercel, exige OIDC e é cobrado por transformação) resolveria
memória, mas adiciona credencial e custo; fica como alternativa se a função
estourar memória em uso real.

Novo módulo `lib/images/upload.ts`: `uploadPathname()` (monta e valida o
caminho), `isImageFile()` (content-type ou extensão), `webVersion()` (decide e
gera a derivada) e `registerUpload()` (o passo 4). `lib/images/ratios.ts` ganha
`nearestRatio(width, height)`: devolve a proporção de `RATIOS` cujo fator fica
em 1,15 (mesma tolerância de `ratioFits`) ou, fora disso, a fração reduzida
("3:2", "3:1"); sem dimensões, `desconhecida`, e o cartão oculta a etiqueta.

### 3.3 Dados

Colunas novas em `db/schema.sql`, no padrão `add column if not exists`:

```sql
alter table images add column if not exists origin             text not null default 'gerada'; -- 'gerada' | 'enviada'
alter table images add column if not exists original_url       text;                           -- arquivo enviado, quando url é a versão web
alter table images add column if not exists original_blob_path text;
alter table images add column if not exists file_meta          jsonb not null default '{}'::jsonb; -- {name, size, type}
```

`width` e `height` passam a ser preenchidos para envios. Valores fixos da
linha: `model = 'upload'`, `prompt_final = ''`, `request_text` = nome do
arquivo, `target_block = null`, `batch_id = batchId` do lote, `kind` conforme a
escolha da interface, `status = 'disponivel'`. `insertImage` recebe os campos
novos como opcionais; `toImage` e `TenantImage` (`lib/types.ts`) expõem
`origin`, `originalUrl`, `width`, `height` e `fileMeta`.

Exclusão: DELETE apaga `url` e, quando houver, `original_url`, e só então a
linha; `referenceReason` confere as duas URLs em páginas e marca. A exclusão do
cliente já varre o prefixo `tenants/<slug>/` por `deleteTenantBlobs`, o que
inclui `enviadas/`. `npm run db:migrate` precisa rodar antes do deploy que
dependa das colunas; conforme AGENTS.md, confirmar recurso e escopo antes de
migrar.

### 3.4 Interface da página

- **Enviar imagens** vira a ação primária em `admin-page-actions`, ao lado de
  **Editar guia** e **Gerar imagens**, ligada a um `input type="file" multiple`
  com `accept="image/*"` como dica do seletor, não como bloqueio. Um
  `SegmentedControl` "Enviar como: Foto | Logo" define o `kind`; padrão Foto.
- O acervo aceita soltar arquivos (`admin-image-collection[data-dragover]`),
  com o botão como caminho por teclado; arrastar nunca é o único jeito.
- Lista de envios em andamento acima da grade: nome, tamanho, barra de
  progresso e estado (enviando, registrando, disponível como #n, falha com
  motivo), em `output` com `aria-live="polite"`. Cada arquivo registrado já
  aparece na grade com número, sem esperar o lote.
- Filtro ganha **Enviadas**. O cartão de imagem enviada mostra `enviada · nome
· 2,3 MB` na linha de meta, a proporção quando conhecida, **Baixar original**
  quando houver versão web e o aviso de formato quando não há prévia. O texto
  alternativo fica editável no cartão (o PATCH já existe), porque envio não
  passa pelo crítico e chega sem `alt`.
- Estado vazio ganha a ação **Enviar imagens** ao lado de **Definir guia na
  conversa**.
- Copy em português simples: "Enviar imagens", "Enviando 2 de 5", "Imagem #12
  disponível", "Não foi possível enviar foto.heic: ...". A palavra "upload"
  fica fora da interface (`lib/copy/lint.ts` a lista como sinal).
- CSS no bloco das imagens de `app/(admin)/admin.css`, validado em 320, 390 e
  1440 px como o restante do painel.

### 3.5 Chat e geração

- `list_images` e o resumo da biblioteca no prompt passam a informar `origem`
  (`gerada` ou `enviada`), nome do arquivo e dimensões. Instrução no prompt:
  foto enviada é registro real do negócio; quando o pedido fala em "minhas
  fotos" ou "foto que enviei", usar a enviada em vez de gerar.
- **Solicitar alteração** sobre uma enviada funciona quando a proporção está em
  `RATIOS`; `reviseImage` passa a usar a versão web como referência, que sempre
  cabe no teto de 8 MB de `fetchReference`. Proporção fora da lista devolve a
  mensagem já existente, sem gerar.
- No PR 1, `sceneCoverage` e `generatedPhotos` recebem o filtro explícito
  `origin !== 'enviada'`: envio não cobre vaga do plano nem conta para o piso
  da home. Isso conserva o comportamento atual do gerador e deixa a mudança de
  regra para uma decisão registrada (§6, PR 2).
- Logo enviado com `kind = 'logo'` mostra **Usar como logo** no cartão;
  `/settings` aceita porque `canApplyLogo` recebe o registro da biblioteca.
- `/api/admin/[tenant]/upload` (anexos do chat e logo em Dados) não muda neste
  plano; unificar no mesmo caminho é o PR 3.

## 4. Sequência

| PR  | Conteúdo                                                                                                    | Depende de            |
| --- | ----------------------------------------------------------------------------------------------------------- | --------------------- |
| 1   | Schema, rota de token, registro, versão web, interface, testes, documentação                                | Nada                  |
| 2   | Foto enviada cobre vaga do plano e conta para o piso da home; prompt orienta preferir foto real             | Decisão em §6         |
| 3   | Descrição e `alt` automáticos por chamada única ao crítico; anexos do chat e logo em Dados no mesmo caminho | Decisão em §6 (custo) |

Arquivos do PR 1:

| Arquivo                                                 | Mudança                                                           |
| ------------------------------------------------------- | ----------------------------------------------------------------- |
| `db/schema.sql`                                         | Quatro colunas de §3.3                                            |
| `lib/types.ts`                                          | Campos novos em `TenantImage`                                     |
| `lib/images/queries.ts`                                 | `toImage`, `insertImage`, `referenceReason` com `original_url`    |
| `lib/images/ratios.ts`                                  | `nearestRatio`                                                    |
| `lib/images/upload.ts` (novo)                           | Caminho, tipo, versão web e registro                              |
| `lib/images/revise.ts`                                  | Referência pela versão web                                        |
| `lib/images/scene-plan.ts`, `lib/taste/metrics.ts`      | Filtro explícito `origin !== 'enviada'`                           |
| `lib/ai/tools.ts`, `lib/taste/prompt.ts`                | `origem`, nome e dimensões em `list_images` e no resumo           |
| `app/api/admin/[tenant]/images/upload/route.ts` (novo)  | `handleUpload` com validação de sessão, tenant e caminho          |
| `app/api/admin/[tenant]/images/route.ts`                | POST de registro; DELETE apaga os dois arquivos                   |
| `app/(admin)/admin/[tenant]/imagens/images-library.tsx` | Botão, escolha de tipo, área de soltar, progresso, filtro, cartão |
| `app/(admin)/admin.css`                                 | Estilos dos itens novos                                           |
| `tests/admin-images-upload.test.mjs` (novo)             | Casos de §5                                                       |
| `tests/browser/admin-handoff.test.mjs` e fixture        | Fluxo de envio com interceptação                                  |
| `docs/admin.md`, `docs/architecture.md`, `README.md`    | Manual, rotas, limites                                            |

## 5. Verificação

Automática, no PR 1:

- `npx next typegen && npx tsc --noEmit`, `npm run lint`, `npm run build:vercel`.
- `tests/admin-images-upload.test.mjs`, executado por `npm run test:admin`,
  com `loadModule` e Blob/banco simulados: `nearestRatio` (4:5, 5:6, 16:9,
  4:3, 1:1, fração reduzida, sem dimensões); `uploadPathname` recusa outro
  tenant, outro host, `..` e subpasta extra; `isImageFile` por content-type e
  por extensão; matriz de §3.2 (JPEG vira WebP e guarda original, GIF, SVG,
  logo e HEIC ficam como enviados); registro sob lock e apagamento do arquivo
  quando o tenant sumiu; tamanho e tipo vindos de `head`, não do cliente;
  DELETE apaga `url` e `original_url`; `referenceReason` encontra a original;
  `generatedPhotos` e `sceneCoverage` ignoram `origin = 'enviada'`;
  `list_images` expõe `origem`.
- `npm run test:sites` sem regressão em uso, substituição e piso da home.
- Navegador, na fixture de `tests/browser/admin-handoff.test.mjs`: o botão
  abre o seletor, soltar um arquivo mostra o item em progresso, o PUT ao Blob e
  o registro são interceptados por `page.setRequestInterception`, o cartão
  aparece com número, o filtro **Enviadas** funciona, sem overflow em 320, 390
  e 1440 px e sem erro de console.

Real, antes do merge, com o Blob e o Neon de desenvolvimento do `.env.local`:
JPEG de câmera com 30 MB, PNG de logo com alfa, SVG, GIF animado, HEIC e TIFF
com mais de 100 MB. Conferir número, URL, versão web, cartão, **Baixar
original**, exclusão e bloqueio em uso; depois do deploy, repetir um envio em
produção e um smoke nas páginas públicas. Evidências em
`outputs/upload-imagens/` (ignorado pelo Git) e registro em
[Verificação](../verification.md). Nada neste plano gera imagem paga; um ensaio
real de **Solicitar alteração** sobre uma foto enviada chama o GPT Image 2 e
depende de autorização.

## 6. Riscos e decisões que ficam com o operador

- **Foto enviada no gerador.** Hoje o piso da home exige duas fotos geradas e
  ignora envios; um site montado só com fotos reais do cliente não publica. A
  recomendação é o PR 2: contar enviada como foto do cliente no piso e na
  cobertura de vagas, porque foto real é evidência e imagem gerada é proposta
  (SOUL.md). Até lá, a mensagem do gate continua a atual.
- **Arquivo que não é imagem.** O plano recusa PDF, ZIP e afins com mensagem
  clara. Liberar tudo é trocar `isImageFile` por `true`; a grade e os blocos do
  site não têm como exibir esses arquivos.
- **Janela sem lock.** O envio direto ao Blob acontece fora de
  `withTenantLock`; só o registro entra no lock. Excluir o cliente durante um
  envio pode deixar um arquivo órfão em `tenants/<slug>/enviadas/` se o
  navegador fechar antes do registro. O token vale uma hora e o registro apaga
  o arquivo quando o tenant não existe mais; não há varredura periódica.
- **Formato sem prévia.** HEIC, PSD e RAW entram no acervo, mas o navegador
  não os exibe e o site também não. O cartão avisa; a versão web é o que
  protege o LCP nos formatos decodificáveis.
- **Espaço no Blob.** Foto com versão web ocupa original mais derivada. Não há
  chamada de modelo por padrão; descrição automática é o PR 3 e é paga.
- **Rota antiga de upload.** Continua com 8 MB e cinco tipos, e declara um
  teto acima dos 4,5 MB históricos da função; não foi verificado se envios
  entre 4,5 e 8 MB passam em produção. O PR 3 leva anexos e logo em Dados para
  o caminho novo.

## 7. Critérios de aceitação do PR 1

- Na página de imagens, o operador envia um ou vários arquivos pelo botão ou
  arrastando; cada um vira cartão numerado e disponível assim que o registro
  termina, sem aprovação e sem depender do guia.
- Nenhum tipo ou tamanho de imagem é recusado; formatos sem prévia entram com
  aviso. Só arquivo que não é imagem recebe recusa.
- O arquivo só é gravado em `tenants/<slug>/enviadas/`, com sessão válida; o
  registro usa tamanho e tipo do Blob e roda sob o lock do tenant.
- Foto decodificável ganha versão web para o site e mantém o original para
  download; logo, GIF e SVG ficam como enviados.
- Apagar remove os dois arquivos e continua bloqueado quando a imagem está em
  uso. A versão publicada não muda.
- `list_images`, o prompt e **Solicitar alteração** tratam a enviada pelo
  número, como qualquer imagem; o gerador não muda de comportamento até o PR 2.
- Testes de §5 verdes, build de produção verde, ensaio real registrado em
  [Verificação](../verification.md) e manual do operador atualizado.
