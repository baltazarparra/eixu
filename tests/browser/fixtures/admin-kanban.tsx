import { createRoot } from 'react-dom/client';
import { KanbanBoard } from '@/app/(admin)/admin/app/kanban/board';
import type { KanbanSnapshot } from '@/lib/kanban/schema';
import styles from '@/app/(admin)/admin/app/kanban/kanban.module.css';
import '@/app/(admin)/admin.css';

const initial = JSON.parse(
  document.getElementById('fixture-state')!.textContent!,
) as KanbanSnapshot;

createRoot(document.getElementById('root')!).render(
  <div className="admin-shell">
    <main className={styles.page}>
      <KanbanBoard initial={initial} />
    </main>
  </div>,
);
