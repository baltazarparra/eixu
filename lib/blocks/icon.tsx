import { ArrowUpRightIcon } from '@phosphor-icons/react/dist/ssr/ArrowUpRight';
import { ArrowRightIcon } from '@phosphor-icons/react/dist/ssr/ArrowRight';
import { PlusIcon } from '@phosphor-icons/react/dist/ssr/Plus';
import { CheckIcon } from '@phosphor-icons/react/dist/ssr/Check';
import { QuotesIcon } from '@phosphor-icons/react/dist/ssr/Quotes';
import { PhoneIcon } from '@phosphor-icons/react/dist/ssr/Phone';
import { EnvelopeSimpleIcon } from '@phosphor-icons/react/dist/ssr/EnvelopeSimple';
import { MapPinIcon } from '@phosphor-icons/react/dist/ssr/MapPin';
import { ChatCircleIcon } from '@phosphor-icons/react/dist/ssr/ChatCircle';
import { PathIcon } from '@phosphor-icons/react/dist/ssr/Path';
import { CompassIcon } from '@phosphor-icons/react/dist/ssr/Compass';
import { StackIcon } from '@phosphor-icons/react/dist/ssr/Stack';
import { BookOpenIcon } from '@phosphor-icons/react/dist/ssr/BookOpen';
import { LeafIcon } from '@phosphor-icons/react/dist/ssr/Leaf';
import { SunIcon } from '@phosphor-icons/react/dist/ssr/Sun';
import { LightningIcon } from '@phosphor-icons/react/dist/ssr/Lightning';
import { GlobeIcon } from '@phosphor-icons/react/dist/ssr/Globe';
import { WrenchIcon } from '@phosphor-icons/react/dist/ssr/Wrench';
import { ChartLineUpIcon } from '@phosphor-icons/react/dist/ssr/ChartLineUp';
import { HandshakeIcon } from '@phosphor-icons/react/dist/ssr/Handshake';
import { HeartIcon } from '@phosphor-icons/react/dist/ssr/Heart';
import { ShieldCheckIcon } from '@phosphor-icons/react/dist/ssr/ShieldCheck';
import { ClockIcon } from '@phosphor-icons/react/dist/ssr/Clock';
import { PaletteIcon } from '@phosphor-icons/react/dist/ssr/Palette';
import { CameraIcon } from '@phosphor-icons/react/dist/ssr/Camera';
import { CubeIcon } from '@phosphor-icons/react/dist/ssr/Cube';
import { ICON_STYLE, type SiteIconName } from '@/lib/design/iconography';
import type { Vibe } from '@/lib/design/vibes';

const icons = {
  'arrow-up-right': ArrowUpRightIcon,
  'arrow-right': ArrowRightIcon,
  plus: PlusIcon,
  check: CheckIcon,
  quote: QuotesIcon,
  phone: PhoneIcon,
  mail: EnvelopeSimpleIcon,
  pin: MapPinIcon,
  chat: ChatCircleIcon,
  route: PathIcon,
  compass: CompassIcon,
  layers: StackIcon,
  book: BookOpenIcon,
  leaf: LeafIcon,
  sun: SunIcon,
  lightning: LightningIcon,
  globe: GlobeIcon,
  tools: WrenchIcon,
  chart: ChartLineUpIcon,
  handshake: HandshakeIcon,
  heart: HeartIcon,
  shield: ShieldCheckIcon,
  clock: ClockIcon,
  palette: PaletteIcon,
  camera: CameraIcon,
  cube: CubeIcon,
} satisfies Record<SiteIconName, typeof ArrowUpRightIcon>;

/** SVG visível no SSR, sem provider/hidratação por ícone. O CSS anima o gesto. */
export function SiteIcon({
  name,
  vibe = 'comercial',
  size = 20,
  badge = false,
  className = '',
}: {
  name: SiteIconName;
  vibe?: Vibe;
  size?: number;
  badge?: boolean;
  className?: string;
}) {
  const Icon = icons[name] ?? icons.layers;
  const style = ICON_STYLE[vibe] ?? ICON_STYLE.comercial;
  return (
    <span
      className={`site-icon ${badge ? 'site-icon-badge' : ''} ${className}`}
      data-icon={name}
      data-icon-vibe={vibe}
      data-icon-motion={style.motion}
      aria-hidden="true"
    >
      <Icon
        className="site-icon-svg"
        size={size}
        weight={style.weight}
        focusable="false"
      />
    </span>
  );
}
