import { randomUUID } from 'node:crypto';
import { db, transaction } from '@/lib/db';
import type { StudioModelRole } from './models';

export type StudioRunStatus =
  | 'queued'
  | 'running'
  | 'cancel_requested'
  | 'succeeded'
  | 'failed'
  | 'cancelled';

export type StudioRun = {
  id: string;
  projectId: string;
  tenantId: string;
  workflowRunId: string | null;
  requestMessageUid: string;
  responseMessageUid: string | null;
  kind: 'chat' | 'build' | 'edit' | 'refine' | 'preview' | 'publish';
  status: StudioRunStatus;
  modelRole: StudioModelRole;
  requestedBy: string | null;
  error: string | null;
};

type Row = Record<string, unknown>;

function text(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number'
    ? `${value}`
    : '';
}

function fromRow(row: Row): StudioRun {
  return {
    id: text(row.id),
    projectId: text(row.project_id),
    tenantId: text(row.tenant_id),
    workflowRunId: row.workflow_run_id ? text(row.workflow_run_id) : null,
    requestMessageUid: text(row.request_message_uid),
    responseMessageUid: row.response_message_uid
      ? text(row.response_message_uid)
      : null,
    kind: row.kind as StudioRun['kind'],
    status: row.status as StudioRunStatus,
    modelRole: row.model_role as StudioModelRole,
    requestedBy: text(row.requested_by) || null,
    error: text(row.error) || null,
  };
}

export async function createStudioRun(input: {
  projectId: string;
  tenantId: string;
  requestMessageUid: string;
  modelRole: StudioModelRole;
  requestedBy: string;
  kind?: StudioRun['kind'];
  baseCodeRevision?: string | null;
  baseContentRevision?: number | null;
}): Promise<StudioRun | null> {
  const id = randomUUID();
  return transaction(async (connection) => {
    const project = await connection.query(
      `select id from studio_projects
       where id = $1 and tenant_id = $2 and status <> 'archived'
       for update`,
      [input.projectId, input.tenantId],
    );
    if (!project.rows[0]) return null;
    const release = await connection.query(
      `select id from studio_releases where project_id = $1
       and status in ('preparing', 'validating', 'ready') limit 1`,
      [input.projectId],
    );
    if (release.rows[0]) return null;
    const result = await connection.query(
      `insert into studio_runs (
         id, project_id, tenant_id, request_message_uid, kind, status,
         model_role, base_code_revision, base_content_revision, requested_by
       ) values ($1, $2, $3, $4, $5, 'queued', $6, $7, $8, $9)
       on conflict do nothing
       returning *`,
      [
        id,
        input.projectId,
        input.tenantId,
        input.requestMessageUid,
        input.kind ?? 'chat',
        input.modelRole,
        input.baseCodeRevision ?? null,
        input.baseContentRevision ?? null,
        input.requestedBy,
      ],
    );
    return result.rows[0] ? fromRow(result.rows[0] as Row) : null;
  });
}

export async function attachWorkflowRun(
  runId: string,
  workflowRunId: string,
): Promise<boolean> {
  const rows = (await db()`
    update studio_runs set workflow_run_id = ${workflowRunId},
      status = case when status = 'queued' then 'running' else status end,
      started_at = coalesce(started_at, now()),
      updated_at = now()
    where id = ${runId}
      and (
        (status = 'queued' and workflow_run_id is null)
        or workflow_run_id = ${workflowRunId}
      )
    returning id
  `) as { id: string }[];
  return rows.length === 1;
}

export async function studioRunById(id: string): Promise<StudioRun | null> {
  const rows = (await db()`
    select * from studio_runs where id = ${id} limit 1
  `) as Row[];
  return rows[0] ? fromRow(rows[0]) : null;
}

export async function studioRunByWorkflowId(
  workflowRunId: string,
): Promise<StudioRun | null> {
  const rows = (await db()`
    select * from studio_runs where workflow_run_id = ${workflowRunId} limit 1
  `) as Row[];
  return rows[0] ? fromRow(rows[0]) : null;
}

export async function activeStudioRun(
  projectId: string,
): Promise<StudioRun | null> {
  await db()`
    update studio_runs set status = 'failed',
      error = 'O workflow não foi vinculado ao run.',
      finished_at = now(), updated_at = now()
    where project_id = ${projectId}
      and status = 'queued' and workflow_run_id is null
      and created_at < now() - interval '10 minutes'
  `;
  const rows = (await db()`
    select * from studio_runs
    where project_id = ${projectId}
      and status in ('queued', 'running', 'cancel_requested')
    order by created_at desc limit 1
  `) as Row[];
  return rows[0] ? fromRow(rows[0]) : null;
}

export async function requestStudioRunCancellation(input: {
  runId: string;
  tenantId: string;
}): Promise<StudioRun | null> {
  const rows = (await db()`
    update studio_runs set status = 'cancel_requested', updated_at = now()
    where id = ${input.runId} and tenant_id = ${input.tenantId}
      and status in ('queued', 'running')
    returning *
  `) as Row[];
  if (rows[0]) return fromRow(rows[0]);
  return studioRunById(input.runId);
}

export async function studioRunMayContinue(runId: string): Promise<boolean> {
  const rows = (await db()`
    select status in ('queued', 'running') as allowed
    from studio_runs where id = ${runId}
  `) as { allowed: boolean }[];
  return rows[0]?.allowed === true;
}

export async function finishStudioRun(input: {
  runId: string;
  status: Extract<StudioRunStatus, 'succeeded' | 'failed' | 'cancelled'>;
  responseMessageUid?: string;
  result?: Record<string, unknown>;
  error?: string;
}): Promise<boolean> {
  const rows = (await db()`
    update studio_runs set
      status = ${input.status},
      response_message_uid = coalesce(${input.responseMessageUid ?? null}, response_message_uid),
      result = ${JSON.stringify(input.result ?? {})}::jsonb,
      error = ${input.error ?? null},
      finished_at = now(), updated_at = now()
    where id = ${input.runId}
      and status in ('queued', 'running', 'cancel_requested')
    returning id
  `) as { id: string }[];
  return rows.length === 1;
}

export async function nextStudioEvent(
  runId: string,
  type: string,
  data: Record<string, unknown> = {},
): Promise<void> {
  const sequences = (await db()`
    update studio_runs set event_sequence = event_sequence + 1,
      updated_at = now()
    where id = ${runId}
    returning event_sequence - 1 as sequence
  `) as { sequence: number }[];
  if (!sequences[0]) throw new Error('Execução não encontrada.');
  await db()`
    insert into studio_events (run_id, sequence, type, data)
    values (
      ${runId}, ${sequences[0].sequence}, ${type},
      ${JSON.stringify(data)}::jsonb
    )
  `;
}
