'use client';

import dynamic from 'next/dynamic';
import type { SiteState } from '@/lib/admin/state';
import type { ChatMessage } from '@/lib/ai/usage';

type Props = {
  initial: SiteState;
  history: ChatMessage[];
  lastMessageId: number;
  imageRequest?: string;
};

const GeneratorWorkspace = dynamic(() =>
  import('./generator-workspace').then((module) => module.GeneratorWorkspace),
);
const PremiumCms = dynamic(() =>
  import('./premium-cms').then((module) => module.PremiumCms),
);
const PremiumConversionWorkspace = dynamic(() =>
  import('./premium-conversion-workspace').then(
    (module) => module.PremiumConversionWorkspace,
  ),
);

/** Carrega somente o editor que pode escrever no runtime atual do tenant. */
export function Workspace(props: Props) {
  if (
    props.initial.premium.maintenanceMode === 'premium' &&
    props.initial.premium.publicRuntime === 'premium'
  )
    return <PremiumCms initial={props.initial} />;
  if (props.initial.premium.maintenanceMode === 'converting')
    return <PremiumConversionWorkspace initial={props.initial} />;
  return <GeneratorWorkspace {...props} />;
}
