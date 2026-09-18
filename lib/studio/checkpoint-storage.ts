import { createHash } from 'node:crypto';
import { get } from '@vercel/blob';
import { privateBlobOptions } from '@/lib/blob/stores.mjs';

export async function readStudioCheckpoint(
  storageKey: string,
  codeRevision: string,
) {
  const blob = await get(storageKey, {
    ...privateBlobOptions(),
    access: 'private',
    useCache: false,
  });
  if (!blob || blob.statusCode !== 200)
    throw new Error('Checkpoint privado do projeto não foi encontrado.');
  const archive = Buffer.from(await new Response(blob.stream).arrayBuffer());
  if (createHash('sha256').update(archive).digest('hex') !== codeRevision)
    throw new Error('O checkpoint não corresponde à revisão registrada.');
  return archive;
}
