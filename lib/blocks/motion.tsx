'use client';

import {
  useEffect,
  useLayoutEffect,
  useSyncExternalStore,
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

type CommercialEntranceKind = 'reveal' | 'rise' | 'image' | 'wipe' | 'fade';
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
      // Links têm sua própria sequência; não anime pai e filho juntos.
      if (target.matches('.site-social-links')) return;
      const kind = target.matches('h1, h2, h3, .site-headline')
        ? 'reveal'
        : 'rise';
      add(target, kind, {
        desktopDelay: Math.min(start + index * 0.08, 0.24),
        mobileDelay: Math.min(start + index * 0.06, 0.18),
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
          add(item.querySelector('img'), 'image', {
            role: 'image',
            desktopDelay: rowDelay,
            mobileDelay: 0,
          });
          add(item.querySelector('h3'), 'reveal', {
            desktopDelay: rowDelay + 0.1,
            mobileDelay: 0.08,
          });
          add(item.querySelector('p'), 'rise', {
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
            add(image, 'image', {
              role: 'image',
              desktopDelay: (index % 3) * 0.1,
              mobileDelay: 0,
            }),
          );
        section
          .querySelectorAll('.site-social-links > li')
          .forEach((link, index) =>
            add(link, 'rise', {
              desktopDelay: 0.26 + index * 0.1,
              mobileDelay: 0.18 + index * 0.08,
            }),
          );
        return;
      }

      if (block === 'media.image') {
        add(section.querySelector('img'), 'image', { role: 'image' });
        add(section.querySelector('figcaption'), 'reveal', {
          desktopDelay: 0.16,
          mobileDelay: 0.1,
        });
        return;
      }

      if (block === 'media.gallery') {
        add(section.querySelector('.site-shell > h2'), 'reveal');
        section.querySelectorAll('.site-gallery li').forEach((item, index) =>
          add(item.querySelector('img') ?? item, 'image', {
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
          add(unit.querySelector('.site-map-unit-copy'), 'rise', {
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
        addCopySequence(section.querySelector('.site-shell > :first-child'));
        add(section.querySelector('.site-shell > form'), 'fade', {
          desktopDelay: 0.2,
          mobileDelay: 0.16,
        });
        return;
      }

      const featureImage = section.querySelector(
        ':scope > section > .site-cta-image',
      );
      if (featureImage) add(featureImage, 'wipe', { role: 'image' });

      const ctaCopy = section.querySelector('.site-cta-copy');
      if (ctaCopy) {
        addCopySequence(ctaCopy, featureImage ? 0.1 : 0);
        add(
          section.querySelector('.site-cta > .site-shell > .site-action'),
          'rise',
          {
            desktopDelay: 0.24,
            mobileDelay: 0.18,
          },
        );
        return;
      }

      const textShell = section.querySelector('.site-text > .site-shell');
      if (textShell) {
        const identity = textShell.querySelector('.site-text-identity');
        const copy = textShell.querySelector('.site-text-copy');
        const image = textShell.querySelector('.site-text-media img');
        if (identity) add(identity, 'wipe');
        if (image) add(image, 'wipe', { role: 'image' });
        addCopySequence(copy ?? textShell, identity || image ? 0.08 : 0);
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

const reducedMotionQuery = '(prefers-reduced-motion: reduce)';
function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia(reducedMotionQuery);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}
const readReducedMotion = () => window.matchMedia(reducedMotionQuery).matches;
const serverReducedMotion = () => false;

function CommercialSiteMotion({
  children,
  intensity,
}: {
  children: ReactNode;
  intensity: number;
}) {
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const reduced = useSyncExternalStore(
    subscribeReducedMotion,
    readReducedMotion,
    serverReducedMotion,
  );
  useLayoutEffect(() => {
    if (reduced || readReducedMotion() || intensity <= 0 || !scope.current)
      return;

    const root = scope.current;
    const entrances = commercialEntrances(root);
    const controls = new Map<HTMLElement, { stop(): void; complete(): void }>();
    const properties = [
      'opacity',
      'transform',
      'clip-path',
      'will-change',
    ] as const;
    const originalStyles = new Map(
      entrances.map(({ target }) => [
        target,
        properties.map((property) => ({
          property,
          value: target.style.getPropertyValue(property),
          priority: target.style.getPropertyPriority(property),
        })),
      ]),
    );
    const restore = (target: HTMLElement) => {
      for (const { property, value, priority } of originalStyles.get(target) ??
        []) {
        if (value) target.style.setProperty(property, value, priority);
        else target.style.removeProperty(property);
      }
    };
    const frames = (kind: CommercialEntranceKind) => {
      const desktop = window.innerWidth >= 768;
      switch (kind) {
        case 'reveal':
          return {
            clipPath: ['inset(0% 0% 100% 0%)', 'inset(0% 0% 0% 0%)'],
            transform: [
              `translate3d(0, ${desktop ? 24 : 14}px, 0)`,
              'translate3d(0, 0, 0)',
            ],
          };
        case 'image':
          return {
            clipPath: ['inset(0% 0% 100% 0%)', 'inset(0% 0% 0% 0%)'],
            transform: [`scale(${desktop ? 0.97 : 0.985})`, 'scale(1)'],
          };
        case 'wipe':
          return {
            clipPath: [
              desktop ? 'inset(0% 100% 0% 0%)' : 'inset(0% 0% 100% 0%)',
              'inset(0% 0% 0% 0%)',
            ],
          };
        case 'rise':
          return {
            opacity: [0, 1],
            transform: [
              `translate3d(0, ${desktop ? 18 : 12}px, 0)`,
              'translate3d(0, 0, 0)',
            ],
          };
        case 'fade':
          return { opacity: [0, 1] };
      }
    };
    for (const { target, kind, role } of entrances) {
      target.dataset.motionKind = kind;
      target.dataset.motionRole = role;
      // Conteúdo já pintado (incluindo scroll restaurado) nunca desaparece na hidratação.
      if (target.getBoundingClientRect().top < window.innerHeight) {
        target.dataset.motionState = 'complete';
        continue;
      }
      target.dataset.motionState = 'pending';
      const initial = frames(kind);
      if (initial.opacity) target.style.opacity = String(initial.opacity[0]);
      if (initial.transform) target.style.transform = initial.transform[0];
      if (initial.clipPath) target.style.clipPath = initial.clipPath[0];
    }
    let active = true;
    const settleFrames = new Set<number>();
    const afterPaint = (callback: () => void) => {
      const frame = requestAnimationFrame(() => {
        settleFrames.delete(frame);
        if (active) callback();
      });
      settleFrames.add(frame);
    };
    const finish = (target: HTMLElement) => {
      if (!active) return;
      target.dataset.motionState = 'complete';
      restore(target);
      controls.delete(target);
    };
    const reveal = ({
      target,
      kind,
      desktopDelay,
      mobileDelay,
    }: CommercialEntrance) => {
      if (target.dataset.motionState !== 'pending') return;
      target.dataset.motionState = 'running';
      const desktop = window.innerWidth >= 768;
      const keyframes = frames(kind);
      target.style.willChange = Object.keys(keyframes)
        .map((key) => (key === 'clipPath' ? 'clip-path' : key))
        .join(', ');
      const control = animate(target, keyframes, {
        duration:
          kind === 'image' || kind === 'wipe'
            ? 0.85
            : kind === 'fade'
              ? 0.45
              : 0.65,
        delay: Math.min(
          desktop ? desktopDelay : mobileDelay,
          desktop ? 0.24 : 0.16,
        ),
        ease: [0.22, 1, 0.36, 1],
      });
      controls.set(target, control);
      void control.finished
        // O motor confirma os estilos finais no frame seguinte à promise.
        .then(() => afterPaint(() => afterPaint(() => finish(target))))
        .catch(() => afterPaint(() => finish(target)));
    };
    const pending = new Set(
      entrances.filter(
        ({ target }) => target.dataset.motionState === 'pending',
      ),
    );
    let entranceFrame = 0;
    const measureEntrances = () => {
      entranceFrame = 0;
      // Mede a caixa de layout, não a área recortada. Isso também preserva
      // lazy loading e entradas individuais nas últimas linhas de uma grade.
      const visible = [...pending].filter(({ target }) => {
        const rect = target.getBoundingClientRect();
        return rect.top < window.innerHeight * 0.94 && rect.bottom > 0;
      });
      for (const entrance of visible) {
        pending.delete(entrance);
        reveal(entrance);
      }
      if (!pending.size) {
        window.removeEventListener('scroll', requestEntrances);
        window.removeEventListener('resize', requestEntrances);
      }
    };
    const requestEntrances = () => {
      if (!entranceFrame)
        entranceFrame = requestAnimationFrame(measureEntrances);
    };
    window.addEventListener('scroll', requestEntrances, { passive: true });
    window.addEventListener('resize', requestEntrances);
    requestEntrances();
    const onFocus = (event: FocusEvent) => {
      if (!(event.target instanceof Element)) return;
      for (const { target } of entrances) {
        if (!target.contains(event.target)) continue;
        const control = controls.get(target);
        control?.complete();
        control?.stop();
        finish(target);
      }
    };
    root.addEventListener('focusin', onFocus);

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
      window.removeEventListener('scroll', requestEntrances);
      window.removeEventListener('resize', requestEntrances);
      if (entranceFrame) cancelAnimationFrame(entranceFrame);
      window.removeEventListener('scroll', requestParallax);
      window.removeEventListener('resize', requestParallax);
      if (frame) cancelAnimationFrame(frame);
      settleFrames.forEach((frameId) => cancelAnimationFrame(frameId));
      root.removeEventListener('focusin', onFocus);
      controls.forEach((control) => {
        control.complete();
        control.stop();
      });
      parallax.forEach(({ figure }) =>
        figure.style.removeProperty('--site-parallax-y'),
      );
      entrances.forEach(({ target }) => {
        delete target.dataset.motionState;
        delete target.dataset.motionKind;
        delete target.dataset.motionRole;
        restore(target);
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
