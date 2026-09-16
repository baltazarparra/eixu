/**
 * Derivações puras da lista de sites. Ficam fora do componente porque o
 * servidor ordena com as mesmas regras que a tela exibe, e porque assim o
 * rótulo da última ação tem teste sem navegador e sem banco.
 */

export type SiteAction = {
  /** Identificador registrado em `admin_activity`, sem tradução. */
  action: string;
  actorType: string;
  actorName: string | null;
  summary: string;
  at: string;
};

/** O prefixo `agent.` já é dito pelo autor da linha; a coluna mostra a ferramenta. */
export function actionLabel(action: string): string {
  return action.startsWith('agent.') ? action.slice('agent.'.length) : action;
}

/** Autoria preservada: o agente sempre diz a pedido de quem trabalhou. */
export function actorLabel(action: SiteAction): string {
  if (action.actorType === 'agent')
    return action.actorName
      ? `Agente · a pedido de ${action.actorName}`
      : 'Agente';
  if (action.actorType === 'system') return 'Sistema';
  return action.actorName ?? 'Operador';
}

type Touched = { updatedAt: string; lastAction?: SiteAction | null };

/** Sem ação registrada, o site cai no próprio `updated_at`. */
export function lastTouch(site: Touched): string {
  return site.lastAction?.at ?? site.updatedAt;
}

/** A lista é ordenada pela data que a linha mostra, da mais recente à mais antiga. */
export function byLastAction(a: Touched, b: Touched): number {
  const time = (site: Touched) => {
    const parsed = Date.parse(lastTouch(site));
    return Number.isNaN(parsed) ? 0 : parsed;
  };
  return time(b) - time(a);
}
