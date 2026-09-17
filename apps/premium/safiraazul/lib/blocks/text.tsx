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
    const typography =
      style &&
      (style.size !== undefined ||
        style.color ||
        style.fontSize !== undefined ||
        style.fontWeight !== undefined ||
        style.lineHeight !== undefined ||
        style.letterSpacing !== undefined ||
        style.transform !== undefined ||
        style.fontStyle !== undefined);
    return style && typography ? (
      <span
        className="site-styled"
        data-color={style.color ? true : undefined}
        data-scale={style.size ?? 0}
        data-font-size={style.fontSize}
        data-font-weight={style.fontWeight}
        data-line-height={style.lineHeight}
        data-letter-spacing={style.letterSpacing}
        data-text-transform={style.transform}
        data-font-style={style.fontStyle}
        style={{
          ...(style.color ? { color: style.color } : {}),
          ...(style.fontSize !== undefined
            ? { fontSize: `${style.fontSize}px` }
            : {}),
          ...(style.fontWeight !== undefined
            ? { fontWeight: style.fontWeight }
            : {}),
          ...(style.lineHeight !== undefined
            ? { lineHeight: style.lineHeight }
            : {}),
          ...(style.letterSpacing !== undefined
            ? { letterSpacing: `${style.letterSpacing}px` }
            : {}),
          ...(style.transform ? { textTransform: style.transform } : {}),
          ...(style.fontStyle ? { fontStyle: style.fontStyle } : {}),
        }}
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
