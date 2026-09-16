import type { Tenant } from '@/lib/types';

export const GENERATOR_LOCKED_MESSAGE =
  'Este projeto está em modo Premium. O site agora é mantido diretamente pelo code agent e o gerador não pode alterá-lo.';

export function generatorWriteBlocked(
  tenant: Pick<Tenant, 'maintenanceMode'>,
): boolean {
  // Fixtures e uma instância no curto intervalo antes da migração não trazem
  // a coluna; o default persistido continua sendo o gerador.
  return Boolean(
    tenant.maintenanceMode && tenant.maintenanceMode !== 'generator',
  );
}

export function generatorWriteMessage(
  tenant: Pick<Tenant, 'maintenanceMode'>,
): string {
  return tenant.maintenanceMode === 'converting'
    ? 'A conversão para Premium está em andamento. O site publicado continua no ar, mas o gerador fica bloqueado até a conversão terminar.'
    : GENERATOR_LOCKED_MESSAGE;
}
