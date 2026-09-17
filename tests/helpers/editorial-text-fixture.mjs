import {
  editPages,
  editTenant,
  pageEditFixture,
} from './page-edit-fixture.mjs';

export const editorialImageRequest =
  'no segundo bloco "Loja Brotas" quero dividir em meio a meio e adicionar a imagem #10 em uma metade e o componente atual em outra metade.';
export const editorialImage = {
  id: 'editorial-image-10',
  tenantId: editTenant.id,
  seq: 10,
  kind: 'foto',
  ratio: '4:3',
  model: 'upload',
  status: 'disponivel',
  url: 'https://assets.test/fachada-10.webp',
  blobPath: `tenants/${editTenant.id}/uploads/fachada-10.webp`,
  alt: 'Fachada da loja com o nome do comércio no letreiro',
  requestText: 'Fachada da loja',
  targetBlock: 'livre',
  critique: {},
  createdAt: '2026-09-17T00:00:00Z',
};

export function editorialPages(layout = 'lead') {
  const pages = editPages({ hero: 'bullets' });
  Object.assign(pages[0].blocks[1].props, {
    image: editorialImage.url,
    imageAlt: editorialImage.alt,
  });
  const intro = pages[0].blocks.find((block) => block.id === 'intro');
  Object.assign(intro.props, {
    layout,
    title: 'Loja Brotas',
    anchor: 'loja-brotas',
    lead: 'Rua da Praça, 100. Centro, Brotas.',
    body: 'A loja recebe moradores e visitantes para as compras do dia a dia. As informações sobre atendimento ajudam a planejar a visita.\n\nOs setores reúnem produtos para diferentes momentos da semana, com a equipe disponível para orientar a escolha.',
    textStyles: [{ field: 'body', size: 0 }],
  });
  pages[0].publishedBlocks = structuredClone(pages[0].blocks);
  return pages;
}

export const editorialImageOperations = [
  { op: 'set', block: 'intro', path: 'layout', value: 'split' },
  { op: 'set', block: 'intro', path: 'image', value: editorialImage.url },
  { op: 'set', block: 'intro', path: 'imageAlt', value: editorialImage.alt },
  { op: 'set', block: 'intro', path: 'imagePosition', value: 'left' },
];

export function editorialFixture(options = {}) {
  return pageEditFixture(editorialImageRequest, {
    initialPages: editorialPages(),
    images: [editorialImage],
    ...options,
  });
}
