import { isStepCount, ToolLoopAgent } from 'ai';
import type { buildTools } from './tools';
import {
  PHASE_STEPS,
  PHASE_TOOLS,
  compositionReadyForReview,
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
}) {
  const { tenantId, instructions, tools, phase } = input;
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
      ({ steps }) =>
        phase === 'composicao' &&
        compositionReadyForReview(steps.at(-1)?.toolResults ?? []),
    ],
    // A função Pro/Fluid tem 800 s; reserve tempo para encerrar e persistir.
    timeout: { totalMs: TURN_TIMEOUT_MS },
    maxRetries: 1,
  });
}
