import { isStepCount, ToolLoopAgent } from 'ai';
import type { buildTools } from './tools';
import {
  PHASE_STEPS,
  PHASE_TOOLS,
  compositionReadyForReview,
  reviewReadyToFinish,
  type Phase,
} from '../taste/phases';
import { modelSettings, productModel, TURN_TIMEOUT_MS } from './models';
import { gatewayOptions } from './usage';
import { serialTools } from './serial-tools';

/** Mesmo loop, limites e modelo no chat e no runner de qualidade. */
type SiteTools = ReturnType<typeof buildTools>;

export function siteAgent(input: {
  tenantId: string;
  instructions: string;
  tools: SiteTools;
  phase?: Phase;
  /** Pausa pedida pelo operador: encerra depois do passo atual. */
  shouldStop?: () => boolean;
}) {
  const { tenantId, instructions, tools, phase, shouldStop } = input;
  return new ToolLoopAgent({
    model: productModel(),
    ...modelSettings(phase ?? 'livre'),
    instructions,
    tools: serialTools(tools),
    ...(phase
      ? {
          activeTools: PHASE_TOOLS[phase].filter(
            (name) => name in tools,
          ) as (keyof SiteTools)[],
        }
      : {}),
    providerOptions: gatewayOptions(tenantId, 'site', phase),
    stopWhen: [
      isStepCount(phase ? PHASE_STEPS[phase] : 32),
      // Abortar no meio desperdiçaria a chamada paga em andamento; a pausa
      // espera o passo corrente terminar e salvar.
      () => shouldStop?.() === true,
      ({ steps }) =>
        phase === 'composicao' &&
        compositionReadyForReview(steps.at(-1)?.toolResults ?? []),
      ({ steps }) => phase === 'revisao' && reviewReadyToFinish(steps),
    ],
    prepareStep: ({ stepNumber }) =>
      phase === 'revisao' && stepNumber === PHASE_STEPS.revisao - 1
        ? {
            activeTools: ['review_pages'],
            toolChoice: { type: 'tool', toolName: 'review_pages' },
          }
        : {},
    // A função Pro/Fluid tem 800 s; reserve tempo para encerrar e persistir.
    timeout: { totalMs: TURN_TIMEOUT_MS },
    maxRetries: 1,
  });
}
