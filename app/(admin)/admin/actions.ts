'use server';

import { randomUUID } from 'node:crypto';
import { redirect } from 'next/navigation';
import { after } from 'next/server';
import { revalidatePath } from 'next/cache';
import { del } from '@vercel/blob';
import { currentUser, signIn, signOut, type AdminUser } from '@/lib/auth';
import { recordActivity } from '@/lib/admin/activity';
import { db } from '@/lib/db';
import { text } from '@/lib/form-data';
import {
  brandColorsFromForm,
  contactsFromForm,
  intakeFromForm,
  tenantDetailsSchema,
  tenantSlugSchema,
  vibeFromForm,
} from '@/lib/admin/tenant-input';
import { primaryWhatsapp } from '@/lib/tenant-contacts';
import { spendSchema } from '@/lib/admin/traffic';
import { countTenantData, getTenantBySlug } from '@/lib/tenant-queries';
import {
  UploadError,
  deleteTenantBlobs,
  putNewTenantBlob,
} from '@/lib/blob/tenant-files';
import { TenantRemovedError, withTenantLock } from '@/lib/tenant-lock';
import { confirmationAccepted } from '@/lib/admin/tenant-delete';
import { normalizeSocialUrl } from '@/lib/social-profile';
import { markSocialReading, syncSocialProfile } from '@/lib/ai/social';
import { deriveLogoAssets } from '@/lib/images/logo-apply';
import type { Brand } from '@/lib/types';

async function guard(): Promise<AdminUser> {
  const user = await currentUser();
  if (!user) redirect('/admin/login');
  return user;
}

export async function loginAction(
  _prev: string | null,
  formData: FormData,
): Promise<string | null> {
  const user = text(formData, 'user');
  const pin = text(formData, 'pin');
  // Atraso fixo para desencorajar tentativa em massa contra uma senha curta.
  await new Promise((resolve) => setTimeout(resolve, 400));
  const result = await signIn(user, pin);
  if (!result.ok)
    return result.blocked
      ? 'Muitas tentativas. Aguarde 15 minutos e tente novamente.'
      : 'Usuário ou PIN incorretos.';
  await recordActivity({
    actor: result.user,
    action: 'auth.login',
    summary: `${result.user.name} entrou no painel`,
  });
  const returnTo = text(formData, 'returnTo');
  redirect(
    returnTo.startsWith('/admin') &&
      !returnTo.startsWith('//') &&
      !returnTo.startsWith('/admin/login')
      ? returnTo
      : '/admin',
  );
}

export async function logoutAction() {
  const user = await currentUser();
  if (user)
    await recordActivity({
      actor: user,
      action: 'auth.logout',
      summary: `${user.name} saiu do painel`,
    });
  await signOut();
  redirect('/admin/login');
}

export async function createTenantAction(
  _prev: string | null,
  formData: FormData,
): Promise<string | null> {
  const actor = await guard();
  const details = tenantDetailsSchema.safeParse(Object.fromEntries(formData));
  const slugResult = tenantSlugSchema.safeParse(text(formData, 'slug'));
  const intake = intakeFromForm(formData);
  const colors = brandColorsFromForm(formData);
  const paletteSource =
    text(formData, 'paletteSource') === 'operador' ? 'operador' : 'sugerida';
  const contacts = contactsFromForm(formData);
  const vibe = vibeFromForm(formData);
  if (!details.success)
    return details.error.issues[0]?.message ?? 'Confira os dados do cliente.';
  if (!slugResult.success)
    return slugResult.error.issues[0]?.message ?? 'Confira o endereço.';
  if (!contacts.success)
    return contacts.error.issues[0]?.message ?? 'Confira os contatos.';
  if (!intake.success)
    return (
      intake.error.issues[0]?.message ??
      'Confira a história, o link de referência e o limite de 160 caracteres por fato ou restrição.'
    );
  if (!colors.success)
    return colors.error.issues[0]?.message ?? 'Confira as cores da marca.';
  if (!vibe.success) return 'Escolha uma vibe para o site.';
  const slug = slugResult.data;
  const { name, contactEmail } = details.data;
  // O site inteiro continua lendo tenants.whatsapp: aqui ele é o primeiro
  // número marcado como WhatsApp na lista de contatos.
  const whatsapp = primaryWhatsapp(contacts.data);

  // O arquivo sobe antes do insert porque a rota de upload exige um cliente
  // que ainda não existe. Um insert recusado apaga o arquivo logo abaixo.
  const file = formData.get('logo');
  let logoUrl: string | null = null;
  if (file instanceof File && file.size > 0) {
    try {
      logoUrl = await putNewTenantBlob(slug, file);
    } catch (error) {
      return error instanceof UploadError
        ? error.message
        : 'Não foi possível enviar o logo. Tente novamente ou cadastre sem ele.';
    }
  }
  // A sugestão visual pode ser adaptada pelo agente. Uma edição explícita do
  // operador trava as cores para que set_design nunca as reescreva.
  const brand = {
    accent: colors.data.primary,
    accentAlt: colors.data.secondary,
    highlight: colors.data.highlight,
    paletteSource,
    vibe: vibe.data,
    ...(logoUrl ? { logoUrl, logoRevision: randomUUID() } : {}),
  };

  let tenantId: string;
  try {
    const rows = (await db()`
      insert into tenants (slug, name, whatsapp, contact_email, brief, brand, contacts)
      values (${slug}, ${name}, ${whatsapp}, ${contactEmail},
              ${JSON.stringify({ intake: intake.data })}::jsonb,
              ${JSON.stringify(brand)}::jsonb,
              ${JSON.stringify(contacts.data)}::jsonb)
      on conflict (slug) do nothing returning id
    `) as { id: string }[];
    if (!rows.length) {
      if (logoUrl) await del(logoUrl).catch(() => undefined);
      return 'Esse endereço já pertence a um cliente. Escolha outro ou abra o cliente existente.';
    }
    tenantId = rows[0].id;
  } catch {
    if (logoUrl) await del(logoUrl).catch(() => undefined);
    return 'Não foi possível criar o cliente. Seus dados continuam no formulário; tente novamente.';
  }

  // O logo do cadastro é medido e ganha a versão para fundo escuro depois da
  // resposta, como a leitura social; uma falha não desfaz o cadastro.
  if (logoUrl) {
    const id = tenantId;
    after(() =>
      deriveLogoAssets({ id, slug, name, brand: brand as Brand }, logoUrl),
    );
  }

  // O cadastro já existe: falhas da leitura social não podem apagar seu logo
  // nem apresentar a criação como recusada. O operador pode reler no painel.
  const social = normalizeSocialUrl(intake.data.socialUrl);
  if (social) {
    try {
      const reading = await markSocialReading(tenantId, social);
      if (reading)
        after(() => syncSocialProfile({ id: tenantId, slug }, reading));
    } catch {
      console.error(
        '[admin] Não foi possível iniciar a leitura social após o cadastro.',
      );
    }
  }
  await recordActivity({
    actor,
    tenant: { id: tenantId, slug, name },
    action: 'tenant.create',
    summary: `${actor.name} criou o cliente ${name}`,
    resourceType: 'tenant',
    resourceId: tenantId,
  });
  revalidatePath('/admin');
  redirect(`/admin/${slug}`);
}

