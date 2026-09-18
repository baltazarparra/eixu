'use client';

import { getToolName, isToolUIPart, type UIMessage } from 'ai';
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useAdminSession } from '@/components/admin/session';

const TOOL_LABELS: Record<string, string> = {
  read_project_context: 'Lendo os dados, a marca e os ativos do cliente',
  read_official_site: 'Consultando o site oficial',
  inspect_visual_reference:
    'Analisando a referência visual em desktop e celular',
  list_project_files: 'Mapeando os arquivos do projeto',
  read_project_file: 'Lendo um arquivo do projeto',
  write_project_file: 'Escrevendo o projeto',
  edit_project_file: 'Ajustando um arquivo do projeto',
  delete_project_file: 'Removendo um arquivo do projeto',
  write_content_contract: 'Organizando o conteúdo editável',
  generate_project_image: 'Criando uma imagem para o projeto',
  run_project_check: 'Validando o projeto',
  record_artifact: 'Registrando uma decisão do projeto',
};

const ARTIFACT_LABELS: Record<string, string> = {
  context: 'Organizando o contexto do projeto',
  art_direction: 'Definindo a direção de arte',
  validation: 'Registrando as verificações do projeto',
};

function describeTool(name: string, input?: unknown): string {
  const kind =
    input && typeof input === 'object' && 'kind' in input
      ? String(input.kind)
      : '';
  return (
    (name === 'record_artifact' ? ARTIFACT_LABELS[kind] : undefined) ??
    TOOL_LABELS[name] ??
    'Trabalhando no projeto'
  );
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

  // As ferramentas alimentam o widget de progresso, sem repetir etapas no chat.
  const texts = message.parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text.trim())
    .filter(Boolean);
  if (!texts.length) return null;

  return (
    <div className="admin-turn">
      {texts.map((text, index) => (
        <Bubble key={index} from="assistant" author={author}>
          {chatErrorMessage(text)}
        </Bubble>
      ))}
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
      ? describeTool(getToolName(pending), pending.input)
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

/** Erro do gateway em linguagem de gente. */
export function chatErrorMessage(message: string): string {
  return /rate.?limit|429|free tier|not have access/i.test(message)
    ? 'O AI Gateway recusou a chamada. Confira os créditos e tente novamente.'
    : /Failed to fetch chat: 409/i.test(message)
      ? 'Já existe um trabalho em andamento neste projeto.'
      : /AI_InvalidToolInputError|AI_TypeValidationError|Invalid input for tool/i.test(
            message,
          )
        ? 'O agente enviou um formato inválido nesta etapa e precisa ajustá-lo.'
        : /Step ["“].+["”] failed|unknown format|after \d+ retries/i.test(
              message,
            )
          ? 'Não consegui concluir esta etapa. Peça para continuar a geração.'
          : message;
}
