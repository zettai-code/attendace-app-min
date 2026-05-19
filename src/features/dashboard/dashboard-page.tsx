"use client";

import { useState, useEffect, useCallback } from "react";
import {
  LayoutDashboard,
  Briefcase,
  CalendarClock,
  ClipboardList,
  Clock,
  Users,
  UserX,
  TrendingUp,
  AlertCircle,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";

interface StatCardProps {
  readonly icon: React.ReactNode;
  readonly label: string;
  readonly value: number;
  readonly unit: string;
  readonly color: string;
  readonly bgColor: string;
}

interface MemberInfo {
  readonly id: string;
  readonly name: string;
  readonly email: string;
}

interface PendingShift {
  readonly id: string;
  readonly user_id: string;
  readonly date: string;
  readonly start_time: string | null;
  readonly end_time: string | null;
  readonly created_at: string;
  readonly profiles: { name: string; email: string } | null;
}

interface MemberSummary {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly attendanceDays: number;
  readonly totalHours: number;
  readonly overtimeHours: number;
}

interface AdminStats {
  readonly todayAttendedCount: number;
  readonly attendedMembers: readonly MemberInfo[];
  readonly absentMembers: readonly MemberInfo[];
  readonly totalMemberCount: number;
  readonly avgMonthlyHours: number;
  readonly pendingShifts: readonly PendingShift[];
  readonly pendingCount: number;
  readonly memberSummaries: readonly MemberSummary[];
}

interface DashboardPageProps {
  readonly isAdmin?: boolean;
}

function StatCard({ icon, label, value, unit, color, bgColor }: StatCardProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 sm:p-5 shadow-sm min-w-0">
      <div className="flex items-center gap-2 sm:gap-4">
        <div className={`flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl shrink-0 ${bgColor}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs sm:text-sm text-gray-500 truncate">{label}</p>
          <p className="text-lg sm:text-2xl font-bold" style={{ color }}>
            {value}
            <span className="text-xs sm:text-sm font-normal text-gray-500 ml-1">{unit}</span>
          </p>
        </div>
      </div>
    </div>
  );
}

function getThisMonthRange(): { start: string; end: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const monthStr = `${y}-${String(m + 1).padStart(2, "0")}`;
  const lastDay = new Date(y, m + 1, 0).getDate();
  const start = new Date(`${monthStr}-01T00:00:00+09:00`).toISOString();
  const end = new Date(`${monthStr}-${String(lastDay).padStart(2, "0")}T23:59:59+09:00`).toISOString();
  return { start, end };
}

export function DashboardPage({ isAdmin = false }: DashboardPageProps) {
  const { user } = useAuth();
  const [attendanceDays, setAttendanceDays] = useState(0);
  const [totalHours, setTotalHours] = useState(0);
  const [overtimeHours, setOvertimeHours] = useState(0);
  const [shiftRequestCount, setShiftRequestCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const now = new Date();
  const monthLabel = `${now.getFullYear()}年${now.getMonth() + 1}月`;

  const loadStats = useCallback(async () => {
    if (!user) return;
    setPageLoading(true);
    setError(null);

    const { start, end } = getThisMonthRange();

    const [attendResult, shiftAllResult, shiftPendingResult] = await Promise.all([
      supabase
        .from("attendances")
        .select("clock_in, clock_out")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .gte("clock_in", start)
        .lte("clock_in", end),
      supabase
        .from("shifts")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .gte("created_at", start)
        .lte("created_at", end),
      supabase
        .from("shifts")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending")
        .is("deleted_at", null),
    ]);

    if (attendResult.error && shiftAllResult.error) {
      setError("ダッシュボードの取得に失敗しました");
      setPageLoading(false);
      return;
    }

    if (!attendResult.error && attendResult.data) {
      const days = new Set<string>();
      let hours = 0;
      let overtime = 0;
      for (const row of attendResult.data) {
        const dateKey = new Date(row.clock_in).toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
        days.add(dateKey);
        if (row.clock_out) {
          const h = (new Date(row.clock_out).getTime() - new Date(row.clock_in).getTime()) / (1000 * 60 * 60);
          hours += h;
          if (h > 8) overtime += h - 8;
        }
      }
      setAttendanceDays(days.size);
      setTotalHours(Math.round(hours * 10) / 10);
      setOvertimeHours(Math.round(overtime * 10) / 10);
    }

    if (!shiftAllResult.error) {
      setShiftRequestCount(shiftAllResult.count ?? 0);
    }

    if (!shiftPendingResult.error) {
      setPendingCount(shiftPendingResult.count ?? 0);
    }

    setPageLoading(false);
  }, [user]);

  const loadAdminStats = useCallback(async () => {
    if (!user || !isAdmin) return;

    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    if (!token) return;

    try {
      const res = await fetch("/api/v1/admin/dashboard", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const json = await res.json();
      setAdminStats(json.data);
    } catch (err) {
      console.error("Failed to load admin stats:", err);
    }
  }, [user, isAdmin]);

  useEffect(() => {
    loadStats();
    loadAdminStats();
  }, [loadStats, loadAdminStats]);

  if (pageLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-gray-400">読み込み中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <AlertCircle className="h-8 w-8 text-red-400" />
        <p className="text-red-600 text-sm">{error}</p>
        <button
          type="button"
          onClick={loadStats}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          再読み込み
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <LayoutDashboard className="h-6 w-6 text-blue-900" />
        <h1 className="text-2xl font-bold text-gray-900">ダッシュボード</h1>
      </div>

      <div className="mx-auto max-w-3xl flex flex-col gap-8">
        {/* 自分のサマリー */}
        <section>
          <h2 className="text-sm font-medium text-gray-400 mb-3">
            {monthLabel} のサマリー
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <StatCard
              icon={<Briefcase className="h-6 w-6 text-blue-600" />}
              label="出勤日数"
              value={attendanceDays}
              unit="日"
              color="#2563eb"
              bgColor="bg-blue-50"
            />
            <StatCard
              icon={<Clock className="h-6 w-6 text-orange-600" />}
              label="合計勤務時間"
              value={totalHours}
              unit="時間"
              color="#ea580c"
              bgColor="bg-orange-50"
            />
            <StatCard
              icon={<TrendingUp className="h-6 w-6 text-red-600" />}
              label="残業時間"
              value={overtimeHours}
              unit="時間"
              color="#dc2626"
              bgColor="bg-red-50"
            />
            <StatCard
              icon={<CalendarClock className="h-6 w-6 text-green-600" />}
              label="シフト申請数"
              value={shiftRequestCount}
              unit="件"
              color="#16a34a"
              bgColor="bg-green-50"
            />
          </div>
        </section>

        {/* admin: チーム全体の情報 */}
        {isAdmin && adminStats && (
          <>
            {/* 本日の出勤状況 */}
            <section>
              <h2 className="text-sm font-medium text-gray-400 mb-3">
                本日の出勤状況
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-4">
                <StatCard
                  icon={<Users className="h-6 w-6 text-blue-600" />}
                  label="出勤者数"
                  value={adminStats.todayAttendedCount}
                  unit={`/ ${adminStats.totalMemberCount}人`}
                  color="#2563eb"
                  bgColor="bg-blue-50"
                />
                <StatCard
                  icon={<UserX className="h-6 w-6 text-gray-500" />}
                  label="未出勤者数"
                  value={adminStats.absentMembers.length}
                  unit="人"
                  color="#6b7280"
                  bgColor="bg-gray-100"
                />
              </div>

              {adminStats.absentMembers.length > 0 && (
                <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">未出勤者リスト</h3>
                  <div className="flex flex-wrap gap-2">
                    {adminStats.absentMembers.map((m) => (
                      <span
                        key={m.id}
                        className="inline-block rounded-full bg-gray-100 text-gray-600 text-xs font-medium px-3 py-1.5"
                      >
                        {m.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* 未処理の承認リクエスト */}
            <section>
              <h2 className="text-sm font-medium text-gray-400 mb-3">
                未処理の承認リクエスト（{adminStats.pendingCount}件）
              </h2>
              {adminStats.pendingCount === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">
                  未処理のリクエストはありません
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {adminStats.pendingShifts.map((shift) => {
                    const profile = shift.profiles as { name: string; email: string } | null;
                    return (
                      <div
                        key={shift.id}
                        className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-block rounded-full bg-blue-100 text-blue-700 text-xs font-medium px-2.5 py-0.5">
                            {profile?.name ?? "不明"}
                          </span>
                          <span className="text-sm text-gray-700">{shift.date}</span>
                          {shift.start_time && shift.end_time && (
                            <span className="text-xs text-gray-400">
                              {shift.start_time} - {shift.end_time}
                            </span>
                          )}
                        </div>
                        <span className="self-start sm:self-auto rounded-full bg-yellow-100 text-yellow-700 text-xs font-medium px-2.5 py-0.5">
                          承認待ち
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* チーム稼働サマリー */}
            <section>
              <h2 className="text-sm font-medium text-gray-400 mb-3">
                {monthLabel} チーム稼働サマリー
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-4">
                <StatCard
                  icon={<Users className="h-6 w-6 text-green-600" />}
                  label="メンバー数"
                  value={adminStats.totalMemberCount}
                  unit="人"
                  color="#16a34a"
                  bgColor="bg-green-50"
                />
                <StatCard
                  icon={<Clock className="h-6 w-6 text-purple-600" />}
                  label="平均労働時間"
                  value={adminStats.avgMonthlyHours}
                  unit="時間"
                  color="#9333ea"
                  bgColor="bg-purple-50"
                />
              </div>

              {/* メンバー別サマリー */}
              <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-x-auto">
                <table className="w-full text-sm min-w-0">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="text-left px-3 sm:px-5 py-3 font-medium text-gray-500">メンバー</th>
                      <th className="text-right px-2 sm:px-5 py-3 font-medium text-gray-500 whitespace-nowrap">出勤</th>
                      <th className="text-right px-2 sm:px-5 py-3 font-medium text-gray-500 whitespace-nowrap">勤務</th>
                      <th className="text-right px-3 sm:px-5 py-3 font-medium text-gray-500 whitespace-nowrap">残業</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminStats.memberSummaries.map((m) => (
                      <tr key={m.id} className="border-b border-gray-100 last:border-0">
                        <td className="px-3 sm:px-5 py-3">
                          <span className="font-medium text-gray-900">{m.name}</span>
                          <span className="text-xs text-gray-400 ml-1 hidden sm:inline">{m.email}</span>
                        </td>
                        <td className="text-right px-2 sm:px-5 py-3 text-gray-700 whitespace-nowrap">{m.attendanceDays}日</td>
                        <td className="text-right px-2 sm:px-5 py-3 text-gray-700 whitespace-nowrap">{m.totalHours}h</td>
                        <td className="text-right px-3 sm:px-5 py-3 whitespace-nowrap">
                          <span className={m.overtimeHours > 0 ? "text-red-600 font-medium" : "text-gray-400"}>
                            {m.overtimeHours}h
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
