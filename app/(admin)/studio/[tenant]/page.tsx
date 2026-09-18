import { notFound, redirect } from 'next/navigation';
import { adminTenant } from '@/lib/admin/queries';
import { isAuthenticated } from '@/lib/auth';
import { listImages } from '@/lib/images/queries';
import { studioEditorStateByTenant } from '@/lib/studio/content';
import { studioMessages } from '@/lib/studio/messages';
import { studioProjectByTenant } from '@/lib/studio/projects';
import { activeStudioRun } from '@/lib/studio/runs';
import {
  hasStudioDraftChanges,
  latestStudioRelease,
  rollbackCandidateStudioRelease,
} from '@/lib/studio/releases';
import { Workspace } from '@/app/(admin)/admin/[tenant]/workspace';

export const dynamic = 'force-dynamic';

const FIRST_BUILD_PROMPT =
  'Crie a primeira versão completa do site usando o briefing, a marca, os contatos, as fontes e a referência cadastrados. Siga o fluxo de contexto, estrutura, direção de arte, imagens, construção e validação. Entregue um site específico para este cliente, responsivo e pronto para publicação.';

export default async function StudioProject({
  params,
  searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{
    start?: string | string[];
    imagem?: string | string[];
    pedido?: string | string[];
  }>;
}) {
  const { tenant: slug } = await params;
  if (!(await isAuthenticated()))
    redirect(`/admin/login?returnTo=${encodeURIComponent(`/studio/${slug}`)}`);
  const tenant = await adminTenant(slug);
  if (!tenant) notFound();
  const project = await studioProjectByTenant(tenant.id);
  const [messages, editor, images, run, release, dirty, rollbackCandidate] =
    await Promise.all([
      studioMessages(tenant.id),
      studioEditorStateByTenant(tenant.id),
      listImages(tenant.id),
      project ? activeStudioRun(project.id) : null,
      project ? latestStudioRelease(project.id) : null,
      project ? hasStudioDraftChanges(project.id) : false,
      project ? rollbackCandidateStudioRelease(project.id) : null,
    ]);
  const { start, imagem, pedido } = await searchParams;
  const imageRequest =
    typeof imagem === 'string' && /^[1-9]\d{0,8}$/.test(imagem)
      ? `Use a imagem #${imagem} neste projeto: `
      : typeof pedido === 'string'
        ? pedido.slice(0, 2_000)
        : '';
  const shouldStart =
    start === '1' &&
    messages.length === 0 &&
    !run &&
    !project?.draftCodeRevision &&
    tenant.status !== 'archived';

  return (
    <Workspace
      key={tenant.slug}
      tenant={{ slug: tenant.slug, name: tenant.name, status: tenant.status }}
      initialMessages={messages}
      initialEditor={editor}
      initialRun={
        run &&
        (run.status === 'queued' ||
          run.status === 'running' ||
          run.status === 'cancel_requested')
          ? {
              id: run.id,
              workflowRunId: run.workflowRunId,
              status: run.status,
            }
          : null
      }
      initialProject={
        project
          ? {
              status: project.status,
              canonicalHost: project.canonicalHost,
              draftCodeRevision: project.draftCodeRevision,
              dirty,
            }
          : null
      }
      initialRelease={
        release
          ? {
              id: release.id,
              status: release.status,
              url:
                release.status === 'active'
                  ? `https://${release.canonicalHost}`
                  : release.deploymentUrl,
              error: release.error,
            }
          : null
      }
      rollbackCandidate={
        rollbackCandidate
          ? {
              id: rollbackCandidate.id,
              activatedAt: rollbackCandidate.activatedAt,
            }
          : null
      }
      images={images.map((image) => ({
        seq: image.seq,
        url: image.url,
        alt: image.alt,
      }))}
      imageRequest={imageRequest}
      basePath="/studio"
      autoStartPrompt={shouldStart ? FIRST_BUILD_PROMPT : undefined}
      autoPublishFirst={shouldStart}
    />
  );
}
