'use client';

import { getToolName, isToolUIPart, type UIMessage } from 'ai';
import { useEffect, useState } from 'react';
import { Check, Loader2, X } from 'lucide-react';
import { describeTool } from '@/lib/generation/labels';
import { useAdminSession } from '@/components/admin/session';

type ToolPart = {
  type: string;
  toolName?: string;
  state?: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
};

/** Junta chamadas repetidas de consulta numa linha só, para a lista não virar ruído. */
const REPEATABLE = new Set([
  'describe_block',
  'list_state',
  'get_page',
  'list_images',
]);

function collapse(parts: ToolPart[]) {
  const out: {
    label: string;
    done: boolean;
    failed: boolean;
    count: number;
  }[] = [];
  for (const raw of parts) {
    const name =
      raw.type === 'dynamic-tool'
        ? (raw.toolName ?? 'ferramenta')
        : raw.type.replace('tool-', '');
    const done = raw.state === 'output-available';
    const output = (raw.output ?? {}) as Record<string, unknown>;
    const failed =
      raw.state === 'output-error' ||
      output.ok === false ||
      Boolean(output.error);
    const label =
      raw.state === 'output-error'
        ? (raw.errorText ?? `Tentativa recusada: ${name}`)
        : describeTool(name, raw.input, raw.output, raw.state ?? '');
    const last = out[out.length - 1];
    if (
      last &&
      REPEATABLE.has(name) &&
      last.label.startsWith(label.replace(/ \(\d+\)$/, ''))
    ) {
      last.count += 1;
      last.done = last.done && done;
      last.label = `${label} (${last.count})`;
      continue;
    }
    out.push({ label, done, failed, count: 1 });
  }
  return out;
}

export function Message({ message }: { message: UIMessage }) {
  const session = useAdminSession();
  const metadata = message.metadata as
    | { author?: { type?: string; name?: string; login?: string } }
    | undefined;
  const recorded = metadata?.author;
  const person = recorded?.name ?? recorded?.login ?? session?.operator;
  const author =
    recorded?.type === 'legacy'
      ? 'Operador anterior'
      : message.role === 'user'
        ? (person ?? 'Operador')
        : person
          ? `Agente · a pedido de ${person}`
          : 'Agente';
  if (message.role === 'user') {
    const text = message.parts
      .filter((part) => part.type === 'text')
      .map((part) => (part as { text: string }).text)
      .join('');
    const images = message.parts.filter((part) => part.type === 'file') as {
      url: string;
      filename?: string;
    }[];
    return (
      <Bubble from="user" author={author}>
        {images.length ? (
          <span className="admin-bubble-files">
            {images.map((image) => (
              // oxlint-disable-next-line next/no-img-element
              <img
                key={image.url}
                src={image.url}
                alt={image.filename ?? 'imagem anexada'}
              />
            ))}
          </span>
        ) : null}
        {text}
      </Bubble>
    );
  }

  // Renderiza na ordem em que o agente trabalhou: pensa, age, pensa, age, resume.
  const groups: (
    | { kind: 'text'; text: string }
    | { kind: 'tools'; parts: ToolPart[] }
  )[] = [];
  for (const part of message.parts) {
    if (part.type === 'text') {
      const text = (part as { text: string }).text;
      if (!text.trim()) continue;
      const last = groups[groups.length - 1];
      if (last?.kind === 'text') last.text += text;
      else groups.push({ kind: 'text', text });
    } else if (isToolUIPart(part)) {
      const last = groups[groups.length - 1];
      if (last?.kind === 'tools') last.parts.push(part as ToolPart);
      else groups.push({ kind: 'tools', parts: [part as ToolPart] });
    }
  }

  return (
    <div className="admin-turn">
      {groups.map((group, index) =>
        group.kind === 'text' ? (
          <Bubble key={index} from="assistant" author={author}>
            {group.text.trim()}
          </Bubble>
        ) : (
          <ol key={index} className="admin-tools">
            {collapse(group.parts).map((item, itemIndex) => (
              <li
                key={itemIndex}
                data-state={
                  item.failed ? 'failed' : item.done ? 'done' : 'pending'
                }
              >
                <span className="admin-tools-mark" aria-hidden="true">
                  {item.failed ? (
                    <X size={12} strokeWidth={3} />
                  ) : item.done ? (
                    <Check size={12} strokeWidth={3} />
                  ) : (
                    <Loader2 size={12} strokeWidth={2.5} />
                  )}
                </span>
                <span>{item.label}</span>
              </li>
            ))}
          </ol>
        ),
      )}
    </div>
  );
}

