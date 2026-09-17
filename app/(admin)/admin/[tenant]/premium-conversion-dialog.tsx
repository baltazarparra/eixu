'use client';

import { Gem, Globe2, LockKeyhole, Workflow } from 'lucide-react';
import { useEffect, useRef } from 'react';

type Props = {
  open: boolean;
  canonicalUrl: string;
  hasDraft: boolean;
  starting: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function PremiumConversionDialog({
  open,
  canonicalUrl,
  hasDraft,
  starting,
  onClose,
  onConfirm,
}: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="admin-dialog admin-premium-conversion-dialog"
      aria-labelledby="premium-conversion-title"
      onCancel={(event) => {
        if (starting) event.preventDefault();
        else onClose();
      }}
      onClose={onClose}
    >
      <header>
        <span aria-hidden="true">
          <Gem size={22} />
        </span>
        <div>
          <p>Projeto Premium</p>
          <h2 id="premium-conversion-title">Transformar este site?</h2>
        </div>
      </header>
      <p className="admin-dialog-copy">
        A conversão parte da versão que já está publicada e prepara um projeto
        de código próprio. Você acompanha tudo sem tirar o site do ar.
      </p>
      <ul>
        <li>
          <Globe2 size={17} aria-hidden="true" />
          <span>
            <strong>Mesmo endereço</strong>
            {canonicalUrl.replace(/^https?:\/\//, '')}
          </span>
        </li>
        <li>
          <Workflow size={17} aria-hidden="true" />
          <span>
            <strong>Entrega acompanhada</strong>
            Preparação, revisão e publicação aparecem em etapas.
          </span>
        </li>
        <li>
          <LockKeyhole size={17} aria-hidden="true" />
          <span>
            <strong>Versão protegida</strong>
            O gerador é bloqueado para não misturar mudanças durante a entrega.
          </span>
        </li>
      </ul>
      {hasDraft ? (
        <p className="admin-premium-conversion-draft" role="note">
          Há alterações em rascunho. Elas ficam preservadas, mas não entram na
          primeira versão Premium. Publique antes se precisar levá-las.
        </p>
      ) : null}
      <footer className="admin-dialog-footer">
        <button
          type="button"
          className="admin-secondary"
          disabled={starting}
          onClick={onClose}
        >
          Agora não
        </button>
        <button
          type="button"
          className="admin-primary"
          disabled={starting}
          onClick={onConfirm}
        >
          <Gem size={15} aria-hidden="true" />
          {starting ? 'Iniciando…' : 'Iniciar conversão'}
        </button>
      </footer>
    </dialog>
  );
}
