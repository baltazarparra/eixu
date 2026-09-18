import { createHash } from 'node:crypto';
import type { StudioEditorContract } from './editor';

export function studioContractHash(contract: StudioEditorContract): string {
  return createHash('sha256').update(JSON.stringify(contract)).digest('hex');
}
