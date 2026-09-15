import styles from './kanban.module.css';

export default function KanbanLoading() {
  return (
    <main className={styles.page} aria-busy="true">
      <div className={styles.loadingHeader} />
      <div className={styles.loadingColumns}>
        <div />
        <div />
        <div />
      </div>
    </main>
  );
}