/** Mantém o andamento visível também durante raciocínio e ferramentas longas. */
export function ChatActivity({
  messages,
  compact = false,
}: {
  messages: UIMessage[];
  compact?: boolean;
}) {
  const [started] = useState(() => Date.now());
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const timer = setInterval(
      () => setElapsed(Math.floor((Date.now() - started) / 1000)),
      1000,
    );
    return () => clearInterval(timer);
  }, [started]);
  const last = messages.at(-1);
  const pending =
    last?.role === 'assistant'
      ? [...last.parts]
          .reverse()
          .find(
            (part) =>
              isToolUIPart(part) &&
              (part.state === 'input-streaming' ||
                part.state === 'input-available'),
          )
      : undefined;
  const activity =
    pending && isToolUIPart(pending)
      ? describeTool(
          getToolName(pending),
          pending.input,
          undefined,
          pending.state,
        )
      : last?.role === 'assistant' && last.parts.some(isToolUIPart)
        ? 'Preparando a resposta'
        : last?.role === 'assistant' &&
            last.parts.some((part) => part.type === 'text' && part.text.trim())
          ? 'Respondendo ao seu pedido'
          : 'Entendendo seu pedido';
  const duration = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`;
  return (
    <div
      className="admin-activity"
      data-chat-activity
      data-compact={compact || undefined}
    >
      <span className="admin-activity-line">
        <Loader2 size={13} strokeWidth={2.5} aria-hidden="true" />
        <output>{activity}</output>
        <span className="admin-activity-time" aria-hidden="true">
          {duration}
        </span>
      </span>
      {elapsed >= 60 && !compact ? (
        <span className="admin-activity-note">
          Aguardando a conclusão desta etapa. As alterações salvas aparecem
          automaticamente na prévia.
        </span>
      ) : null}
    </div>
  );
}

export function Bubble({
  from,
  author,
  children,
}: {
  from: string;
  author?: string;
  children: React.ReactNode;
}) {
  const isUser = from === 'user';
  return (
    <div className="admin-bubble" data-from={isUser ? 'user' : 'assistant'}>
      <span className="admin-bubble-author">
        {author ?? (isUser ? 'Você' : 'Agente')}
      </span>
      <div className="admin-bubble-body whitespace-pre-wrap">{children}</div>
    </div>
  );
}

/**
 * Uma requisição que falha no transporte rejeita com o texto do navegador —
 * "Load failed" no WebKit, "Failed to fetch" no Chromium —, que chegava cru à
 * tela. Sem tradução o operador lê uma frase sem ação e, pior, sem saber se a
 * edição chegou a ser salva: o servidor pode ter concluído a escrita depois de
 * a conexão cair. A mensagem passa a dizer o que fazer e a não afirmar nem que
 * salvou nem que perdeu, o mesmo contrato do CHAT_INTERRUPTED do servidor.
 */
const TRANSPORT_FAILURE =
  /load failed|failed to fetch|networkerror|network request failed|err_(?:network|connection|internet)|the operation (?:timed out|was aborted)|timeouterror|aborterror/i;

/** Erro do gateway e queda de conexão em linguagem de gente. */
export function chatErrorMessage(message: string): string {
  if (/rate.?limit|429|free tier|not have access/i.test(message))
    return 'O AI Gateway recusou a chamada. Verifique créditos e o modelo em EIXU_MODEL.';
  if (TRANSPORT_FAILURE.test(message))
    return 'A conexão com o painel caiu antes da resposta. A alteração pode ter sido salva mesmo assim: recarregue a página e confira a prévia antes de pedir de novo.';
  return message;
}
