import { randomUUID } from 'node:crypto';
import { after } from 'next/server';
import { putTenantBlob } from '@/lib/blob/tenant-files';
import { fetchReferenceRaw } from '@/lib/images/logo';
import {
  prepareLogoAsset,
  prepareLogoRendition,
} from '@/lib/images/logo-asset';
import {
  currentLogoAsset,
  currentDarkLogoAsset,
} from '@/lib/images/logo-schema';
import { critiqueLogo } from '@/lib/images/logo-critic';
import { measureLogoFit } from '@/lib/images/logo-measure';
import { deriveWhiteLogo } from '@/lib/images/logo-white';
import { insertImage } from '@/lib/images/queries';
import {
  setBrandLogo,
  setBrandLogoDark,
  setBrandLogoDerived,
} from '@/lib/tenant-queries';
import type { Brand, Tenant } from '@/lib/types';

export const WHITE_LOGO_MODEL = 'sharp/luminance-cut';
const DARK_PREVIEW = '#0b0e14';
type LogoTenant = Pick<Tenant, 'id' | 'slug' | 'name'> & { brand: Brand };
type ApplyOptions = { wait?: boolean; read?: boolean; signal?: AbortSignal };

function guarded(run: () => Promise<void>) {
  return run().catch((error) =>
    console.warn(
      '[logo] derivação falhou:',
      error instanceof Error ? error.message : 'erro desconhecido',
    ),
  );
}

function defer(run: () => Promise<void>): void {
  try {
    after(() => guarded(run));
  } catch {
    void guarded(run);
  }
}

export async function applyBrandLogo(
  tenant: LogoTenant,
  url: string | null,
  options: ApplyOptions = {},
): Promise<Brand> {
  const brand = (await setBrandLogo(tenant.id, url)) as Brand;
  if (url) {
    const run = () =>
      deriveLogoAssets({ ...tenant, brand }, url, {
        ...options,
        read: options.read ?? false,
      });
    if (options.wait) await guarded(run);
    else defer(run);
  }
  return brand;
}

/** Prepara o master antes de medir; ambas as gravações comparam a aplicação vigente. */
export async function deriveLogoAssets(
  tenant: LogoTenant,
  source: string,
  options: ApplyOptions = {},
): Promise<void> {
  const revision = tenant.brand.logoRevision;
  if (!revision) return;
  if (
    currentLogoAsset(tenant.brand)?.source === source &&
    tenant.brand.logoFit?.source === source &&
    currentDarkLogoAsset(tenant.brand)
  )
    return;
  const { bytes: original } = await fetchReferenceRaw(source, options.signal);
  options.signal?.throwIfAborted();
  const { asset, master } = await prepareLogoAsset({
    tenant,
    source,
    bytes: original,
    read: options.read ?? true,
  });
  const fit = await measureLogoFit(
    asset.background === 'opaque' ? original : master,
    source,
  );
  if (!(await setBrandLogoDerived(tenant.id, source, { fit, asset }, revision)))
    return;
  Object.assign(tenant.brand, { logoFit: fit, logoAsset: asset });
  const white = await deriveWhiteLogo(master);
  if (!white) return;
  options.signal?.throwIfAborted();
  const batchId = randomUUID();
  const blob = await putTenantBlob(
    tenant.id,
    `logo/${batchId}/branca.png`,
    white.png,
    { access: 'public', addRandomSuffix: false, contentType: 'image/png' },
  );
  const row = await insertImage({
    tenantId: tenant.id,
    batchId,
    requestText: 'Versão branca do logo para fundo escuro',
    targetBlock: 'logo',
    ratio: white.width > white.height ? '4:3' : '1:1',
    model: WHITE_LOGO_MODEL,
    promptFinal: `Recorte por luminância de ${source}; cobertura ${white.coverage}.`,
    url: blob.url,
    blobPath: blob.pathname,
    kind: 'logo',
    referenceUrls: [source],
    width: white.width,
    height: white.height,
  });
  const critique = await critiqueLogo({
    id: row.id,
    bytes: new Uint8Array(white.png),
    variant: 'branca',
    mode: 'derivar',
    brandName: tenant.name,
    wordmark: false,
    reference: master,
    surface: DARK_PREVIEW,
    signal: options.signal,
  });
  if (!critique.aprovado || options.signal?.aborted) return;
  const { rendition: darkAsset } = await prepareLogoRendition(
    { tenant, source: blob.url, bytes: white.png },
    { dark: true },
  );
  if (
    await setBrandLogoDerived(
      tenant.id,
      source,
      { darkUrl: blob.url, darkAsset },
      revision,
    )
  )
    Object.assign(tenant.brand, {
      logoDarkUrl: blob.url,
      logoDarkAsset: darkAsset,
    });
}

/** Uma escolha manual escura invalida jobs antigos e recebe somente sua própria rendição. */
export async function applyBrandLogoDark(
  tenant: LogoTenant,
  url: string | null,
  options: ApplyOptions = {},
): Promise<Brand> {
  const brand = (await setBrandLogoDark(tenant.id, url)) as Brand;
  if (url && brand.logoUrl && brand.logoRevision) {
    const source = brand.logoUrl,
      revision = brand.logoRevision;
    const run = async () => {
      const { bytes } = await fetchReferenceRaw(url, options.signal);
      const { rendition: darkAsset } = await prepareLogoRendition(
        { tenant, source: url, bytes },
        { dark: true },
      );
      if (await setBrandLogoDerived(tenant.id, source, { darkAsset }, revision))
        brand.logoDarkAsset = darkAsset;
    };
    if (options.wait) await guarded(run);
    else defer(run);
  }
  return brand;
}
