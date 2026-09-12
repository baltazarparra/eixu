export const url = 'https://reference.test/';
export const reading = {
  usable: true,
  layout:
    'Abertura clara com título serifado à esquerda e foto vertical à direita.',
  typography: 'Display serifada de alto contraste e texto de apoio sans menor.',
  imagery:
    'Fotografias de matéria em luz quente, com recorte vertical e legendas.',
  rhythm:
    'Abertura ampla, galeria de detalhes e capítulos com bastante respiro.',
  surface: 'Fundo branco com superfícies cinza claras e bordas discretas.',
  mobile:
    'Título acima da foto e capítulos empilhados com margens preservadas.',
  limits: ['Movimento não foi avaliado por captura estática.'],
};
export const referenceDirection = {
  primaryUrl: url,
  // surface entra porque a leitura descreve fundo branco: sem esse aspecto a
  // faixa da vibe continua exigindo papel escuro no moderno.
  decisions: ['layout', 'typography', 'imagery', 'rhythm', 'surface'].map(
    (aspect) => ({
      aspect,
      sourceUrl: url,
      observed: reading[aspect],
      application: `Aplicar ${aspect} na abertura e capítulos com hero.split offset, galeria e narrative.split editorial.`,
    }),
  ),
  adaptations:
    'Preservar as cores cadastradas e fotos de matéria; manter a mesma escala e respiro nas páginas internas.',
};
export const direction = {
  brief: {
    audience: 'Pessoas reformando a casa',
    offer: 'Pedras para arquitetura',
    goal: 'Solicitar orientação',
    personality: ['sóbria', 'natural'],
    evidence: ['Produção própria'],
  },
  concept: 'Recortes da matéria em escala arquitetônica',
  signatureElement: 'Janela vertical de matéria',
  structure: 'moderno-sistema',
  structureRationale:
    'O mapa de sistema relaciona materiais, aplicações e orientação antes do contato.',
  accent: '#87522a',
  accentAlt: '#315b48',
  ink: '#111111',
  paper: '#ffffff',
  surface: '#eeeeee',
  radius: 'lg',
  displayFont: 'editorial',
  bodyFont: 'sans',
  heroComposition: 'offset',
  navigation: 'bar',
  rhythm: 'alternating',
  imageTreatment: 'framed',
  surfaceStyle: 'flat',
  motif: 'none',
  variance: 5,
  motion: 3,
  density: 3,
};
export function referenceTenant() {
  return {
    id: 'reference-fixture',
    slug: 'reference-fixture',
    name: 'Matéria',
    brand: {
      vibe: 'moderno',
      paletteSource: 'operador',
      accent: '#884411',
      accentAlt: '#316854',
      highlight: '#ac4422',
    },
    dials: {},
    imageGuide: {},
    contacts: { phones: [], addresses: [], social: [] },
    whatsapp: null,
    brief: {
      intake: { references: [url] },
      sources: [{ url, status: 'ok', visual: { status: 'ok', reading } }],
    },
  };
}
