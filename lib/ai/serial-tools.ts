import type { ToolSet } from 'ai';

/** Evita que duas edições do mesmo passo leiam a mesma versão e percam props. */
export function serialTools<T extends ToolSet>(tools: T): T {
  let tail: Promise<unknown> = Promise.resolve();
  return Object.fromEntries(
    Object.entries(tools).map(([name, definition]) => {
      const run = definition.execute;
      if (!run) return [name, definition];
      return [
        name,
        {
          ...definition,
          execute: (...args: Parameters<typeof run>) => {
            const pending = tail.then(() => {
              args[1]?.abortSignal?.throwIfAborted();
              return run(...args);
            });
            // Uma recusa não impede a próxima ferramenta de executar a correção.
            tail = pending.then(
              () => undefined,
              () => undefined,
            );
            return pending;
          },
        },
      ];
    }),
  ) as T;
}
