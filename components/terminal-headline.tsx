'use client';

import { useEffect, useState } from 'react';

const HEADLINE = 'A/gente tira do papel.';

function typingDelay(character: string, index: number) {
  if (character === '/') return 150;
  if (character === '.') return 220;
  return 42 + (index % 4) * 9;
}

export function TerminalHeadline() {
  const [typedHeadline, setTypedHeadline] = useState('');
  const [isTyping, setIsTyping] = useState(true);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      setTypedHeadline(HEADLINE);
      setIsTyping(false);
      return;
    }

    const timers = new Set<ReturnType<typeof setTimeout>>();
    let cancelled = false;

    const wait = (duration: number) =>
      new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          timers.delete(timer);
          resolve();
        }, duration);
        timers.add(timer);
      });

    const typeHeadline = async () => {
      await wait(560);

      for (let characterIndex = 0; characterIndex < HEADLINE.length; characterIndex += 1) {
        if (cancelled) return;

        const nextCharacter = HEADLINE[characterIndex];
        setTypedHeadline(HEADLINE.slice(0, characterIndex + 1));
        await wait(typingDelay(nextCharacter, characterIndex));
      }

      await wait(1100);
      if (!cancelled) setIsTyping(false);
    };

    void typeHeadline();

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      timers.clear();
    };
  }, []);

  return (
    <h1 className="hero-title hero-title--terminal reveal delay-2" aria-label={HEADLINE}>
      <span className="terminal-line" aria-hidden="true">
        <span className="terminal-ghost">{HEADLINE}</span>
        <span className="terminal-typed">
          {typedHeadline}
          {isTyping ? <span className="terminal-cursor" /> : null}
        </span>
      </span>
    </h1>
  );
}
