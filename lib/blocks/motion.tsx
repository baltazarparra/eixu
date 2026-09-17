'use client';

import {
  useEffect,
  useLayoutEffect,
  type ComponentProps,
  type ReactNode,
} from 'react';
import {
  inView,
  motion,
  stagger,
  useAnimate,
  useReducedMotion,
} from 'framer-motion';

/** O HTML permanece útil sem JavaScript; o cliente apenas acrescenta movimento. */
export function SiteMotion({
  children,
  intensity,
  commercialEntrances = false,
}: {
  children: ReactNode;
  intensity: number;
  commercialEntrances?: boolean;
}) {
  if (commercialEntrances)
    return (
      <CommercialSiteMotion intensity={intensity}>
        {children}
      </CommercialSiteMotion>
    );
  return <LegacySiteMotion intensity={intensity}>{children}</LegacySiteMotion>;
}

type CommercialEntranceKind = 'reveal' | 'fade';
type CommercialEntranceRole = 'content' | 'image';

type CommercialEntrance = {
  target: HTMLElement;
  kind: CommercialEntranceKind;
  role: CommercialEntranceRole;
  desktopDelay: number;
  mobileDelay: number;
};

function commercialEntrances(root: HTMLElement): CommercialEntrance[] {
  const entrances: CommercialEntrance[] = [];
  const used = new Set<HTMLElement>();
  const add = (
    target: Element | null | undefined,
    kind: CommercialEntranceKind,
    options: {
      role?: CommercialEntranceRole;
      desktopDelay?: number;
      mobileDelay?: number;
    } = {},
  ) => {
    if (!(target instanceof HTMLElement) || used.has(target)) return;
    used.add(target);
    entrances.push({
      target,
      kind,
      role: options.role ?? 'content',
      desktopDelay: options.desktopDelay ?? 0,
      mobileDelay: options.mobileDelay ?? options.desktopDelay ?? 0,
    });
  };
  const addCopySequence = (
    container: Element | null | undefined,
    start = 0,
  ) => {
    if (!container) return;
    Array.from(container.children).forEach((target, index) => {
      const kind = target.matches(
        'h1, h2, h3, .site-headline, .site-actions, .site-action',
      )
        ? 'reveal'
        : 'fade';
      add(target, kind, {
        desktopDelay: start + index * 0.12,
        mobileDelay: start + index * 0.1,
      });
    });
  };

  root
    .querySelectorAll<HTMLElement>(
      '[data-animation]:not([data-animation="none"])',
    )
    .forEach((section) => {
      const block = section.dataset.block;
      if (block === 'nav.bar' || block?.startsWith('hero.')) return;

      if (block === 'feature.bento') {
        addCopySequence(section.querySelector('.site-shell > :first-child'));
        section.querySelectorAll('.site-bento-item').forEach((item, index) => {
          const rowDelay = (index % 3) * 0.12;
          add(item.querySelector('img'), 'fade', {
            role: 'image',
            desktopDelay: rowDelay,
            mobileDelay: 0,
          });
          add(item.querySelector('h3'), 'reveal', {
            desktopDelay: rowDelay + 0.1,
            mobileDelay: 0.08,
          });
          add(item.querySelector('p'), 'fade', {
            desktopDelay: rowDelay + 0.2,
            mobileDelay: 0.16,
          });
        });
        return;
      }

      if (block === 'social.follow') {
        addCopySequence(section.querySelector('.site-social-copy'));
        section
          .querySelectorAll('.site-social-images > img')
          .forEach((image, index) =>
            add(image, 'fade', {
              role: 'image',
              desktopDelay: (index % 3) * 0.1,
              mobileDelay: 0,
            }),
          );
        section
          .querySelectorAll('.site-social-links > li')
          .forEach((link, index) =>
            add(link, 'fade', {
              desktopDelay: 0.26 + index * 0.1,
              mobileDelay: 0.18 + index * 0.08,
            }),
          );
        return;
      }

      if (block === 'media.image') {
        add(section.querySelector('img'), 'fade', { role: 'image' });
        add(section.querySelector('figcaption'), 'reveal', {
          desktopDelay: 0.16,
          mobileDelay: 0.1,
        });
        return;
      }

      if (block === 'media.gallery') {
        add(section.querySelector('.site-shell > h2'), 'reveal');
        section.querySelectorAll('.site-gallery li').forEach((item, index) =>
          add(item.querySelector('img') ?? item, 'fade', {
            role: 'image',
            desktopDelay: (index % 3) * 0.12,
            mobileDelay: 0,
          }),
        );
        return;
      }

      if (block === 'media.map') {
        add(section.querySelector('.site-shell > h2'), 'reveal');
        section.querySelectorAll('.site-map-unit').forEach((unit, index) => {
          const delay = (index % 3) * 0.12;
          add(unit.querySelector('.site-map-unit-copy'), 'fade', {
            desktopDelay: delay,
            mobileDelay: 0,
          });
          add(unit.querySelector('iframe'), 'fade', {
            desktopDelay: delay + 0.12,
            mobileDelay: 0.1,
          });
        });
        return;
      }

      if (block === 'form.lead') {
        const copy = section.querySelector('.site-shell > :first-child');
        if (copy)
          Array.from(copy.children).forEach((target, index) =>
            add(target, 'fade', {
              desktopDelay: index * 0.12,
              mobileDelay: index * 0.1,
            }),
          );
        add(section.querySelector('.site-shell > form'), 'fade', {
          desktopDelay: 0.2,
          mobileDelay: 0.16,
        });
        return;
      }

      const featureImage = section.querySelector(
        ':scope > section > .site-cta-image',
      );
      if (featureImage) add(featureImage, 'fade', { role: 'image' });

      const ctaCopy = section.querySelector('.site-cta-copy');
      if (ctaCopy) {
        addCopySequence(ctaCopy, featureImage ? 0.1 : 0);
        add(
          section.querySelector('.site-cta > .site-shell > .site-action'),
          'reveal',
          {
            desktopDelay: featureImage ? 0.42 : 0.34,
            mobileDelay: featureImage ? 0.32 : 0.28,
          },
        );
        return;
      }

      const textShell = section.querySelector('.site-text > .site-shell');
      if (textShell) {
        addCopySequence(textShell);
        return;
      }

      const footerShell = section.querySelector('.site-footer > .site-shell');
      if (footerShell) {
        const row = footerShell.firstElementChild;
        if (row)
          Array.from(row.children).forEach((target, index) =>
            add(target, 'fade', {
              desktopDelay: index * 0.1,
              mobileDelay: index * 0.08,
            }),
          );
        const legal = footerShell.lastElementChild;
        if (legal !== row)
          add(legal, 'fade', {
            desktopDelay: 0.3,
            mobileDelay: 0.24,
          });
        return;
      }

      addCopySequence(
        section.querySelector('.site-shell') ?? section.firstElementChild,
      );
    });

  return entrances;
}

