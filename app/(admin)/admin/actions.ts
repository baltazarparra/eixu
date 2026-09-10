'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { isAuthenticated, signIn, signOut } from '@/lib/auth';
import { db } from '@/lib/db';
import { text } from '@/lib/form-data';
import { intakeSchema, lines } from '@/lib/tenant-intake';
import { getTenantBySlug } from '@/lib/tenant-queries';

async function guard() {
  if (!(await isAuthenticated())) redirect('/admin/login');
}

export async function loginAction(
  _prev: string | null,
  formData: FormData,
): Promise<string | null> {
  const user = text(formData, 'user');
  const password = text(formData, 'password');
  // Atraso fixo para desencorajar tentativa em massa contra uma senha curta.
  await new Promise((resolve) => setTimeout(resolve, 400));
  if (!(await signIn(user, password))) return 'Usuário ou senha incorretos.';
  redirect('/admin');
}

export async function logoutAction() {
  await signOut();
  redirect('/admin/login');
}

export async function createTenantAction(formData: FormData) {
  await guard();
  const name = text(formData, 'name').trim();
  const slug = text(formData, 'slug')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!name || !slug) return;
  // O briefing entra na criação: é ele que separa uma direção ligada ao
  // negócio de uma dedução a partir do nome do cliente.
  const intake = intakeSchema.parse({
    segment: text(formData, 'segment').trim(),
    region: text(formData, 'region').trim(),
    audience: text(formData, 'audience').trim(),
    offer: text(formData, 'offer').trim(),
    goal: text(formData, 'goal').trim(),
    evidence: lines(text(formData, 'evidence')),
    constraints: lines(text(formData, 'constraints')),
    references: lines(text(formData, 'references'), 3).filter((line) =>
      /^https?:\/\//i.test(line),
    ),
  });
  await db()`
    insert into tenants (slug, name, whatsapp, contact_email, brief)
    values (${slug}, ${name}, ${text(formData, 'whatsapp') || null},
            ${text(formData, 'email') || null}, ${JSON.stringify({ intake })}::jsonb)
    on conflict (slug) do nothing
  `;
  revalidatePath('/admin');
  redirect(`/admin/${slug}`);
}

export async function saveSpendAction(formData: FormData) {
  await guard();
  const tenantSlug = text(formData, 'tenant');
  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) return;
  const campaign = text(formData, 'campaign').trim();
  const spend = Math.round(
    Number(text(formData, 'spend', '0').replace(',', '.')) * 100,
  );
  if (!campaign || !Number.isFinite(spend)) return;
  const start = text(formData, 'start', new Date().toISOString().slice(0, 10));
  const end = text(formData, 'end', start);
  await db()`
    insert into campaign_spend (tenant_id, campaign, channel, spend_cents, period_start, period_end)
    values (${tenant.id}, ${campaign}, ${text(formData, 'channel', 'google')}, ${spend}, ${start}, ${end})
  `;
  revalidatePath(`/admin/${tenantSlug}/trafego`);
}
