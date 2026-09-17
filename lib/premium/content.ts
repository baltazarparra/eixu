import { createHash, randomBytes } from 'node:crypto';
import { db, transaction } from '@/lib/db';
import {
  compatiblePremiumEditorValues,
  parsePremiumEditorContract,
  premiumEditorDefaults,
  premiumEditorFields,
  validatePremiumEditorValues,
  PremiumEditorError,
  type PremiumEditorContent,
  type PremiumEditorContract,
  type PremiumEditorState,
} from '@/lib/premium/editor';

type Row = Record<string, unknown>;

function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function contractHash(contract: PremiumEditorContract): string {
  return createHash('sha256').update(JSON.stringify(contract)).digest('hex');
}

function iso(value: unknown): string | null {
  if (!value) return null;
  return new Date(value as string | Date).toISOString();
}

function editorState(row: Row | undefined): PremiumEditorState | null {
  if (!row) return null;
  const contract = parsePremiumEditorContract(row.editor);
  if (!contract) return null;
  return {
    contractHash: contractHash(contract),
    contract,
    content: {
      revision: Number(row.revision ?? 0),
      values: compatiblePremiumEditorValues(contract, row.content),
      updatedAt: iso(row.content_updated_at),
    },
  };
}

async function editorRowByTenant(tenantId: string): Promise<Row | undefined> {
  const rows = (await db()`
    select p.id as project_id, p.tenant_id, p.canonical_host,
           release.manifest->'editor' as editor,
           content.revision, content.content,
           content.created_at as content_updated_at
    from premium_projects p
    join tenants tenant on tenant.id = p.tenant_id
    join premium_releases release on release.id = p.active_release_id
    left join premium_content_revisions content
      on content.id = p.active_content_revision_id
    where p.tenant_id = ${tenantId}
      and p.status = 'active'
      and tenant.maintenance_mode = 'premium'
      and tenant.public_runtime = 'premium'
    limit 1
  `) as Row[];
  return rows[0];
}

export async function premiumEditorStateByTenant(
  tenantId: string,
): Promise<PremiumEditorState | null> {
  return editorState(await editorRowByTenant(tenantId));
}

export async function premiumContentForProject(
  projectId: string,
  previewToken?: string,
): Promise<PremiumEditorContent | null> {
  const rows = (await db()`
    select release.manifest->'editor' as editor,
           content.revision, content.content,
           content.created_at as content_updated_at
    from premium_projects project
    join premium_releases release on release.id = project.active_release_id
    left join premium_content_revisions content
      on content.id = project.active_content_revision_id
    where project.id = ${projectId} and project.status = 'active'
    limit 1
  `) as Row[];
  const row = rows[0];
  const contract = parsePremiumEditorContract(row?.editor);
  if (!row || !contract) return null;
  const currentContractHash = contractHash(contract);

  if (previewToken) {
    const previews = (await db()`
      select content, client_version, updated_at
      from premium_preview_sessions
      where project_id = ${projectId}
        and token_hash = ${tokenHash(previewToken)}
        and schema_version = ${contract.version}
        and contract_hash = ${currentContractHash}
        and expires_at > now()
      limit 1
    `) as Row[];
    const preview = previews[0];
    if (!preview)
      throw new PremiumEditorError(
        'A sessão da prévia expirou. Reabra o editor.',
        401,
      );
    return {
      revision: Number(preview.client_version ?? 0),
      values: compatiblePremiumEditorValues(contract, preview.content),
      updatedAt: iso(preview.updated_at),
    };
  }

  return {
    revision: Number(row.revision ?? 0),
    values: compatiblePremiumEditorValues(contract, row.content),
    updatedAt: iso(row.content_updated_at),
  };
}

async function allowedImages(tenantId: string): Promise<Set<string>> {
  const rows = (await db()`
    select url from images
    where tenant_id = ${tenantId} and status in ('disponivel', 'aprovada')
  `) as { url: string }[];
  return new Set(rows.map((row) => row.url));
}

async function allowedImagesForState(
  tenantId: string,
  state: PremiumEditorState,
): Promise<Set<string>> {
  const images = await allowedImages(tenantId);
  for (const field of premiumEditorFields(state.contract))
    if (field.type === 'image' && state.content.values[field.key])
      images.add(state.content.values[field.key]);
  return images;
}

export async function createPremiumPreviewSession(input: {
  tenantId: string;
  userId: string;
}): Promise<{
  token: string;
  expiresAt: string;
  contractHash: string;
  content: PremiumEditorContent;
}> {
  const row = await editorRowByTenant(input.tenantId);
  const state = editorState(row);
  if (!row || !state)
    throw new PremiumEditorError(
      'Este projeto Premium ainda não publicou um contrato editorial.',
      409,
    );
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
  await db()`
    delete from premium_preview_sessions
    where project_id = ${String(row.project_id)} and expires_at <= now()
  `;
  await db()`
    insert into premium_preview_sessions (
      project_id, token_hash, schema_version, contract_hash, content,
      client_version, created_by, expires_at
    ) values (
      ${String(row.project_id)}, ${tokenHash(token)}, ${state.contract.version},
      ${state.contractHash}, ${JSON.stringify(state.content.values)}::jsonb,
      0, ${input.userId},
      ${expiresAt.toISOString()}
    )
  `;
  return {
    token,
    expiresAt: expiresAt.toISOString(),
    contractHash: state.contractHash,
    content: state.content,
  };
}