function CommercialSiteMotion({
  children,
  intensity,
}: {
  children: ReactNode;
  intensity: number;
}) {
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const reduced = useReducedMotion();
  useLayoutEffect(() => {
    if (reduced || intensity <= 0 || !scope.current) return;

    const root = scope.current;
    const entrances = commercialEntrances(root);
    const controls: {
      stop(): void;
      complete(): void;
      finished: Promise<unknown>;
    }[] = [];
    const stops: (() => void)[] = [];
    const settleFrames = new Set<number>();

    for (const { target, kind, role } of entrances) {
      target.dataset.motionState = 'pending';
      target.dataset.motionKind = kind;
      target.dataset.motionRole = role;
      target.style.opacity = '0';
      if (kind === 'reveal')
        target.style.transform = `translate3d(0, ${window.innerWidth >= 768 ? 28 : 20}px, 0)`;
      target.style.willChange =
        kind === 'reveal' ? 'opacity, transform' : 'opacity';
    }
    let active = true;
    const finish = (target: HTMLElement) => {
      if (!active) return;
      target.dataset.motionState = 'complete';
      target.style.removeProperty('opacity');
      target.style.removeProperty('transform');
      target.style.removeProperty('will-change');
    };
    const afterPaint = (callback: () => void) => {
      const frameId = requestAnimationFrame(() => {
        settleFrames.delete(frameId);
        callback();
      });
      settleFrames.add(frameId);
    };

    const reveal = ({
      target,
      kind,
      role,
      desktopDelay,
      mobileDelay,
    }: CommercialEntrance) => {
      if (target.dataset.motionState !== 'pending') return;
      target.dataset.motionState = 'running';
      const desktop = window.innerWidth >= 768;
      const delay = desktop ? desktopDelay : mobileDelay;
      const duration = role === 'image' ? 1.15 : kind === 'fade' ? 1.05 : 1;
      const control =
        kind === 'fade'
          ? animate(
              target,
              { opacity: [0, 1] },
              {
                duration,
                delay,
                ease: [0.39, 0.575, 0.565, 1],
              },
            )
          : animate(
              target,
              { opacity: [0, 1], y: [desktop ? 28 : 20, 0] },
              {
                duration,
                delay,
                ease: [0.25, 0.46, 0.45, 0.94],
              },
            );
      controls.push(control);
      void control.finished
        .then(() => afterPaint(() => afterPaint(() => finish(target))))
        .catch(() => undefined);
    };

    for (const entrance of entrances)
      stops.push(
        inView(entrance.target, () => reveal(entrance), {
          amount: 0.18,
          margin: '0px 0px -7% 0px',
        }),
      );

    const parallax = Array.from(
      root.querySelectorAll<HTMLElement>('[data-parallax="true"] > figure'),
    ).map((figure) => ({ figure, current: 0, target: 0 }));
    let frame = 0;
    const measureParallax = () => {
      for (const state of parallax) {
        const rect = state.figure.parentElement?.getBoundingClientRect();
        if (!rect || rect.bottom < 0 || rect.top > window.innerHeight) continue;
        const distance = window.innerHeight / 2 - (rect.top + rect.height / 2);
        state.target = Math.max(-42, Math.min(42, distance * 0.08));
      }
    };
    const renderParallax = () => {
      let moving = false;
      for (const state of parallax) {
        const delta = state.target - state.current;
        if (Math.abs(delta) <= 0.04) state.current = state.target;
        else {
          state.current += delta * 0.18;
          moving = true;
        }
        state.figure.style.setProperty(
          '--site-parallax-y',
          `${state.current.toFixed(3)}px`,
        );
      }
      frame = moving ? requestAnimationFrame(renderParallax) : 0;
    };
    const requestParallax = () => {
      measureParallax();
      if (!frame) frame = requestAnimationFrame(renderParallax);
    };
    if (parallax.length) {
      requestParallax();
      window.addEventListener('scroll', requestParallax, { passive: true });
      window.addEventListener('resize', requestParallax);
    }

    return () => {
      active = false;
      stops.forEach((stop) => stop());
      window.removeEventListener('scroll', requestParallax);
      window.removeEventListener('resize', requestParallax);
      if (frame) cancelAnimationFrame(frame);
      settleFrames.forEach((frameId) => cancelAnimationFrame(frameId));
      settleFrames.clear();
      controls.forEach((control) => {
        control.complete();
        control.stop();
      });
      entrances.forEach(({ target }) => {
        delete target.dataset.motionState;
        delete target.dataset.motionKind;
        delete target.dataset.motionRole;
        target.style.removeProperty('opacity');
        target.style.removeProperty('transform');
        target.style.removeProperty('will-change');
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

function LegacySiteMotion({
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
            {
              duration: 0.65,
              delay: stagger(0.085),
              ease: [0.22, 1, 0.36, 1],
            },
          ),
        );
      const photo = hero.querySelector('.site-hero-media img:first-of-type');
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
    const stops: (() => void)[] = [];
    for (const section of sections) {
      if (section.contains(hero)) continue;
      const elements = Array.from<HTMLElement>(
        section.dataset.animation === 'image'
          ? section.querySelectorAll(
              'img:not(.site-carousel-image), figcaption, .site-carousel-slide:first-child .site-carousel-image',
            )
          : section.dataset.animation === 'stagger'
            ? section.querySelectorAll(
                'article, ol > li, .site-social-links > li, .site-social-images > img, .site-gallery li',
              )
            : section.querySelectorAll(
                '.site-shell > h2, .site-shell > div:first-child, .site-nav-row > *, .site-footer > .site-shell > *',
              ),
      );
      const individually = section.dataset.animation === 'stagger';
      const targets = individually ? elements : [section];
      targets.forEach((target, index) => {
        stops.push(
          inView(
            target,
            () => {
              const animated = individually ? [target] : elements;
              if (!animated.length) return;
              controls.push(
                animate(
                  animated,
                  { opacity: [0.35, 1], y: [20, 0] },
                  {
                    duration: 0.6,
                    delay: individually ? (index % 3) * 0.055 : stagger(0.07),
                    ease: [0.22, 1, 0.36, 1],
                  },
                ),
              );
            },
            { amount: individually ? 0.35 : 0.18 },
          ),
        );
      });
    }
    // Entrada breve por símbolo, sem loop. Anima o invólucro; o SVG fica
    // disponível para o gesto de foco/hover mesmo depois da entrada.
    scope.current
      .querySelectorAll<HTMLElement>('.site-icon-badge')
      .forEach((icon) => {
        const artistic = icon.dataset.iconVibe === 'artistico';
        stops.push(
          inView(
            icon,
            () => {
              controls.push(
                animate(
                  icon,
                  {
                    opacity: [0.65, 1],
                    y: [6, 0],
                    rotate: [artistic ? -10 : 0, 0],
                  },
                  {
                    duration: artistic ? 0.5 : 0.3,
                    ease: [0.22, 1, 0.36, 1],
                  },
                ),
              );
            },
            { amount: 0.5 },
          ),
        );
      });
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
