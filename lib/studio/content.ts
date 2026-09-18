import { db, transaction } from '@/lib/db';
import {
  compatibleStudioEditorValues,
  parseStudioEditorContract,
  studioEditorFields,
  validateStudioEditorValues,
  StudioEditorError,
  type StudioEditorContract,
} from './editor';
import { studioContractHash } from './editor-hash';
import { activeStudioRun } from './runs';
import { studioProjectByTenant } from './projects';
import type { StudioEditorState } from './types';

type Row = Record<string, unknown>;

function iso(value: unknown): string | null {
  return value ? new Date(value as string | Date).toISOString() : null;
}

function stateFromRow(row: Row | undefined): StudioEditorState | null {
  if (!row) return null;
  const contract = parseStudioEditorContract(row.contract);
  if (!contract) return null;
  return {
    revision: Number(row.revision ?? 0),
    contractHash: studioContractHash(contract),
    contract,
    values: compatibleStudioEditorValues(contract, row.content),
    updatedAt: iso(row.created_at),
  };
}

export async function studioEditorStateByTenant(
  tenantId: string,
): Promise<StudioEditorState | null> {
  const rows = (await db()`
    select revision.contract, revision.content, revision.revision,
           revision.created_at
    from studio_projects project
    join studio_content_revisions revision
      on revision.id = project.active_content_revision_id
    where project.tenant_id = ${tenantId}
    limit 1
  `) as Row[];
  return stateFromRow(rows[0]);
}

async function allowedImages(
  tenantId: string,
  contract: StudioEditorContract,
  current: Record<string, string>,
) {
  const rows = (await db()`
    select url from images
    where tenant_id = ${tenantId} and status in ('disponivel', 'aprovada')
  `) as { url: string }[];
  const urls = new Set(rows.map((row) => row.url));
  for (const field of studioEditorFields(contract))
    if (field.type === 'image' && current[field.key])
      urls.add(current[field.key]);
  return urls;
}

export async function saveStudioEditorContent(input: {
  tenantId: string;
  userId: string;
  expectedRevision: number;
  contractHash: string;
  values: unknown;
}): Promise<StudioEditorState> {
  const project = await studioProjectByTenant(input.tenantId);
  if (!project)
    throw new StudioEditorError('O projeto ainda não foi criado.', 409);
  if (project.status === 'archived')
    throw new StudioEditorError(
      'O cliente está arquivado. Reative-o antes de editar o conteúdo.',
      409,
    );
  if (await activeStudioRun(project.id))
    throw new StudioEditorError(
      'O agente está alterando o projeto. Aguarde o turno terminar antes de salvar o CMS.',
      409,
    );
  const before = await studioEditorStateByTenant(input.tenantId);
  if (!before)
    throw new StudioEditorError(
      'O projeto ainda não publicou um contrato editorial.',
      409,
    );
  if (before.contractHash !== input.contractHash)
    throw new StudioEditorError(
      'O contrato editorial mudou. Recarregue antes de salvar.',
      409,
      {},
      before.revision,
    );
  const values = validateStudioEditorValues(
    before.contract,
    input.values,
    await allowedImages(input.tenantId, before.contract, before.values),
  );

  const saved = await transaction(async (connection) => {
    const rows = await connection.query(
      `select project.id, project.sandbox_name,
              revision.revision, revision.contract, revision.contract_hash
       from studio_projects project
       join studio_content_revisions revision
         on revision.id = project.active_content_revision_id
       where project.id = $1 for update of project`,
      [project.id],
    );
    const row = rows.rows[0] as Row | undefined;
    if (!row) throw new StudioEditorError('Projeto indisponível.', 409);
    const activeRuns = await connection.query(
      `select 1 from studio_runs
       where project_id = $1
         and status in ('queued', 'running', 'cancel_requested')
       limit 1`,
      [project.id],
    );
    if (activeRuns.rows[0])
      throw new StudioEditorError(
        'O agente começou a alterar o projeto. Aguarde o turno terminar antes de salvar o CMS.',
        409,
      );
    const revision = Number(row.revision);
    if (revision !== input.expectedRevision)
      throw new StudioEditorError(
        'Outra pessoa salvou conteúdo enquanto você editava. Recarregue para comparar.',
        409,
        {},
        revision,
      );
    if (String(row.contract_hash) !== input.contractHash)
      throw new StudioEditorError(
        'O contrato editorial mudou. Recarregue antes de salvar.',
        409,
      );
    const nextRevision = revision + 1;
    const inserted = await connection.query(
      `insert into studio_content_revisions (
         project_id, revision, schema_version, contract_hash, contract,
         content, source, summary, created_by
       ) values ($1, $2, 1, $3, $4::jsonb, $5::jsonb, 'cms', $6, $7)
       returning id, created_at`,
      [
        project.id,
        nextRevision,
        input.contractHash,
        JSON.stringify(before.contract),
        JSON.stringify(values),
        'Conteúdo salvo pelo CMS lite',
        input.userId,
      ],
    );
    await connection.query(
      `update studio_projects set active_content_revision_id = $2,
         updated_at = now() where id = $1`,
      [project.id, inserted.rows[0].id],
    );
    return {
      revision: nextRevision,
      updatedAt: iso(inserted.rows[0].created_at),
    };
  });

  // O Neon é a fonte de verdade. A próxima prévia ou execução sincroniza esta
  // revisão sob o lock do projeto; uma escrita solta aqui poderia cruzar um run.
  return { ...before, ...saved, values };
}

export async function activeStudioContent(
  sandboxName: string,
): Promise<Record<string, string> | null> {
  const rows = (await db()`
    select revision.content
    from studio_projects project
    join studio_content_revisions revision
      on revision.id = project.active_content_revision_id
    where project.sandbox_name = ${sandboxName}
    limit 1
  `) as { content: Record<string, string> }[];
  return rows[0]?.content ?? null;
}
