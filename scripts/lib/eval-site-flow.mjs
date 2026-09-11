/** Executa as fases pelo estado persistido, sem etapas de aprovação. */
export async function runEvaluationPhases({
  readSnapshot,
  nextPhase,
  runPhase,
  maxPhases = 14,
}) {
  for (let attempts = 0; attempts <= maxPhases; attempts += 1) {
    const snapshot = await readSnapshot();
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
