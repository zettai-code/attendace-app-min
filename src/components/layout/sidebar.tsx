"use client";

import {
  Clock,
  CalendarClock,
  CalendarDays,
  FileText,
  LayoutDashboard,
  UserCircle,
  ShieldCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type MenuKey =
  | "attendance"
  | "shift"
  | "calendar"
  | "daily-report"
  | "dashboard"
  | "account";

interface MenuItem {
  readonly key: MenuKey;
  readonly label: string;
  readonly icon: LucideIcon;
}

const menuItems: readonly MenuItem[] = [
  { key: "attendance", label: "打刻", icon: Clock },
  { key: "shift", label: "シフト申請", icon: CalendarClock },
  { key: "calendar", label: "カレンダー", icon: CalendarDays },
  { key: "daily-report", label: "日報", icon: FileText },
  { key: "dashboard", label: "ダッシュボード", icon: LayoutDashboard },
  { key: "account", label: "アカウント", icon: UserCircle },
] as const;

interface SidebarProps {
  readonly activeMenu: MenuKey;
  readonly onMenuSelect: (key: MenuKey) => void;
  readonly isAdmin?: boolean;
}

export function Sidebar({ activeMenu, onMenuSelect, isAdmin }: SidebarProps) {
  return (
    <aside className="fixed left-0 top-0 h-full w-16 sm:w-[260px] bg-blue-900 text-white flex flex-col transition-all">
      <div className="flex items-center gap-3 px-3 sm:px-6 py-6 justify-center sm:justify-start">
        <Clock className="h-7 w-7 shrink-0" />
        <span className="text-xl font-bold tracking-tight hidden sm:inline">勤怠管理</span>
      </div>

      <nav className="flex flex-col gap-1 px-1.5 sm:px-3 mt-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeMenu === item.key;

          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onMenuSelect(item.key)}
              title={item.label}
              className={`flex items-center gap-3 rounded-md px-3 sm:px-4 py-3 text-sm font-medium transition-colors justify-center sm:justify-start ${
                isActive
                  ? "bg-blue-700 text-white"
                  : "text-blue-100 hover:bg-blue-800 hover:text-white"
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="hidden sm:inline">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {isAdmin && (
        <div className="mt-auto px-1.5 sm:px-3 pb-6">
          <p className="text-xs text-blue-300 mb-2 hidden sm:block px-4">管理者メニュー</p>
          <a
            href="/admin/shifts"
            title="シフト承認"
            className="flex items-center gap-3 rounded-md px-3 sm:px-4 py-3 text-sm font-medium text-blue-100 hover:bg-blue-800 hover:text-white transition-colors justify-center sm:justify-start"
          >
            <ShieldCheck className="h-5 w-5 shrink-0" />
            <span className="hidden sm:inline">シフト承認</span>
          </a>
        </div>
      )}
    </aside>
  );
}
