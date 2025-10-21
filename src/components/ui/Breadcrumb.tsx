'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ChevronRight, MoreHorizontal } from 'lucide-react';
import { useState } from 'react';

interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: React.ComponentType<{ className?: string }>;
  isActive?: boolean;
}

interface BreadcrumbProps {
  items?: BreadcrumbItem[];
  maxItems?: number;
  showHome?: boolean;
  className?: string;
}

const routeMap: Record<string, string> = {
  'dashboard': 'Dashboard',
  'strategies': 'Strategies',
  'backtest': 'Backtesting',
  'monitor': 'Monitor',
  'trades': 'Trades',
  'executors': 'Executors',
  'analytics': 'Analytics',
  'settings': 'Settings',
  'create': 'Create',
  'edit': 'Edit',
  'view': 'View',
  'reports': 'Reports',
  'performance': 'Performance',
  'risk': 'Risk Management',
  'portfolio': 'Portfolio',
  'alerts': 'Alerts',
  'api': 'API',
  'docs': 'Documentation',
  'help': 'Help',
  'profile': 'Profile',
  'security': 'Security',
  'notifications': 'Notifications',
  'integrations': 'Integrations',
  'billing': 'Billing',
  'team': 'Team',
  'audit': 'Audit Log',
};

function generateSeoItems(path: string): BreadcrumbItem[] {
  const pathSegments = path.split('/').filter(Boolean);
  const seoItems: BreadcrumbItem[] = [
    { label: 'Home', href: '/' },
  ];

  let currentPath = '';
  pathSegments.forEach((segment, index) => {
    currentPath += `/${segment}`;
    
    if (/^\d+$|^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(segment)) {
      return;
    }

    const label = routeMap[segment] || segment.charAt(0).toUpperCase() + segment.slice(1);
    const isActive = index === pathSegments.length - 1;

    seoItems.push({
      label,
      href: currentPath,
      isActive,
    });
  });

  return seoItems;
}

export function Breadcrumb({ 
  items, 
  maxItems = 4, 
  showHome = true, 
  className = '' 
}: BreadcrumbProps) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(false);

  // Generate breadcrumb items from pathname if not provided
  const generateItems = (): BreadcrumbItem[] => {
    if (items) return items;

    const pathSegments = pathname.split('/').filter(Boolean);
    const generatedItems: BreadcrumbItem[] = [];

    // Add home if requested
    if (showHome) {
      generatedItems.push({
        label: 'Home',
        href: '/',
        icon: Home,
      });
    }

    // Generate items from path segments
    let currentPath = '';
    pathSegments.forEach((segment, index) => {
      currentPath += `/${segment}`;
      
      // Skip if it's just an ID (numeric or UUID-like)
      if (/^\d+$|^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(segment)) {
        return;
      }

      const label = routeMap[segment] || segment.charAt(0).toUpperCase() + segment.slice(1);
      const isActive = index === pathSegments.length - 1;

      generatedItems.push({
        label,
        href: isActive ? undefined : currentPath,
        isActive,
      });
    });

    return generatedItems;
  };

  const breadcrumbItems = generateItems();

  // Handle overflow for long breadcrumbs
  const getDisplayItems = () => {
    if (breadcrumbItems.length <= maxItems || expanded) {
      return breadcrumbItems;
    }

    // Show first item, ellipsis, and last 2 items
    return [
      breadcrumbItems[0],
      { label: '...', isActive: false },
      ...breadcrumbItems.slice(-2),
    ];
  };

  const displayItems = getDisplayItems();

  return (
    <nav aria-label="Breadcrumb" className={`flex items-center space-x-1 text-sm ${className}`}>
      <ol className="flex items-center space-x-1">
        {displayItems.map((item, index) => {
          const isLast = index === displayItems.length - 1;
          const isEllipsis = item.label === '...';

          return (
            <li key={index} className="flex items-center">
              {index > 0 && !isEllipsis && (
                <ChevronRight className="h-4 w-4 mx-1 text-tertiary flex-shrink-0" />
              )}

              {isEllipsis ? (
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="flex items-center text-tertiary hover:text-primary transition-colors p-1 rounded-md hover:bg-secondary"
                  aria-label="Show more breadcrumb items"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              ) : (
                <div className="flex items-center">
                  {item.icon && (
                    <item.icon className="h-4 w-4 mr-1 text-tertiary" />
                  )}
                  {item.href && !item.isActive ? (
                    <Link
                      href={item.href}
                      className="text-tertiary hover:text-primary transition-colors font-medium"
                    >
                      {item.label}
                    </Link>
                  ) : (
                    <span
                      className={`font-medium ${
                        item.isActive
                          ? 'text-primary'
                          : 'text-tertiary'
                      }`}
                      aria-current={item.isActive ? 'page' : undefined}
                    >
                      {item.label}
                    </span>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// Breadcrumb with schema.org structured data for SEO
export function SeoBreadcrumb({ items, className = '' }: { items?: BreadcrumbItem[], className?: string }) {
  const pathname = usePathname();
  const breadcrumbItems = items || generateSeoItems(pathname);

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbItems.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.label,
      item: item.href,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <Breadcrumb items={items} className={className} />
    </>
  );
}

// Mobile-friendly breadcrumb with dropdown
export function MobileBreadcrumb({ items, className = '' }: { items?: BreadcrumbItem[], className?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  
  const breadcrumbItems = items || generateSeoItems(pathname);
  const currentLabel = breadcrumbItems[breadcrumbItems.length - 1]?.label || 'Current Page';

  return (
    <div className={`lg:hidden ${className}`}>
      <div className="flex items-center space-x-2">
        <Link href="/" className="text-tertiary hover:text-primary">
          <Home className="h-4 w-4" />
        </Link>
        <ChevronRight className="h-4 w-4 text-tertiary" />
        
        <div className="relative">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center space-x-1 text-primary font-medium px-2 py-1 rounded-md hover:bg-secondary transition-colors"
            aria-expanded={isOpen}
            aria-haspopup="true"
          >
            <span>{currentLabel}</span>
            <ChevronRight className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
          </button>

          {isOpen && (
            <div className="absolute top-full left-0 mt-1 w-48 bg-primary border border-primary rounded-lg shadow-lg z-10">
              <div className="p-2">
                {breadcrumbItems.slice(1, -1).map((item: BreadcrumbItem, index: number) => (
                  <Link
                    key={index}
                    href={item.href || '#'}
                    className="block px-3 py-2 text-sm text-primary hover:bg-secondary rounded-md transition-colors"
                    onClick={() => setIsOpen(false)}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Overlay for mobile dropdown */}
      {isOpen && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}