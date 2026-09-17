'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Loader2, RotateCw } from 'lucide-react';

type PreviewMessage = {
  type?: string;
  revision?: number;
  requestId?: string;
  y?: number;
};

/**
 * A prévia Premium vive no domínio canônico do cliente. Ela só é considerada
 * pronta quando o runtime Premium responde pelo canal autenticado de
 * postMessage; o onLoad sozinho também aceitaria páginas de erro da Vercel.
 */
export function PremiumPreviewFrame({
  src,
  device,
  origin,
  expectedRevision,
  requestId,
  onScroll,
}: {
  src: string;
  device: 'desktop' | 'mobile';
  origin: string;
  expectedRevision: number;
  requestId: string;
  onScroll: (y: number) => void;
}) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [settled, setSettled] = useState<{
    url: string;
    state: 'loaded' | 'error';
  } | null>(null);
  const url = useMemo(() => {
    const next = new URL(src);
    if (attempt) next.searchParams.set('eixu_retry', String(attempt));
    return next.toString();
  }, [attempt, src]);
  const state = settled?.url === url ? settled.state : 'loading';
  const width =
    device === 'desktop'
      ? Math.max(1280, size.width)
      : Math.min(390, size.width);
  const scale = size.width ? Math.min(1, size.width / width) : 1;

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const observer = new ResizeObserver(() => {
      if (stage.clientWidth && stage.clientHeight)
        setSize({ width: stage.clientWidth, height: stage.clientHeight });
    });
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const receive = (event: MessageEvent<PreviewMessage>) => {
      if (
        event.origin !== origin ||
        event.source !== frameRef.current?.contentWindow
      )
        return;
      if (
        event.data?.type === 'eixu:premium-preview-ready' &&
        event.data.requestId === requestId &&
        event.data.revision === expectedRevision
      ) {
        setSettled({ url, state: 'loaded' });
        return;
      }
      if (
        event.data?.type === 'eixu:premium-preview-scroll' &&
        Number.isFinite(event.data.y)
      )
        onScroll(Math.max(0, Number(event.data.y)));
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [expectedRevision, onScroll, origin, requestId, url]);

  useEffect(() => {
    if (state !== 'loading') return;
    const timer = window.setTimeout(
      () => setSettled({ url, state: 'error' }),
      20_000,
    );
    return () => window.clearTimeout(timer);
  }, [state, url]);

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
            ? 'Aplicando alterações na prévia Premium…'
            : state === 'loaded'
              ? 'Prévia Premium atualizada'
              : 'O runtime Premium não confirmou a prévia.'}
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
      <div ref={stageRef} className="admin-preview-stage">
        <iframe
          ref={frameRef}
          src={url}
          title="Prévia do site Premium"
          className="admin-preview-frame"
          data-device={device}
          referrerPolicy="no-referrer"
          aria-busy={state === 'loading'}
          style={
            size.width
              ? {
                  width,
                  height: size.height / scale,
                  transform: `scale(${scale})`,
                }
              : undefined
          }
          onError={() => setSettled({ url, state: 'error' })}
        />
      </div>
    </div>
  );
}
