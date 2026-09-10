import Link from 'next/link';
export default function AdminNotFound() {
  return (
    <main className="mx-auto max-w-lg px-6 py-24">
      <h1 className="text-2xl font-semibold">Cliente não encontrado</h1>
      <p className="mt-3 text-sm text-[var(--color-muted)]">
        Confira o endereço ou abra um cliente na lista do painel.
      </p>
      <Link href="/admin" className="admin-primary mt-6">
        Ver clientes
      </Link>
    </main>
  );
}
