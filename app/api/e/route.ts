import { db } from '@/lib/db';
import { getTenantBySlug } from '@/lib/tenant-queries';

const TYPES = new Set(['page_view', 'form_submit', 'whatsapp_click', 'phone_click', 'booking']);

/** Coleta de eventos de primeira parte. Sem cookies de terceiros. */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      tenant?: string;
      type?: string;
      path?: string;
      session?: string;
      source?: Record<string, unknown>;
    };
    if (!body.tenant || !body.type || !TYPES.has(body.type)) {
      return new Response(null, { status: 204 });
    }
    const tenant = await getTenantBySlug(body.tenant);
    if (!tenant) return new Response(null, { status: 204 });

    await db()`
      insert into events (tenant_id, type, path, session_id, source)
      values (${tenant.id}, ${body.type}, ${body.path ?? null}, ${body.session ?? null},
              ${JSON.stringify(body.source ?? {})}::jsonb)
    `;
    return new Response(null, { status: 204 });
  } catch {
    // Telemetria nunca deve quebrar a navegação.
    return new Response(null, { status: 204 });
  }
}
