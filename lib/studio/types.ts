import type { UIMessage } from 'ai';
import type { StudioEditorContract, StudioEditorValues } from './editor';
import type { StudioModelRole } from './models';

export type StudioMessageMetadata = {
  author?: {
    type: 'user' | 'agent' | 'legacy';
    name?: string;
    login?: string;
  };
  runId?: string;
  usage?: {
    model: string;
    modelRole: StudioModelRole;
    policyVersion: string;
    reasoning: string;
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    reasoningTokens?: number;
    costUsd?: number;
    generationId?: string;
    steps?: number;
    durationMs?: number;
    finishReason?: string;
  };
};

export type StudioDataParts = {
  'run-status': {
    runId: string;
    status:
      | 'queued'
      | 'running'
      | 'cancel_requested'
      | 'succeeded'
      | 'failed'
      | 'cancelled';
    label: string;
  };
  artifact: {
    id: string;
    kind: string;
    version: number;
  };
  'preview-ready': {
    url: string;
    codeRevision: string;
    contentRevision: number | null;
  };
  'release-result': {
    releaseId: string;
    url: string;
    status: 'ready' | 'active' | 'failed';
  };
};

export type StudioMessage = UIMessage<StudioMessageMetadata, StudioDataParts>;

export type StudioProject = {
  id: string;
  tenantId: string;
  slug: string;
  status: 'draft' | 'building' | 'ready' | 'published' | 'archived' | 'failed';
  sandboxName: string;
  repositoryPath: string | null;
  vercelProjectId: string | null;
  vercelProjectName: string | null;
  canonicalHost: string;
  baseCodeRevision: string | null;
  draftCodeRevision: string | null;
  activeReleaseId: string | null;
  activeContentRevisionId: string | null;
};

export type StudioEditorState = {
  revision: number;
  contractHash: string;
  contract: StudioEditorContract;
  values: StudioEditorValues;
  updatedAt: string | null;
};
