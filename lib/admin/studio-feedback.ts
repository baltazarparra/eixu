export type StudioOperation =
  | 'preview'
  | 'publish'
  | 'upload'
  | 'content'
  | 'cancel'
  | 'rollback';

const failures: Record<StudioOperation, string> = {
  preview: 'Não foi possível abrir a prévia. Tente recarregá-la.',
  publish: 'Não foi possível publicar o site. O rascunho está preservado.',
  upload: 'Não foi possível enviar a imagem. Tente novamente.',
  content: 'Não foi possível salvar o conteúdo. Tente novamente.',
  cancel: 'Não foi possível confirmar o cancelamento. Tente novamente.',
  rollback: 'Não foi possível republicar a versão anterior. Tente novamente.',
};

/** Falhas operacionais não devem pedir uma nova geração pelo chat. */
export function studioOperationErrorMessage(
  message: string,
  operation: StudioOperation,
): string {
  if (
    (operation === 'publish' || operation === 'rollback') &&
    /EIXU_VERCEL_(?:TEAM_ID|ROOT_PROJECT_ID|TOKEN)|VERCEL_(?:ORG_ID|PROJECT_ID)/i.test(
      message,
    )
  )
    return 'A publicação não foi concluída porque a integração com a Vercel precisa ser configurada. O rascunho está preservado.';
  if (
    !message.trim() ||
    /Step ["“].+["”] failed|unknown format|after \d+ retries/i.test(message)
  )
    return failures[operation];
  return message;
}
