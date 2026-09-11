import type { ReactNode } from 'react';

export type StatusTone = 'ok' | 'warn' | 'err' | 'accent' | 'neutral';

export function StatusDot({
  tone = 'neutral',
  pulse = false,
}: {
  tone?: StatusTone;
  pulse?: boolean;
}) {
  return (
    <span
      className="admin-status-dot"
      data-tone={tone}
      data-pulse={pulse || undefined}
      aria-hidden="true"
    />
  );
}

export function StatusPill({
  tone = 'neutral',
  pulse = false,
  children,
}: {
  tone?: StatusTone;
  pulse?: boolean;
  children: ReactNode;
}) {
  return (
    <span className="admin-status-pill" data-tone={tone}>
      <StatusDot tone={tone} pulse={pulse} />
      {children}
    </span>
  );
}

export function MetricCard({
  label,
  value,
  qualifier,
  note,
}: {
  label: string;
  value: ReactNode;
  qualifier?: ReactNode;
  note?: ReactNode;
}) {
  return (
    <div className="admin-metric">
      <p className="admin-label">{label}</p>
      <div className="admin-metric-number">
        <strong>{value}</strong>
        {qualifier ? <span>{qualifier}</span> : null}
      </div>
      {note ? <p className="admin-metric-note">{note}</p> : null}
    </div>
  );
}

export function EmptyState({
  title,
  children,
  action,
  kind = 'clients',
  compact = false,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
  kind?: 'clients' | 'images' | 'traffic';
  compact?: boolean;
}) {
  return (
    <div className="admin-empty" data-compact={compact || undefined}>
      <span className="admin-empty-mark" data-kind={kind} aria-hidden="true" />
      <h2>{title}</h2>
      <p>{children}</p>
      {action}
    </div>
  );
}

export function Notice({
  tone = 'warn',
  title,
  children,
  action,
}: {
  tone?: StatusTone;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <output className="admin-notice" data-tone={tone}>
      <StatusDot tone={tone} />
      <span>
        <strong>{title}</strong>
        {children ? (
          <span className="admin-notice-description">{children}</span>
        ) : null}
      </span>
      {action}
    </output>
  );
}

export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly (readonly [T, string])[];
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="admin-segmented" aria-label={label}>
      {options.map(([key, text]) => (
        <button
          key={key}
          type="button"
          aria-pressed={value === key}
          onClick={() => onChange(key)}
        >
          {text}
        </button>
      ))}
    </fieldset>
  );
}
