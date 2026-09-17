import { connection } from 'next/server';
import editorData from '@/content/editor.json';

export type PremiumEditorValues = Record<string, string>;
type Content = {
  revision: number;
  values: PremiumEditorValues;
  updatedAt: string | null;
};
type Target = { page: string; block: string; path: string };
type Field = { key: string; value: string; target?: Target };
type Contract = {
  version: 1;
  pages: { sections: { fields: Field[] }[] }[];
};

export const premiumEditor = editorData as Contract;

export function defaultPremiumValues(): PremiumEditorValues {
  return Object.fromEntries(
    premiumEditor.pages.flatMap((page) =>
      page.sections.flatMap((section) =>
        section.fields.map((field) => [field.key, field.value]),
      ),
    ),
  );
}

export async function loadPremiumContent(
  tenantSlug: string,
  previewToken?: string,
): Promise<Content> {
  await connection();
  const fallback: Content = {
    revision: 0,
    values: defaultPremiumValues(),
    updatedAt: null,
  };
  const token = process.env.EIXU_PREMIUM_TOKEN;
  if (!token) {
    if (previewToken)
      throw new Error('Token da ponte Premium não configurado.');
    return fallback;
  }
  try {
    const base = process.env.EIXU_PLATFORM_URL || 'https://eixu.com.br';
    const url = new URL('/api/premium/content', base);
    if (previewToken) url.searchParams.set('preview', previewToken);
    const response = await fetch(url, {
      headers: {
        authorization: `Bearer ${token}`,
        'x-eixu-site-host': `${tenantSlug}.eixu.com.br`,
      },
      cache: 'no-store',
    });
    if (!response.ok) {
      if (previewToken)
        throw new Error(`Prévia Premium recusada (${response.status}).`);
      return fallback;
    }
    const content = (await response.json()) as Partial<Content>;
    const invalid =
      !Number.isInteger(content.revision) ||
      !content.values ||
      typeof content.values !== 'object' ||
      Array.isArray(content.values);
    if (invalid) {
      if (previewToken)
        throw new Error('A ponte Premium devolveu conteúdo inválido.');
      return fallback;
    }
    return {
      revision: content.revision!,
      values: { ...fallback.values, ...content.values },
      updatedAt:
        typeof content.updatedAt === 'string' ? content.updatedAt : null,
    };
  } catch (error) {
    if (previewToken) throw error;
    return fallback;
  }
}

function setPath(root: Record<string, unknown>, path: string, value: string) {
  const parts = path.split('.');
  let current: unknown = root;
  for (let index = 0; index < parts.length - 1; index += 1) {
    if (!current || typeof current !== 'object') return;
    current = (current as Record<string, unknown>)[parts[index]];
  }
  if (!current || typeof current !== 'object') return;
  (current as Record<string, unknown>)[parts.at(-1)!] = value;
}

export function applyPremiumValues<
  T extends {
    slug: string;
    blocks: { id: string; props: Record<string, unknown> }[];
  },
>(pages: T[], values: PremiumEditorValues): T[] {
  const result = structuredClone(pages);
  for (const page of premiumEditor.pages)
    for (const section of page.sections)
      for (const field of section.fields) {
        if (!field.target || typeof values[field.key] !== 'string') continue;
        const targetPage = result.find(
          (candidate) => candidate.slug === field.target!.page,
        );
        const block = targetPage?.blocks.find(
          (candidate) => candidate.id === field.target!.block,
        );
        if (block) setPath(block.props, field.target.path, values[field.key]);
      }
  return result;
}
