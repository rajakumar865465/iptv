'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Users, MonitorSmartphone, KeyRound, CreditCard, Globe, Zap,
  AlertTriangle, FileStack, Settings, Bell, BarChart3, ScrollText, Activity, Shield,
  Package, Globe2, HeartPulse, Radio, MessageSquareWarning, CloudDownload,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

type NavItem = {
  href: string;
  label: string;
  icon: React.ElementType;
};

type NavSection = {
  title: string;
  items: NavItem[];
};

const navSections: NavSection[] = [
  {
    title: 'Overview',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/analytics', label: 'Analytics', icon: BarChart3 },
      { href: '/logs', label: 'Logs', icon: ScrollText },
      { href: '/system', label: 'System', icon: Activity },
    ],
  },
  {
    title: 'Users',
    items: [
      { href: '/users', label: 'Users', icon: Users },
      { href: '/devices', label: 'Devices', icon: MonitorSmartphone },
      { href: '/licenses', label: 'Licenses', icon: KeyRound },
      { href: '/payments', label: 'Payments', icon: CreditCard },
      { href: '/orders', label: 'Manual Orders', icon: CreditCard },
      { href: '/feedback', label: 'User Feedback', icon: MessageSquareWarning },
    ],
  },
  {
    title: 'Content',
    items: [
      { href: '/channels', label: 'Channels', icon: Globe },
      { href: '/channel-import', label: 'Import Channels', icon: CloudDownload },
      { href: '/categories', label: 'Categories', icon: FileStack },
      { href: '/languages', label: 'Languages', icon: Globe },
    ],
  },
  {
    title: 'Stream Ops',
    items: [
      { href: '/channels/stream-health', label: 'Stream Health', icon: HeartPulse },
      { href: '/stream-scanner', label: 'Scanner', icon: AlertTriangle },
      { href: '/smooth-playback', label: 'Smooth Playback', icon: Radio },
      { href: '/channels/reported', label: 'Reports', icon: AlertTriangle },
      { href: '/channels/duplicates', label: 'Duplicates', icon: FileStack },
      { href: '/channels/hidden', label: 'Hidden', icon: Zap },
    ],
  },
  {
    title: 'Product',
    items: [
      { href: '/plans', label: 'Plans', icon: CreditCard },
      { href: '/app-settings', label: 'App Settings', icon: Settings },
      { href: '/app-releases', label: 'Releases', icon: Package },
      { href: '/website-settings', label: 'Website Settings', icon: Globe2 },
    ],
  },
  {
    title: 'Admin',
    items: [
      { href: '/admin-users', label: 'Admin Users', icon: Shield },
      { href: '/notifications', label: 'Notifications', icon: Bell },
    ],
  },
];

function isActivePath(pathname: string, href: string) {
  if (href === '/channels') return pathname === href;
  return pathname === href || pathname.startsWith(href + '/');
}

export default function Sidebar() {
  const pathname = usePathname();
  const { logout } = useAuth();

  return (
    <aside className="w-64 h-screen bg-gray-900 text-gray-300 flex flex-col border-r border-gray-800">
      <div className="p-4 border-b border-gray-800 flex items-center gap-2.5">
        <Image src="/logo.png" alt="NivaTV" width={32} height={32} className="h-8 w-auto object-contain" />
        <div className="flex flex-col leading-none">
          <span
            className="text-base font-bold tracking-tight"
            style={{ fontFamily: 'var(--font-poppins)' }}
          >
            <span className="text-white">Niva</span>
            <span className="text-red-400">TV</span>
          </span>
          <span className="text-[10px] font-semibold text-gray-500 tracking-widest uppercase mt-0.5">Admin</span>
        </div>
      </div>
      <nav aria-label="Admin navigation" className="flex-1 overflow-y-auto p-2 space-y-5">
        {navSections.map((section) => (
          <div key={section.title}>
            <h2 className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-500">
              {section.title}
            </h2>
            <div className="space-y-1">
              {section.items.map((item) => {
                const active = isActivePath(pathname, item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                      active
                        ? 'bg-gray-800 text-white'
                        : 'hover:bg-gray-800 hover:text-white'
                    }`}
                  >
                    <Icon size={16} aria-hidden="true" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="p-3 border-t border-gray-800">
        <button
          onClick={logout}
          className="w-full px-3 py-2 rounded-md bg-red-600 text-white text-sm hover:bg-red-700 transition-colors"
        >
          Logout
        </button>
      </div>
    </aside>
  );
}
