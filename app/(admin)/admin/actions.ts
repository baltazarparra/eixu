'use server';

import { randomUUID } from 'node:crypto';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { del } from '@vercel/blob';
import { currentUser, signIn, signOut, type AdminUser } from '@/lib/auth';
import { recordActivity } from '@/lib/admin/activity';
import { db, transaction } from '@/lib/db';
import { text } from '@/lib/form-data';
import {
  brandColorsFromForm,
  contactsFromForm,
  intakeFromForm,
  tenantDetailsSchema,
  tenantSlugSchema,
  directionFromForm,
} from '@/lib/admin/tenant-input';
import { primaryWhatsapp } from '@/lib/tenant-contacts';
import { spendSchema } from '@/lib/admin/traffic';
import {
  countTenantData,
  getTenantBySlug,
  siteFolderExists,
} from '@/lib/tenant-queries';
import {
  UploadError,
  deleteStudioProjectBlobs,
  deleteTenantBlobs,
  putNewTenantBlob,
} from '@/lib/blob/tenant-files';
import { TenantRemovedError, withTenantLock } from '@/lib/tenant-lock';
import { confirmationAccepted } from '@/lib/admin/tenant-delete';
import {
  folderNameSchema,
  optionalFolderIdSchema,
  parseFolderAssignments,
} from '@/lib/admin/site-folders';
import { sitesAreInMaintenance } from '@/lib/sites-maintenance';
import {
  archiveStudioVercelProject,
  deleteStudioVercelProject,
  restoreStudioVercelProject,
} from '@/lib/studio/releases';

