import { put } from '@vercel/blob';

export const UPLOAD_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/svg+xml',
]);
export const UPLOAD_MAX_BYTES = 8 * 1024 * 1024;

export class UploadError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** Nome previsível: canApplyLogo confere o formato do caminho do logo. */
function safeName(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9.]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'imagem'
  );
}

/**
 * Sobe uma imagem para o Vercel Blob, pública, no prefixo do cliente. Serve à
 * rota de upload do painel e ao cadastro, que grava o logo antes do tenant
 * existir e por isso não pode passar pela rota.
 */
export async function storeTenantFile(
  slug: string,
  kind: 'logo' | 'media',
  file: File,
): Promise<string> {
  if (!UPLOAD_TYPES.has(file.type))
    throw new UploadError(`Tipo não aceito: ${file.type}`, 415);
  if (file.size > UPLOAD_MAX_BYTES)
    throw new UploadError('Imagem acima de 8 MB.', 413);
  const blob = await put(
    `tenants/${slug}/${kind}/${Date.now()}-${safeName(file.name)}`,
    file,
    { access: 'public', addRandomSuffix: false, contentType: file.type },
  );
  return blob.url;
}
