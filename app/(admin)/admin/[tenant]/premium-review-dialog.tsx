'use client';

import { GitPullRequest } from 'lucide-react';
import { useEffect, useRef } from 'react';

export function PremiumReviewDialog({
  pullRequestUrl,
}: {
  pullRequestUrl: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => dialog?.close();
  }, []);

  return (
    <dialog
      ref={ref}
      className="admin-dialog admin-premium-conversion-dialog admin-premium-review-dialog"
      aria-labelledby="premium-review-title"
      aria-describedby="premium-review-description"
    >
      <header>
        <span aria-hidden="true">
          <GitPullRequest size={22} />
        </span>
        <div>
          <p>Preparação concluída</p>
          <h2 id="premium-review-title">Só falta sua aprovação</h2>
        </div>
      </header>
      <p id="premium-review-description" className="admin-dialog-copy">
        O projeto Premium está pronto para revisão. A conversão aguarda sua
        aprovação para iniciar a publicação; o site atual continua no ar.
      </p>
      <p className="admin-dialog-copy">
        O botão abre a revisão no GitHub em outra aba. Revise a entrega e
        conclua em <strong>Merge pull request</strong> para continuar.
      </p>
      <footer className="admin-dialog-footer">
        <button
          type="button"
          className="admin-secondary"
          onClick={() => ref.current?.close()}
        >
          Revisar depois
        </button>
        <a
          className="admin-primary"
          href={pullRequestUrl}
          target="_blank"
          rel="noreferrer"
          onClick={() => ref.current?.close()}
        >
          <GitPullRequest size={15} aria-hidden="true" /> Revisar e aprovar
        </a>
      </footer>
    </dialog>
  );
}
