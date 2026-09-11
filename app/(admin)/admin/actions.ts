'use server';

import { redirect } from 'next/navigation';
import { after } from 'next/server';
import { revalidatePath } from 'next/cache';
import { isAuthenticated, signIn, signOut } from '@/lib/auth';
import { db } from '@/lib/db';
import { text } from '@/lib/form-data';
import {
  intakeFromForm,
  tenantDetailsSchema,
  tenantSlugSchema,
} from '@/lib/admin/tenant-input';
import { spendSchema } from '@/lib/admin/traffic';
import { countTenantData, getTenantBySlug } from '@/lib/tenant-queries';
import { deleteTenantBlobs } from '@/lib/blob/tenant-files';
import { TenantRemovedError, withTenantLock } from '@/lib/tenant-lock';
import { confirmationAccepted } from '@/lib/admin/tenant-delete';
import { normalizeSocialUrl } from '@/lib/social-profile';
import { markSocialReading, syncSocialProfile } from '@/lib/ai/social';

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
  if (!details.success)
    return details.error.issues[0]?.message ?? 'Confira os dados do cliente.';
  if (!slugResult.success)
    return slugResult.error.issues[0]?.message ?? 'Confira o endereço.';
  if (!intake.success)
    return (
      intake.error.issues[0]?.message ??
      'Confira o briefing: URLs válidas e até 160 caracteres por fato ou restrição.'
    );
  const slug = slugResult.data;
  const { name, whatsapp, contactEmail } = details.data;
  try {
    const rows = (await db()`
      insert into tenants (slug, name, whatsapp, contact_email, brief)
      values (${slug}, ${name}, ${whatsapp}, ${contactEmail}, ${JSON.stringify({ intake: intake.data })}::jsonb)
      on conflict (slug) do nothing returning id
    `) as { id: string }[];
    if (!rows.length)
      return 'Esse endereço já pertence a um cliente. Escolha outro ou abra o cliente existente.';
    // A leitura do perfil depende de rede e do modelo: ela não pode atrasar a
    // abertura do editor, e o painel mostra o estado enquanto ela corre.
    const social = normalizeSocialUrl(intake.data.socialUrl);
    if (social) {
      const tenantId = rows[0].id;
      const reading = await markSocialReading(tenantId, social);
      if (reading)
        after(() => syncSocialProfile({ id: tenantId, slug }, reading));
    }
  } catch {
    return 'Não foi possível criar o cliente. Seus dados continuam no formulário; tente novamente.';
  }
  revalidatePath('/admin');
  redirect(`/admin/${slug}`);
}

export type DeleteTenantResult = {
  ok: boolean;
  message: string;
  slug?: string;
};

/**
 * Exclusão do cliente. O lock aguarda uploads em curso, impede novos e só é
 * liberado depois de limpar os arquivos e remover o cadastro na transação.
 */
export async function deleteTenantAction(
  _prev: DeleteTenantResult | null,
  formData: FormData,
): Promise<DeleteTenantResult> {
  await guard();
  const slugResult = tenantSlugSchema.safeParse(text(formData, 'slug'));
  if (!slugResult.success)
    return { ok: false, message: 'Endereço de cliente inválido.' };
  const tenant = await getTenantBySlug(slugResult.data);
  if (!tenant) return { ok: false, message: 'Cliente não encontrado.' };
  let stage: 'prepare' | 'files' | 'record' = 'prepare';
  try {
    const result = await withTenantLock(
      tenant.id,
      'delete',
      async (locked, connection): Promise<DeleteTenantResult> => {
        const counts = await countTenantData(locked.id);
        // Reconfere o estado depois de adquirir o lock: publicação e contatos
        // podem ter mudado desde a abertura do diálogo.
        if (
          !confirmationAccepted(
            { ...locked, leadCount: counts.leads },
            text(formData, 'confirm'),
          )
        )
          return {
            ok: false,
            message: 'Digite o endereço do cliente para confirmar a exclusão.',
          };
        stage = 'files';
        await deleteTenantBlobs(locked.slug);
        stage = 'record';
        await connection.query('DELETE FROM tenants WHERE id = $1', [
          locked.id,
        ]);
        return {
          ok: true,
          slug: locked.slug,
          message: `${locked.name} foi excluído.`,
        };
      },
    );
    if (result.ok) revalidatePath('/admin');
    return result;
  } catch (error) {
    const messages = {
      prepare: 'Não foi possível iniciar a exclusão. Tente novamente.',
      files:
        'Os arquivos do cliente não puderam ser removidos. Ele continua no painel; tente novamente.',
      record:
        'Os arquivos foram removidos, mas o cadastro não. Tente excluir novamente.',
    };
    return {
      ok: false,
      message:
        error instanceof TenantRemovedError ? error.message : messages[stage],
    };
  }
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
