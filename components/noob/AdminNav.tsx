"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { User } from "firebase/auth";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Gift,
  Youtube,
  ScanLine,
  DollarSign,
  Bell,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  Shield,
  LogOut,
  Home,
  Package,
  Zap,
} from "lucide-react";

interface AdminNavProps {
  user: User | null;
  onLogout: () => void;
}

const navItems = [
  { href: "/noob", label: "Dashboard", icon: LayoutDashboard },
  { href: "/noob/users", label: "Users", icon: Users },
  { href: "/noob/plans", label: "Plans", icon: Package },
  { href: "/noob/subscriptions", label: "Subscriptions", icon: CreditCard },
  { href: "/noob/referrals", label: "Referrals", icon: Gift },
  { href: "/noob/channels", label: "Channels", icon: Youtube },
  { href: "/noob/scans", label: "Scans", icon: ScanLine },
  { href: "/noob/auto-scan", label: "Auto-Scan", icon: Zap },
  { href: "/noob/payments", label: "Payments", icon: DollarSign },
  { href: "/noob/notifications", label: "Notifications", icon: Bell },
  { href: "/noob/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/noob/settings", label: "Settings", icon: Settings },
];

export default function AdminNav({ user, onLogout }: AdminNavProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const isActive = (href: string) => {
    if (href === "/noob") return pathname === "/noob";
    return pathname.startsWith(href);
  };

  return (
    <div
      className={`bg-gray-900 text-white min-h-screen flex flex-col transition-all duration-300 ${
        collapsed ? "w-16" : "w-64"
      }`}
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center justify-between">
          {!collapsed && (
            <div className="flex items-center space-x-2">
              <Shield className="w-8 h-8 text-primary-500" />
              <span className="font-bold text-lg">Admin Panel</span>
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            {collapsed ? (
              <ChevronRight className="w-5 h-5" />
            ) : (
              <ChevronLeft className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 py-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center px-4 py-3 mx-2 mb-1 rounded-lg transition-all duration-200 ${
                active
                  ? "bg-primary-600 text-white"
                  : "text-gray-400 hover:bg-gray-800 hover:text-white"
              }`}
              title={collapsed ? item.label : undefined}
            >
              <Icon className={`w-5 h-5 ${collapsed ? "" : "mr-3"}`} />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Return to App Link */}
      <div className="border-t border-gray-800 p-2">
        <Link
          href="/dashboard"
          className="flex items-center px-4 py-3 mx-2 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition-all duration-200"
          title={collapsed ? "Return to App" : undefined}
        >
          <Home className={`w-5 h-5 ${collapsed ? "" : "mr-3"}`} />
          {!collapsed && <span>Return to App</span>}
        </Link>
      </div>

      {/* User Info & Logout */}
      <div className="border-t border-gray-800 p-4">
        {!collapsed && user && (
          <div className="mb-3">
            <p className="text-sm font-medium truncate">
              {user.displayName || "Admin"}
            </p>
            <p className="text-xs text-gray-500 truncate">{user.email}</p>
          </div>
        )}
        <button
          onClick={onLogout}
          className="flex items-center w-full px-4 py-2 text-red-400 hover:bg-red-900/30 rounded-lg transition-all duration-200"
          title={collapsed ? "Logout" : undefined}
        >
          <LogOut className={`w-5 h-5 ${collapsed ? "" : "mr-3"}`} />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </div>
  );
}
