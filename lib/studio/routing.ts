import type { StudioProject } from './types';
import type { StudioModelRole } from './models';

const matches = (text: string, expression: RegExp) => expression.test(text);

/** Estado do projeto tem precedência; palavras só distinguem trabalhos já existentes. */
export function routeStudioTurn(
  project: StudioProject,
  request: string,
): StudioModelRole {
  if (project.status === 'draft' || !project.draftCodeRevision) return 'build';
  const text = request
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
  if (
    matches(
      text,
      /\b(erro|falha|quebrou|nao abre|nao carrega|build|deploy|diagnost)/,
    )
  )
    return 'diagnostic';
  if (
    matches(
      text,
      /\b(refaca|recrie|redesenhe|nova direcao|novo site|recomponha|mude tudo)/,
    )
  )
    return 'build';
  if (
    matches(
      text,
      /\b(direcao de arte|direcao visual|tipografia|identidade visual|referencia visual)/,
    )
  )
    return 'art_direction';
  if (
    matches(
      text,
      /\b(motion|animacao|animacoes|scroll|reveal|fade|microinteracao|refin)/,
    )
  )
    return 'refine';
  if (
    matches(
      text,
      /\b(troque|mude|altere|adicione|remova|corrija|texto|imagem|foto|cor|secao|pagina|menu|botao)/,
    )
  )
    return 'edit';
  return 'assistant';
}
