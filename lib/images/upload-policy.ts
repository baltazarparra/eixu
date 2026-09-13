/** Margem para multipart dentro do limite de 4,5 MB da função em produção. */
export const IMAGE_UPLOAD_MAX_BYTES = 4 * 1024 * 1024;
export const IMAGE_UPLOAD_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
];
export const IMAGE_UPLOAD_ACCEPT = IMAGE_UPLOAD_TYPES.join(',');
export const IMAGE_UPLOAD_HINT = 'JPG, PNG, WebP ou AVIF, até 4 MB por imagem.';

export function imageUploadError(
  file: Pick<File, 'type' | 'size'>,
): string | null {
  if (!IMAGE_UPLOAD_TYPES.includes(file.type)) return IMAGE_UPLOAD_HINT;
  if (!file.size) return 'O arquivo está vazio.';
  if (file.size > IMAGE_UPLOAD_MAX_BYTES) return 'A imagem deve ter até 4 MB.';
  return null;
}
