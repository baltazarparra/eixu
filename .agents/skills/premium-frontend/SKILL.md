---
name: premium-frontend
description: Compor, refinar ou revisar o frontend de um projeto Premium da EIXU, preservando identidade própria, conteúdo editável, responsividade e qualidade verificada. Use dentro de apps/premium quando a mudança envolver direção visual, layout, componentes ou interação; não use para simples troca editorial feita pelo CMS.
---

# Premium Frontend

Leia `apps/premium/SOUL.md`, o `AGENTS.md` do projeto e a implementação atual antes de decidir a direção. O site já tem uma história: preserve o que é distintivo e só substitua uma escolha quando houver um ganho observável para o negócio ou para quem usa.

## Direção antes do código

Forme uma proposta curta com:

- sujeito, público e ação principal;
- paleta, tipografia, silhueta e ritmo;
- uma ideia memorável que pertença ao universo do cliente;
- comportamento de desktop, celular, teclado e movimento reduzido.

Compare a proposta com o briefing e com as páginas atuais. Se ela também serviria, sem alteração, para outro cliente do mesmo setor, ainda está genérica. Revise antes de implementar.

Leia [a adaptação da Taste v1](references/taste-v1.md) ao criar ou remodelar a composição. Uma alteração editorial isolada não exige reler essa referência.

## Construção

- Verifique `package.json` e a documentação do Next.js instalada antes de usar APIs ou dependências.
- Mantenha Server Components como base e isole interação em folhas Client pequenas.
- Dê função a tipografia, imagem, espaço, borda e movimento. Corte decoração que não ajuda a leitura, a ação ou a identidade.
- Trate loading, vazio, erro, sucesso, foco, toque e redução de movimento como parte da composição.
- Use conteúdo real e fatos confirmados. Não preencha lacunas com números, depoimentos, marcas ou promessas inventadas.
- Todo texto ou imagem que o operador deve manter sem novo release precisa de chave estável em `content/editor.json`. Mudança estrutural continua no código.
- Preserve formulários, tracking, WhatsApp e a ponte server-side da plataforma. Segredos nunca entram no cliente.

## Crítica e entrega

Observe a página renderizada em desktop e celular. Revise hierarquia, quebras de linha, enquadramento, contraste, foco, estados e custo de movimento. Faça ao menos uma passagem de subtração.

Conclua somente depois de `typecheck`, lint, build e smoke do fluxo afetado. Uma opinião estética ou a própria revisão do modelo não substitui esses gates. Quando o projeto usa o CMS Premium, valide também que a prévia e a URL pública renderizam a mesma revisão de conteúdo.
