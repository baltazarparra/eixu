'use client';

import type { StudioEditorState, StudioMessage } from '@/lib/studio/types';
import { StudioWorkspace } from './studio-workspace';

type Props = {
  tenant: { slug: string; name: string; status: string };
  initialMessages: StudioMessage[];
  initialEditor: StudioEditorState | null;
  initialRun: {
    id: string;
    workflowRunId: string | null;
    status: 'queued' | 'running' | 'cancel_requested';
  } | null;
  initialProject: {
    status:
      | 'draft'
      | 'building'
      | 'ready'
      | 'published'
      | 'archived'
      | 'failed';
    canonicalHost: string;
    draftCodeRevision: string | null;
    dirty: boolean;
  } | null;
  initialRelease: {
    id: string;
    status:
      | 'preparing'
      | 'validating'
      | 'ready'
      | 'active'
      | 'failed'
      | 'rolled_back';
    url: string | null;
    error: string | null;
  } | null;
  rollbackCandidate: { id: string; activatedAt: string | null } | null;
  images: { seq: number; url: string; alt: string | null }[];
  imageRequest?: string;
};

/** Uma única jornada: conversa, prévia e conteúdo do mesmo projeto. */
export function Workspace(props: Props) {
  return <StudioWorkspace {...props} />;
}