const maintenanceMessage =
  'A gestão de sites está em manutenção. O institucional e o Kanban continuam disponíveis.';

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
  if (await sitesAreInMaintenance()) return maintenanceMessage;
  const details = tenantDetailsSchema.safeParse(Object.fromEntries(formData));
  const slugResult = tenantSlugSchema.safeParse(text(formData, 'slug'));
  const intake = intakeFromForm(formData);
  const colors = brandColorsFromForm(formData);
  const paletteSource =
    text(formData, 'paletteSource') === 'operador' ? 'operador' : 'sugerida';
  const contacts = contactsFromForm(formData);
  const direction = directionFromForm(formData);
  const folderIdResult = optionalFolderIdSchema.safeParse(
    text(formData, 'folderId') || null,
  );
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
  if (!direction.success) return 'Escolha uma direção visual para o site.';
  if (!folderIdResult.success) return 'A pasta selecionada é inválida.';
  if (folderIdResult.data && !(await siteFolderExists(folderIdResult.data)))
    return 'Essa pasta não existe mais. Escolha outra pasta ou crie o site sem pasta.';
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
    direction: direction.data,
    ...(logoUrl ? { logoUrl, assetRevision: randomUUID() } : {}),
  };

  let tenantId: string;
  try {
    const rows = (await db()`
      insert into tenants (slug, name, whatsapp, contact_email, brief, brand, contacts, folder_id)
      values (${slug}, ${name}, ${whatsapp}, ${contactEmail},
              ${JSON.stringify({ intake: intake.data })}::jsonb,
              ${JSON.stringify(brand)}::jsonb,
              ${JSON.stringify(contacts.data)}::jsonb,
              ${folderIdResult.data})
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

export type FolderActionResult = {
  ok: boolean;
  message: string;
  folder?: { id: string; name: string; siteCount: number };
};

function folderId(formData: FormData) {
  return optionalFolderIdSchema.safeParse(text(formData, 'folderId') || null);
}

export async function createSiteFolderAction(
  formData: FormData,
): Promise<FolderActionResult> {
  const actor = await guard();
  if (await sitesAreInMaintenance())
    return { ok: false, message: maintenanceMessage };
  const name = folderNameSchema.safeParse(text(formData, 'name'));
  if (!name.success)
    return {
      ok: false,
      message: name.error.issues[0]?.message ?? 'Confira o nome da pasta.',
    };
  try {
    const rows = (await db()`
      insert into site_folders (name)
      values (${name.data})
      on conflict do nothing
      returning id, name
    `) as { id: string; name: string }[];
    if (!rows[0])
      return { ok: false, message: 'Já existe uma pasta com esse nome.' };
    await recordActivity({
      actor,
      action: 'folder.create',
      summary: `${actor.name} criou a pasta ${rows[0].name}`,
      resourceType: 'site_folder',
      resourceId: rows[0].id,
    });
    revalidatePath('/admin');
    return {
      ok: true,
      message: `Pasta ${rows[0].name} criada.`,
      folder: { ...rows[0], siteCount: 0 },
    };
  } catch {
    return {
      ok: false,
      message: 'Não foi possível criar a pasta. Tente novamente.',
    };
  }
}

export async function renameSiteFolderAction(
  formData: FormData,
): Promise<FolderActionResult> {
  const actor = await guard();
  if (await sitesAreInMaintenance())
    return { ok: false, message: maintenanceMessage };
  const id = folderId(formData);
  const name = folderNameSchema.safeParse(text(formData, 'name'));
  if (!id.success || !id.data) return { ok: false, message: 'Pasta inválida.' };
  if (!name.success)
    return {
      ok: false,
      message: name.error.issues[0]?.message ?? 'Confira o nome da pasta.',
    };
  try {
    const rows = (await db()`
      update site_folders f
      set name = ${name.data}, updated_at = now()
      where f.id = ${id.data}
        and not exists (
          select 1 from site_folders other
          where other.id <> f.id
            and lower(btrim(other.name)) = lower(btrim(${name.data}))
        )
      returning id, name,
        (select count(*)::int from tenants where folder_id = f.id) as site_count
    `) as { id: string; name: string; site_count: number }[];
    if (!rows[0])
      return {
        ok: false,
        message: 'A pasta não existe mais ou esse nome já está em uso.',
      };
    await recordActivity({
      actor,
      action: 'folder.rename',
      summary: `${actor.name} renomeou a pasta para ${rows[0].name}`,
      resourceType: 'site_folder',
      resourceId: rows[0].id,
    });
    revalidatePath('/admin');
    return {
      ok: true,
      message: `Pasta renomeada para ${rows[0].name}.`,
      folder: {
        id: rows[0].id,
        name: rows[0].name,
        siteCount: Number(rows[0].site_count ?? 0),
      },
    };
  } catch {
    return {
      ok: false,
      message: 'Não foi possível renomear a pasta. Tente novamente.',
    };
  }
}

export async function deleteSiteFolderAction(
  formData: FormData,
): Promise<FolderActionResult> {
  const actor = await guard();
  if (await sitesAreInMaintenance())
    return { ok: false, message: maintenanceMessage };
  const id = folderId(formData);
  if (!id.success || !id.data) return { ok: false, message: 'Pasta inválida.' };
  try {
    const rows = (await db()`
      delete from site_folders where id = ${id.data} returning id, name
    `) as { id: string; name: string }[];
    if (!rows[0]) return { ok: false, message: 'A pasta não existe mais.' };
    await recordActivity({
      actor,
      action: 'folder.delete',
      summary: `${actor.name} excluiu a pasta ${rows[0].name}`,
      resourceType: 'site_folder',
      resourceId: rows[0].id,
    });
    revalidatePath('/admin');
    return {
      ok: true,
      message: `${rows[0].name} foi excluída. Os sites ficaram em Sem pasta.`,
    };
  } catch {
    return {
      ok: false,
      message: 'Não foi possível excluir a pasta. Tente novamente.',
    };
  }
}

export type MoveSitesResult = {
  ok: boolean;
  message: string;
  moved: number;
};

/**
 * O lote compara a pasta vista pelo operador antes de escrever. Se outra sessão
 * mover qualquer site no intervalo, nenhuma linha do lote é alterada.
 */
export async function moveSitesToFolderAction(
  formData: FormData,
): Promise<MoveSitesResult> {
  const actor = await guard();
  if (await sitesAreInMaintenance())
    return { ok: false, message: maintenanceMessage, moved: 0 };
  const parsed = parseFolderAssignments(text(formData, 'assignments'));
  if (!parsed.success)
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? 'Movimentação inválida.',
      moved: 0,
    };
  const assignments = JSON.stringify(parsed.data);
  try {
    const rows = (await db()`
      with requested as (
        select *
        from jsonb_to_recordset(${assignments}::jsonb)
          as item(slug text, "fromFolderId" uuid, "toFolderId" uuid)
      ), eligible as (
        select count(*) = (select count(*) from requested) as ok
        from requested r
        join tenants t on t.slug = r.slug
          and t.folder_id is not distinct from r."fromFolderId"
        where r."toFolderId" is null
          or exists(select 1 from site_folders f where f.id = r."toFolderId")
      )
      update tenants t
      set folder_id = r."toFolderId", updated_at = now()
      from requested r, eligible e
      where e.ok and t.slug = r.slug
      returning t.slug
    `) as { slug: string }[];
    if (rows.length !== parsed.data.length)
      return {
        ok: false,
        message:
          'A organização mudou em outra sessão. Atualize a página antes de mover novamente.',
        moved: 0,
      };
    await recordActivity({
      actor,
      action: 'folder.move_sites',
      summary:
        rows.length === 1
          ? `${actor.name} moveu um site entre pastas`
          : `${actor.name} moveu ${rows.length} sites entre pastas`,
      resourceType: 'site_folder',
      detail: { sites: rows.map((row) => row.slug) },
    });
    revalidatePath('/admin');
    return {
      ok: true,
      message:
        rows.length === 1 ? 'Site movido.' : `${rows.length} sites movidos.`,
      moved: rows.length,
    };
  } catch {
    return {
      ok: false,
      message: 'Não foi possível mover os sites. Tente novamente.',
      moved: 0,
    };
  }
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

/** Arquivar preserva projeto, conteúdo e releases e retira sua disponibilidade. */
export async function setTenantArchivedAction(
  _prev: ArchiveTenantResult | null,
  formData: FormData,
): Promise<ArchiveTenantResult> {
  const actor = await guard();
  if (await sitesAreInMaintenance())
    return { ok: false, message: maintenanceMessage };
  const slugResult = tenantSlugSchema.safeParse(text(formData, 'slug'));
  if (!slugResult.success)
    return { ok: false, message: 'Endereço de cliente inválido.' };
  const intent = text(formData, 'intent');
  if (intent !== 'archive' && intent !== 'restore')
    return { ok: false, message: 'Ação de arquivamento inválida.' };

  try {
    const tenants = (await db()`
      select id, name, status from tenants where slug = ${slugResult.data} limit 1
    `) as {
      id: string;
      name: string;
      status: 'draft' | 'published' | 'archived';
    }[];
    const tenant = tenants[0];
    if (!tenant) return { ok: false, message: 'Cliente não encontrado.' };
    const changed = await transaction(async (connection) => {
      const projects = await connection.query(
        `select id, active_release_id, draft_code_revision
         from studio_projects where tenant_id = $1 for update`,
        [tenant.id],
      );
      const lockedTenant = await connection.query(
        `select id, name from tenants where id = $1 for update`,
        [tenant.id],
      );
      if (!lockedTenant.rows[0]) throw new Error('Cliente não encontrado.');
      const project = projects.rows[0] as
        | {
            id: string;
            active_release_id: string | null;
            draft_code_revision: string | null;
          }
        | undefined;
      if (project) {
        const work = await connection.query(
          `select
             exists(
               select 1 from studio_runs where project_id = $1
               and status in ('queued', 'running', 'cancel_requested')
             ) as active_run,
             exists(
               select 1 from studio_releases where project_id = $1
               and status in ('preparing', 'validating', 'ready')
             ) as active_release`,
          [project.id],
        );
        if (work.rows[0]?.active_run || work.rows[0]?.active_release)
          throw new Error(
            'Há um turno ou publicação em andamento. Aguarde a conclusão antes de arquivar o cliente.',
          );
      }

      if (intent === 'archive') await archiveStudioVercelProject(tenant.id);
      else await restoreStudioVercelProject(tenant.id);

      let nextStatus: 'draft' | 'published' | 'archived' = 'archived';
      let projectStatus: 'draft' | 'ready' | 'published' | 'archived' =
        'archived';
      if (intent === 'restore') {
        const active = project?.active_release_id
          ? await connection.query(
              `select 1 from studio_releases
               where id = $1 and project_id = $2 and status = 'active'`,
              [project.active_release_id, project.id],
            )
          : null;
        if (active?.rows[0]) {
          nextStatus = 'published';
          projectStatus = 'published';
        } else {
          nextStatus = 'draft';
          projectStatus = project?.draft_code_revision ? 'ready' : 'draft';
        }
      }
      const updated = await connection.query(
        `update tenants set status = $2, updated_at = now()
         where id = $1 returning id, name, status`,
        [tenant.id, nextStatus],
      );
      if (project)
        await connection.query(
          `update studio_projects set status = $2, updated_at = now()
           where id = $1`,
          [project.id, projectStatus],
        );
      return updated.rows[0] as {
        id: string;
        name: string;
        status: 'draft' | 'published' | 'archived';
      };
    });
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
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : intent === 'archive'
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
  if (await sitesAreInMaintenance())
    return { ok: false, message: maintenanceMessage };
  const slugResult = tenantSlugSchema.safeParse(text(formData, 'slug'));
  if (!slugResult.success)
    return { ok: false, message: 'Endereço de cliente inválido.' };
  const tenant = await getTenantBySlug(slugResult.data);
  if (!tenant) return { ok: false, message: 'Cliente não encontrado.' };
  let stage: 'prepare' | 'vercel' | 'files' | 'record' = 'prepare';
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
        const activeWork = await connection.query(
          `select
             exists(
               select 1 from studio_runs run
               join studio_projects project on project.id = run.project_id
               where project.tenant_id = $1
                 and run.status in ('queued', 'running', 'cancel_requested')
             ) as active_run,
             exists(
               select 1 from studio_releases release
               join studio_projects project on project.id = release.project_id
               where project.tenant_id = $1
                 and release.status in ('preparing', 'validating', 'ready')
             ) as active_release`,
          [locked.id],
        );
        if (
          activeWork.rows[0]?.active_run ||
          activeWork.rows[0]?.active_release
        )
          return {
            ok: false,
            message:
              'Há um turno ou publicação em andamento. Aguarde a conclusão antes de excluir o cliente.',
          };
        const projects = await connection.query(
          `select id from studio_projects where tenant_id = $1 limit 1`,
          [locked.id],
        );
        stage = 'vercel';
        await deleteStudioVercelProject(locked.id);
        stage = 'files';
        await deleteTenantBlobs(locked.slug);
        if (projects.rows[0]?.id)
          await deleteStudioProjectBlobs(String(projects.rows[0].id));
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
      vercel:
        'O projeto do cliente não pôde ser removido da Vercel. O cadastro continua no painel.',
      files:
        'O projeto Vercel foi removido, mas os arquivos não. O cadastro continua no painel e a exclusão pode ser repetida.',
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
  if (await sitesAreInMaintenance())
    return { ok: false, message: maintenanceMessage };
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
