'use client';

import { useActionState } from 'react';
import { loginAction } from '../actions';

export default function LoginPage() {
  const [error, formAction, pending] = useActionState(loginAction, null);

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <form action={formAction} className="flex w-full max-w-sm flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-semibold tracking-[-0.02em]">EIXU Sites</h1>
          <p className="text-sm text-[var(--color-muted)]">Painel de geração e tráfego.</p>
        </div>
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium">Usuário</span>
          <input
            name="user"
            defaultValue="admin"
            autoComplete="username"
            className="rounded-md border bg-[var(--color-surface)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--color-accent)]"
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium">Senha</span>
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            className="rounded-md border bg-[var(--color-surface)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--color-accent)]"
          />
        </label>
        {error ? <p className="text-sm text-[var(--color-err)]">{error}</p> : null}
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-[var(--color-accent)] px-4 py-2.5 text-sm font-medium text-[var(--color-accent-ink)] disabled:opacity-60"
        >
          {pending ? 'Entrando' : 'Entrar'}
        </button>
      </form>
    </main>
  );
}
