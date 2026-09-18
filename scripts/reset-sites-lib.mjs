export const CLIENT_PROJECT_PREFIX = 'eixu-site-';
export const LEGACY_CLIENT_PROJECT_PREFIX = 'eixu-premium-';
export const RESET_BLOB_TARGETS = [
  { access: 'public', prefix: 'tenants/' },
  { access: 'private', prefix: 'studio/' },
];
export const RESET_MANIFEST_MAX_AGE_MS = 30 * 60 * 1000;

export function resetConfirmation(environment) {
  if (!['production', 'preview'].includes(environment))
    throw new Error('Use --environment=production ou --environment=preview.');
  return `RESET-EIXU-SITES-${environment.toUpperCase()}`;
}

export function parseResetArgs(argv) {
  const values = new Map();
  for (const argument of argv) {
    if (argument === '--execute') values.set('execute', true);
    else if (argument === '--manifest') values.set('manifest', true);
    else if (argument.startsWith('--') && argument.includes('=')) {
      const [key, ...rest] = argument.slice(2).split('=');
      values.set(key, rest.join('='));
    } else throw new Error(`Argumento desconhecido: ${argument}`);
  }
  const environment = values.get('environment');
  if (environment !== 'production' && environment !== 'preview')
    throw new Error(
      'Informe --environment=production ou --environment=preview.',
    );
  const execute = values.get('execute') === true;
  if (execute && values.get('confirm') !== resetConfirmation(environment))
    throw new Error(
      `Execução recusada. Use --confirm=${resetConfirmation(environment)}.`,
    );
  const scopeDigest = values.get('scope-digest');
  const databaseFingerprint = values.get('database-fingerprint');
  const manifestCreatedAt = values.get('manifest-created-at');
  if (execute && !/^[0-9a-f]{64}$/.test(scopeDigest ?? ''))
    throw new Error(
      'Execução recusada. Informe o --scope-digest do manifesto.',
    );
  if (execute && !/^[0-9a-f]{16}$/.test(databaseFingerprint ?? ''))
    throw new Error(
      'Execução recusada. Informe o --database-fingerprint do manifesto.',
    );
  if (execute) {
    const created = Date.parse(manifestCreatedAt ?? '');
    const age = Date.now() - created;
    if (
      !Number.isFinite(created) ||
      age < -60_000 ||
      age > RESET_MANIFEST_MAX_AGE_MS
    )
      throw new Error(
        'Execução recusada. O manifesto precisa ter sido criado nos últimos 30 minutos.',
      );
  }
  return {
    environment,
    execute,
    ...(scopeDigest ? { scopeDigest } : {}),
    ...(databaseFingerprint ? { databaseFingerprint } : {}),
    ...(manifestCreatedAt ? { manifestCreatedAt } : {}),
  };
}

function allowedClientProjectName(name) {
  return (
    name?.startsWith(CLIENT_PROJECT_PREFIX) ||
    name?.startsWith(LEGACY_CLIENT_PROJECT_PREFIX)
  );
}

export function clientProjects({
  databaseProjects,
  vercelProjects,
  rootProjectId,
}) {
  if (typeof rootProjectId !== 'string' || !rootProjectId.startsWith('prj_'))
    throw new Error('O projeto raiz protegido é obrigatório.');
  const live = new Map(
    vercelProjects
      .filter((project) => typeof project.id === 'string' && project.id)
      .map((project) => [project.id, project]),
  );
  const targets = new Map();
  for (const project of databaseProjects) {
    if (!project.id || project.id === rootProjectId) continue;
    if (!allowedClientProjectName(project.expectedName))
      throw new Error(
        `Nome de projeto de cliente inválido: ${project.expectedName}`,
      );
    if (project.storedName && project.storedName !== project.expectedName)
      throw new Error(`Vínculo Vercel divergente no banco: ${project.id}`);
    const remote = live.get(project.id);
    if (remote && remote.name !== project.expectedName)
      throw new Error(`Projeto Vercel divergente: ${project.id}`);
    if (remote)
      targets.set(project.id, {
        id: project.id,
        name: project.expectedName,
        source: project.source,
      });
  }
  for (const project of vercelProjects) {
    if (
      project.id &&
      project.id !== rootProjectId &&
      allowedClientProjectName(project.name)
    )
      targets.set(project.id, {
        id: project.id,
        name: project.name,
        source: targets.has(project.id)
          ? targets.get(project.id).source
          : 'prefix',
      });
  }
  return [...targets.values()].sort((left, right) =>
    left.id.localeCompare(right.id),
  );
}

export function resourceDigest(values, createHash) {
  return createHash('sha256')
    .update(
      [...values].sort((left, right) => left.localeCompare(right)).join('\n'),
    )
    .digest('hex');
}

/** Vincula o aceite ao manifesto exato, incluindo ambiente e identidades. */
export function manifestScopeDigest(manifest, createHash) {
  return resourceDigest(
    [
      `schema:${manifest.schemaVersion}`,
      `environment:${manifest.environment}`,
      `createdAt:${manifest.createdAt}`,
      `database:${manifest.database.fingerprint}`,
      `team:${manifest.vercel.teamId}`,
      `root:${manifest.vercel.protectedProjectId}`,
      ...Object.entries(manifest.database.resetCounts).map(
        ([table, count]) => `reset:${table}:${count}`,
      ),
      ...Object.entries(manifest.database.preservedCounts).map(
        ([table, count]) => `preserved:${table}:${count}`,
      ),
      ...manifest.database.inventories.map(
        (item) =>
          `database-inventory:${item.table}:${item.count}:${item.digest}`,
      ),
      ...manifest.vercel.clientProjectPrefixes.map(
        (prefix) => `vercel-prefix:${prefix}`,
      ),
      ...manifest.vercel.deleteProjects.map(
        (project) => `vercel-project:${project.id}:${project.name}`,
      ),
      ...manifest.blob.inventories.map(
        (item) =>
          `blob:${item.access}:${item.storeId}:${item.prefix}:${item.count}:${item.bytes}:${item.digest}`,
      ),
    ],
    createHash,
  );
}

export const SITE_TABLES = [
  'tenants',
  'site_folders',
  'leads',
  'events',
  'campaign_spend',
  'images',
  'chat_messages',
  'ai_usage',
  'studio_projects',
  'studio_content_revisions',
  'studio_releases',
  'studio_runs',
  'studio_tool_leases',
  'studio_events',
  'studio_artifacts',
  'studio_source_evidence',
  'studio_preview_sessions',
  'pages',
  'page_revisions',
  'generation_runs',
  'generation_events',
  'premium_projects',
  'premium_conversions',
  'premium_releases',
  'premium_content_revisions',
  'premium_preview_sessions',
];

export const PRESERVED_TABLES = [
  'admin_users',
  'admin_sessions',
  'admin_login_attempts',
  'admin_activity',
  'kanban_boards',
  'kanban_columns',
  'kanban_cards',
];
