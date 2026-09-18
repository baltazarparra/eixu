import type { ModelCallStreamPart } from '@ai-sdk/workflow';

/** O handle obtido no workflow só pode ser usado dentro de um step. */
export async function closeStudioStreamStep(
  writable: WritableStream<ModelCallStreamPart>,
  error?: string,
) {
  'use step';
  const writer = writable.getWriter();
  try {
    if (error) await writer.write({ type: 'error', error });
    await writer.close();
  } finally {
    writer.releaseLock();
  }
}
