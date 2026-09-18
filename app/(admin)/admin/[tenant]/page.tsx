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
import { notFound, redirect } from 'next/navigation';
import { Workspace } from './workspace';

export const dynamic = 'force-dynamic';

export default async function TenantWorkspace({
  params,
  searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{
    imagem?: string | string[];
    pedido?: string | string[];
  }>;
}) {
  const { tenant: slug } = await params;
  if (!(await isAuthenticated()))
    redirect(`/admin/login?returnTo=${encodeURIComponent(`/admin/${slug}`)}`);
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
  const { imagem, pedido } = await searchParams;
  const imageRequest =
    typeof imagem === 'string' && /^[1-9]\d{0,8}$/.test(imagem)
      ? `Use a imagem #${imagem} neste projeto: `
      : typeof pedido === 'string'
        ? pedido.slice(0, 2_000)
        : '';

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
    />
  );
}
