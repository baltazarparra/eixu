import type { TextStyle } from './text-style-schema';

/** Sem edição ou estilo, preserva os elementos e o texto público originais. */
export function textAttrs(styles?: TextStyle[], editing = false, prefix = '') {
  const styleFor = (field: string) =>
    styles?.find((entry) => entry.field === prefix + field);
  const mark = (field: string, part?: number) => {
    const style = styleFor(field);
    return {
      ...(editing ? { 'data-field': prefix + field, 'data-part': part } : {}),
      ...(style?.color ? { 'data-text-color': true } : {}),
      ...(style?.align ? { 'data-text-align': style.align } : {}),
    };
  };
  const content = (field: string, value: string | undefined) => {
    const style = styleFor(field);
    return style && (style.size !== undefined || style.color) ? (
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
      editing || styleFor(field)?.align ? (
        <span {...mark(field)}>{content(field, value)}</span>
      ) : (
        content(field, value)
      ),
  });
}
