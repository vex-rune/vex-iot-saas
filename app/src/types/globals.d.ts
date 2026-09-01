// heroicons v2 不含独立 .d.ts, 这里做全局声明
declare module '@heroicons/react/24/outline' {
  import type { FC, SVGProps } from 'react';
  type IconComponent = FC<SVGProps<SVGSVGElement>>;
  export const SignalIcon: IconComponent;
  export const ShieldCheckIcon: IconComponent;
  export const CircleStackIcon: IconComponent;
  export const EyeIcon: IconComponent;
  export const EyeSlashIcon: IconComponent;
  export const ArrowTopRightOnSquareIcon: IconComponent;
  export const SunIcon: IconComponent;
  export const MoonIcon: IconComponent;
  export const BellIcon: IconComponent;
  export const ChartBarIcon: IconComponent;
  export const Cog6ToothIcon: IconComponent;
  export const ComputerDesktopIcon: IconComponent;
  export const CpuChipIcon: IconComponent;
  export const PowerIcon: IconComponent;
  export const UsersIcon: IconComponent;
  export const PencilIcon: IconComponent;
  export const TrashIcon: IconComponent;
  export const PlusIcon: IconComponent;
  export const XMarkIcon: IconComponent;
  export const SearchIcon: IconComponent;
  export const ChevronDownIcon: IconComponent;
  export const ChevronLeftIcon: IconComponent;
  export const ChevronRightIcon: IconComponent;
  export const MagnifyingGlassIcon: IconComponent;
  export const CheckCircleIcon: IconComponent;
  export const XCircleIcon: IconComponent;
  export const ClockIcon: IconComponent;
  export const BoltIcon: IconComponent;
  export const ExclamationTriangleIcon: IconComponent;
  export const Battery100Icon: IconComponent;
  export const FunnelIcon: IconComponent;
  export const MagnifyingGlassCircleIcon: IconComponent;
  export const StopCircleIcon: IconComponent;
  export const PlayCircleIcon: IconComponent;
  export const RefreshCwIcon: IconComponent;
  export const ArrowPathIcon: IconComponent;
  export const ArrowLeftIcon: IconComponent;
  export const DevicePhoneMobileIcon: IconComponent;
  export const CalendarIcon: IconComponent;
  export const MapPinIcon: IconComponent;
  export const LinkIcon: IconComponent;
  export const BuildingOfficeIcon: IconComponent;
  export const CheckBadgeIcon: IconComponent;
  export const CpuIcon: IconComponent;
  export const WifiIcon: IconComponent;
  export const GlobeAltIcon: IconComponent;
  export const ChevronUpIcon: IconComponent;
  export const PencilSquareIcon: IconComponent;
  export const DocumentDuplicateIcon: IconComponent;
  export const Bars3Icon: IconComponent;
  export const BarsArrowDownIcon: IconComponent;
  export const ArrowUpIcon: IconComponent;
  export const ArrowDownIcon: IconComponent;
  export const ArrowUpDownIcon: IconComponent;
}

declare module '@heroicons/react/24/solid' {
  import type { FC, SVGProps } from 'react';
  type IconComponent = FC<SVGProps<SVGSVGElement>>;
  export const CheckIcon: IconComponent;
  export const XMarkIcon: IconComponent;
}

// CSS modules (side effect imports for TS `import './styles/globals.css'`)
declare module '*.css' {
  const content: string;
  export default content;
}

// Vite env 扩展 — 保持和 .env.development/.env.production 变量命名一致
/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_APP_TITLE?: string;
  readonly VITE_API_BASE?: string;
  readonly VITE_SSE_BASE?: string;
  readonly VITE_OFFICIAL_SITE?: string;
  readonly VITE_OFFICIAL_URL?: string;
  readonly MODE: string;
  readonly DEV: boolean;
  readonly PROD: boolean;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
