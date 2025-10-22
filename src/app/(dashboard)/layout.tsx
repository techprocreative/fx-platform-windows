'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import {
  Menu,
  X,
  LayoutDashboard,
  TrendingUp,
  BarChart3,
  Settings,
  LogOut,
  ChevronDown,
  Zap,
  Server,
  Activity,
  History,
  Brain,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { Breadcrumb, MobileBreadcrumb } from '@/components/ui/Breadcrumb';
import { HelpButton } from '@/components/help/HelpButton';
import { InteractiveTutorial } from '@/components/help/InteractiveTutorial';

const navItems = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    label: 'Strategies',
    href: '/dashboard/strategies',
    icon: TrendingUp,
  },
  {
    label: 'Backtesting',
    href: '/dashboard/backtest',
    icon: BarChart3,
  },
  {
    label: 'Executors',
    href: '/dashboard/executors',
    icon: Server,
  },
  {
    label: 'AI Supervisor',
    href: '/dashboard/supervisor',
    icon: Brain,
  },
  {
    label: 'Trades',
    href: '/dashboard/trades',
    icon: History,
  },
  {
    label: 'Analytics',
    href: '/dashboard/analytics',
    icon: BarChart3,
  },
  {
    label: 'Settings',
    href: '/dashboard/settings',
    icon: Settings,
  },
];

// Admin-only navigation items
const adminNavItems = [
  {
    label: 'Admin Panel',
    href: '/dashboard/admin/supervisor',
    icon: Settings,
  },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await signOut({ redirect: false });
      toast.success('Logged out successfully');
      router.push('/login');
    } catch (error) {
      toast.error('Failed to logout');
    }
  };

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  return (
    <div className="flex h-screen bg-secondary">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 transform bg-primary shadow-lg transition-transform duration-200 ease-in-out lg:relative lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center gap-2 border-b border-primary p-6">
            <Zap className="h-6 w-6 text-primary-600" />
            <span className="text-xl font-bold text-primary">NexusTrade</span>
            <button
              onClick={() => setSidebarOpen(false)}
              className="ml-auto lg:hidden"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 p-4">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 rounded-lg px-4 py-3 transition-colors ${
                    active
                      ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400'
                      : 'text-secondary hover:bg-secondary'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}

            {/* Admin Section */}
            <div className="pt-4 mt-4 border-t border-primary">
              <div className="px-4 mb-2">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                  Admin
                </span>
              </div>
              {adminNavItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-4 py-3 transition-colors ${
                      active
                        ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400'
                        : 'text-secondary hover:bg-secondary'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="font-medium">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </nav>

          {/* Footer */}
          <div className="border-t border-primary p-4">
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-secondary hover:bg-secondary transition-colors"
            >
              <LogOut className="h-5 w-5" />
              <span className="font-medium">Logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="border-b border-primary bg-primary shadow-sm">
          <div className="flex items-center justify-between p-6">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden"
            >
              <Menu className="h-6 w-6 text-neutral-600" />
            </button>

            <div className="flex-1" />

            {/* Theme Toggle */}
            <div className="flex items-center gap-2">
              <ThemeToggle />
            </div>

            {/* User Menu */}
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-secondary transition-colors"
              >
                <div className="h-8 w-8 rounded-full bg-accent-primary flex items-center justify-center text-inverse font-semibold">
                  {session?.user?.name?.charAt(0).toUpperCase() || '?'}
                </div>
                <span className="hidden sm:inline text-sm font-medium text-secondary">
                  {session?.user?.name || 'User'}
                </span>
                <ChevronDown className="h-4 w-4 text-secondary" />
              </button>

              {/* Dropdown Menu */}
              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 rounded-lg bg-primary shadow-lg border border-primary z-10">
                  <div className="px-4 py-3 border-b border-primary">
                    <p className="text-sm font-medium text-primary">
                      {session?.user?.name}
                    </p>
                    <p className="text-xs text-tertiary">
                      {session?.user?.email}
                    </p>
                  </div>

                  <div className="p-2">
                    <Link
                      href="/dashboard/settings"
                      className="block px-4 py-2 text-sm text-primary hover:bg-secondary rounded-md transition-colors"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      Account Settings
                    </Link>
                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        handleLogout();
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                    >
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-6">
          {/* Breadcrumb Navigation */}
          <div className="mb-6">
            <div className="hidden lg:block">
              <Breadcrumb />
            </div>
            <div className="lg:hidden">
              <MobileBreadcrumb />
            </div>
          </div>
          
          <ErrorBoundary>{children}</ErrorBoundary>
        </main>
      </div>

      {/* Backdrop for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      {/* Help Components */}
      <HelpButton />
      <InteractiveTutorial />
    </div>
  );
}
