import { useState, useEffect, useRef, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  FileText,
  LayoutDashboard,
  Package,
  ShoppingCart,
  Receipt,
  BarChart3,
  Building2,
  Moon,
  Sun,
  Menu,
  X,
  Settings,
  Info,
  CreditCard,
  LogOut,
  ClipboardList,
  Users,
  Wallet,
  CreditCard as CreditCardIcon,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../hooks/useAuth';
import { BRAND_LOGO_ICON, BRAND_NAME } from '../../constants/brand';
import {
  getSubscriptionDaysRemaining,
  getSubscriptionWarningThresholdDays,
} from '../../utils/subscription';

interface LayoutProps {
  children: ReactNode;
}

interface NavItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavGroup {
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    items: [
      { path: '/', label: 'Dashboard', icon: LayoutDashboard },
      { path: '/reports', label: 'Reports', icon: BarChart3 },
    ],
  },
  {
    items: [
      { path: '/sales', label: 'Online sales', icon: ShoppingCart },
      { path: '/invoices', label: 'Offline sales', icon: FileText },
      { path: '/payments', label: 'Payments', icon: Wallet },
      { path: '/purchases', label: 'Purchases', icon: ClipboardList },
      { path: '/expenses', label: 'Expenses', icon: Receipt },
    ],
  },
  {
    items: [
      { path: '/vendors', label: 'Vendors', icon: Building2 },
      { path: '/customers', label: 'Customers', icon: Users },
      { path: '/products', label: 'Products', icon: Package },
    ],
  },
];

const accountNavItems: NavItem[] = [
  { path: '/subscription', label: 'Subscription', icon: CreditCard },
  { path: '/settings', label: 'Settings', icon: Settings },
  { path: '/about', label: 'About', icon: Info },
];

const SIDEBAR_SUBSCRIPTION_DAYS_THRESHOLD = 10;

function isNavActive(pathname: string, path: string): boolean {
  if (path === '/') return pathname === '/';
  return pathname === path || pathname.startsWith(`${path}/`);
}

