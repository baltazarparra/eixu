'use client';

import { useEffect, type ComponentProps, type ReactNode } from 'react';
import {
  inView,
  motion,
  stagger,
  useAnimate,
  useReducedMotion,
} from 'framer-motion';

/** Conteúdo sai visível do servidor. A coreografia só começa após hidratação. */
export function SiteMotion({
  children,
  intensity,
}: {
  children: ReactNode;
  intensity: number;
}) {
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced || intensity <= 3) return;
    const hero = scope.current?.querySelector('.site-hero');
    const controls: { stop(): void; complete(): void }[] = [];
    if (hero) {
      const copy = hero.querySelectorAll('.site-hero-copy > *');
      if (copy.length)
        controls.push(
          animate(
            copy,
            { opacity: [0.35, 1], y: [18, 0] },
            { duration: 0.65, delay: stagger(0.085), ease: [0.22, 1, 0.36, 1] },
          ),
        );
      const photo = hero.querySelector('.site-hero-media > img');
      if (photo)
        controls.push(
          animate(
            photo,
            { scale: [1.045, 1] },
            { duration: 1.15, ease: [0.22, 1, 0.36, 1] },
          ),
        );
    }
    const sections = scope.current.querySelectorAll<HTMLElement>(
      '[data-animation]:not([data-animation="none"])',
    );
    const stops = [...sections].map((section) =>
      inView(
        section,
        () => {
          if (section.contains(hero)) return;
          const elements =
            section.dataset.animation === 'image'
              ? section.querySelectorAll('img')
              : section.dataset.animation === 'stagger'
                ? section.querySelectorAll('article, ol > li')
                : section.querySelectorAll(
                    '.site-shell > h2, .site-shell > div:first-child',
                  );
          if (elements.length)
            controls.push(
              animate(
                elements,
                { opacity: [0.45, 1], y: [20, 0] },
                {
                  duration: 0.6,
                  delay: stagger(0.07),
                  ease: [0.22, 1, 0.36, 1],
                },
              ),
            );
        },
        { amount: 0.18 },
      ),
    );
    return () => {
      stops.forEach((stop) => stop());
      controls.forEach((control) => {
        control.complete();
        control.stop();
      });
    };
  }, [animate, intensity, reduced, scope]);
  return (
    <div
      className="site-motion-root"
      ref={scope}
      data-motion-engine="framer-motion"
    >
      {children}
    </div>
  );
}

export function MotionLink({
  children,
  ...props
}: ComponentProps<typeof motion.a>) {
  const reduced = useReducedMotion();
  return (
    <motion.a
      {...props}
      tabIndex={props.tabIndex ?? 0}
      whileHover={reduced ? undefined : { y: -2 }}
      whileTap={reduced ? undefined : { scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 360, damping: 24 }}
    >
      {children}
    </motion.a>
  );
}
