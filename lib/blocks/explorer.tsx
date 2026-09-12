'use client';

// oxlint-disable next/no-img-element
// oxlint-disable next/no-html-link-for-pages
import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { SiteIcon } from './icon';
import type { Vibe } from '@/lib/design/vibes';
import type { z } from 'zod';
import type { blockSchemas } from './registry';
import { MotionLink } from './motion';

export type ExplorerProps = z.infer<
  (typeof blockSchemas)['feature.explorer']
> & { vibe?: Vibe };

export function VisualExplorer({
  title,
  body,
  items,
  layout,
  vibe = 'comercial',
}: ExplorerProps) {
  const id = useId();
  const [selected, select] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const reduced = useReducedMotion();
  const item = items[selected];
  function navigate(event: KeyboardEvent, index: number) {
    const next =
      event.key === 'ArrowRight'
        ? (index + 1) % items.length
        : event.key === 'ArrowLeft'
          ? (index - 1 + items.length) % items.length
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? items.length - 1
              : null;
    if (next === null) return;
    event.preventDefault();
    select(next);
    tabs.current[next]?.focus();
  }
  return (
    <section className={`site-section site-explorer site-explorer-${layout}`}>
      <div className="site-shell mx-auto w-full max-w-[var(--site-max,76rem)] px-6 md:px-10">
        <div className="site-explorer-heading">
          <h2>{title}</h2>
          {body && <p>{body}</p>}
        </div>
        <div className="site-explorer-tabs" role="tablist" aria-label={title}>
          {items.map((entry, index) => (
            <button
              key={entry.title}
              type="button"
              role="tab"
              ref={(element) => {
                tabs.current[index] = element;
              }}
              id={`${id}-tab-${index}`}
              aria-controls={`${id}-panel`}
              aria-selected={selected === index}
              tabIndex={selected === index ? 0 : -1}
              onKeyDown={(event) => navigate(event, index)}
              onClick={() => select(index)}
            >
              {selected === index && (
                <motion.span
                  className="site-explorer-indicator"
                  layoutId={reduced ? undefined : `${id}-indicator`}
                  transition={
                    reduced
                      ? { duration: 0 }
                      : {
                          type: 'spring',
                          stiffness: 360,
                          damping: 32,
                        }
                  }
                />
              )}
              {entry.icon ? <SiteIcon name={entry.icon} vibe={vibe} /> : null}
              <span>{entry.title}</span>
            </button>
          ))}
        </div>
        <div
          id={`${id}-panel`}
          role="tabpanel"
          aria-labelledby={`${id}-tab-${selected}`}
          tabIndex={0}
          className="site-explorer-panel"
        >
          <figure className="site-explorer-photo">
            <AnimatePresence initial={false}>
              <motion.img
                key={item.image}
                src={item.image}
                alt={item.imageAlt}
                width={960}
                height={720}
                loading="lazy"
                decoding="async"
                initial={{ opacity: reduced ? 1 : 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduced ? 0 : 0.38 }}
              />
            </AnimatePresence>
            {item.caption && <figcaption>{item.caption}</figcaption>}
          </figure>
          <motion.div
            className="site-explorer-copy"
            key={item.title}
            initial={false}
            animate={{ opacity: 1 }}
          >
            <span className="site-explorer-kicker">{item.title}</span>
            <h3>{item.headline}</h3>
            <p>{item.body}</p>
            <ul>
              {item.facts.map((fact) => (
                <li key={fact}>{fact}</li>
              ))}
            </ul>
            <MotionLink
              className="site-action site-explorer-cta"
              href={item.cta.href}
            >
              {item.cta.label}
              <SiteIcon name="arrow-up-right" vibe={vibe} size={18} />
            </MotionLink>
          </motion.div>
        </div>
        <noscript>
          <ul>
            {items.slice(1).map((entry) => (
              <li key={entry.title}>
                <a href={entry.cta.href}>
                  {entry.title}: {entry.body}
                </a>
              </li>
            ))}
          </ul>
        </noscript>
      </div>
    </section>
  );
}
