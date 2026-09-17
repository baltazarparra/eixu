import type { Finding } from '@/lib/taste/lint';

/** A geração continua exigente. Na publicação pedida pelo operador, avaliações
 * editoriais são recomendações; dados inválidos e destinos quebrados são erros.
 * Regra nova permanece bloqueante até ser classificada explicitamente aqui. */
const EDITORIAL_RULES = new Set([
  'acao-pouco-clara',
  'familias-de-layout',
  'composicao-generica',
  'ritmo-generico',
  'hero-headline',
  'hero-subtexto',
  'travessao',
  'copy-generico',
  'placeholder',
  'sem-conversao',
  'seo-titulo',
  'seo-descricao',
  'seo-repetido',
  'inbound-paginas',
  'inbound-intencao',
  'inbound-repetido',
  'inbound-conteudo',
  'inbound-copia',
  'inbound-jornada',
  'pagina-isolada',
  'estrutura-v5-incompleta',
  'comercial-v8-estrutura',
  // O contrato visual orienta a geração; não veta a versão aprovada.
  // Schema, âncoras e destinos continuam validados pelas regras técnicas.
  'comercial-v8-navegacao',
  'comercial-v8-hero-imagem',
  'comercial-v8-rodape',
  'comercial-v8-categorias',
  'comercial-v8-imagens-imersivas',
  'comercial-v8-galeria',
  'comercial-v8-redes',
  'comercial-v8-carreira',
  'composicao-autoral-obrigatoria',
  'abertura-fora-da-vibe',
  'headline-fora-da-vibe',
  'protagonista-fora-da-vibe',
  'pagina-sem-foto',
  'home-imagens-geradas',
  'home-protagonista',
  'home-rasa',
  'home-paleta',
  'composicao-duplicada',
  'landing-prova',
  'landing-preco',
  'landing-secoes',
  'landing-pagina-extra',
  'landing-menu-ancoras',
  'landing-acao-unica',
  'landing-formulario-curto',
]);

export function publicationFinding<T extends Finding>(finding: T): T {
  return finding.level === 'error' && EDITORIAL_RULES.has(finding.rule)
    ? { ...finding, level: 'warn' }
    : finding;
}
