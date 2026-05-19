"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";
import { AuthPage } from "@/features/auth/auth-page";
import { Sidebar, type MenuKey } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { AuthSection } from "@/components/layout/auth-section";
import { AttendancePage } from "@/features/attendance/attendance-page";
import { ShiftPage } from "@/features/shift/shift-page";
import { CalendarPage } from "@/features/calendar/calendar-page";
import { DailyReportPage } from "@/features/daily-report/daily-report-page";
import { DashboardPage } from "@/features/dashboard/dashboard-page";

const pages: Record<Exclude<MenuKey, "account">, React.ComponentType<{ isAdmin?: boolean }>> = {
  attendance: AttendancePage,
  shift: ShiftPage,
  calendar: CalendarPage,
  "daily-report": DailyReportPage,
  dashboard: DashboardPage,
};

export default function Home() {
  const { user, loading } = useAuth();
  const [activeMenu, setActiveMenu] = useState<MenuKey>("attendance");
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        setIsAdmin(data?.role === "admin");
      });
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-400">読み込み中...</p>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar activeMenu={activeMenu} onMenuSelect={setActiveMenu} isAdmin={isAdmin} />
      <main className="ml-16 sm:ml-[260px] flex-1 p-4 sm:p-6 lg:p-8 bg-gray-50">
        <Header email={user.email ?? ""} />
        {activeMenu === "account" ? (
          <AuthSection user={user} />
        ) : (
          (() => {
            const ActivePage = pages[activeMenu];
            return <ActivePage isAdmin={isAdmin} />;
          })()
        )}
      </main>
    </div>
  );
}
