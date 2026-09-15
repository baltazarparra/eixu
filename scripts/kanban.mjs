#!/usr/bin/env node

import { randomUUID } from 'node:crypto';
import { parseCardNumber } from '../lib/kanban/card-reference.mjs';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const DEFAULT_BASE_URL = 'https://eixu.com.br';
const MAX_DESCRIPTION_LENGTH = 12_000;
const PRIORITIES = new Set(['low', 'medium', 'high', 'urgent']);

export class KanbanHttpError extends Error {
  constructor(status, payload) {
    super(payload?.error || `Kanban respondeu HTTP ${status}.`);
    this.name = 'KanbanHttpError';
    this.status = status;
    this.code = payload?.code;
    this.fields = payload?.fields;
    this.currentRevision = payload?.currentRevision;
  }
}

function gitOutput(arguments_, cwd) {
  try {
    return execFileSync('git', arguments_, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
}

export function findEnvFile(cwd = process.cwd()) {
  if (process.env.EIXU_ENV_FILE) {
    const explicit = resolve(cwd, process.env.EIXU_ENV_FILE);
    if (!existsSync(explicit))
      throw new Error(`Arquivo de ambiente não encontrado: ${explicit}`);
    return explicit;
  }

  const candidates = [resolve(cwd, '.env.local')];
  const repository = gitOutput(['rev-parse', '--show-toplevel'], cwd);
  if (repository) candidates.push(resolve(repository, '.env.local'));

  const commonDirectory = gitOutput(
    ['rev-parse', '--path-format=absolute', '--git-common-dir'],
    cwd,
  );
  if (commonDirectory && basename(commonDirectory) === '.git')
    candidates.push(resolve(dirname(commonDirectory), '.env.local'));

  return [...new Set(candidates)].find((candidate) => existsSync(candidate));
}

export function loadKanbanEnv(cwd = process.cwd()) {
  if (process.env.KANBAN_AGENT_TOKEN) return null;
  const envFile = findEnvFile(cwd);
  if (envFile) process.loadEnvFile(envFile);
  return envFile ?? null;
}

export function normalizeBaseUrl(value = DEFAULT_BASE_URL) {
  const url = new URL(value);
  const local =
    url.hostname === 'localhost' ||
    url.hostname === '127.0.0.1' ||
    url.hostname.endsWith('.localhost');
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local))
    throw new Error('O Kanban exige HTTPS, exceto em localhost.');
  if (url.pathname !== '/' || url.search || url.hash)
    throw new Error('EIXU_KANBAN_URL deve conter apenas a origem do painel.');
  return url.origin;
}

export class KanbanClient {
  constructor({
    baseUrl = DEFAULT_BASE_URL,
    token,
    fetchImpl = globalThis.fetch,
  } = {}) {
    this.baseUrl = normalizeBaseUrl(baseUrl);
    if (!token) throw new Error('KANBAN_AGENT_TOKEN ausente.');
    this.authorization = `Bearer ${token}`;
    this.fetchImpl = fetchImpl;
  }

