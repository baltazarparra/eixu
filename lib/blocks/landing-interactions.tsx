'use client';

import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';

const subscribe = () => () => {};
const client = () => true;
const server = () => false;

/** HTML completo sem JS; após hidratar, abas com seleção e foco por teclado. */
export function ShowcaseTabs({
  items,
  editing,
}: {
  items: { label: ReactNode; content: ReactNode }[];
  editing?: boolean;
}) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState(0);
  const hydrated = useSyncExternalStore(subscribe, client, server);
  const enhanced = hydrated && !editing;
  return (
    <div ref={root} className="site-showcase-tabs" data-enhanced={enhanced}>
      {enhanced && (
        <div
          role="tablist"
          aria-label="Aplicações do produto"
          className="site-showcase-tablist"
        >
          {items.map((item, index) => (
            <button
              key={index}
              type="button"
              role="tab"
              id={`${id}-tab-${index}`}
              aria-controls={`${id}-panel-${index}`}
              aria-selected={selected === index}
              tabIndex={selected === index ? 0 : -1}
              onClick={() => setSelected(index)}
              onKeyDown={(event) => {
                const next =
                  event.key === 'Home'
                    ? 0
                    : event.key === 'End'
                      ? items.length - 1
                      : ['ArrowRight', 'ArrowDown'].includes(event.key)
                        ? (index + 1) % items.length
                        : ['ArrowLeft', 'ArrowUp'].includes(event.key)
                          ? (index - 1 + items.length) % items.length
                          : null;
                if (next === null) return;
                event.preventDefault();
                setSelected(next);
                root.current
                  ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
                  [next]?.focus();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
      {items.map((item, index) => (
        <div
          key={index}
          id={`${id}-panel-${index}`}
          role={enhanced ? 'tabpanel' : undefined}
          aria-labelledby={enhanced ? `${id}-tab-${index}` : undefined}
          tabIndex={enhanced ? 0 : undefined}
          hidden={enhanced && selected !== index}
          className="site-showcase-tabpanel"
        >
          {item.content}
        </div>
      ))}
    </div>
  );
}

/** Oculta ao alcançar qualquer formulário ou focar um campo, sem medir em cada scroll. */
export function LandingStickyCta({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = root.current;
    const theme = element?.closest('.site-theme');
    if (!element || !theme) return;
    element.dataset.ready = 'true';
    const visible = new Set<Element>();
    const update = () => {
      const typing = document.activeElement?.matches('input, textarea, select');
      element.dataset.hidden = String(visible.size > 0 || Boolean(typing));
    };
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) =>
          entry.isIntersecting
            ? visible.add(entry.target)
            : visible.delete(entry.target),
        );
        update();
      },
      { threshold: 0 },
    );
    theme.querySelectorAll('form').forEach((form) => observer.observe(form));
    theme.addEventListener('focusin', update);
    theme.addEventListener('focusout', update);
    return () => {
      observer.disconnect();
      theme.removeEventListener('focusin', update);
      theme.removeEventListener('focusout', update);
    };
  }, []);
  return (
    <div ref={root} className="site-sticky-cta" data-ready="false">
      <a
        href={href}
        data-track={href.startsWith('/go/wa') ? 'whatsapp' : undefined}
      >
        {children}
      </a>
    </div>
  );
}
