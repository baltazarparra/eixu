import { redirect } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import { StudioCreateForm } from './studio-create-form';

export default async function NewStudioProject() {
  if (!(await isAuthenticated()))
    redirect('/admin/login?returnTo=/studio/novo');
  return <StudioCreateForm />;
}
