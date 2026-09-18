import { getVercelOidcToken } from '@vercel/oidc';

function configuredTokenStore(variable, env) {
  const token = env[variable]?.trim();
  if (!token) throw new Error(`${variable} é obrigatório.`);
  const storeId = /^vercel_blob_rw_([^_]+)_/.exec(token)?.[1];
  if (!storeId)
    throw new Error(`${variable} deve conter um token de Blob válido.`);
  return { token, storeId };
}

export function publicBlobOptions(env = process.env) {
  const { token } = configuredTokenStore('BLOB_READ_WRITE_TOKEN', env);
  return { token };
}

function configuredPrivateStore(env) {
  const value = env.STUDIO_BLOB_STORE_ID?.trim();
  if (!value) throw new Error('STUDIO_BLOB_STORE_ID é obrigatório.');
  if (!/^store_[a-zA-Z0-9]+$/.test(value))
    throw new Error('STUDIO_BLOB_STORE_ID deve conter um ID de Blob válido.');
  return { storeId: value.slice('store_'.length) };
}

function distinctPrivateStore(env) {
  const publicStore = configuredTokenStore('BLOB_READ_WRITE_TOKEN', env);
  const privateStore = configuredPrivateStore(env);
  if (publicStore.storeId === privateStore.storeId)
    throw new Error(
      'O Studio exige stores Blob distintos para arquivos públicos e privados.',
    );
  return privateStore;
}

/**
 * O token OIDC é curto, renovável e obtido pela Vercel no momento da operação.
 * Passá-lo explicitamente impede o SDK de cair no token do store público.
 */
export async function privateBlobOptions(
  env = process.env,
  oidcToken = getVercelOidcToken,
) {
  const privateStore = distinctPrivateStore(env);
  const token = await oidcToken();
  if (!token)
    throw new Error('OIDC da Vercel não está disponível para o Blob privado.');
  return { storeId: privateStore.storeId, oidcToken: token };
}

/** Identidade não secreta, usada para vincular o manifesto de reset ao store. */
export function blobStoreId(access, env = process.env) {
  if (access === 'private') return distinctPrivateStore(env).storeId;
  return configuredTokenStore('BLOB_READ_WRITE_TOKEN', env).storeId;
}