  async request(path, init = {}) {
    const method = init.method ?? 'GET';
    const headers = new Headers(init.headers);
    headers.set('accept', 'application/json');
    headers.set('authorization', this.authorization);

    const response = await this.fetchImpl(new URL(path, `${this.baseUrl}/`), {
      ...init,
      method,
      headers,
      signal: init.signal ?? AbortSignal.timeout(30_000),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new KanbanHttpError(response.status, payload);
    return payload;
  }

  board() {
    return this.request('/api/admin/kanban');
  }

  card(id) {
    return this.request(`/api/admin/kanban/cards/${encodeURIComponent(id)}`);
  }

  command(command) {
    return this.request('/api/admin/kanban/commands', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(command),
    });
  }
}

function normalized(value) {
  return value.trim().toLocaleLowerCase('pt-BR');
}

export function resolveColumn(board, selector = 'A fazer') {
  const byId = board.columns.find((column) => column.id === selector);
  if (byId) return byId;
  const matches = board.columns.filter(
    (column) => normalized(column.title) === normalized(selector),
  );
  if (matches.length !== 1)
    throw new Error(
      matches.length
        ? `Coluna ambígua: ${selector}`
        : `Coluna não encontrada: ${selector}`,
    );
  return matches[0];
}

export function resolveTenant(board, selector) {
  if (selector === undefined) return undefined;
  if (selector === 'none' || selector === 'null') return null;
  const exact = board.tenants.filter(
    (tenant) =>
      tenant.id === selector ||
      normalized(tenant.slug) === normalized(selector) ||
      normalized(tenant.name) === normalized(selector),
  );
  if (exact.length !== 1)
    throw new Error(
      exact.length
        ? `Cliente ambíguo: ${selector}`
        : `Cliente não encontrado: ${selector}`,
    );
  return exact[0].id;
}

function readDescription(values, current = '') {
  const sources = [
    values.description !== undefined,
    values['description-file'] !== undefined,
    values['append-description-file'] !== undefined,
  ].filter(Boolean).length;
  if (sources > 1)
    throw new Error(
      'Use apenas uma opção de descrição, arquivo ou anexo de descrição.',
    );

  let description = current;
  if (values.description !== undefined) description = values.description;
  if (values['description-file'] !== undefined)
    description = readFileSync(resolve(values['description-file']), 'utf8');
  if (values['append-description-file'] !== undefined) {
    const addition = readFileSync(
      resolve(values['append-description-file']),
      'utf8',
    ).trim();
    description = [current.trimEnd(), addition].filter(Boolean).join('\n\n');
  }
  if (description.length > MAX_DESCRIPTION_LENGTH)
    throw new Error(
      `A descrição tem ${description.length} caracteres; o limite é ${MAX_DESCRIPTION_LENGTH}.`,
    );
  return description;
}

function parsePriority(value, current) {
  if (value === undefined) return current;
  if (value === 'none' || value === 'null') return null;
  if (!PRIORITIES.has(value))
    throw new Error('Prioridade deve ser low, medium, high, urgent ou none.');
  return value;
}

function parseDueDate(value, current) {
  if (value === undefined) return current;
  if (value === 'none' || value === 'null') return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new Error('Prazo deve usar YYYY-MM-DD ou none.');
  return value;
}

function printHelp() {
  process.stdout.write(`Uso:
  npm run kanban -- board
  npm run kanban -- card <id>
  npm run kanban -- create-card --title <texto> [--description-file <arquivo>] [--column <nome>] [--tenant <slug>] [--priority <valor>] [--due-date YYYY-MM-DD]
  npm run kanban -- update-card <id> [--title <texto>] [--description-file <arquivo> | --append-description-file <arquivo>] [--tenant <slug|none>] [--priority <valor|none>] [--due-date <data|none>]
  npm run kanban -- move-card <id> --column <nome>

ID: número (0001, 1 ou #0001) ou UUID.
Variáveis: KANBAN_AGENT_TOKEN; EIXU_KANBAN_URL é opcional.
`);
}

function parseCli(arguments_) {
  return parseArgs({
    args: arguments_,
    allowPositionals: true,
    strict: true,
    options: {
      title: { type: 'string' },
      description: { type: 'string' },
      'description-file': { type: 'string' },
      'append-description-file': { type: 'string' },
      column: { type: 'string' },
      tenant: { type: 'string' },
      priority: { type: 'string' },
      'due-date': { type: 'string' },
      id: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
  });
}

export async function createCard(client, values) {
  if (!values.title?.trim()) throw new Error('--title é obrigatório.');
  const id = values.id ?? randomUUID();
  const description = readDescription(values);
  let board = await client.board();

  const send = () => {
    const column = resolveColumn(board, values.column);
    const tenantId = resolveTenant(board, values.tenant);
    return client.command({
      type: 'create_card',
      expectedRevision: board.revision,
      id,
      columnId: column.id,
      title: values.title.trim(),
      description,
      ...(tenantId !== undefined ? { tenantId } : {}),
      ...(values.priority !== undefined
        ? { priority: parsePriority(values.priority, null) }
        : {}),
      ...(values['due-date'] !== undefined
        ? { dueDate: parseDueDate(values['due-date'], null) }
        : {}),
    });
  };

  try {
    return await send();
  } catch (error) {
    if (
      !(error instanceof KanbanHttpError) ||
      error.code !== 'REVISION_CONFLICT'
    )
      throw error;
    board = await client.board();
    return send();
  }
}

export async function updateCard(client, id, values) {
  const detail = await client.card(id);
  const card = detail.card;
  const needsBoard = values.tenant !== undefined;
  const board = needsBoard ? await client.board() : null;
  const tenantId = needsBoard ? resolveTenant(board, values.tenant) : undefined;
  return client.command({
    type: 'update_card',
    expectedRevision: detail.revision,
    cardId: card.id,
    title: values.title?.trim() || card.title,
    description: readDescription(values, card.description),
    ...(tenantId !== undefined ? { tenantId } : {}),
    priority: parsePriority(values.priority, card.priority),
    dueDate: parseDueDate(values['due-date'], card.dueDate),
    expectedCardVersion: card.version,
  });
}

export async function moveCard(client, id, columnSelector) {
  if (!columnSelector) throw new Error('--column é obrigatório.');
  const board = await client.board();
  const number = parseCardNumber(id);
  const card = board.cards.find((candidate) =>
    number === null ? candidate.id === id : candidate.number === number,
  );
  if (!card) throw new Error(`Cartão ativo não encontrado: ${id}`);
  const target = resolveColumn(board, columnSelector);
  if (card.columnId === target.id) return board;
  return client.command({
    type: 'move_card',
    expectedRevision: board.revision,
    cardId: card.id,
    targetColumnId: target.id,
    beforeCardId: null,
  });
}

export async function runCli(arguments_, dependencies = {}) {
  const { values, positionals } = parseCli(arguments_);
  if (values.help || !positionals.length) {
    printHelp();
    return null;
  }

  loadKanbanEnv(dependencies.cwd ?? process.cwd());
  const token = process.env.KANBAN_AGENT_TOKEN;
  const client =
    dependencies.client ??
    new KanbanClient({
      baseUrl: process.env.EIXU_KANBAN_URL ?? DEFAULT_BASE_URL,
      token,
    });
  const [command, id] = positionals;
  let result;
  if (command === 'board') result = await client.board();
  else if (command === 'card') {
    if (!id) throw new Error('Informe o ID do cartão.');
    result = await client.card(id);
  } else if (command === 'create-card')
    result = await createCard(client, values);
  else if (command === 'update-card') {
    if (!id) throw new Error('Informe o ID do cartão.');
    result = await updateCard(client, id, values);
  } else if (command === 'move-card') {
    if (!id) throw new Error('Informe o ID do cartão.');
    result = await moveCard(client, id, values.column);
  } else throw new Error(`Comando desconhecido: ${command}`);

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return result;
}

const isMain =
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isMain) {
  runCli(process.argv.slice(2)).catch((error) => {
    const output = {
      error: error instanceof Error ? error.message : String(error),
      ...(error instanceof KanbanHttpError
        ? {
            status: error.status,
            code: error.code,
            fields: error.fields,
            currentRevision: error.currentRevision,
          }
        : {}),
    };
    process.stderr.write(`${JSON.stringify(output, null, 2)}\n`);
    process.exitCode = 1;
  });
}
