'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Users, MonitorSmartphone, KeyRound, CreditCard, Globe, Zap,
  AlertTriangle, FileStack, Settings, Bell, BarChart3, ScrollText, Activity, Shield,
  Package, Globe2,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/users', label: 'Users', icon: Users },
  { href: '/devices', label: 'Devices', icon: MonitorSmartphone },
  { href: '/licenses', label: 'Licenses', icon: KeyRound },
  { href: '/plans', label: 'Plans', icon: CreditCard },
  { href: '/payments', label: 'Payments', icon: CreditCard },
  { href: '/channels', label: 'Channels', icon: Globe },
  { href: '/stream-scanner', label: 'Stream Scanner', icon: Zap },
  { href: '/broken-channels', label: 'Broken Channels', icon: AlertTriangle },
  { href: '/duplicate-channels', label: 'Duplicates', icon: FileStack },
  { href: '/categories', label: 'Categories', icon: FileStack },
  { href: '/languages', label: 'Languages', icon: Globe },
  { href: '/app-settings', label: 'App Settings', icon: Settings },
  { href: '/notifications', label: 'Notifications', icon: Bell },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/logs', label: 'Logs', icon: ScrollText },
  { href: '/system', label: 'System Health', icon: Activity },
  { href: '/admin-users', label: 'Admin Users', icon: Shield },
  { href: '/app-releases', label: 'App Releases', icon: Package },
  { href: '/website-settings', label: 'Website Settings', icon: Globe2 },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { logout } = useAuth();

  return (
    <aside className="w-64 h-screen bg-gray-900 text-gray-300 flex flex-col border-r border-gray-800">
      <div className="p-4 border-b border-gray-800">
        <h1 className="text-xl font-bold text-blue-500">NivaTV Admin</h1>
      </div>
      <nav className="flex-1 overflow-y-auto p-2 space-y-1">
        {navItems.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                active
                  ? 'bg-gray-800 text-white'
                  : 'hover:bg-gray-800 hover:text-white'
              }`}
            >
              <Icon size={16} />
              <span>{item.label}</span>
            </Link>
          );
        })}
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
