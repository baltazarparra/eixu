export type ReferenceFailureReason =
  | 'rede'
  | 'tempo'
  | 'resposta'
  | 'captura'
  | 'desconhecido';

export type ReferenceFailure = {
  reason: ReferenceFailureReason;
  /** Frase pronta para o operador, sem atribuir causa não observada. */
  summary: string;
  detail: string;
};

/**
 * Converte o erro bruto em causa verificável. Sem isso o agente narra "site
 * fora do ar" para uma recusa pontual da origem ou um estouro de prazo nosso.
 * É função pura de propósito: a captura é substituída nos testes, o
 * diagnóstico não.
 */
export function referenceFailure(error: unknown): ReferenceFailure {
  const detail =
    error instanceof Error ? error.message : 'Falha desconhecida na captura.';
  const match = (pattern: RegExp) => pattern.test(detail);
  if (match(/aborted due to timeout|Navigation timeout|ETIMEDOUT/i))
    return {
      reason: 'tempo',
      summary:
        'A página não terminou de carregar dentro do prazo da captura. Não houve recusa observada da origem.',
      detail,
    };
  if (match(/Referência respondeu/))
    return {
      reason: 'resposta',
      summary: `A origem respondeu, mas recusou a leitura: ${detail}`,
      detail,
    };
  if (match(/Rede não pública|URL pública inválida/))
    return {
      reason: 'rede',
      summary: `O endereço não passou na política de rede da captura: ${detail}`,
      detail,
    };
  if (match(/net::|ECONNRESET|ECONNREFUSED|EAI_AGAIN|socket hang up/i))
    return {
      reason: 'rede',
      summary:
        'A conexão com a origem foi encerrada antes da resposta. Isso costuma ser intermitente e a mesma URL pode responder em nova tentativa.',
      detail,
    };
  if (match(/captureScreenshot|Protocol error/i))
    return {
      reason: 'captura',
      summary:
        'A página carregou, mas o navegador não conseguiu gerar a imagem.',
      detail,
    };
  return {
    reason: 'desconhecido',
    summary: `A captura falhou: ${detail}`,
    detail,
  };
}
