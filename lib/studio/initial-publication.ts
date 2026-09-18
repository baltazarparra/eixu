import type { StudioModelRole } from './models';

/**
 * O navegador só solicita a automação. O servidor decide a partir do estado
 * canônico para que uma mensagem posterior nunca publique por engano.
 */
export function shouldAutoPublishInitialProject(input: {
  requested: boolean;
  role: StudioModelRole;
  draftCodeRevision: string | null;
  historyLength: number;
}): boolean {
  return (
    input.requested &&
    input.role === 'build' &&
    !input.draftCodeRevision &&
    input.historyLength === 0
  );
}
