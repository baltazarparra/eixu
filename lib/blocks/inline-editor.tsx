'use client';

import { useEffect, useRef, useState } from 'react';
import { editorContrast } from './inline-contrast';
import { fieldTextError, normalizeFieldText, type FieldError } from './fields';
import {
  EDIT_PROTOCOL,
  type EditChanges,
  type EditorField,
  type InlineEditorProps,
} from './edit-protocol';
import type { TextStyle } from './text-style-schema';

type Entry = EditorField & { current: string; currentStyle?: TextStyle };
type Toolbar = {
  field: Entry;
  error?: string;
  ratio?: number;
  top: number;
  left: number;
};
const keyOf = (field: { block: string; path: string }) =>
  `${field.block}:${field.path}`;
const sameStyle = (a?: TextStyle, b?: TextStyle) =>
  (a?.size ?? 0) === (b?.size ?? 0) &&
  (a?.color ?? '').toLowerCase() === (b?.color ?? '').toLowerCase();
const changedText = (entry: Entry) =>
  normalizeFieldText(entry.current, entry.multiline) !==
  normalizeFieldText(entry.value, entry.multiline);
const changedStyle = (entry: Entry) =>
  !sameStyle(entry.style, entry.currentStyle);

function caretOffset(node: HTMLElement): number | null {
  const selection = window.getSelection();
  if (!selection?.rangeCount || !node.contains(selection.anchorNode))
    return null;
  const range = selection.getRangeAt(0).cloneRange();
  range.selectNodeContents(node);
  range.setEnd(selection.anchorNode!, selection.anchorOffset);
  return range.toString().length;
}
function placeCaret(node: HTMLElement, offset: number) {
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
  let text = walker.nextNode();
  while (text && offset > (text.textContent?.length ?? 0)) {
    offset -= text.textContent!.length;
    text = walker.nextNode();
  }
  const range = document.createRange();
  if (text)
    range.setStart(text, Math.min(offset, text.textContent?.length ?? 0));
  else {
    range.selectNodeContents(node);
    range.collapse(false);
  }
  range.collapse(true);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

export function InlineEditor({
  page,
  revision,
  fields,
  palette,
}: InlineEditorProps) {
  const [toolbar, setToolbar] = useState<Toolbar | null>(null);
  const commands = useRef<{
    style: (style?: Partial<TextStyle>) => void;
    restore: () => void;
    focus: () => void;
  } | null>(null);
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(
      '.site-theme[data-editing="true"]',
    );
    if (!root) return;
    const entries = new Map(
      fields.map((field) => [
        keyOf(field),
        { ...field, current: field.value, currentStyle: field.style } as Entry,
      ]),
    );
    const serverErrors = new Map<string, string>();
    const clearErrors = (entry: Entry) => {
      // Um erro do pre-flight pode pertencer ao bloco inteiro. Uma correção
      // permite reenviá-lo; o servidor valida novamente todos os campos.
      for (const key of serverErrors.keys())
        if (key.startsWith(`${entry.block}:`)) serverErrors.delete(key);
    };
    const originals = new Map<HTMLElement, string>();
    let focused: HTMLElement | null = null;
    let paused = false;
    let syncFrame = 0;
    let composing = false;
    const observer = new MutationObserver(() => {
      if (!syncFrame && !composing)
        syncFrame = requestAnimationFrame(() => {
          syncFrame = 0;
          sync();
        });
    });
    const send = (message: object) =>
      window.parent.postMessage(
        { type: EDIT_PROTOCOL, ...message },
        location.origin,
      );
    const entryOf = (node: Element | null) => {
      const block =
        node?.closest<HTMLElement>('[data-block-id]')?.dataset.blockId;
      const path = (node as HTMLElement | null)?.dataset.field;
      return block && path ? entries.get(`${block}:${path}`) : undefined;
    };
    const nodesOf = (entry: Entry) =>
      [
        ...root.querySelectorAll<HTMLElement>('[data-block-id] [data-field]'),
      ].filter((node) => entryOf(node) === entry);
    const reason = (entry: Entry): string | undefined => {
      if (serverErrors.has(keyOf(entry))) return serverErrors.get(keyOf(entry));
      if (!changedText(entry) && !changedStyle(entry)) return undefined;
      const message = fieldTextError(
        entry,
        normalizeFieldText(entry.current, entry.multiline),
      );
      if (message) return message;
      const style = entry.currentStyle;
      if ((style?.size ?? 0) < entry.minStep)
        return 'Este texto precisa de um tamanho maior para leitura.';
      if (style?.color && !/^#[0-9a-f]{6}$/i.test(style.color))
        return 'Informe uma cor como #193f47.';
      if (style?.color) {
        if (!entry.backgrounds.length)
          return 'Texto sobre foto: mantenha a cor automática.';
        if (
          editorContrast(style.color, entry.backgrounds, nodesOf(entry)) < 4.5
        )
          return 'A cor precisa de contraste mínimo de 4,5:1.';
      }
      return undefined;
    };
    const show = () => {
      const field = entryOf(focused);
      if (!field || !focused) {
        setToolbar(null);
        return;
      }
      const rect = focused.getBoundingClientRect();
      const ratio =
        field.currentStyle?.color &&
        /^#[0-9a-f]{6}$/i.test(field.currentStyle.color) &&
        field.backgrounds.length
          ? editorContrast(
              field.currentStyle.color,
              field.backgrounds,
              nodesOf(field),
            )
          : undefined;
      setToolbar({
        field: { ...field },
        error: reason(field),
        ratio,
        top: Math.max(8, Math.min(innerHeight - 230, rect.bottom + 10)),
        left: Math.max(8, Math.min(innerWidth - 368, rect.left)),
      });
    };
    const announce = () => {
      const invalid: FieldError[] = [];
      for (const entry of entries.values()) {
        const message = reason(entry);
        if (message)
          invalid.push({ block: entry.block, path: entry.path, message });
        for (const node of nodesOf(entry)) {
          if (message) node.setAttribute('aria-invalid', 'true');
          else node.removeAttribute('aria-invalid');
        }
      }
      send({
        action: 'state',
        changed: [...entries.values()].some(
          (entry) => changedText(entry) || changedStyle(entry),
        ),
        invalid,
      });
      show();
    };
    const paint = (node: HTMLElement, entry: Entry, value: string) => {
      const offset = document.activeElement === node ? caretOffset(node) : null;
      const style = entry.currentStyle;
      const span = node.firstElementChild as HTMLElement | null;
      const needsStyle = Boolean(style && (style.size || style.color));
      let replaced = false;
      if (
        node.textContent !== value ||
        (needsStyle &&
          (!span?.classList.contains('site-styled') ||
            node.childNodes.length !== 1)) ||
        (!needsStyle && node.childElementCount)
      ) {
        replaced = true;
        if (needsStyle) {
          const child = document.createElement('span');
          child.className = 'site-styled';
          child.textContent = value;
          node.replaceChildren(child);
        } else node.textContent = value;
      }
      const child = node.querySelector<HTMLElement>(':scope > .site-styled');
      if (child) {
        child.dataset.scale = String(style?.size ?? 0);
        if (style?.color) child.dataset.color = 'true';
        else delete child.dataset.color;
        child.style.color = /^#[0-9a-f]{6}$/i.test(style?.color ?? '')
          ? style!.color!
          : '';
      }
      if (style?.color) node.dataset.textColor = 'true';
      else delete node.dataset.textColor;
      if (offset !== null && replaced) placeCaret(node, offset);
    };
    const sync = () => {
      observer?.disconnect();
      for (const entry of entries.values()) {
        const nodes = nodesOf(entry);
        if (entry.multiline && nodes.length) {
          const parts = entry.current.split('\n\n');
          while (nodes.length < parts.length) {
            const clone = nodes[0].cloneNode(true) as HTMLElement;
            const previous = nodes.at(-1)!;
            previous.parentNode!.insertBefore(clone, previous.nextSibling);
            nodes.push(clone);
          }
          while (nodes.length > parts.length) nodes.pop()!.remove();
          nodes.forEach((node, index) => {
            node.dataset.part = String(index);
          });
        }
        for (const node of nodes) {
          if (!originals.has(node))
            originals.set(node, node.getAttribute('tabindex') ?? '');
          node.contentEditable = paused ? 'false' : 'plaintext-only';
          if (node.contentEditable !== 'plaintext-only' && !paused)
            node.contentEditable = 'true';
          node.setAttribute('role', 'textbox');
          node.setAttribute('aria-label', entry.label);
          node.setAttribute('aria-multiline', String(entry.multiline));
          node.tabIndex = 0;
          node.spellcheck = true;
          paint(
            node,
            entry,
            entry.multiline
              ? (entry.current.split('\n\n')[Number(node.dataset.part)] ?? '')
              : entry.current,
          );
        }
      }
      observer?.observe(root, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    };
    const change = (node: HTMLElement) => {
      const entry = entryOf(node);
      if (!entry) return;
      entry.current = entry.multiline
        ? nodesOf(entry)
            .map((part) => part.textContent ?? '')
            .join('\n\n')
        : (node.textContent ?? '');
      clearErrors(entry);
      sync();
      announce();
    };
    const startComposition = () => {
      composing = true;
    };
    const endComposition = (event: CompositionEvent) => {
      composing = false;
      if (event.target instanceof HTMLElement) change(event.target);
    };
    const onInput = (event: Event) => {
      if (
        event.target instanceof HTMLElement &&
        event.target.matches('[data-field]') &&
        !(event as InputEvent).isComposing
      )
        change(event.target);
    };
    const insert = (node: HTMLElement, value: string) => {
      const selection = window.getSelection();
      if (!selection?.rangeCount || !node.contains(selection.anchorNode))
        return;
      const range = selection.getRangeAt(0);
      range.deleteContents();
      const text = document.createTextNode(value);
      range.insertNode(text);
      range.setStartAfter(text);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      change(node);
    };
    const onPaste = (event: ClipboardEvent) => {
      const node = (event.target as Element)?.closest<HTMLElement>(
        '[data-field]',
      );
      if (!node) return;
      event.preventDefault();
      const entry = entryOf(node);
      if (!entry) return;
      const value = event.clipboardData?.getData('text/plain') ?? '';
      insert(
        node,
        entry.multiline
          ? value.replace(/\r/g, '').replace(/\n/g, '\n\n')
          : value.replace(/\s+/g, ' '),
      );
    };
    const onKey = (event: KeyboardEvent) => {
      const node = (event.target as Element)?.closest<HTMLElement>(
        '[data-field]',
      );
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        send({ action: 'save' });
        return;
      }
      if (event.key === 'Escape') {
        focused?.focus();
        setToolbar(null);
        return;
      }
      if (!node || event.isComposing) return;
      const entry = entryOf(node);
      if (!entry) return;
      // Não deixe teclas chegarem ao menu/abas que envolvem o campo.
      if (['ArrowLeft', 'ArrowRight', 'Home', 'End', ' '].includes(event.key))
        event.stopPropagation();
      if (event.key === 'Enter') {
        event.preventDefault();
        event.stopPropagation();
        if (entry.multiline) {
          const part = Number(node.dataset.part ?? 0),
            offset = caretOffset(node) ?? 0;
          const parts = entry.current.split('\n\n');
          const current = node.textContent ?? '';
          parts.splice(
            part,
            1,
            current.slice(0, offset),
            current.slice(offset),
          );
          entry.current = parts.join('\n\n');
          sync();
          const next = nodesOf(entry)[part + 1];
          next?.focus();
          if (next) placeCaret(next, 0);
          announce();
        }
      } else if (
        event.key === 'Backspace' &&
        entry.multiline &&
        caretOffset(node) === 0 &&
        Number(node.dataset.part) > 0
      ) {
        event.preventDefault();
        const part = Number(node.dataset.part);
        const parts = entry.current.split('\n\n');
        const offset = parts[part - 1].length;
        parts.splice(part - 1, 2, parts[part - 1] + parts[part]);
        entry.current = parts.join('\n\n');
        sync();
        const previous = nodesOf(entry)[part - 1];
        previous.focus();
        placeCaret(previous, offset);
        announce();
      }
    };
    const onClick = (event: MouseEvent) => {
      const target = event.target as Element;
      if (target.closest('.site-inline-toolbar')) return;
      if (
        target.closest(
          'a, button, summary, select, input, textarea, [role="tab"]',
        )
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
      const node = target.closest<HTMLElement>('[data-field]');
      if (node) {
        node.focus();
        focused = node;
        show();
      }
    };
    const onFocus = (event: FocusEvent) => {
      const node = (event.target as Element).closest<HTMLElement>(
        '[data-field]',
      );
      if (node) {
        focused = node;
        show();
      }
    };
    const collect = (): EditChanges => {
      const blocks = new Map<string, EditChanges['blocks'][number]>();
      for (const entry of entries.values()) {
        if (!changedText(entry) && !changedStyle(entry)) continue;
        const block = blocks.get(entry.block) ?? { id: entry.block };
        if (changedText(entry))
          block.text = {
            ...block.text,
            [entry.path]: normalizeFieldText(entry.current, entry.multiline),
          };
        if (changedStyle(entry))
          block.textStyles = [...entries.values()]
            .filter((f) => f.block === entry.block && f.currentStyle)
            .map((f) => f.currentStyle!);
        blocks.set(entry.block, block);
      }
      return { page, revision, blocks: [...blocks.values()] };
    };
    const onMessage = (event: MessageEvent) => {
      if (
        event.origin !== location.origin ||
        event.source !== window.parent ||
        event.data?.type !== EDIT_PROTOCOL
      )
        return;
      if (event.data.action === 'collect') {
        paused = true;
        sync();
        send({ action: 'changes', ...collect() });
      }
      if (event.data.action === 'errors') {
        paused = false;
        for (const error of (event.data.fields ?? []) as FieldError[]) {
          for (const entry of entries.values())
            if (
              (!error.block || entry.block === error.block) &&
              (!error.path || entry.path === error.path)
            )
              serverErrors.set(keyOf(entry), error.message);
        }
        sync();
        announce();
        const invalid = root.querySelector<HTMLElement>(
          '[aria-invalid="true"]',
        );
        invalid?.focus();
        invalid?.scrollIntoView({ block: 'center' });
      }
      if (event.data.action === 'resume') {
        paused = false;
        sync();
      }
      if (event.data.action === 'discard') {
        for (const entry of entries.values()) {
          entry.current = entry.value;
          entry.currentStyle = entry.style;
        }
        serverErrors.clear();
        paused = false;
        sync();
        announce();
      }
    };
    commands.current = {
      style(style) {
        const entry = entryOf(focused);
        if (!entry || !entry.stylable || paused) return;
        const next = { ...entry.currentStyle, ...style, field: entry.path };
        entry.currentStyle = !next.color && !next.size ? undefined : next;
        clearErrors(entry);
        sync();
        announce();
      },
      restore() {
        const entry = entryOf(focused);
        if (!entry || paused) return;
        entry.current = entry.value;
        entry.currentStyle = entry.style;
        clearErrors(entry);
        sync();
        announce();
      },
      focus() {
        focused?.focus();
      },
    };

    root
      .querySelectorAll<HTMLDetailsElement>('.site-faq details')
      .forEach((node) => {
        node.open = true;
      });
    sync();
    root.addEventListener('input', onInput);
    root.addEventListener('compositionstart', startComposition);
    root.addEventListener('compositionend', endComposition);
    root.addEventListener('paste', onPaste);
    root.addEventListener('keydown', onKey, true);
    root.addEventListener('click', onClick, true);
    root.addEventListener('focusin', onFocus);
    window.addEventListener('message', onMessage);
    window.addEventListener('scroll', show, true);
    window.addEventListener('resize', show);
    send({ action: 'ready', page, revision, fields: fields.length });
    announce();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(syncFrame);
      commands.current = null;
      root.removeEventListener('input', onInput);
      root.removeEventListener('compositionstart', startComposition);
      root.removeEventListener('compositionend', endComposition);
      root.removeEventListener('paste', onPaste);
      root.removeEventListener('keydown', onKey, true);
      root.removeEventListener('click', onClick, true);
      root.removeEventListener('focusin', onFocus);
      window.removeEventListener('message', onMessage);
      window.removeEventListener('scroll', show, true);
      window.removeEventListener('resize', show);
      for (const [node, tabIndex] of originals) {
        node.removeAttribute('contenteditable');
        node.removeAttribute('role');
        node.removeAttribute('aria-label');
        node.removeAttribute('aria-multiline');
        node.removeAttribute('aria-invalid');
        if (tabIndex) node.setAttribute('tabindex', tabIndex);
        else node.removeAttribute('tabindex');
      }
    };
  }, [page, revision, fields]);
  if (!toolbar) return null;
  const { field, error, ratio } = toolbar;
  const step = field.currentStyle?.size ?? 0;
  return (
    <section
      className="site-inline-toolbar"
      aria-label="Editar texto"
      style={{ top: toolbar.top, left: toolbar.left }}
    >
      <div className="site-inline-heading">
        <strong>{field.label}</strong>
        <span>
          {field.current.length}
          {field.max !== null ? `/${field.max}` : ''}
          {field.path === 'headline'
            ? ` · ${Math.ceil(field.current.length / 28)}/2 linhas`
            : ''}
        </span>
      </div>
      {field.stylable && (
        <>
          <div className="site-inline-row">
            <span>Tamanho</span>
            <button
              type="button"
              aria-label="Diminuir texto"
              disabled={step <= field.minStep}
              onClick={() =>
                commands.current?.style({
                  size: (step - 1) as TextStyle['size'],
                })
              }
            >
              A−
            </button>
            <output>{[80, 90, 100, 115, 130][step + 2]}%</output>
            <button
              type="button"
              aria-label="Aumentar texto"
              disabled={step >= 2}
              onClick={() =>
                commands.current?.style({
                  size: (step + 1) as TextStyle['size'],
                })
              }
            >
              A+
            </button>
          </div>
          <div className="site-inline-colors">
            <button
              type="button"
              onClick={() => commands.current?.style({ color: undefined })}
            >
              Automático
            </button>
            {palette.map((color) => (
              <button
                type="button"
                key={color.label}
                title={color.label}
                aria-label={`Cor ${color.label}`}
                style={{ '--swatch': color.color } as React.CSSProperties}
                onClick={() => commands.current?.style({ color: color.color })}
              >
                <i aria-hidden="true" />
                {color.label}
              </button>
            ))}
          </div>
          <div className="site-inline-row">
            <label>
              Cor{' '}
              <input
                aria-label="Cor hexadecimal"
                type="text"
                maxLength={7}
                value={field.currentStyle?.color ?? ''}
                placeholder="#193f47"
                onChange={(event) =>
                  commands.current?.style({
                    color: event.target.value || undefined,
                  })
                }
              />
            </label>
            <input
              aria-label="Escolher cor"
              type="color"
              value={
                /^#[0-9a-f]{6}$/i.test(field.currentStyle?.color ?? '')
                  ? field.currentStyle!.color!
                  : '#193f47'
              }
              onChange={(event) =>
                commands.current?.style({ color: event.target.value })
              }
            />
          </div>
          {ratio !== undefined && (
            <output className="site-inline-ratio">
              {ratio >= 4.5 ? '✓' : '✗'} Contraste {ratio.toFixed(2)}:1
            </output>
          )}
        </>
      )}
      {error && (
        <p className="site-inline-error" role="alert">
          {error}
        </p>
      )}
      <div className="site-inline-row">
        <button type="button" onClick={() => commands.current?.restore()}>
          Restaurar
        </button>
        <button
          type="button"
          onClick={() => {
            commands.current?.focus();
            setToolbar(null);
          }}
        >
          Voltar ao texto
        </button>
      </div>
    </section>
  );
}
