const BLOB_HOST_SUFFIXES = [
  '.public.blob.vercel-storage.com',
  '.blob.vercel-storage.com',
];

function parsedHttpsUrl(value) {
  if (typeof value !== 'string' || value.length > 2_048) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port)
      return null;
    return url;
  } catch {
    return null;
  }
}

export function isVercelBlobUrl(value) {
  const url = parsedHttpsUrl(value);
  if (!url) return false;
  return BLOB_HOST_SUFFIXES.some(
    (suffix) =>
      url.hostname.length > suffix.length && url.hostname.endsWith(suffix),
  );
}

export function isTenantBlobUrl(value, slug) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || !isVercelBlobUrl(value))
    return false;
  const url = new URL(value);
  return url.pathname.startsWith(`/tenants/${slug}/`);
}
