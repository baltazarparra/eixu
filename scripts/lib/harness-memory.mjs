import { randomUUID } from 'node:crypto';
import { loadModule } from '../../tests/helpers/load-module.mjs';

/** O código das ferramentas é real; somente I/O é substituído por memória. */
export async function memoryHarness(tenant, images, review = {}) {
  const pages = [];
  const clone = (value) => structuredClone(value);
  function sql(parts, ...values) {
    const query = parts.join('?').replace(/\s+/g, ' ').trim();
    const operation = () => {
      if (query.startsWith('select')) return [];
      if (query.startsWith('insert into pages')) {
        const [tenantId, slug, type, title, seo, meta, blocks] = values;
        const old = pages.find((page) => page.slug === slug);
        const page = {
          ...old,
          id: old?.id ?? randomUUID(),
          tenantId,
          slug,
          type,
          title,
          seo: JSON.parse(seo),
          meta: JSON.parse(meta),
          blocks: blocks ? JSON.parse(blocks) : (old?.blocks ?? []),
          publishedBlocks: old?.publishedBlocks ?? null,
          publishedSeo: old?.publishedSeo ?? null,
        };
        if (old) Object.assign(old, page);
        else pages.push(page);
        return [];
      }
      if (query.startsWith('update pages set blocks')) {
        const page = pages.find((page) => page.id === values[1]);
        if (!page) throw new Error('Página sintética ausente');
        page.blocks = JSON.parse(values[0]);
        return [];
      }
      if (query.startsWith('update pages set seo')) {
        const page = pages.find((page) => page.id === values[2]);
        if (!page) throw new Error('Página sintética ausente');
        page.seo = JSON.parse(values[0]);
        page.meta = JSON.parse(values[1]);
        return [];
      }
      if (
        query.startsWith('update tenants') &&
        query.includes('brief = brief ||')
      ) {
        Object.assign(tenant.brief, JSON.parse(values[0]));
        if (query.includes('brand =')) {
          tenant.brand = { ...tenant.brand, ...JSON.parse(values[1]) };
          tenant.dials = JSON.parse(values[2]);
        }
        return [];
      }
      throw new Error(`I/O não autorizado no ensaio: ${query.slice(0, 90)}`);
    };
    return Promise.resolve().then(operation);
  }
  sql.transaction = async (operations) => {
    const before = clone(pages);
    try {
      return await Promise.all(operations);
    } catch (error) {
      pages.splice(0, pages.length, ...before);
      throw error;
    }
  };
  const imageQueries = {
    listImages: async () => clone(images),
    getGuide: async () => clone(tenant.imageGuide),
    setGuide: async (_id, guide) => {
      tenant.imageGuide = clone(guide);
      return guide;
    },
    guideIsEmpty: (guide) => Object.keys(guide).length === 0,
  };
  const { guideTool } = await loadModule('lib/ai/guide-tool.ts', {
    '@/lib/images/queries': imageQueries,
  });
  const { buildTools } = await loadModule('lib/ai/tools.ts', {
    '@/lib/db': { db: () => sql },
    '@/lib/tenant-queries': {
      listPages: async () => clone(pages),
      getPage: async (_id, slug) =>
        clone(pages.find((page) => page.slug === slug) ?? null),
      getTenantBySlug: async () => clone(tenant),
    },
    '@/lib/images/queries': imageQueries,
    '@/lib/ai/guide-tool': { guideTool },
    '@/lib/design/uniqueness': {
      compositionConflict: async () => null,
      compositionConflictMessage: () => '',
    },
    '@/lib/ai/reference': {
      readReference: async (url) => ({
        url,
        status: 'inacessivel',
        motivo: 'Sem fonte externa neste ensaio',
        lidoEm: new Date().toISOString(),
      }),
    },
    '@/lib/sites/publish': {
      publishSite: async () => {
        throw new Error('Publicação proibida no ensaio');
      },
    },
    ...review,
  });
  return {
    tenant,
    images,
    pages,
    buildTools: (context) => buildTools(clone(tenant), context),
  };
}
