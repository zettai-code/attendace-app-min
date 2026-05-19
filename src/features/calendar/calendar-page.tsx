"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  CalendarDays,
  Briefcase,
  Clock,
  AlarmClock,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";

interface AttendanceRecord {
  readonly date: string;
  readonly hours: number;
}

interface Member {
  readonly id: string;
  readonly name: string;
  readonly email: string;
}

interface CalendarPageProps {
  readonly isAdmin?: boolean;
}

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"] as const;

function toDateKey(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function getCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const days: { day: number; currentMonth: boolean; key: string }[] = [];

  for (let i = firstDay - 1; i >= 0; i--) {
    const d = daysInPrevMonth - i;
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    days.push({ day: d, currentMonth: false, key: toDateKey(prevYear, prevMonth, d) });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    days.push({ day: d, currentMonth: true, key: toDateKey(year, month, d) });
  }

  const remaining = 7 - (days.length % 7);
  if (remaining < 7) {
    for (let d = 1; d <= remaining; d++) {
      const nextMonth = month === 11 ? 0 : month + 1;
      const nextYear = month === 11 ? year + 1 : year;
      days.push({ day: d, currentMonth: false, key: toDateKey(nextYear, nextMonth, d) });
    }
  }

  return days;
}

function calcHours(clockIn: string, clockOut: string | null): number {
  if (!clockOut) return 0;
  const diff = new Date(clockOut).getTime() - new Date(clockIn).getTime();
  return Math.round((diff / (1000 * 60 * 60)) * 10) / 10;
}

