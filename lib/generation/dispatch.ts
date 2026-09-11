import { createStepToken } from '@/lib/generation/token';

/**
 * Uma etapa chama a próxima pela rota HTTP: cada fase precisa da própria
 * invocação para caber no limite de duração da função.
 *
 * A origem vem do run, não de VERCEL_URL: o projeto protege os domínios de
 * deployment com SSO, e a chamada interna morreria numa tela de login. Em
 * pré-visualização o segredo de automação libera a passagem; no domínio
 * próprio o cabeçalho é inofensivo.
 */
export async function dispatchStep(input: {
  origin: string;
  slug: string;
  runId: string;
}): Promise<void> {
  const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  const response = await fetch(
    `${input.origin}/api/admin/${input.slug}/generation/step`,
    {
      method: 'POST',
      headers: {
        'x-eixu-run': await createStepToken(input.runId),
        ...(bypass ? { 'x-vercel-protection-bypass': bypass } : {}),
      },
      signal: AbortSignal.timeout(15_000),
    },
  );
  if (!response.ok && response.status !== 202)
    throw new Error(`A etapa não pôde ser iniciada (${response.status}).`);
}
