import { db } from '@/lib/db';
import { publicTenantBySlug } from '@/lib/site-availability';
import {
  canonicalTenantOrigin,
  matchesTenantOrigin,
  tenantCorsHeaders,
  TENANT_SLUG_PATTERN,
} from '@/lib/public-origin.mjs';
import {
  boundedPublicSource,
  parseBoundedPublicJson,
} from '@/lib/public-input.mjs';

const TYPES = new Set([
  'page_view',
  'form_submit',
  'whatsapp_click',
  'phone_click',
  'booking',
]);

export async function OPTIONS(request: Request) {
  const url = new URL(request.url);
  const slug = url.searchParams.get('tenant') ?? '';
  const origin = request.headers.get('origin') ?? '';
  if (!TENANT_SLUG_PATTERN.test(slug) || !matchesTenantOrigin(origin, slug))
    return new Response(null, { status: 204 });
  return new Response(null, {
    status: 204,
    headers: tenantCorsHeaders(origin),
  });
}

/** Coleta de eventos de primeira parte. Sem cookies de terceiros. */
export async function POST(request: Request) {
  try {
    const requestedTenant = new URL(request.url).searchParams.get('tenant');
    const body = (await parseBoundedPublicJson(request, 32_000)) as {
      tenant?: string;
      type?: string;
      path?: string;
      session?: string;
      source?: Record<string, unknown>;
    };
    const origin = request.headers.get('origin') ?? '';
    if (
      !body.tenant ||
      body.tenant !== requestedTenant ||
      !TENANT_SLUG_PATTERN.test(body.tenant) ||
      origin !== canonicalTenantOrigin(body.tenant) ||
      !body.type ||
      !TYPES.has(body.type)
    ) {
      return new Response(null, { status: 204 });
    }
    const headers = tenantCorsHeaders(origin);
    const tenant = await publicTenantBySlug(body.tenant);
    if (!tenant) return new Response(null, { status: 204, headers });

    await db()`
      insert into events (tenant_id, type, path, session_id, source)
      values (${tenant.id}, ${body.type}, ${body.path?.slice(0, 500) ?? null}, ${body.session?.slice(0, 160) ?? null},
              ${JSON.stringify(boundedPublicSource(body.source))}::jsonb)
    `;
    return new Response(null, { status: 204, headers });
  } catch {
    // Telemetria nunca deve quebrar a navegação.
    return new Response(null, { status: 204 });
  }
}
