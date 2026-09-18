import { createDownload, type Experimental_DownloadFunction } from 'ai';

/** O SDK converte URLs de mensagens e ferramentas fora dos steps do modelo. */
export async function downloadStudioAssetsStep(
  requests: Parameters<Experimental_DownloadFunction>[0],
) {
  'use step';
  const download = createDownload();
  return Promise.all(
    requests.map(async ({ url, isUrlSupportedByModel }) =>
      isUrlSupportedByModel ? null : download({ url }),
    ),
  );
}
