import { redirect } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import { readKanbanBoard } from '@/lib/kanban/queries';
import { KanbanBoard } from './board';
import styles from './kanban.module.css';

export const dynamic = 'force-dynamic';

export default async function KanbanPage() {
  if (!(await isAuthenticated()))
    redirect('/admin/login?returnTo=/admin/kanban');
  const initial = await readKanbanBoard();
  return (
    <main className={styles.page}>
      <KanbanBoard initial={initial} />
    </main>
  );
}
