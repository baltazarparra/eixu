export default function AdminLoading() {
  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-16">
      <p className="text-sm text-[var(--color-muted)]" aria-live="polite">
        Carregando seu espaço de trabalho…
      </p>
      <div className="mt-6 h-32 rounded-xl border bg-[var(--color-surface)]" />
    </main>
  );
}
