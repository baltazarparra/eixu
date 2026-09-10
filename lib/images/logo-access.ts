/** Uploads manuais têm arquivo direto; logos gerados têm pasta de lote. */
export function canApplyLogo(
  slug: string,
  url: string,
  image?: { kind: string; status: string } | null,
): boolean {
  if (image) return image.kind === 'logo' && image.status === 'aprovada';
  try {
    const parsed = new URL(url);
    const prefix = `/tenants/${slug}/logo/`;
    const file = parsed.pathname.slice(prefix.length);
    return (
      parsed.protocol === 'https:' &&
      parsed.hostname.endsWith('.public.blob.vercel-storage.com') &&
      parsed.pathname.startsWith(prefix) &&
      /^\d+-[a-z0-9.-]+$/.test(file) &&
      !file.includes('/')
    );
  } catch {
    return false;
  }
}
