import type { TextStyle } from './text-style-schema';

/** Sem edição ou estilo, preserva os elementos e o texto público originais. */
export function textAttrs(styles?: TextStyle[], editing = false, prefix = '') {
  const mark = (field: string, part?: number) => ({
    ...(editing ? { 'data-field': prefix + field, 'data-part': part } : {}),
    ...(styles?.some((entry) => entry.field === prefix + field && entry.color)
      ? { 'data-text-color': true }
      : {}),
  });
  const content = (field: string, value: string | undefined) => {
    const style = styles?.find((entry) => entry.field === prefix + field);
    return style ? (
      <span
        className="site-styled"
        data-color={style.color ? true : undefined}
        data-scale={style.size ?? 0}
        style={style.color ? { color: style.color } : undefined}
      >
        {value}
      </span>
    ) : (
      value
    );
  };
  const attrs = (field: string, value: string | undefined, part?: number) => ({
    ...mark(field, part),
    children: content(field, value),
  });
  return Object.assign(attrs, {
    mark,
    content,
    node: (field: string, value: string | undefined) =>
      editing ? (
        <span {...mark(field)}>{content(field, value)}</span>
      ) : (
        content(field, value)
      ),
  });
}
