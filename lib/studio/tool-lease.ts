import { randomUUID } from 'node:crypto';
import { db } from '@/lib/db';

export async function withStudioToolLease<T>(input: {
  projectId: string;
  runId: string;
  operation: string;
  ttlSeconds: number;
  run: () => Promise<T>;
}): Promise<T> {
  const token = randomUUID();
  const rows = (await db()`
    insert into studio_tool_leases (
      project_id, run_id, token, operation, expires_at
    ) values (
      ${input.projectId}, ${input.runId}, ${token}, ${input.operation},
      now() + make_interval(secs => ${input.ttlSeconds})
    )
    on conflict (project_id) do update set
      run_id = excluded.run_id,
      token = excluded.token,
      operation = excluded.operation,
      expires_at = excluded.expires_at,
      created_at = now()
    where studio_tool_leases.expires_at <= now()
    returning token
  `) as { token: string }[];
  if (rows[0]?.token !== token)
    throw new Error(
      'Outra alteração deste projeto está em execução. Leia o estado novamente antes de tentar.',
    );
  try {
    return await input.run();
  } finally {
    await db()`
      delete from studio_tool_leases
      where project_id = ${input.projectId} and token = ${token}
    `.catch(() => undefined);
  }
}
