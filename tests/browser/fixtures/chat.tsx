import { createRoot } from 'react-dom/client';
import { Workspace } from '@/app/(admin)/admin/[tenant]/workspace';
import type { SiteState } from '@/lib/admin/state';

const initial = JSON.parse(
  document.getElementById('fixture-state')!.textContent!,
) as SiteState;
createRoot(document.getElementById('root')!).render(
  <Workspace initial={initial} history={[]} />,
);
