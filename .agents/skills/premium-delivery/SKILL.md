---
name: premium-delivery
description: Converter um site da EIXU para Premium ou entregar uma atualização de um projeto Premium existente com contrato editorial, PR, release Vercel e URL canônica verificados. Use para conversão, manutenção estrutural, recuperação ou publicação em apps/premium; não use para uma troca rotineira de texto ou imagem já atendida pelo CMS.
---

# Premium Delivery

Identifique primeiro o `project-key`, o host canônico e o modo atual do tenant.
Leia `docs/plano-projetos-premium.md`, `apps/premium/AGENTS.md` e o `AGENTS.md`
do projeto quando ele já existir. Mudanças de direção visual também usam a skill
`premium-frontend`.

## Escolha o caminho certo

- **Conversão inicial:** inicie pelo botão Premium no painel. O snapshot
  publicado é a fonte e o workflow cria a pasta e a PR. Não monte a pasta à mão
  nem reexecute o exportador sobre um projeto existente.
- **Conteúdo editorial:** se texto ou imagem já consta em
  `content/editor.json`, publique pelo CMS. O valor salvo no CMS prevalece sobre
  o default versionado; editar somente esse default não atualiza o site ativo.
- **Código Premium:** layout, componentes, comportamento, integrações, SEO e
  campos editoriais novos vivem em `apps/premium/<project-key>` e seguem por PR.

Durante uma conversão, confira o estado persistido e a execução correspondente
antes de repetir qualquer ação. Uma falha anterior à ativação deve conservar o
runtime do gerador. Uma pasta já materializada é evidência para investigar, não
alvo para nova exportação.

## Atualize um projeto

Parta de `main` atual e limite o diff ao cliente. Leia a implementação renderizada
e o contrato editorial antes de mudar código. Preserve a ponte server-side,
formulário, eventos, WhatsApp, host e fallback público.

Chaves de `content/editor.json` são identidade de conteúdo, não rótulos
descartáveis. Campos novos podem começar pelo valor empacotado. Não remova,
renomeie nem reutilize uma chave enquanto houver conteúdo publicado sem entregar
uma migração compatível. Mudar o default de uma chave existente não substitui o
valor já publicado pelo CMS.

Valide o projeto com um comando:

```bash
npm run premium:check -- <project-key>
```

Observe também a página real em desktop e celular, teclado e movimento reduzido.
Exercite as rotas afetadas; mudanças em formulário, tracking ou WhatsApp exigem
o caminho completo até a ponte central em ambiente autorizado.

## Entregue e confira

Revise o diff e abra a PR com o projeto e os checks executados. Depois do merge
autorizado, acompanhe `Premium release` até terminar. O workflow deve criar o
deployment sem mover o domínio, esperar `READY`, testar sua URL imutável e só
então apontar o host canônico.

Conclua apenas com estas evidências da mesma revisão:

- commit de `main` que contém a mudança;
- execução verde do workflow para esse commit e projeto;
- deployment `READY` criado a partir desse commit;
- host canônico respondendo depois da promoção;
- callback da release aceito pela plataforma;
- prévia CMS e URL pública coerentes quando o contrato editorial mudou.

Se o deployment falhar antes da promoção, mantenha o domínio no release anterior
e corrija a causa. Se falhar depois da promoção, preserve os identificadores da
execução e do deployment para recuperação; não repita conversão nem sobrescreva
a pasta.
