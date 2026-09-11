'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { del } from '@vercel/blob';
import { isAuthenticated, signIn, signOut } from '@/lib/auth';
import { db } from '@/lib/db';
import { text } from '@/lib/form-data';
import { UploadError, storeTenantFile } from '@/lib/admin/upload';
import {
  brandColorsFromForm,
  intakeFromForm,
  tenantDetailsSchema,
  tenantSlugSchema,
} from '@/lib/admin/tenant-input';
import { spendSchema } from '@/lib/admin/traffic';
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

export async function createTenantAction(
  _prev: string | null,
  formData: FormData,
): Promise<string | null> {
  await guard();
  const details = tenantDetailsSchema.safeParse(Object.fromEntries(formData));
  const slugResult = tenantSlugSchema.safeParse(text(formData, 'slug'));
  const intake = intakeFromForm(formData);
  const colors = brandColorsFromForm(formData);
  if (!details.success)
    return details.error.issues[0]?.message ?? 'Confira os dados do cliente.';
  if (!slugResult.success)
    return slugResult.error.issues[0]?.message ?? 'Confira o endereço.';
  if (!intake.success)
    return 'Confira o briefing: URLs válidas e até 160 caracteres por fato ou restrição.';
  if (!colors.success)
    return colors.error.issues[0]?.message ?? 'Confira as cores da marca.';
  const slug = slugResult.data;
  const { name, whatsapp, contactEmail } = details.data;

  // O arquivo sobe antes do insert: a rota de upload exige um cliente que
  // ainda não existe. Se o insert falhar, o Blob é removido logo abaixo.
  const file = formData.get('logo');
  let logoUrl: string | null = null;
  if (file instanceof File && file.size > 0) {
    try {
      logoUrl = await storeTenantFile(slug, 'logo', file);
    } catch (error) {
      return error instanceof UploadError
        ? error.message
        : 'Não foi possível enviar o logo. Tente novamente ou cadastre sem ele.';
    }
  }
  // paletteSource registra que a escolha é do operador: set_design respeita
  // essas cores em vez de propor as próprias.
  const brand = {
    accent: colors.data.primary,
    accentAlt: colors.data.secondary,
    highlight: colors.data.highlight,
    paletteSource: 'operador',
    ...(logoUrl ? { logoUrl } : {}),
  };

  try {
    const rows = (await db()`
      insert into tenants (slug, name, whatsapp, contact_email, brief, brand)
      values (${slug}, ${name}, ${whatsapp}, ${contactEmail},
              ${JSON.stringify({ intake: intake.data })}::jsonb,
              ${JSON.stringify(brand)}::jsonb)
      on conflict (slug) do nothing returning id
    `) as { id: string }[];
    if (!rows.length) {
      if (logoUrl) await del(logoUrl).catch(() => undefined);
      return 'Esse endereço já pertence a um cliente. Escolha outro ou abra o cliente existente.';
    }
  } catch {
    if (logoUrl) await del(logoUrl).catch(() => undefined);
    return 'Não foi possível criar o cliente. Seus dados continuam no formulário; tente novamente.';
  }
  revalidatePath('/admin');
  redirect(`/admin/${slug}`);
}

export type SpendResult = { ok: boolean; message: string };

export async function saveSpendAction(
  _prev: SpendResult | null,
  formData: FormData,
): Promise<SpendResult> {
  await guard();
  const tenantSlug = text(formData, 'tenant');
  const parsed = spendSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return {
      ok: false,
      message:
        parsed.error.issues[0]?.message ?? 'Confira o gasto e o período.',
    };
  const { campaign, channel, spend, start, end } = parsed.data;
  try {
    const tenant = await getTenantBySlug(tenantSlug);
    if (!tenant) return { ok: false, message: 'Cliente não encontrado.' };
    await db()`
      insert into campaign_spend (tenant_id, campaign, channel, spend_cents, period_start, period_end)
      values (${tenant.id}, ${campaign}, ${channel}, ${spend}, ${start}, ${end})
    `;
  } catch {
    return {
      ok: false,
      message:
        'Não foi possível salvar o gasto. Confira o relatório antes de repetir.',
    };
  }
  revalidatePath(`/admin/${tenantSlug}/trafego`);
  return {
    ok: true,
    message: 'Gasto adicionado. Os valores foram atualizados.',
  };
}
