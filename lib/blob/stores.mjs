/** O token explícito impede que OIDC/BLOB_STORE_ID selecione outro store. */
function configuredStore(variable, env) {
  const token = env[variable]?.trim();
  if (!token) throw new Error(`${variable} é obrigatório.`);
  const storeId = /^vercel_blob_rw_([^_]+)_/.exec(token)?.[1];
  if (!storeId)
    throw new Error(`${variable} deve conter um token de Blob válido.`);
  return { token, storeId };
}

export function publicBlobOptions(env = process.env) {
  const { token } = configuredStore('BLOB_READ_WRITE_TOKEN', env);
  return { token };
}

export function privateBlobOptions(env = process.env) {
  const publicStore = configuredStore('BLOB_READ_WRITE_TOKEN', env);
  const privateStore = configuredStore('STUDIO_BLOB_READ_WRITE_TOKEN', env);
  if (publicStore.storeId === privateStore.storeId)
    throw new Error(
      'O Studio exige stores Blob distintos para arquivos públicos e privados.',
    );
  return { token: privateStore.token };
}

/** Identidade não secreta, usada para vincular o manifesto de reset ao store. */
export function blobStoreId(access, env = process.env) {
  const { token } =
    access === 'private' ? privateBlobOptions(env) : publicBlobOptions(env);
  return token.split('_')[3];
}
