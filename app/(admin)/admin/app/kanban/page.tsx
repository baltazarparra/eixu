import { permanentRedirect } from 'next/navigation';

/** Compatibilidade com o endereço publicado no primeiro piloto. */
export default function LegacyKanbanPage() {
  permanentRedirect('/admin/kanban');
}
