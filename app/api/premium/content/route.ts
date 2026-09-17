import { premiumBridgeProject } from '@/lib/premium/bridge';
import { premiumContentForProject } from '@/lib/premium/content';
import { PremiumEditorError } from '@/lib/premium/editor';

export async function GET(request: Request) {
  const project = await premiumBridgeProject(request);
  if (!project) return new Response('Não autorizado', { status: 401 });
  const preview = new URL(request.url).searchParams.get('preview') ?? undefined;
  if (preview && (preview.length < 32 || preview.length > 200))
    return new Response('Prévia inválida', { status: 400 });
  try {
    const content = await premiumContentForProject(project.projectId, preview);
    if (!content)
      return Response.json(
        { error: 'Contrato editorial indisponível.' },
        { status: 404 },
      );
    return Response.json(content, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    if (error instanceof PremiumEditorError)
      return Response.json({ error: error.message }, { status: error.status });
    throw error;
  }
}