function getInitialSidebarCollapsed(): boolean {
  return localStorage.getItem('sidebar-collapsed') === 'true';
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { signOut, company, loading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(getInitialSidebarCollapsed);
  const prevPathname = useRef(location.pathname);

  const subscriptionDaysLeft =
    company?.subscriptionEnd != null ? getSubscriptionDaysRemaining(company.subscriptionEnd) : null;
  const subscriptionWarningThresholdDays =
    company?.subscriptionEnd != null
      ? getSubscriptionWarningThresholdDays(
          company.subscriptionStart,
          company.subscriptionEnd,
          company.createdAt
        )
      : null;
  const showSubscriptionWarning =
    subscriptionDaysLeft !== null &&
    subscriptionWarningThresholdDays !== null &&
    subscriptionDaysLeft > 0 &&
    subscriptionDaysLeft <= subscriptionWarningThresholdDays;
  const isExpired = subscriptionDaysLeft !== null && subscriptionDaysLeft <= 0;
  const showSidebarSubscriptionDays =
    subscriptionDaysLeft !== null &&
    subscriptionDaysLeft > 0 &&
    subscriptionDaysLeft < SIDEBAR_SUBSCRIPTION_DAYS_THRESHOLD;
  const subscriptionDaysLabel =
    subscriptionDaysLeft === 1 ? '1 day left' : `${subscriptionDaysLeft} days left`;

  useEffect(() => {
    if (!loading && company?.subscriptionEnd != null && isExpired) {
      navigate('/subscription-expired', { replace: true });
    }
  }, [loading, company?.subscriptionEnd, isExpired, navigate]);

  useEffect(() => {
    const pathChanged = prevPathname.current !== location.pathname;
    if (pathChanged) {
      prevPathname.current = location.pathname;
      if (window.innerWidth < 1024 && sidebarOpen) {
        setTimeout(() => setSidebarOpen(false), 0);
      }
    }
  }, [location.pathname, sidebarOpen]);

  useEffect(() => {
    if (sidebarOpen && window.innerWidth < 1024) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [sidebarOpen]);

  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  const toggleSidebarCollapsed = () => setSidebarCollapsed((prev) => !prev);

  const navLinkClass = (active: boolean) =>
    `flex items-center ${
      sidebarCollapsed ? 'lg:justify-center lg:px-2 lg:space-x-0' : 'space-x-3 px-3'
    } py-2 rounded-md text-sm font-medium transition-colors touch-manipulation active:scale-[0.98] ${
      active
        ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
    }`;

  const footerButtonClass = (extra = '') =>
    `w-full flex items-center ${
      sidebarCollapsed ? 'lg:justify-center lg:px-2 lg:space-x-0' : 'space-x-3 px-3'
    } py-2 rounded-md text-sm font-medium transition-colors ${extra}`;

  return (
    <div className="min-h-screen flex bg-gray-50 dark:bg-gray-900 transition-colors">
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 h-dvh max-h-dvh lg:h-screen print:hidden
          w-64 md:w-72 ${sidebarCollapsed ? 'lg:w-16' : 'lg:w-64'}
          bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700
          transform transition-[transform,width] duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          flex flex-col overflow-hidden shadow-lg lg:shadow-none
        `}
      >
        <div
          className={`shrink-0 flex items-center min-h-14 border-b border-gray-200 dark:border-gray-700 ${
            sidebarCollapsed ? 'lg:flex-col lg:justify-center lg:gap-2 lg:px-2 lg:py-2' : 'justify-between px-3 py-2'
          }`}
        >
          <Link
            to="/"
            className={`flex items-center no-underline min-w-0 ${
              sidebarCollapsed ? 'lg:justify-center lg:flex-none' : 'gap-3 flex-1'
            }`}
            onClick={() => setSidebarOpen(false)}
            title={sidebarCollapsed ? company?.name || BRAND_NAME : undefined}
          >
            {company?.logo ? (
              <div className="shrink-0 w-9 h-9 rounded-md overflow-hidden bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                <img src={company.logo} alt={company.name || ''} className="w-full h-full object-contain" />
              </div>
            ) : (
              <div className="shrink-0 w-9 h-9 rounded-md overflow-hidden bg-white dark:bg-gray-800 ring-1 ring-gray-200/80 dark:ring-gray-600 flex items-center justify-center">
                <img src={BRAND_LOGO_ICON} alt={BRAND_NAME} className="w-7 h-7 object-contain" />
              </div>
            )}
            {company?.name ? (
              <span
                className={`text-sm font-semibold text-gray-900 dark:text-white truncate ${
                  sidebarCollapsed ? 'lg:hidden' : ''
                }`}
              >
                {company.name}
              </span>
            ) : null}
          </Link>
          <button
            onClick={toggleSidebarCollapsed}
            className="hidden lg:flex p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
          </button>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className={`flex-1 min-h-0 overflow-y-auto py-3 ${sidebarCollapsed ? 'lg:px-2 px-2' : 'px-2'}`}>
          <div className="space-y-1">
            {navGroups.map((group, groupIndex) => (
              <div
                key={groupIndex}
                className={groupIndex > 0 ? 'pt-3 mt-3 border-t border-gray-200 dark:border-gray-700' : ''}
              >
                {group.items.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => window.innerWidth < 1024 && setSidebarOpen(false)}
                    className={navLinkClass(isNavActive(location.pathname, item.path))}
                    title={sidebarCollapsed ? item.label : undefined}
                  >
                    <item.icon className="w-4 h-4 shrink-0" />
                    <span className={sidebarCollapsed ? 'lg:hidden' : ''}>{item.label}</span>
                  </Link>
                ))}
              </div>
            ))}

            <div className="pt-3 mt-3 border-t border-gray-200 dark:border-gray-700 space-y-1">
              {accountNavItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => window.innerWidth < 1024 && setSidebarOpen(false)}
                  className={navLinkClass(isNavActive(location.pathname, item.path))}
                  title={sidebarCollapsed ? item.label : undefined}
                >
                  <item.icon className="w-4 h-4 shrink-0" />
                  <span className={sidebarCollapsed ? 'lg:hidden' : ''}>{item.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </nav>

        <div
          className={`shrink-0 border-t border-gray-200 dark:border-gray-700 space-y-1 ${
            sidebarCollapsed ? 'lg:p-2 p-3' : 'p-3'
          }`}
        >
          {showSidebarSubscriptionDays && (
            <Link
              to="/subscription"
              onClick={() => window.innerWidth < 1024 && setSidebarOpen(false)}
              title={sidebarCollapsed ? subscriptionDaysLabel : undefined}
              className={`flex items-center gap-2 rounded-md text-xs font-medium transition-colors touch-manipulation ${
                sidebarCollapsed
                  ? 'lg:justify-center lg:px-2 lg:py-2 w-full bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 hover:bg-amber-200/80 dark:hover:bg-amber-900/40'
                  : 'px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/30'
              }`}
            >
              <CreditCardIcon className="w-4 h-4 shrink-0" />
              <span className={sidebarCollapsed ? 'lg:hidden' : ''}>
                {subscriptionDaysLabel} on subscription
              </span>
              {sidebarCollapsed && (
                <span className="hidden lg:inline tabular-nums font-semibold">
                  {subscriptionDaysLeft}
                </span>
              )}
            </Link>
          )}
          <button
            onClick={toggleTheme}
            className={footerButtonClass('text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700')}
            aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            title={sidebarCollapsed ? (theme === 'light' ? 'Dark Mode' : 'Light Mode') : undefined}
          >
            {theme === 'light' ? <Moon className="w-4 h-4 shrink-0" /> : <Sun className="w-4 h-4 shrink-0" />}
            <span className={sidebarCollapsed ? 'lg:hidden' : ''}>
              {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
            </span>
          </button>
          <button
            onClick={() => signOut().catch(console.error)}
            className={footerButtonClass('text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20')}
            aria-label="Sign out"
            title={sidebarCollapsed ? 'Sign Out' : undefined}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span className={sidebarCollapsed ? 'lg:hidden' : ''}>Sign Out</span>
          </button>
        </div>
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <div
        className={`flex-1 flex flex-col min-w-0 transition-[margin] duration-300 ease-in-out ${
          sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'
        }`}
      >
        <header className="lg:hidden sticky top-0 z-30 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between h-12 px-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
              aria-label="Open sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="font-semibold text-gray-900 dark:text-white text-sm truncate">
              {company?.name || BRAND_NAME}
            </span>
            <div className="w-9" />
          </div>
        </header>
        {showSubscriptionWarning && (
          <div className="shrink-0 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800">
            <div className="px-4 py-3">
              <Link to="/subscription" className="flex items-center gap-3 text-amber-800 dark:text-amber-200 text-sm font-medium">
                <CreditCardIcon className="w-5 h-5 shrink-0" />
                Subscription ending in {subscriptionDaysLeft} day{subscriptionDaysLeft === 1 ? '' : 's'} — renew to keep access
              </Link>
            </div>
          </div>
        )}

        <main className="flex-1 w-full max-w-screen-2xl mx-auto px-4 py-4 lg:px-6">{children}</main>
      </div>
    </div>
  );
}
