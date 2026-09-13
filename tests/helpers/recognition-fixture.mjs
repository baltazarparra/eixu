import { editPages, pageEditFixture } from './page-edit-fixture.mjs';

export const recognitionRequest =
  'no bloco "Reconhecimento comprovado", quero essa imagem maior, o box que ela esta, quero que seja clean, sem bg e sem border e o container tambem, a imagem deve ocupar 100% do width desse container e nao precisa de espaço no top, nem padding nem margin';

export function recognitionPages(layout = 'editorial-spread') {
  const pages = editPages();
  pages[0].blocks[2] = {
    id: 'recognition',
    type: 'signature.composition',
    props: {
      layout,
      eyebrow: 'Reconhecimento comprovado',
      title: 'Uma conquista que merece ser apresentada com clareza',
      body: 'A imagem fornecida pelo operador acompanha o relato do negócio, com a identidade e os detalhes preservados.',
      presentation: { tone: 'soft', edge: 'line', spacing: 'airy' },
      items: [
        {
          role: 'focus',
          label: 'Reconhecimento',
          title: 'A imagem da conquista',
          body: 'O registro mantém o conteúdo original e a apresentação da imagem enviada.',
          image: 'https://assets.test/recognition.svg',
          imageAlt: 'Arte horizontal usada na verificação local',
          caption: 'Arte de teste, sem publicação.',
        },
        {
          role: 'support',
          title: 'O produto continua aqui',
          body: 'A segunda imagem e seu texto devem permanecer como estavam antes da edição.',
          image: 'https://assets.test/product.svg',
          imageAlt: 'Imagem de produto usada na verificação local',
          caption: 'Outra imagem, preservada.',
        },
        {
          role: 'action',
          label: 'Pedido direto',
          title: 'Converse sobre o produto',
          body: 'O botão e seu destino continuam preservados enquanto a apresentação é ajustada.',
          cta: { label: 'Conversar', href: '/materiais' },
        },
      ],
    },
  };
  pages[0].publishedBlocks = structuredClone(pages[0].blocks);
  return pages;
}

export const recognitionOperations = [
  ['presentation.background', 'transparent'],
  ['presentation.edge', 'none'],
  ['presentation.spacingTop', 'none'],
  ['items.0.imagePresentation.frame', 'none'],
  ['items.0.imagePresentation.fit', 'natural'],
  ['items.0.imagePresentation.width', 'container'],
  ['items.0.imagePresentation.spacingTop', 'none'],
].map(([path, value]) => ({ op: 'set', block: 'recognition', path, value }));

export function recognitionFixture(layout) {
  return pageEditFixture(recognitionRequest, {
    initialPages: recognitionPages(layout),
  });
}
