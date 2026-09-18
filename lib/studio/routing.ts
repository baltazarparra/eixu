import type { StudioProject } from './types';
import type { StudioModelRole } from './models';

/** Depois do primeiro checkpoint, o agente interpreta o pedido sem classificador de palavras. */
export function routeStudioTurn(project: StudioProject): StudioModelRole {
  return project.draftCodeRevision ? 'edit' : 'build';
}
