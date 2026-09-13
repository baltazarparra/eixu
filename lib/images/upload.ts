import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { del } from '@vercel/blob';
import { putTenantBlob, UploadError } from '@/lib/blob/tenant-files';
import { insertImage } from '@/lib/images/queries';
import {
  IMAGE_UPLOAD_MAX_BYTES,
  imageUploadError,
} from '@/lib/images/upload-policy';

/** Valida pixels e registra o upload no mesmo acervo numerado da geração. */
export async function uploadLibraryImage(tenantId: string, file: File) {
  const error = imageUploadError(file);
  if (error)
    throw new UploadError(
      error,
      file.size > IMAGE_UPLOAD_MAX_BYTES ? 413 : 415,
    );

  let processed;
  try {
    const source = sharp(Buffer.from(await file.arrayBuffer()), {
      limitInputPixels: 40_000_000,
      failOn: 'warning',
    });
    const metadata = await source.metadata();
    if (
      !['jpeg', 'png', 'webp', 'heif'].includes(metadata.format ?? '') ||
      (metadata.pages ?? 1) > 1
    )
      throw new Error('Formato inválido');
    // Orientação EXIF aplicada aos pixels; metadados removidos na saída.
    processed = await source
      .rotate()
      .webp({ quality: 90 })
      .toBuffer({ resolveWithObject: true });
  } catch {
    throw new UploadError(
      'Não foi possível ler a imagem. Envie um JPG, PNG, WebP ou AVIF estático válido, com até 40 megapixels.',
      415,
    );
  }

  const { width, height } = processed.info;
  const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
  const divisor = gcd(width, height);
  const batchId = randomUUID();
  const title =
    file.name
      .replace(/\.[^.]+$/, '')
      .replace(/[_-]+/g, ' ')
      .trim()
      .slice(0, 140) || 'Imagem enviada';
  const blob = await putTenantBlob(
    tenantId,
    `uploads/${batchId}.webp`,
    processed.data,
    {
      access: 'public',
      addRandomSuffix: false,
      contentType: 'image/webp',
    },
  );
  try {
    return await insertImage({
      tenantId,
      batchId,
      requestText: title,
      targetBlock: 'livre',
      ratio: `${width / divisor}:${height / divisor}`,
      model: 'upload',
      promptFinal: '',
      url: blob.url,
      blobPath: blob.pathname,
      kind: 'foto',
      alt: title,
      width,
      height,
    });
  } catch (error) {
    await del(blob.url).catch(() => undefined);
    throw error;
  }
}
