// Prepara apenas rascunhos. Não apaga arquivos, não publica e não executa por padrão.
import { createJiti } from 'jiti';
const args = process.argv.slice(2);
const slug = args.find((arg) => arg.startsWith('--slug='))?.slice(7);
const all = args.includes('--all');
const apply = args.includes('--apply') && !args.includes('--dry-run');
if (!slug && !all) {
  console.log(
    'Use --slug=cliente (ou --all) e --dry-run. Após autorizar o recurso e o escopo, --apply prepara só os rascunhos. Pode chamar o crítico de logo.',
  );
  process.exit(0);
}
const jiti = createJiti(import.meta.url, {
  alias: { '@': process.cwd() },
  fsCache: false,
});
const { db } = await jiti.import('../lib/db.ts');
const { getTenantBySlug } = await jiti.import('../lib/tenant-queries.ts');
const { ensureLogoRevision } = await jiti.import(
  '../lib/images/logo-studio-queries.ts',
);
const { deriveLogoAssets } = await jiti.import('../lib/images/logo-apply.ts');
const { currentLogoAsset } = await jiti.import('../lib/images/logo-schema.ts');
const rows = slug
  ? [{ slug }]
  : await db()`select slug from tenants where nullif(brand->>'logoUrl', '') is not null order by slug`;
for (const row of rows) {
  const tenant = await getTenantBySlug(row.slug);
  if (!tenant?.brand.logoUrl) {
    console.log(`${row.slug}: sem logo`);
    continue;
  }
  if (!apply) {
    console.log(
      `${row.slug}: ${currentLogoAsset(tenant.brand) ? 'asset existente' : 'preparação pendente'}; rascunho, sem escrita`,
    );
    continue;
  }
  const source = tenant.brand.logoUrl;
  const brand = await ensureLogoRevision(tenant.id, source);
  if (!brand) {
    console.log(`${row.slug}: logo alterado durante a leitura`);
    continue;
  }
  await deriveLogoAssets({ ...tenant, brand }, source, {
    read: false,
    wait: true,
  });
  console.log(`${row.slug}: rascunho preparado; publicação não alterada`);
}
