'use client';

import { useEffect } from 'react';
import { EDIT_PROTOCOL, type PointedAnchor } from './edit-protocol';

const HIGHLIGHT = 'eixu-pointing-target';

/**
 * Modo apontar da prévia: o operador clica no elemento e o painel recebe o
 * bloco e o texto visível dele.
 *
 * Sem isso, um pedido com print anexado só informava a URL da imagem, e o alvo
 * ficava por conta do palpite do modelo, inclusive em remoções.
 */
export function PreviewPointer({ page }: { page: string }) {
  useEffect(() => {
    let active = false;
    let current: HTMLElement | null = null;

    const clear = () => {
      current?.classList.remove(HIGHLIGHT);
      current = null;
    };
    const scopeOf = (target: EventTarget | null): HTMLElement | null => {
      if (!(target instanceof HTMLElement)) return null;
      const block = target.closest<HTMLElement>('[data-block-id]');
      if (!block) return null;
      const item = target.closest<HTMLElement>('article, li, figure');
      return item && block.contains(item) && item !== block ? item : block;
    };
    const anchorOf = (scope: HTMLElement): PointedAnchor | undefined => {
      const block = scope.closest<HTMLElement>('[data-block-id]');
      const blockId = block?.dataset.blockId;
      if (!blockId) return undefined;
      const text = (scope.innerText ?? '').replace(/\s+/g, ' ').trim();
      const heading = scope
        .querySelector('h1, h2, h3, h4, h5, strong')
        ?.textContent?.replace(/\s+/g, ' ')
        .trim();
      return {
        blockId,
        blockType: block?.dataset.block,
        text: text.slice(0, 600),
        label: (heading || text || 'elemento apontado').slice(0, 80),
      };
    };
    const onMove = (event: MouseEvent) => {
      if (!active) return;
      const scope = scopeOf(event.target);
      if (scope === current) return;
      clear();
      current = scope;
      current?.classList.add(HIGHLIGHT);
    };
    const onClick = (event: MouseEvent) => {
      if (!active) return;
      event.preventDefault();
      event.stopPropagation();
      const scope = scopeOf(event.target);
      const anchor = scope ? anchorOf(scope) : undefined;
      if (!anchor) return;
      window.parent?.postMessage(
        { type: EDIT_PROTOCOL, action: 'anchor', page, anchor },
        window.location.origin,
      );
      setPointing(false);
    };
    const setPointing = (enabled: boolean) => {
      active = enabled;
      document.body.classList.toggle('eixu-pointing', enabled);
      if (!enabled) clear();
    };
    const onMessage = (event: MessageEvent) => {
      if (
        event.origin !== window.location.origin ||
        event.data?.type !== EDIT_PROTOCOL ||
        event.data?.action !== 'point'
      )
        return;
      setPointing(event.data.enabled === true);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPointing(false);
    };

    window.addEventListener('message', onMessage);
    // A prévia recarrega a cada edição: sem avisar que montou, um modo ligado
    // antes do carregamento ficaria inerte e o clique não faria nada.
    window.parent?.postMessage(
      { type: EDIT_PROTOCOL, action: 'point-ready' },
      window.location.origin,
    );
    document.addEventListener('mousemove', onMove, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('message', onMessage);
      document.removeEventListener('mousemove', onMove, true);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKey);
      setPointing(false);
    };
  }, [page]);
  return null;
}
