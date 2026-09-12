import { hydrateRoot } from 'react-dom/client';
import { RenderBlocks } from '@/lib/blocks/render';
import { themeVars } from '@/lib/blocks/theme';
import { SITE_STRUCTURES, type StructureKey } from '@/lib/design/structures';
import type { DesignProfileInput } from '@/lib/design/profile';
import type { Tenant } from '@/lib/types';

const image = (index: number) =>
  `https://assets.test/signature-structure-${index}.svg`;

function fixtureTenant(structureKey: StructureKey): Tenant {
  const structure = SITE_STRUCTURES[structureKey];
  const dark = structure.vibe === 'moderno';
  return {
    id: 'signature-structure-fixture',
    slug: 'signature-structure-fixture',
    name: 'Estudo estrutural',
    status: 'draft',
    brand: {
      vibe: structure.vibe,
      ink: dark ? '#f5f5f4' : '#202722',
      paper: dark ? '#0e1112' : '#fffdf7',
      surface: dark ? '#171a1c' : '#f5f2e9',
      accent: '#486b50',
      accentAlt: '#b3a3bc',
      highlight: dark ? '#b8ed91' : '#405939',
      radius: structure.vibe === 'artistico' ? 'lg' : 'sm',
      design: {
        version: 5,
        structure: structure.key,
        structureRationale: structure.intent,
        concept: 'Relações próprias entre assunto, cenas e decisão',
        signatureElement: 'Composição autoral ligada ao contexto',
        displayFont: dark ? 'grotesk' : 'humanist',
        bodyFont: 'source',
        heroComposition: structure.openings[0].split(
          ':',
        )[1] as DesignProfileInput['heroComposition'],
        navigation: 'bar',
        rhythm: 'alternating',
        imageTreatment: 'framed',
        surfaceStyle: 'flat',
        motif: 'none',
        signature: structure.key,
        definedAt: '2026-09-12T00:00:00.000Z',
      },
    },
    dials: { motion: 5, variance: 5, density: 4 },
    contacts: {},
    brief: {},
    imageGuide: {},
  } as Tenant;
}

export function SignatureStructureFixture({
  structureKey,
}: {
  structureKey: StructureKey;
}) {
  const structure = SITE_STRUCTURES[structureKey];
  const tenant = fixtureTenant(structureKey);
  const blocks = [
    {
      id: 'signature',
      type: 'signature.composition',
      props: {
        layout: structure.signatureLayout,
        eyebrow: structure.label,
        title: 'Uma composição que só existe para este contexto',
        body: structure.intent,
        items: [
          {
            role: 'support',
            label: 'Contexto',
            title: 'O ponto que prepara a leitura',
            body: 'A informação de apoio conecta o assunto à cena principal sem competir com ela.',
            image: image(1),
            imageAlt: 'Forma verde sobre uma superfície de papel',
          },
          {
            role: 'focus',
            label: 'Foco',
            title: 'A relação central desta história',
            body: 'O item principal combina uma cena própria com o critério que orienta a escolha.',
            image: image(2),
            imageAlt: 'Composição geométrica em destaque',
          },
          {
            role: 'detail',
            label: 'Detalhe',
            title: 'Uma consequência que merece atenção',
            body: 'O detalhe aprofunda a proposta e muda de posição conforme a família estrutural.',
          },
          {
            role: 'action',
            label: 'Ação',
            title: 'Um próximo passo relacionado à leitura',
            body: 'A ação encerra a composição com contexto suficiente para o visitante decidir.',
            cta: { label: 'Conhecer o processo', href: '/processo' },
          },
        ],
      },
    },
  ];
  return (
    <main
      className="site-theme"
      data-vibe={structure.vibe}
      data-structure={structure.key}
      data-profile-version="5"
      data-motion="gentle"
      style={themeVars(tenant.brand)}
    >
      <RenderBlocks
        blocks={blocks}
        ctx={{ tenant, pagePath: '/', isPreview: true }}
      />
    </main>
  );
}

if (typeof document !== 'undefined') {
  const structureKey = new URLSearchParams(location.search).get(
    'structure',
  ) as StructureKey;
  hydrateRoot(
    document.getElementById('root')!,
    <SignatureStructureFixture structureKey={structureKey} />,
  );
}
