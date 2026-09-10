'use client';
import Link from 'next/link';

export default function AdminError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-[70dvh] max-w-lg flex-col justify-center px-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        Não foi possível carregar o painel
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-[var(--color-muted)]">
        A conexão pode ter sido interrompida. Tente carregar novamente para
        recuperar o estado salvo.
      </p>
      <div className="mt-6 flex gap-3">
        <button type="button" onClick={retry} className="admin-primary">
          Tentar novamente
        </button>
        <Link href="/admin" className="admin-secondary">
          Clientes
        </Link>
      </div>
    </main>
  );
}
