import { db } from '@/lib/db';

export async function sitesAreInMaintenance(): Promise<boolean> {
  const rows = (await db()`
    select value = 'true'::jsonb as active
    from platform_settings where key = 'sites_maintenance'
    limit 1
  `) as { active: boolean }[];
  return rows[0]?.active === true;
}

export async function sitesWriteGuard(): Promise<Response | null> {
  return (await sitesAreInMaintenance())
    ? Response.json(
        {
          error:
            'A gestão de sites está em manutenção. O institucional e o Kanban continuam disponíveis.',
        },
        { status: 503, headers: { 'retry-after': '300' } },
      )
    : null;
}
