'use client';

import Link from 'next/link';
import styles from './kanban.module.css';

export default function KanbanErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className={styles.page}>
      <div className={styles.loadError} role="alert">
        <h1>Não foi possível abrir o Kanban</h1>
        <p>Confira a conexão ou tente novamente.</p>
        <div className={styles.inlineActions}>
          <button className="admin-primary" onClick={reset}>
            Tentar novamente
          </button>
          <Link className="admin-secondary" href="/admin">
            Voltar aos clientes
          </Link>
        </div>
      </div>
    </main>
  );
}
