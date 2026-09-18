import { posix } from 'node:path';
import { STUDIO_PROTECTED_FILES } from './scaffold.ts';

export const STUDIO_WORKSPACE_ROOT = '/vercel/sandbox/project';

const BLOCKED_SEGMENTS = new Set(['.git', '.env', '.next', 'node_modules']);
const PROTECTED_FILES = new Set<string>([
  ...STUDIO_PROTECTED_FILES,
  'next-env.d.ts',
  'package-lock.json',
  'npm-shrinkwrap.json',
]);
const CONTRACT_FILES = new Set<string>([
  'content/schema.json',
  'content/values.json',
]);

/** Resolve um caminho de ferramenta sem permitir fuga, segredo ou symlink por nome. */
export function studioWorkspacePath(input: string): string {
  const source = input.replace(/\\/g, '/').trim();
  if (!source || source.includes('\0'))
    throw new Error('Caminho de projeto inválido.');
  const relative = source.startsWith('/')
    ? posix.relative(STUDIO_WORKSPACE_ROOT, source)
    : source;
  const normalized = posix.normalize(relative);
  const segments = normalized.split('/').filter(Boolean);
  if (
    normalized === '..' ||
    normalized.startsWith('../') ||
    posix.isAbsolute(normalized) ||
    segments.some((segment) => BLOCKED_SEGMENTS.has(segment))
  )
    throw new Error('Caminho fora do projeto ou reservado.');
  return posix.join(STUDIO_WORKSPACE_ROOT, normalized);
}

export function isReadableStudioFile(input: string): boolean {
  const path = studioWorkspacePath(input);
  return (
    posix.relative(STUDIO_WORKSPACE_ROOT, path) === '.gitignore' ||
    /\.(?:css|json|js|jsx|md|mjs|svg|ts|tsx|txt)$/i.test(path)
  );
}

export function isEditableStudioFile(input: string): boolean {
  const path = studioWorkspacePath(input);
  const relative = posix.relative(STUDIO_WORKSPACE_ROOT, path);
  if (PROTECTED_FILES.has(relative))
    throw new Error('Arquivo de integração reservado pela plataforma.');
  return isReadableStudioFile(input);
}

/**
 * Remover uma rota ou um componente obsoleto faz parte de recompor o site. O
 * contrato editorial não: ele é substituído pela ferramenta de conteúdo, que
 * valida schema e valores como uma unidade.
 */
export function isRemovableStudioFile(input: string): boolean {
  const relative = posix.relative(
    STUDIO_WORKSPACE_ROOT,
    studioWorkspacePath(input),
  );
  if (CONTRACT_FILES.has(relative))
    throw new Error(
      'O contrato editorial é atualizado por write_content_contract, não removido.',
    );
  return isEditableStudioFile(input);
}