export async function updatePremiumPreviewSession(input: {
  tenantId: string;
  token: string;
  contractHash: string;
  version: number;
  values: unknown;
}): Promise<{ version: number }> {
  const row = await editorRowByTenant(input.tenantId);
  const state = editorState(row);
  if (!row || !state)
    throw new PremiumEditorError('Editor Premium indisponível.', 409);
  if (input.contractHash !== state.contractHash)
    throw new PremiumEditorError(
      'O frontend Premium mudou. Recarregue o editor antes de continuar.',
      409,
    );
  const values = validatePremiumEditorValues(
    state.contract,
    input.values,
    await allowedImagesForState(input.tenantId, state),
  );
  const updated = (await db()`
    update premium_preview_sessions set
      content = ${JSON.stringify(values)}::jsonb,
      client_version = ${input.version},
      expires_at = now() + interval '30 minutes',
      updated_at = now()
    where project_id = ${String(row.project_id)}
      and token_hash = ${tokenHash(input.token)}
      and schema_version = ${state.contract.version}
      and contract_hash = ${state.contractHash}
      and expires_at > now()
      and client_version < ${input.version}
    returning client_version
  `) as { client_version: number }[];
  if (updated[0]) return { version: Number(updated[0].client_version) };

  const sessions = (await db()`
    select client_version from premium_preview_sessions
    where project_id = ${String(row.project_id)}
      and token_hash = ${tokenHash(input.token)}
      and expires_at > now()
    limit 1
  `) as { client_version: number }[];
  if (!sessions[0])
    throw new PremiumEditorError(
      'A sessão da prévia expirou. Reabra o editor.',
      401,
    );
  return { version: Number(sessions[0].client_version) };
}

export async function publishPremiumContent(input: {
  actor: { id: string; name: string; login: string };
  tenant: { id: string; slug: string; name: string };
  expectedRevision: number;
  schemaVersion: number;
  contractHash: string;
  values: unknown;
}): Promise<PremiumEditorContent> {
  return transaction(async (connection) => {
    const projects = await connection.query(
      `select project.id, release.manifest->'editor' as editor,
              content.revision, content.content
       from premium_projects project
       join tenants tenant on tenant.id = project.tenant_id
       join premium_releases release on release.id = project.active_release_id
       left join premium_content_revisions content
         on content.id = project.active_content_revision_id
       where project.tenant_id = $1
         and project.status = 'active'
         and tenant.maintenance_mode = 'premium'
         and tenant.public_runtime = 'premium'
       for update of project`,
      [input.tenant.id],
    );
    const project = projects.rows[0] as Row | undefined;
    const contract = parsePremiumEditorContract(project?.editor);
    if (!project || !contract)
      throw new PremiumEditorError(
        'Este projeto Premium ainda não publicou um contrato editorial.',
        409,
      );
    if (input.schemaVersion !== contract.version)
      throw new PremiumEditorError(
        'O frontend Premium mudou. Recarregue o editor antes de publicar.',
        409,
      );
    const currentContractHash = contractHash(contract);
    if (input.contractHash !== currentContractHash)
      throw new PremiumEditorError(
        'O frontend Premium mudou. Recarregue o editor antes de publicar.',
        409,
      );
    const currentRevision = Number(project.revision ?? 0);
    if (input.expectedRevision !== currentRevision)
      throw new PremiumEditorError(
        'Outra pessoa publicou conteúdo enquanto você editava. Recarregue para comparar as versões.',
        409,
        {},
        currentRevision,
      );
    const imageRows = await connection.query(
      `select url from images
       where tenant_id = $1 and status in ('disponivel', 'aprovada')`,
      [input.tenant.id],
    );
    const images = new Set(
      imageRows.rows.map((image) => String((image as Row).url)),
    );
    const currentValues = compatiblePremiumEditorValues(
      contract,
      project.content,
    );
    for (const field of premiumEditorFields(contract))
      if (field.type === 'image' && currentValues[field.key])
        images.add(currentValues[field.key]);
    const values = validatePremiumEditorValues(contract, input.values, images);
    const revision = currentRevision + 1;
    const revisions = await connection.query(
      `insert into premium_content_revisions (
         project_id, revision, schema_version, contract_hash, content, created_by
       ) values ($1, $2, $3, $4, $5::jsonb, $6)
       returning id, created_at`,
      [
        project.id,
        revision,
        contract.version,
        currentContractHash,
        JSON.stringify(values),
        input.actor.id,
      ],
    );
    const saved = revisions.rows[0] as Row;
    await connection.query(
      `update premium_projects set
         active_content_revision_id = $2, updated_at = now()
       where id = $1`,
      [project.id, saved.id],
    );
    await connection.query(
      `insert into admin_activity (
         user_id, actor_type, actor_name, actor_login,
         tenant_id, tenant_slug, tenant_name,
         action, resource_type, resource_id, result, summary,
         operation_id, detail
       ) values (
         $1, 'user', $2, $3,
         $4, $5, $6,
         'premium.content.publish', 'premium_content', $7, 'success', $8,
         $9, $10::jsonb
       )
       on conflict (operation_id) do nothing`,
      [
        input.actor.id,
        input.actor.name,
        input.actor.login,
        input.tenant.id,
        input.tenant.slug,
        input.tenant.name,
        String(revision),
        `${input.actor.name} publicou a revisão editorial ${revision} de ${input.tenant.name}`,
        `premium:content:${input.tenant.id}:${revision}`,
        JSON.stringify({ revision }),
      ],
    );
    return {
      revision,
      values,
      updatedAt: iso(saved.created_at),
    };
  });
}

export function fallbackPremiumContent(
  contract: PremiumEditorContract,
): PremiumEditorContent {
  return {
    revision: 0,
    values: premiumEditorDefaults(contract),
    updatedAt: null,
  };
}