export function CalendarPage({ isAdmin = false }: CalendarPageProps) {
  const { user } = useAuth();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [records, setRecords] = useState<readonly AttendanceRecord[]>([]);
  const [members, setMembers] = useState<readonly Member[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const targetUserId = isAdmin && selectedMemberId ? selectedMemberId : user?.id;

  const getAccessToken = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }, []);

  const loadMembers = useCallback(async () => {
    if (!user || !isAdmin) return;

    const token = await getAccessToken();
    if (!token) return;

    try {
      const res = await fetch("/api/v1/admin/members", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const json = await res.json();
      setMembers(json.data ?? []);
    } catch (err) {
      console.error("Failed to load members:", err);
    }
  }, [user, isAdmin, getAccessToken]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const loadAttendances = useCallback(async () => {
    if (!targetUserId) return;
    setPageLoading(true);
    setError(null);

    const monthStr = `${year}-${String(month + 1).padStart(2, "0")}`;
    const start = new Date(`${monthStr}-01T00:00:00+09:00`).toISOString();
    const lastDay = new Date(year, month + 1, 0).getDate();
    const end = new Date(`${monthStr}-${String(lastDay).padStart(2, "0")}T23:59:59+09:00`).toISOString();

    try {
      if (isAdmin && selectedMemberId) {
        const token = await getAccessToken();
        if (!token) {
          setError("認証情報の取得に失敗しました");
          return;
        }

        const params = new URLSearchParams({ user_id: targetUserId, start, end });
        const res = await fetch(`/api/v1/admin/attendances?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          setError("出勤データの取得に失敗しました");
          return;
        }
        const json = await res.json();
        const mapped = (json.data ?? []).map((row: { clock_in: string; clock_out: string | null }) => ({
          date: new Date(row.clock_in).toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" }),
          hours: calcHours(row.clock_in, row.clock_out),
        }));
        setRecords(mapped);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from("attendances")
        .select("clock_in, clock_out")
        .eq("user_id", targetUserId)
        .is("deleted_at", null)
        .gte("clock_in", start)
        .lte("clock_in", end)
        .order("clock_in", { ascending: true });

      if (fetchError) {
        setError("出勤データの取得に失敗しました");
        return;
      }

      const mapped = (data ?? []).map((row) => {
        const jstDate = new Date(row.clock_in).toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
        return {
          date: jstDate,
          hours: calcHours(row.clock_in, row.clock_out),
        };
      });
      setRecords(mapped);
    } catch {
      setError("出勤データの取得に失敗しました");
    } finally {
      setPageLoading(false);
    }
  }, [targetUserId, year, month, isAdmin, selectedMemberId, getAccessToken]);

  useEffect(() => {
    loadAttendances();
  }, [loadAttendances]);

  const attendanceMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of records) {
      map.set(r.date, (map.get(r.date) ?? 0) + r.hours);
    }
    return map;
  }, [records]);

  const days = useMemo(() => getCalendarDays(year, month), [year, month]);

  const todayKey = useMemo(() => {
    const t = new Date();
    return toDateKey(t.getFullYear(), t.getMonth(), t.getDate());
  }, []);

  const monthlyStats = useMemo(() => {
    let totalDays = 0;
    let totalHours = 0;
    let overtimeHours = 0;
    for (const [, hours] of attendanceMap) {
      totalDays++;
      totalHours += hours;
      if (hours > 8) {
        overtimeHours += hours - 8;
      }
    }
    return {
      totalDays,
      totalHours: Math.round(totalHours * 10) / 10,
      overtimeHours: Math.round(overtimeHours * 10) / 10,
    };
  }, [attendanceMap]);

  const handlePrevMonth = () => {
    if (month === 0) {
      setYear(year - 1);
      setMonth(11);
    } else {
      setMonth(month - 1);
    }
  };

  const handleNextMonth = () => {
    if (month === 11) {
      setYear(year + 1);
      setMonth(0);
    } else {
      setMonth(month + 1);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <CalendarDays className="h-6 w-6 text-blue-900" />
        <h1 className="text-2xl font-bold text-gray-900">カレンダー</h1>
      </div>

      {isAdmin && (
        <div className="mx-auto max-w-xl mb-6">
          <label
            htmlFor="member-select"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            メンバー選択
          </label>
          <select
            id="member-select"
            value={selectedMemberId ?? ""}
            onChange={(e) => setSelectedMemberId(e.target.value || null)}
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-colors bg-white"
          >
            <option value="">自分</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}（{m.email}）
              </option>
            ))}
          </select>
        </div>
      )}

      {pageLoading ? (
        <div className="flex items-center justify-center py-20">
          <p className="text-gray-400">読み込み中...</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <AlertCircle className="h-8 w-8 text-red-400" />
          <p className="text-red-600 text-sm">{error}</p>
          <button
            type="button"
            onClick={loadAttendances}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            再読み込み
          </button>
        </div>
      ) : (
      <div className="mx-auto max-w-xl flex flex-col items-center gap-8">
        {/* 月間カレンダー */}
        <div className="w-full rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          {/* ヘッダー: 月切替 */}
          <div className="flex items-center justify-between mb-6">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="rounded-lg p-2 hover:bg-gray-100 transition-colors"
            >
              <ChevronLeft className="h-5 w-5 text-gray-600" />
            </button>
            <h2 className="text-lg font-bold text-gray-900">
              {year}年{month + 1}月
            </h2>
            <button
              type="button"
              onClick={handleNextMonth}
              className="rounded-lg p-2 hover:bg-gray-100 transition-colors"
            >
              <ChevronRight className="h-5 w-5 text-gray-600" />
            </button>
          </div>

          {/* 曜日ヘッダー */}
          <div className="grid grid-cols-7 mb-2">
            {WEEKDAYS.map((wd, i) => (
              <div
                key={wd}
                className={`text-center text-sm font-medium py-2 ${
                  i === 0 ? "text-red-400" : i === 6 ? "text-blue-400" : "text-gray-400"
                }`}
              >
                {wd}
              </div>
            ))}
          </div>

          {/* 日付グリッド */}
          <div className="grid grid-cols-7">
            {days.map((d, i) => {
              const isAttended = d.currentMonth && attendanceMap.has(d.key);
              const isToday = d.key === todayKey;
              const dayOfWeek = i % 7;

              return (
                <div
                  key={`${d.key}-${d.currentMonth}`}
                  className="flex flex-col items-center justify-center py-2"
                >
                  <div
                    className={`relative flex h-10 w-10 items-center justify-center rounded-full text-sm ${
                      !d.currentMonth
                        ? "text-gray-300"
                        : isToday
                          ? "bg-blue-100 font-bold text-blue-700"
                          : dayOfWeek === 0
                            ? "text-red-500"
                            : dayOfWeek === 6
                              ? "text-blue-500"
                              : "text-gray-700"
                    }`}
                  >
                    {d.day}
                  </div>
                  {/* 出勤ドット */}
                  <span
                    className={`mt-1 h-1.5 w-1.5 rounded-full ${
                      isAttended ? "bg-green-500" : "bg-transparent"
                    }`}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* 凡例 */}
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-500" />
          出勤日
        </div>

        {/* データ0件 */}
        {records.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-4">
            データがありません
          </p>
        )}

        {/* 月間サマリー */}
        <div className="w-full grid grid-cols-3 gap-2 sm:gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-3 rounded-xl border border-gray-200 bg-white p-3 sm:p-5 shadow-sm text-center sm:text-left">
            <Briefcase className="h-5 w-5 text-blue-600 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-gray-500">出勤日数</p>
              <p className="text-lg sm:text-2xl font-bold text-gray-900">
                {monthlyStats.totalDays}
                <span className="text-xs sm:text-sm font-normal text-gray-500 ml-0.5">日</span>
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-3 rounded-xl border border-gray-200 bg-white p-3 sm:p-5 shadow-sm text-center sm:text-left">
            <Clock className="h-5 w-5 text-blue-600 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-gray-500">勤務時間</p>
              <p className="text-lg sm:text-2xl font-bold text-gray-900">
                {monthlyStats.totalHours}
                <span className="text-xs sm:text-sm font-normal text-gray-500 ml-0.5">h</span>
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-3 rounded-xl border border-gray-200 bg-white p-3 sm:p-5 shadow-sm text-center sm:text-left">
            <AlarmClock className="h-5 w-5 text-orange-600 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-gray-500">残業</p>
              <p className="text-lg sm:text-2xl font-bold text-orange-600">
                {monthlyStats.overtimeHours}
                <span className="text-xs sm:text-sm font-normal text-gray-500 ml-0.5">h</span>
              </p>
            </div>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
