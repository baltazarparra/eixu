/** Só recibos de escrita confirmada podem antecipar a atualização da prévia. */
export function changesPreview(name: string, output: unknown): boolean {
  if (!output || typeof output !== 'object') return false;
  const out = output as Record<string, unknown>;
  if (out.error || out.ok === false || out.changed === false) return false;
  switch (name) {
    case 'edit_page':
    case 'update_block':
    case 'insert_block':
    case 'remove_block':
    case 'move_block':
    case 'set_blocks':
    case 'build_site':
    case 'repair_site':
    case 'delete_page':
    case 'set_design':
    case 'set_site_logo':
    case 'set_seo':
      return out.ok === true;
    case 'create_page':
      return out.created === true;
    case 'set_brand':
      return Boolean(out.brand);
    case 'update_image':
      return (
        out.ok === true &&
        Array.isArray(out.paginasAtualizadas) &&
        out.paginasAtualizadas.length > 0
      );
    default:
      return false;
  }
}
