import type { AdminUser } from '@/lib/auth';
import { db } from '@/lib/db';

export type ActivityActor = AdminUser & {
  type?: 'user' | 'agent' | 'system';
};

export type ActivityInput = {
  actor?: ActivityActor | null;
  actorType?: 'user' | 'agent' | 'system';
  requestedBy?: AdminUser | null;
  tenant?: { id?: string; slug: string; name: string } | null;
  action: string;
  summary: string;
  result?: 'success' | 'failed' | 'denied' | 'partial' | 'started';
  resourceType?: string;
  resourceId?: string;
  operationId?: string;
  detail?: Record<string, unknown>;
};

export async function recordActivity(input: ActivityInput): Promise<void> {
  const principal = input.actor ?? input.requestedBy ?? null;
  await db()`
    insert into admin_activity (
      user_id, actor_type, actor_name, actor_login,
      tenant_id, tenant_slug, tenant_name,
      action, resource_type, resource_id, result, summary, operation_id, detail
    ) values (
      ${principal?.id ?? null},
      ${input.actorType ?? input.actor?.type ?? (input.actor ? 'user' : input.requestedBy ? 'agent' : 'system')},
      ${principal?.name ?? null}, ${principal?.login ?? null},
      ${input.tenant?.id ?? null}, ${input.tenant?.slug ?? null}, ${input.tenant?.name ?? null},
      ${input.action}, ${input.resourceType ?? null}, ${input.resourceId ?? null},
      ${input.result ?? 'success'}, ${input.summary}, ${input.operationId ?? null},
      ${JSON.stringify(input.detail ?? {})}::jsonb
    )
    on conflict (operation_id) do nothing
  `;
}

export type AdminActivity = {
  id: number;
  actorType: string;
  actorName: string | null;
  actorLogin: string | null;
  tenantId: string | null;
  tenantSlug: string | null;
  tenantName: string | null;
  action: string;
  result: string;
  summary: string;
  createdAt: string;
};

type ActivityRow = {
  id: number;
  actor_type: string;
  actor_name: string | null;
  actor_login: string | null;
  tenant_id: string | null;
  tenant_slug: string | null;
  tenant_name: string | null;
  action: string;
  result: string;
  summary: string;
  created_at: string | Date;
};

export async function listActivity(input?: {
  tenantSlug?: string;
  limit?: number;
}): Promise<AdminActivity[]> {
  const limit = Math.min(Math.max(input?.limit ?? 100, 1), 200);
  const tenantSlug = input?.tenantSlug ?? null;
  const rows = (await db()`
    select id, actor_type, actor_name, actor_login, tenant_id, tenant_slug, tenant_name,
           action, result, summary, created_at
    from admin_activity
    where (${tenantSlug}::text is null or tenant_slug = ${tenantSlug})
    order by created_at desc, id desc
    limit ${limit}
  `) as ActivityRow[];
  return rows.map((row) => ({
    id: row.id,
    actorType: row.actor_type,
    actorName: row.actor_name,
    actorLogin: row.actor_login,
    tenantId: row.tenant_id,
    tenantSlug: row.tenant_slug,
    tenantName: row.tenant_name,
    action: row.action,
    result: row.result,
    summary: row.summary,
    createdAt: new Date(row.created_at).toISOString(),
  }));
}

export const MUTATING_AGENT_TOOLS = new Set([
  'define_image_guide',
  'prepare_site_images',
  'update_image',
  'generate_logo',
  'set_site_logo',
  'repair_publication',
  'confirm_evidence',
  'edit_page',
  'undo_page_edit',
  'set_brand',
  'set_design',
  'build_site',
  'repair_site',
  'delete_page',
  'create_page',
  'set_blocks',
  'insert_block',
  'update_block',
  'remove_block',
  'move_block',
  'set_seo',
  'publish_page',
  'publish_site',
]);

export async function recordAgentTool(input: {
  requestedBy: AdminUser;
  tenant: { id: string; slug: string; name: string };
  tool: string;
  callId: string;
  output: unknown;
}): Promise<void> {
  if (!MUTATING_AGENT_TOOLS.has(input.tool)) return;
  const output = (input.output ?? {}) as Record<string, unknown>;
  const failed = Boolean(output.error) || output.ok === false;
  await recordActivity({
    requestedBy: input.requestedBy,
    actorType: 'agent',
    tenant: input.tenant,
    action: `agent.${input.tool}`,
    summary: failed
      ? `Agente não concluiu ${input.tool}, a pedido de ${input.requestedBy.name}`
      : `Agente executou ${input.tool}, a pedido de ${input.requestedBy.name}`,
    result: failed ? 'denied' : 'success',
    resourceType: 'tool',
    resourceId: input.tool,
    operationId: `tool:${input.callId}`,
  });
}
