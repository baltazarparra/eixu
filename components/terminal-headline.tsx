'use client';

import { useEffect, useState } from 'react';

const LINES = ['A/gente tira do papel.', 'E coloca em produção.'] as const;
const FULL_HEADLINE = LINES.join(' ');

function typingDelay(character: string, index: number) {
  if (character === '/') return 150;
  if (character === '.') return 220;
  return 42 + (index % 4) * 9;
}

export function TerminalHeadline() {
  const [typedLines, setTypedLines] = useState<[string, string]>(['', '']);
  const [activeLine, setActiveLine] = useState<0 | 1 | null>(0);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      setTypedLines([...LINES]);
      setActiveLine(null);
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

      for (let lineIndex = 0; lineIndex < LINES.length; lineIndex += 1) {
        const line = LINES[lineIndex];
        setActiveLine(lineIndex as 0 | 1);

        for (let characterIndex = 0; characterIndex < line.length; characterIndex += 1) {
          if (cancelled) return;

          const nextCharacter = line[characterIndex];
          setTypedLines((current) => {
            const next: [string, string] = [...current];
            next[lineIndex] = line.slice(0, characterIndex + 1);
            return next;
          });
          await wait(typingDelay(nextCharacter, characterIndex));
        }

        if (lineIndex === 0) await wait(320);
      }

      await wait(1100);
      if (!cancelled) setActiveLine(null);
    };

    void typeHeadline();

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      timers.clear();
    };
  }, []);

  return (
    <h1 className="hero-title hero-title--terminal reveal delay-2" aria-label={FULL_HEADLINE}>
      {LINES.map((line, index) => (
        <span
          className={`terminal-line${index === 1 ? ' terminal-line--accent' : ''}`}
          key={line}
          aria-hidden="true"
        >
          <span className="terminal-ghost">{line}</span>
          <span className="terminal-typed">
            {typedLines[index]}
            {activeLine === index ? <span className="terminal-cursor" /> : null}
          </span>
        </span>
      ))}
    </h1>
  );
}
