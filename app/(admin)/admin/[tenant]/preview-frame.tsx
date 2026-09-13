'use client';

import { useEffect, useRef, useState, type Ref } from 'react';
import { Check, Loader2, RotateCw } from 'lucide-react';

/** A confirmação vem do iframe carregado, não do término da resposta do agente. */
export function PreviewFrame({
  src,
  device,
  frameRef,
}: {
  src: string;
  device: 'desktop' | 'mobile';
  frameRef?: Ref<HTMLIFrameElement>;
}) {
  const [attempt, setAttempt] = useState(0);
  const [settled, setSettled] = useState<{
    url: string;
    state: 'loaded' | 'error';
  } | null>(null);
  const scroll = useRef({ x: 0, y: 0 });
  const detach = useRef<() => void>(() => {});
  const url = attempt ? `${src}&reload=${attempt}` : src;
  const state = settled?.url === url ? settled.state : 'loading';

  useEffect(() => {
    if (state !== 'loading') return;
    const timer = setTimeout(() => setSettled({ url, state: 'error' }), 20_000);
    return () => clearTimeout(timer);
  }, [url, state]);
  useEffect(() => () => detach.current(), []);

  return (
    <div className="admin-preview-surface" data-device={device}>
      <div className="admin-preview-status" data-preview-state={state}>
        {state === 'loading' ? (
          <Loader2 size={12} aria-hidden="true" />
        ) : state === 'loaded' ? (
          <Check size={12} aria-hidden="true" />
        ) : null}
        <output>
          {state === 'loading'
            ? 'Atualizando prévia…'
            : state === 'loaded'
              ? 'Prévia atualizada'
              : 'Não foi possível carregar a prévia.'}
        </output>
        {state === 'error' ? (
          <button
            type="button"
            onClick={() => setAttempt((value) => value + 1)}
          >
            <RotateCw size={12} aria-hidden="true" /> Tentar novamente
          </button>
        ) : null}
      </div>
      <iframe
        ref={frameRef}
        src={url}
        title="Preview do site"
        className="admin-preview-frame"
        data-device={device}
        aria-busy={state === 'loading'}
        onError={() => setSettled({ url, state: 'error' })}
        onLoad={(event) => {
          const frame = event.currentTarget.contentWindow;
          if (!frame) return;
          try {
            const loaded = new URL(frame.location.href);
            const expected = new URL(url, window.location.origin);
            if (loaded.href === 'about:blank') return;
            if (
              loaded.origin !== expected.origin ||
              !loaded.pathname.startsWith('/s/') ||
              !frame.document.querySelector('.site-theme')
            ) {
              setSettled({ url, state: 'error' });
              return;
            }
            // Ignora um carregamento anterior que terminou depois de outra edição.
            if (
              loaded.searchParams.get('v') !== expected.searchParams.get('v') ||
              loaded.searchParams.get('reload') !==
                expected.searchParams.get('reload')
            )
              return;
            detach.current();
            // Uma edição do rodapé não deve devolver quem está conferindo ao topo.
            frame.scrollTo({
              left: scroll.current.x,
              top: scroll.current.y,
              behavior: 'instant',
            });
            const remember = () => {
              scroll.current = { x: frame.scrollX, y: frame.scrollY };
            };
            frame.addEventListener('scroll', remember, { passive: true });
            detach.current = () =>
              frame.removeEventListener('scroll', remember);
            setSettled({ url, state: 'loaded' });
          } catch {
            setSettled({ url, state: 'error' });
          }
        }}
      />
    </div>
  );
}
