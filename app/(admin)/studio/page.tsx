import { redirect } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import { studioDashboardProjects } from '@/lib/studio/dashboard';
import { StudioProjects } from './projects';

export const dynamic = 'force-dynamic';

export default async function StudioHome() {
  if (!(await isAuthenticated())) redirect('/admin/login?returnTo=/studio');
  return <StudioProjects initialProjects={await studioDashboardProjects()} />;
}
