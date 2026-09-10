'use client';
import { startTransition, useActionState, useRef } from 'react';
import { saveSpendAction } from '../../actions';

export function SpendForm({
  tenant,
  period,
}: {
  tenant: string;
  period: { start: string; end: string };
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [notice, action, pending] = useActionState(
    async (
      previous: Awaited<ReturnType<typeof saveSpendAction>> | null,
      data: FormData,
    ) => {
      const result = await saveSpendAction(previous, data);
      if (result.ok) formRef.current?.reset();
      return result;
    },
    null,
  );
  return (
    <form
      ref={formRef}
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        startTransition(() => action(data));
      }}
      className="mt-5"
    >
      <input type="hidden" name="tenant" value={tenant} />
      <fieldset
        disabled={pending}
        className="grid items-end gap-4 sm:grid-cols-3"
      >
        <label className="admin-field">
          <span>Nome da campanha</span>
          <input
            className="admin-input"
            name="campaign"
            placeholder="Valor de utm_campaign"
            maxLength={160}
            required
          />
        </label>
        <label className="admin-field">
          <span>Canal</span>
          <select className="admin-input" name="channel">
            <option value="google">Google</option>
            <option value="meta">Meta</option>
            <option value="other">Outro</option>
          </select>
        </label>
        <label className="admin-field">
          <span>Gasto em reais</span>
          <input
            className="admin-input"
            name="spend"
            inputMode="decimal"
            placeholder="0,00"
            required
          />
        </label>
        <label className="admin-field">
          <span>Início do gasto</span>
          <input
            className="admin-input"
            type="date"
            name="start"
            defaultValue={period.start}
            required
          />
        </label>
        <label className="admin-field">
          <span>Fim do gasto</span>
          <input
            className="admin-input"
            type="date"
            name="end"
            defaultValue={period.end}
            required
          />
        </label>
        <button className="admin-primary" type="submit">
          {pending ? 'Salvando…' : 'Adicionar gasto'}
        </button>
      </fieldset>
      {notice ? (
        <output aria-live="polite" className="mt-4 block text-sm">
          {notice.message}
        </output>
      ) : null}
    </form>
  );
}
