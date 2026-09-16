'use client';

import {
  createContext,
  useCallback,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { CircleHelp } from 'lucide-react';

const STORAGE_KEY = 'eixu.admin.ajuda';
/** Sem provedor — cadastro novo, testes isolados — a ajuda fica à vista. */
const Help = createContext(true);

/**
 * A preferência mora no navegador do operador, não no React: o botão e a área
 * do formulário leem a mesma fonte e não precisam de estado compartilhado.
 */
const listeners = new Set<() => void>();
/** Armazenamento bloqueado tira a memória entre visitas, não o botão. */
let volatile = false;
function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}
function readPreference() {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'visivel';
  } catch {
    return volatile;
  }
}
function writePreference(next: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, next ? 'visivel' : 'oculta');
  } catch {
    volatile = next;
  }
  for (const listener of listeners) listener();
}
const serverPreference = () => false;

function usePreference() {
  return useSyncExternalStore(subscribe, readPreference, serverPreference);
}

export function useHelp() {
  return useContext(Help);
}

/** Nota de seção: entra logo abaixo do título, só com a ajuda ligada. */
export function HelpNote({ children }: { children: ReactNode }) {
  return useHelp() ? <p className="admin-help-note">{children}</p> : null;
}

/** Nota de campo: acompanha o próprio controle, nunca um painel à parte. */
export function HelpHint({ children }: { children: ReactNode }) {
  return useHelp() ? (
    <small className="admin-help-hint">{children}</small>
  ) : null;
}

/** Um botão só governa todo o texto de apoio do cadastro. */
export function HelpButton() {
  const visible = usePreference();
  const toggle = useCallback(() => writePreference(!visible), [visible]);
  return (
    <button
      type="button"
      className="admin-secondary admin-help-button"
      aria-pressed={visible}
      onClick={toggle}
    >
      <CircleHelp size={14} aria-hidden="true" />
      {visible ? 'Ocultar ajuda' : 'Ajuda'}
    </button>
  );
}

export function HelpArea({ children }: { children: ReactNode }) {
  const visible = usePreference();
  return <Help.Provider value={visible}>{children}</Help.Provider>;
}
