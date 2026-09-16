import { db } from '@/lib/db';
import { premiumBridgeProject } from '@/lib/premium/bridge';

const TYPES = new Set([
  'page_view',
  'form_submit',
  'whatsapp_click',
  'phone_click',
  'booking',
]);

export async function POST(request: Request) {
  try {
    const project = await premiumBridgeProject(request);
    if (!project) return new Response(null, { status: 204 });
    const body = (await request.json()) as {
      type?: string;
      path?: string;
      session?: string;
      source?: Record<string, unknown>;
    };
    if (!body.type || !TYPES.has(body.type))
      return new Response(null, { status: 204 });
    await db()`
      insert into events (tenant_id, type, path, session_id, source)
      values (${project.tenantId}, ${body.type}, ${body.path ?? null},
              ${body.session?.slice(0, 160) ?? null},
              ${JSON.stringify(body.source ?? {})}::jsonb)
    `;
  } catch {
    // Telemetria nunca interrompe a navegacao publica.
  }
  return new Response(null, { status: 204 });
}
