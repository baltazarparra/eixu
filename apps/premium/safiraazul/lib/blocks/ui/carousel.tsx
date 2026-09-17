'use client';

// As URLs são definidas por tenant e não cabem numa allowlist estática do next/image.
// oxlint-disable next/no-img-element

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import type { EmblaCarouselType } from 'embla-carousel';
import { SiteIcon } from '../icon';
import { textAttrs } from '../text';
import type { TextStyle } from '../text-style-schema';
import type { Vibe } from '@/lib/design/vibes';

export type SiteCarouselSlide = {
  src: string;
  alt: string;
  caption?: string;
  /** Caminho do texto no bloco, usado somente pelo editor da prévia. */
  captionField?: string;
};

export function SiteCarousel({
  label,
  slides,
  vibe = 'comercial',
  editing = false,
  autoplay = false,
  interval = 6,
  fit = 'cover',
  focalPoint = 'center',
  width,
  height,
  textStyles,
}: {
  label: string;
  slides: SiteCarouselSlide[];
  vibe?: Vibe;
  editing?: boolean;
  autoplay?: boolean;
  interval?: number;
  fit?: 'cover' | 'contain' | 'natural';
  focalPoint?: 'center' | 'top' | 'bottom' | 'left' | 'right';
  width: number;
  height: number;
  textStyles?: TextStyle[];
}) {
  const viewportId = useId();
  const rootRef = useRef<HTMLElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<EmblaCarouselType | null>(null);
  const hoveredRef = useRef(false);
  const focusedRef = useRef(false);
  const [enhanced, setEnhanced] = useState(false);
  const [selected, setSelected] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [still, setStill] = useState(editing);
  const [manuallyPaused, setManuallyPaused] = useState(false);
  const text = textAttrs(textStyles, editing);
  const slideSignature = slides.map((slide) => slide.src).join('\n');
  const effectiveAutoplay =
    autoplay && enhanced && !editing && !reducedMotion && !still;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const enter = () => {
      hoveredRef.current = true;
    };
    const leave = () => {
      hoveredRef.current = false;
    };
    const focusIn = () => {
      focusedRef.current = true;
    };
    const focusOut = (event: FocusEvent) => {
      if (!root.contains(event.relatedTarget as Node | null))
        focusedRef.current = false;
    };
    root.addEventListener('mouseenter', enter);
    root.addEventListener('mouseleave', leave);
    root.addEventListener('focusin', focusIn);
    root.addEventListener('focusout', focusOut);
    return () => {
      root.removeEventListener('mouseenter', enter);
      root.removeEventListener('mouseleave', leave);
      root.removeEventListener('focusin', focusIn);
      root.removeEventListener('focusout', focusOut);
    };
  }, []);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const theme = viewportRef.current?.closest<HTMLElement>('.site-theme');
    const update = () =>
      setStill(
        editing ||
          theme?.dataset.motion === 'still' ||
          theme?.dataset.editing === 'true',
      );
    update();
    if (!theme) return;
    const observer = new MutationObserver(update);
    observer.observe(theme, {
      attributes: true,
      attributeFilter: ['data-motion', 'data-editing'],
    });
    return () => observer.disconnect();
  }, [editing]);

  useEffect(() => {
    if (editing || slides.length < 2 || !viewportRef.current) return;
    let active = true;
    let instance: EmblaCarouselType | undefined;
    void import('embla-carousel')
      .then(({ default: createCarousel }) => {
        if (!active || !viewportRef.current) return;
        instance = createCarousel(viewportRef.current, {
          loop: true,
          duration: reducedMotion || still ? 0 : 25,
        });
        apiRef.current = instance;
        const update = () => setSelected(instance?.selectedScrollSnap() ?? 0);
        instance.on('select', update);
        instance.on('reInit', update);
        update();
        setEnhanced(true);
      })
      // Scroll-snap continua funcional se o motor não puder ser carregado.
      .catch(() => undefined);
    return () => {
      active = false;
      instance?.destroy();
      if (apiRef.current === instance) apiRef.current = null;
      setEnhanced(false);
    };
  }, [editing, reducedMotion, slideSignature, slides.length, still]);

  useEffect(() => {
    if (!effectiveAutoplay || manuallyPaused) return;
    const delay = Math.min(12, Math.max(4, interval)) * 1000;
    const timer = window.setInterval(() => {
      const siteDialogOpen = Boolean(
        document.querySelector(
          '.site-theme dialog[open], .site-theme .site-mobile-nav[open]',
        ),
      );
      if (
        document.hidden ||
        hoveredRef.current ||
        focusedRef.current ||
        siteDialogOpen
      )
        return;
      apiRef.current?.scrollNext();
    }, delay);
    return () => window.clearInterval(timer);
  }, [effectiveAutoplay, interval, manuallyPaused]);

  const scrollTo = (index: number) => {
    const target = (index + slides.length) % slides.length;
    const jump = reducedMotion || still;
    if (apiRef.current) apiRef.current.scrollTo(target, jump);
    else
      viewportRef.current?.scrollTo({
        left: target * (viewportRef.current?.clientWidth ?? 0),
        behavior: jump ? 'auto' : 'smooth',
      });
    setSelected(target);
  };

  const handleKeys = (event: KeyboardEvent<HTMLElement>) => {
    const destinations: Record<string, number> = {
      ArrowLeft: selected - 1,
      ArrowRight: selected + 1,
      Home: 0,
      End: slides.length - 1,
    };
    if (!(event.key in destinations)) return;
    event.preventDefault();
    scrollTo(destinations[event.key]);
  };

  return (
    <section
      ref={rootRef}
      className="site-carousel"
      aria-roledescription="carrossel"
      aria-label={label}
      data-enhanced={enhanced ? 'true' : undefined}
      data-autoplay={effectiveAutoplay ? 'true' : undefined}
      data-paused={manuallyPaused ? 'true' : undefined}
    >
      <div className="site-carousel-viewport" ref={viewportRef} id={viewportId}>
        <div className="site-carousel-track">
          {slides.map((slide, index) => (
            <figure
              className="site-carousel-slide"
              key={`${slide.src}-${index}`}
              aria-roledescription="slide"
              aria-label={`Foto ${index + 1} de ${slides.length}`}
            >
              <img
                className="site-carousel-image"
                src={slide.src}
                alt={slide.alt}
                width={width}
                height={height}
                loading={index < 2 ? 'eager' : 'lazy'}
                fetchPriority={index === 0 ? 'high' : undefined}
                decoding="async"
                draggable={false}
                data-fit={fit}
                data-image-fit={fit}
                data-focal={focalPoint}
              />
              {slide.caption ? (
                <figcaption>
                  {slide.captionField
                    ? text.node(slide.captionField, slide.caption)
                    : slide.caption}
                </figcaption>
              ) : null}
            </figure>
          ))}
        </div>
      </div>

      <div
        className="site-carousel-controls"
        aria-label="Controles do carrossel"
      >
        <button
          type="button"
          className="site-carousel-control site-carousel-previous"
          aria-label="Foto anterior"
          aria-controls={viewportId}
          onKeyDown={handleKeys}
          onClick={() => scrollTo(selected - 1)}
        >
          <SiteIcon name="arrow-left" vibe={vibe} />
        </button>
        <button
          type="button"
          className="site-carousel-control site-carousel-next"
          aria-label="Próxima foto"
          aria-controls={viewportId}
          onKeyDown={handleKeys}
          onClick={() => scrollTo(selected + 1)}
        >
          <SiteIcon name="arrow-right" vibe={vibe} />
        </button>
        {effectiveAutoplay ? (
          <button
            type="button"
            className="site-carousel-pause"
            aria-pressed={manuallyPaused}
            onKeyDown={handleKeys}
            onClick={() => setManuallyPaused((value) => !value)}
          >
            {manuallyPaused ? 'Continuar' : 'Pausar'}
          </button>
        ) : null}
      </div>

      <div className="site-carousel-dots" aria-label="Escolher foto">
        {slides.map((slide, index) => (
          <button
            type="button"
            key={`${slide.src}-dot-${index}`}
            aria-label={`Ir para a foto ${index + 1}`}
            aria-current={selected === index ? 'true' : undefined}
            aria-controls={viewportId}
            onKeyDown={handleKeys}
            onClick={() => scrollTo(index)}
          />
        ))}
      </div>

      <p
        className="site-carousel-live"
        aria-live={effectiveAutoplay ? 'off' : 'polite'}
        aria-atomic="true"
      >
        Foto {selected + 1} de {slides.length}
      </p>
    </section>
  );
}
