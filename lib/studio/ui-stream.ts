import {
  createModelCallToUIChunkTransform,
  type ModelCallStreamPart,
} from '@ai-sdk/workflow';
import type { Run } from 'workflow/api';

/** O cliente só recebe finish depois da mensagem e do estado terminal persistidos. */
export function studioUIMessageStream(run: Run<unknown>, uiStartIndex = 0) {
  return run
    .getReadable<ModelCallStreamPart>({ startIndex: 0 })
    .pipeThrough(
      new TransformStream<ModelCallStreamPart, ModelCallStreamPart>({
        transform(part, controller) {
          controller.enqueue(part);
        },
        async flush(controller) {
          try {
            await run.returnValue;
          } catch (error) {
            controller.enqueue({
              type: 'error',
              error:
                error instanceof Error
                  ? error.message
                  : 'Falha ao concluir o turno.',
            });
          }
        },
      }),
    )
    .pipeThrough(createModelCallToUIChunkTransform({ uiStartIndex }));
}
