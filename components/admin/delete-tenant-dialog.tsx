'use client';

import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { DeletableTenant } from '@/lib/admin/tenant-delete';
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
  const ready = typed.trim().toLowerCase() === tenant.slug;

  return (
    <dialog
      ref={ref}
      className="admin-dialog"
      onClose={onClose}
      aria-labelledby="delete-tenant-title"
      aria-describedby="delete-tenant-description"
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          startTransition(() => formAction(data));
        }}
      >
        <fieldset disabled={pending}>
          <input type="hidden" name="slug" value={tenant.slug} />
          <h2 id="delete-tenant-title">Excluir {tenant.name}?</h2>
          <p className="admin-dialog-copy" id="delete-tenant-description">
            {tenant.status === 'published'
              ? 'O site sai do ar imediatamente. '
              : ''}
            A exclusão é definitiva. Confira o que é apagado junto:
          </p>
          <dl className="admin-dialog-impact">
            {(
              [
                ['Páginas e rascunhos', tenant.pageCount],
                ['Imagens no acervo', tenant.imageCount],
                ['Leads recebidos', tenant.leadCount],
              ] as const
            ).map(([label, count]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>
                  {count === undefined
                    ? 'Não informado'
                    : count === 0
                      ? 'nenhum'
                      : count}
                </dd>
              </div>
            ))}
          </dl>
          <p className="admin-dialog-copy">
            Também apaga conversas, eventos de tráfego, gastos, logo e arquivos
            enviados. Não há como desfazer.
          </p>
          <label className="admin-field mt-5">
            <span>Digite {tenant.slug} para confirmar</span>
            <input
              className="admin-input admin-numeric"
              name="confirm"
              autoComplete="off"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
            />
          </label>
          {state && !state.ok ? (
            <p
              aria-live="polite"
              className="mt-4 text-sm text-[var(--color-err)]"
            >
              {state.message}
            </p>
          ) : null}
          <div className="admin-dialog-footer">
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
