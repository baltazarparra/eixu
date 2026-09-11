'use client';

import { startTransition, useActionState, useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  confirmationAccepted,
  deletionImpact,
  requiresSlugConfirmation,
  type DeletableTenant,
} from '@/lib/admin/tenant-delete';
import { deleteTenantAction } from '@/app/(admin)/admin/actions';

/**
 * `<dialog>` nativo: prende o foco, fecha no Esc e devolve o foco ao gatilho
 * sem biblioteca. Os componentes de UI genéricos do repositório usam os tokens
 * do institucional e não valem para o painel.
 */
export function DeleteTenantDialog({
  tenant,
  onClose,
  onDeleted,
}: {
  tenant: DeletableTenant | null;
  onClose: () => void;
  onDeleted: (slug: string) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [typed, setTyped] = useState('');
  const [state, formAction, pending] = useActionState(deleteTenantAction, null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (tenant && !dialog.open) {
      setTyped('');
      dialog.showModal();
    }
    if (!tenant && dialog.open) dialog.close();
  }, [tenant]);

  useEffect(() => {
    if (state?.ok && state.slug) onDeleted(state.slug);
  }, [state, onDeleted]);

  if (!tenant) return <dialog ref={ref} className="admin-dialog" />;
  const needsSlug = requiresSlugConfirmation(tenant);
  const ready = confirmationAccepted(tenant, typed);

  return (
    <dialog ref={ref} className="admin-dialog" onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          startTransition(() => formAction(data));
        }}
      >
        <fieldset disabled={pending}>
          <input type="hidden" name="slug" value={tenant.slug} />
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <AlertTriangle size={18} className="text-[var(--color-err)]" />
            Excluir {tenant.name}?
          </h2>
          <ul className="mt-4 text-sm text-[var(--color-muted)]">
            {deletionImpact(tenant).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="mt-4 text-sm">Não há como desfazer.</p>
          {needsSlug ? (
            <label className="admin-field mt-5">
              <span>Digite {tenant.slug} para confirmar</span>
              <input
                className="admin-input"
                name="confirm"
                autoComplete="off"
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
              />
            </label>
          ) : null}
          {state && !state.ok ? (
            <p
              aria-live="polite"
              className="mt-4 text-sm text-[var(--color-err)]"
            >
              {state.message}
            </p>
          ) : null}
          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <button
              type="button"
              className="admin-secondary"
              onClick={() => ref.current?.close()}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="admin-danger"
              disabled={!ready || pending}
            >
              {pending ? 'Excluindo…' : 'Excluir definitivamente'}
            </button>
          </div>
        </fieldset>
      </form>
    </dialog>
  );
}