export type DeleteTenantResult = {
  ok: boolean;
  message: string;
  slug?: string;
};

export type ArchiveTenantResult = {
  ok: boolean;
  message: string;
};

/**
 * Arquivar só muda a disponibilidade pública. Rascunho, snapshot publicado,
 * arquivos e dados operacionais permanecem no tenant e na prévia autenticada.
 */
export async function setTenantArchivedAction(
  _prev: ArchiveTenantResult | null,
  formData: FormData,
): Promise<ArchiveTenantResult> {
  const actor = await guard();
  const slugResult = tenantSlugSchema.safeParse(text(formData, 'slug'));
  if (!slugResult.success)
    return { ok: false, message: 'Endereço de cliente inválido.' };
  const intent = text(formData, 'intent');
  if (intent !== 'archive' && intent !== 'restore')
    return { ok: false, message: 'Ação de arquivamento inválida.' };

  try {
    const rows = (await db()`
      update tenants t
      set status = case
            when ${intent === 'archive'}::boolean then 'archived'
            when exists (
              select 1 from pages p
              where p.tenant_id = t.id and p.published_blocks is not null
            ) then 'published'
            else 'draft'
          end,
          updated_at = now()
      where t.slug = ${slugResult.data}
      returning t.id, t.name, t.status
    `) as {
      id?: string;
      name: string;
      status: 'draft' | 'published' | 'archived';
    }[];
    const changed = rows[0];
    if (!changed) return { ok: false, message: 'Cliente não encontrado.' };
    await recordActivity({
      actor,
      tenant: { id: changed.id, slug: slugResult.data, name: changed.name },
      action:
        changed.status === 'archived' ? 'tenant.archive' : 'tenant.restore',
      summary:
        changed.status === 'archived'
          ? `${actor.name} arquivou ${changed.name}`
          : `${actor.name} reativou ${changed.name}`,
      resourceType: 'tenant',
      resourceId: slugResult.data,
    });
    revalidatePath('/admin');
    revalidatePath(`/admin/${slugResult.data}`);
    return {
      ok: true,
      message:
        changed.status === 'archived'
          ? `${changed.name} foi arquivado. A URL pública está fora do ar e a prévia continua disponível.`
          : changed.status === 'published'
            ? `${changed.name} foi reativado com a última versão publicada.`
            : `${changed.name} voltou como rascunho.`,
    };
  } catch {
    return {
      ok: false,
      message:
        intent === 'archive'
          ? 'Não foi possível arquivar o site. Tente novamente.'
          : 'Não foi possível reativar o site. Tente novamente.',
    };
  }
}

/**
 * Exclusão do cliente. O lock aguarda uploads em curso, impede novos e só é
 * liberado depois de limpar os arquivos e remover o cadastro na transação.
 */
export async function deleteTenantAction(
  _prev: DeleteTenantResult | null,
  formData: FormData,
): Promise<DeleteTenantResult> {
  const actor = await guard();
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
    if (result.ok) {
      await recordActivity({
        actor,
        tenant: { slug: tenant.slug, name: tenant.name },
        action: 'tenant.delete',
        summary: `${actor.name} excluiu ${tenant.name}`,
        resourceType: 'tenant',
        resourceId: tenant.id,
      });
      revalidatePath('/admin');
    }
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
  const actor = await guard();
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
    await recordActivity({
      actor,
      tenant,
      action: 'traffic.spend.create',
      summary: `${actor.name} adicionou um gasto em ${tenant.name}`,
      resourceType: 'campaign_spend',
      detail: { campaign, channel, start, end },
    });
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
