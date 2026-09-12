import { randomUUID } from 'node:crypto';
import { after } from 'next/server';
import { putTenantBlob } from '@/lib/blob/tenant-files';
import { fetchReference } from '@/lib/images/logo';
import { critiqueLogo } from '@/lib/images/logo-critic';
import { measureLogoFit } from '@/lib/images/logo-measure';
import { deriveWhiteLogo } from '@/lib/images/logo-white';
import { insertImage } from '@/lib/images/queries';
import { setBrandLogo, setBrandLogoDerived } from '@/lib/tenant-queries';
import type { Brand, Tenant } from '@/lib/types';

/** Registrado em images.model: a versão branca não passa por modelo de imagem. */
export const WHITE_LOGO_MODEL = 'sharp/luminance-cut';
/** Superfície em que o crítico vê a versão branca: o papel das vibes escuras. */
const DARK_PREVIEW = '#0b0e14';

type LogoTenant = Pick<Tenant, 'id' | 'slug' | 'name'> & { brand: Brand };

/**
 * Corre depois da resposta quando há request (rota, ação); fora dele, corre
 * solto e registra a falha. A derivação nunca decide o resultado da chamada
 * que aplicou o logo.
 */
function defer(run: () => Promise<void>): void {
  const guarded = () =>
    run().catch((error) => {
      console.warn('[logo] derivação da versão escura falhou:', error);
    });
  try {
    after(guarded);
  } catch {
    void guarded();
  }
}

/**
 * Aplica o logo e agenda a medição e a versão para fundo escuro. O logo
 * aplicado é decisão do operador; a versão escura é o mesmo logo adaptado ao
 * papel da seção, e só entra quando a medição e o crítico aprovam.
 */
export async function applyBrandLogo(
  tenant: LogoTenant,
  url: string | null,
): Promise<Brand> {
  const brand = (await setBrandLogo(tenant.id, url)) as Brand;
  if (url) defer(() => deriveLogoAssets({ ...tenant, brand }, url));
  return brand;
}

/**
 * Mede o logo, grava a medição e deriva a versão branca. Idempotente para o
 * mesmo logo já derivado. Cada gravação confere que o logo medido ainda é o
 * atual: o operador pode ter trocado o logo enquanto isto corria.
 */
export async function deriveLogoAssets(
  tenant: LogoTenant,
  source: string,
): Promise<void> {
  if (tenant.brand.logoFit?.source === source && tenant.brand.logoDarkUrl)
    return;
  // SVG, webp e formatos exóticos viram PNG de até 1024 px, com o alfa.
  const original = await fetchReference(source);
  const fit = await measureLogoFit(original, source);
  if (!(await setBrandLogoDerived(tenant.id, source, { fit }))) return;

  const white = await deriveWhiteLogo(original);
  if (!white) {
    console.info(
      `[logo] ${tenant.slug}: sem versão branca por recorte; o chat pode pedir uma ao modelo.`,
    );
    return;
  }
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
    ratio: '1:1',
    model: WHITE_LOGO_MODEL,
    promptFinal: `Recorte por luminância de ${source}; cobertura ${white.coverage}.`,
    url: blob.url,
    blobPath: blob.pathname,
    kind: 'logo',
    referenceUrls: [source],
  });
  const critique = await critiqueLogo({
    id: row.id,
    bytes: new Uint8Array(white.png),
    variant: 'branca',
    mode: 'derivar',
    brandName: tenant.name,
    wordmark: false,
    reference: original,
    surface: DARK_PREVIEW,
  });
  if (critique.aprovado)
    await setBrandLogoDerived(tenant.id, source, { darkUrl: blob.url });
}
