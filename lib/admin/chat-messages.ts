import type { ChatMessage } from '@/lib/ai/usage';

const text = (message: ChatMessage) =>
  message.parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('\n')
    .trim();

/** Reconcilia o recibo salvo com a bolha do stream, preservando ferramentas e metadados. */
export function mergeSavedMessages(
  current: ChatMessage[],
  saved: ChatMessage[],
): ChatMessage[] {
  const next = [...current];
  const known = new Set(current.map((message) => message.id));
  let from = 0;
  for (const message of saved) {
    if (known.has(message.id)) continue;
    const match = next.findIndex(
      (item, index) =>
        index >= from &&
        !item.id.startsWith('saved-') &&
        item.role === message.role &&
        text(item) === text(message),
    );
    if (match === -1) next.push(message);
    else {
      next[match] = { ...next[match], id: message.id };
      from = match + 1;
    }
    known.add(message.id);
  }
  return next;
}
