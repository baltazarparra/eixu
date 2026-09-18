const MAX_SOURCE_BYTES = 8_000;

export class PublicInputTooLargeError extends Error {
  constructor() {
    super('Corpo público acima do limite.');
  }
}

/** Lê streams sem confiar em Content-Length, que pode estar ausente ou incorreto. */
export async function readBoundedPublicBody(request, maxBytes) {
  const declaredHeader = request.headers.get('content-length');
  const declared = declaredHeader === null ? null : Number(declaredHeader);
  if (declared !== null && Number.isFinite(declared) && declared > maxBytes)
    throw new PublicInputTooLargeError();
  if (!request.body) return Buffer.alloc(0);

  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new PublicInputTooLargeError();
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, size);
}

export async function parseBoundedPublicJson(request, maxBytes) {
  const body = await readBoundedPublicBody(request, maxBytes);
  return JSON.parse(body.toString('utf8'));
}

export async function parseBoundedPublicFormData(request, maxBytes) {
  const contentType = request.headers.get('content-type') ?? '';
  if (
    !contentType.startsWith('application/x-www-form-urlencoded') &&
    !contentType.startsWith('multipart/form-data')
  )
    throw new TypeError('Formato de formulário inválido.');
  const body = await readBoundedPublicBody(request, maxBytes);
  return new Response(body, {
    headers: { 'content-type': contentType },
  }).formData();
}

export function boundedPublicSource(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  try {
    const serialized = JSON.stringify(value);
    if (Buffer.byteLength(serialized, 'utf8') > MAX_SOURCE_BYTES) return {};
    return JSON.parse(serialized);
  } catch {
    return {};
  }
}

export function parseBoundedPublicSource(value) {
  if (
    typeof value !== 'string' ||
    Buffer.byteLength(value, 'utf8') > MAX_SOURCE_BYTES
  )
    return {};
  try {
    return boundedPublicSource(JSON.parse(value));
  } catch {
    return {};
  }
}
