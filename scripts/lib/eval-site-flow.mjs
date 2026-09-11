/** Conta chamadas de fase; a aprovação do runner não gasta esse orçamento. */
export async function runEvaluationPhases({
  readSnapshot,
  approveImage,
  onApproved = () => {},
  nextPhase,
  runPhase,
  maxPhases = 14,
}) {
  for (let attempts = 0; attempts <= maxPhases; attempts += 1) {
    let snapshot = await readSnapshot();
    if (approveImage) {
      const pending = snapshot.images.filter(
        (image) => image.status === 'candidata',
      );
      if (pending.length) {
        for (const image of pending) await approveImage(snapshot, image);
        onApproved(pending.length);
        snapshot = await readSnapshot();
        if (snapshot.images.some((image) => image.status === 'candidata'))
          return {
            completed: false,
            next: 'cenas',
            reason: 'approval-pending',
            attempts,
          };
      }
    }
    const next = nextPhase(snapshot);
    if (next === 'pronto')
      return { completed: true, next, reason: 'completed', attempts };
    if (attempts === maxPhases)
      return { completed: false, next, reason: 'phase-budget', attempts };
    try {
      await runPhase(snapshot, next);
    } catch {
      return {
        completed: false,
        next,
        reason: 'phase-error',
        attempts: attempts + 1,
      };
    }
  }
}
