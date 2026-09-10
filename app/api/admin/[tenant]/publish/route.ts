import { isAuthenticated } from '@/lib/auth';
import { db } from '@/lib/db';
import { isDesignProfile } from '@/lib/design/profile';
import { hasDuplicateComposition } from '@/lib/design/uniqueness';
import { formatFindings, lintPage } from '@/lib/taste/lint';
import { getPage, getTenantBySlug, listPages } from '@/lib/tenant-queries';

/** Publica uma página, ou todas quando `page` vier ausente. Erro de pre-flight bloqueia. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenant: string }> },
) {
  if (!(await isAuthenticated()))
    return new Response('Não autorizado', { status: 401 });
  const { tenant: slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) return new Response('Cliente não encontrado', { status: 404 });

  const body = (await request.json().catch(() => ({}))) as { page?: string };
  const targets =
    typeof body.page === 'string'
      ? [await getPage(tenant.id, body.page)].filter(Boolean)
      : await listPages(tenant.id);

  const blocked: { page: string; preflight: string }[] = [];
  const published: string[] = [];
  for (const page of targets) {
    if (!page) continue;
    const findings = lintPage(page, tenant.brand.design);
    if (findings.some((f) => f.level === 'error')) {
      blocked.push({
        page: `/${page.slug}`,
        preflight: formatFindings(findings),
      });
      continue;
    }
    if (
      page.slug === '' &&
      isDesignProfile(tenant.brand.design) &&
      (await hasDuplicateComposition(tenant.id, page.blocks))
    ) {
      blocked.push({
        page: `/${page.slug}`,
        preflight:
          'ERRO [composicao-duplicada] A home repete a silhueta estrutural de outro cliente.',
      });
      continue;
    }
    await db()`
      update pages set published_blocks = blocks, published_seo = seo, published_at = now(), updated_at = now()
      where id = ${page.id}
    `;
    published.push(`/${page.slug}`);
  }
  if (published.length)
    await db()`update tenants set status = 'published' where id = ${tenant.id}`;
  return Response.json({
    published,
    blocked,
    url: `https://${tenant.slug}.eixu.com.br`,
  });
}
