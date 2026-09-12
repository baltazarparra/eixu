'use client';

import { createContext, useContext, type ReactNode } from 'react';

/**
 * Sem o rail de clientes, a identidade do operador e a saída passam a viver
 * nos cabeçalhos. O formulário de logout é montado no servidor e atravessa a
 * fronteira como elemento pronto; aqui só circula até quem o desenha.
 */
export const AdminSession = createContext<{
  operator: string;
  logout: ReactNode;
} | null>(null);

export function useAdminSession() {
  return useContext(AdminSession);
}
