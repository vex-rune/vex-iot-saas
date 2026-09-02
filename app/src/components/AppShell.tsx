import { useEffect } from 'react';
import {
  Outlet,
  NavLink,
  useNavigate,
} from 'react-router-dom';
import {
  Avatar,
  Button,
  Chip,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Link,
  Navbar,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tooltip,
} from '@heroui/react';
import {
  BellIcon,
  ChartBarIcon,
  ComputerDesktopIcon,
  CpuChipIcon,
  DevicePhoneMobileIcon,
  MoonIcon,
  PowerIcon,
  SunIcon,
  UsersIcon,
  GlobeAltIcon,
} from '@heroicons/react/24/outline';
import { useAuthStore } from '@/stores/auth';
import { useThemeStore } from '@/stores/theme';
import { useViewModeStore, type ViewMode } from '@/stores/viewMode';
import { APP_TITLE, OFFICIAL_URL } from '@/lib/env';
import { isAdmin } from '@/lib/perm';
import { BrandLogo } from '@/components/BrandLogo';

interface NavItem {
  to: string;
  label: string;
  icon: typeof ChartBarIcon;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', label: '控制台', icon: ChartBarIcon },
  { to: '/devices', label: '设备管理', icon: CpuChipIcon },
  { to: '/alarms/events', label: '警告信息', icon: BellIcon },
  { to: '/notify-users', label: '通知', icon: UsersIcon },
];

export default function AppShell() {
  const navigate = useNavigate();
  const { user, clear } = useAuthStore();
  const { theme, toggle } = useThemeStore();
  const viewMode = useViewModeStore((s) => s.viewMode);
  const setViewMode = useViewModeStore((s) => s.setViewMode);

  useEffect(() => {
    document.title = APP_TITLE;
  }, []);

  const handleLogout = () => {
    clear();
    navigate('/login', { replace: true });
  };

  const viewModeLabel: Record<ViewMode, string> = {
    auto: '跟随窗口',
    mobile: '手机模式',
    desktop: '电脑模式',
  };

  return (
    <div className="flex min-h-screen flex-col bg-content1">
      {/* 顶栏 */}
      <Navbar maxWidth="full" isBordered className="px-3 sm:px-6">
        <NavbarBrand>
          <Link href="/dashboard" className="flex items-center gap-2 text-foreground">
            <BrandLogo size={28} className="rounded-md" />
            <span className="font-semibold tracking-wide">{APP_TITLE}</span>
          </Link>
        </NavbarBrand>

        <NavbarContent justify="end" className="gap-2">
          {/* 官网外链:打开 Vex 云物联 官方站点 */}
          <NavbarItem>
            <Tooltip content={`访问官网 ${OFFICIAL_URL}`}>
              <a
                href={OFFICIAL_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md p-2 text-foreground hover:bg-content2"
                aria-label="访问官网"
              >
                <GlobeAltIcon className="h-5 w-5" />
              </a>
            </Tooltip>
          </NavbarItem>

          <NavbarItem>
            <Tooltip content={theme === 'light' ? '切换为暗色' : '切换为浅色'}>
              <button
                type="button"
                onClick={toggle}
                className="rounded-md p-2 text-foreground hover:bg-content2"
                aria-label="切换主题"
              >
                {theme === 'light' ? (
                  <MoonIcon className="h-5 w-5" />
                ) : (
                  <SunIcon className="h-5 w-5" />
                )}
              </button>
            </Tooltip>
          </NavbarItem>

          <NavbarItem>
            <Popover placement="bottom-end">
              <PopoverTrigger>
                <button
                  type="button"
                  className="relative rounded-md p-2 text-foreground hover:bg-content2"
                  aria-label="切换视图模式"
                >
                  {viewMode === 'auto' ? (
                    <span className="relative inline-block h-5 w-5">
                      <ComputerDesktopIcon className="absolute inset-0 h-5 w-5" />
                      <DevicePhoneMobileIcon className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-content1 text-primary" />
                    </span>
                  ) : viewMode === 'mobile' ? (
                    <DevicePhoneMobileIcon className="h-5 w-5 text-primary" />
                  ) : (
                    <ComputerDesktopIcon className="h-5 w-5 text-primary" />
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-44 p-2">
                <div className="flex flex-col gap-1">
                  <p className="px-2 pb-1 text-xs text-foreground-500">视图模式</p>
                  {(['auto', 'mobile', 'desktop'] as ViewMode[]).map((m) => {
                    const Icon = m === 'mobile' ? DevicePhoneMobileIcon : ComputerDesktopIcon;
                    const active = viewMode === m;
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setViewMode(m)}
                        className={`flex items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors ${
                          active
                            ? 'bg-primary/10 text-primary'
                            : 'text-foreground hover:bg-content2'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          {viewModeLabel[m]}
                        </span>
                        {active && <span className="text-xs">✓</span>}
                      </button>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>
          </NavbarItem>

          <NavbarItem>
            <Dropdown placement="bottom-end">
              <DropdownTrigger>
                <Button
                  variant="light"
                  className="flex items-center gap-2 px-2"
                  aria-label="用户菜单"
                >
                  <Avatar size="sm" name={user?.nickname ?? user?.username ?? 'U'} />
                  <span className="hidden text-sm sm:inline">
                    {user?.nickname ?? user?.username ?? '未登录'}
                  </span>
                </Button>
              </DropdownTrigger>
              <DropdownMenu aria-label="用户操作">
                <DropdownItem
                  key="role"
                  isReadOnly
                  className="opacity-100"
                  description="当前角色"
                >
                  <div className="flex gap-1">
                    {(user?.roles ?? []).map((r) => (
                      <Chip key={r} size="sm" variant="flat" color={r === 'ADMIN' ? 'primary' : 'default'}>
                        {r}
                      </Chip>
                    ))}
                  </div>
                </DropdownItem>
                <DropdownItem key="logout" color="danger" startContent={<PowerIcon className="h-4 w-4" />} onPress={handleLogout}>
                  退出登录
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>
          </NavbarItem>
        </NavbarContent>
      </Navbar>

      <div className="flex min-h-0 flex-1">
        {/* 侧边栏:桌面端显示,移动端改为底部导航 */}
        <aside className="hidden w-56 shrink-0 border-r border-divider bg-content1 p-3 md:block">
          <nav className="flex flex-col gap-1">
            {NAV_ITEMS.filter((it) => !it.adminOnly || isAdmin(user?.roles)).map((it) => {
              const Icon = it.icon;
              return (
                <NavLink
                  key={it.to}
                  to={it.to}
                  className={({ isActive }) =>
                    [
                      'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-foreground/80 hover:bg-content2 hover:text-foreground',
                    ].join(' ')
                  }
                >
                  <Icon className="h-5 w-5" />
                  <span>{it.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </aside>

        {/* 主体 */}
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto bg-content2 p-4 pb-20 md:pb-6">
          <div className="flex-1"><Outlet /></div>
        </main>
      </div>

      {/* 移动端底部 Tab Bar */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-divider bg-content1 md:hidden">
        <ul className="grid grid-cols-4">
          {NAV_ITEMS.filter((it) => !it.adminOnly).map((it) => {
            const Icon = it.icon;
            return (
              <li key={it.to}>
                <NavLink
                  to={it.to}
                  className={({ isActive }) =>
                    [
                      'flex flex-col items-center justify-center gap-0.5 py-2 text-[11px]',
                      isActive ? 'text-primary' : 'text-foreground/60',
                    ].join(' ')
                  }
                >
                  <Icon className="h-5 w-5" />
                  <span>{it.label}</span>
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
