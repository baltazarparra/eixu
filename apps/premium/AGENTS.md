# Projetos Premium da EIXU

Leia [SOUL.md](SOUL.md) para a identidade do Creative Developer e use a skill local `premium-frontend` em mudanças de composição visual. O `AGENTS.md` dentro de cada projeto registra endereço, comandos e limites específicos.

## Responsabilidades

O código em `apps/premium/<project-key>` é a implementação pública do cliente. O agente mantém composição, componentes, CSS, integrações e o contrato editorial. O operador mantém pelo CMS os campos declarados em `content/editor.json`.

Uma mudança estrutural que cria, remove ou renomeia conteúdo editável deve atualizar o contrato sem perder valores publicados. Chaves editoriais são estáveis. Acrescentar campo com valor inicial é compatível; remover ou alterar sem migração exige tratar o conteúdo existente.

O site usa `EIXU_PREMIUM_TOKEN` apenas no servidor para buscar conteúdo e encaminhar leads, eventos e WhatsApp. Preserve host canônico, isolamento por projeto e o fallback local das visitas públicas: indisponibilidade momentânea da plataforma não deve apagar a última composição empacotada. A prévia autenticada falha de modo visível quando não consegue confirmar o rascunho.

## Fluxo

1. Leia o briefing disponível, a direção atual, `content/editor.json` e a página renderizada.
2. Defina ou revise a direção antes de remodelar.
3. Implemente a menor mudança completa, incluindo estados e contrato editorial.
4. Rode os comandos do projeto e observe desktop, celular, teclado e movimento reduzido.
5. Revise o diff, a prévia CMS e a URL pública pertinente antes de entregar.

Não exponha tokens nem copie dados operacionais para o projeto. Conteúdo comercial usa fatos verificáveis. O merge em `main` dispara o workflow Premium; confira o deployment do SHA, o domínio canônico e o callback da release.

## Consumo do projeto

O histórico de custo continua no mesmo tenant depois da conversão. Antes de
trabalhar, identifique o slug e dedique a sessão a esse cliente. Siga
[Coleta de consumo](../../docs/project-usage.md): `npm run usage:sync` extrai
recibos de Codex/Claude ou de serviços externos, sem enviar mensagens.
Execute a coleta contínua durante o trabalho quando o ambiente de destino já
estiver autorizado e faça uma sincronização final após o último recibo.
Inclua arquivos próprios dos subagentes e ferramentas pagas; não atribua uma
sessão compartilhada inteira a um cliente. Trabalho no harness geral da EIXU
não é custo exclusivo de um cliente. Sem log, vínculo ou credencial disponível,
registre a limitação na entrega; nunca invente tokens ou custo zero.
