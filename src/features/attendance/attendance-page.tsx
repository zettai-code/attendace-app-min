"use client";

import { useState, useEffect, useCallback } from "react";
import { Clock, LogIn, LogOut, AlertCircle } from "lucide-react";
import { useCurrentTime } from "@/hooks/use-current-time";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";

type WorkStatus = "not-started" | "working" | "finished";

interface StatusConfig {
  readonly label: string;
  readonly color: string;
  readonly bg: string;
}

const STATUS_MAP: Record<WorkStatus, StatusConfig> = {
  "not-started": {
    label: "未出勤",
    color: "text-gray-600",
    bg: "bg-gray-100",
  },
  working: {
    label: "勤務中",
    color: "text-green-700",
    bg: "bg-green-50",
  },
  finished: {
    label: "退勤済",
    color: "text-blue-700",
    bg: "bg-blue-50",
  },
};

function toJSTString(date: Date): string {
  return date.toLocaleTimeString("ja-JP", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function formatDateJST(date: Date): string {
  return date.toLocaleDateString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });
}

function getTodayRangeUTC(): { start: string; end: string } {
  const now = new Date();
  const jstOffset = 9 * 60 * 60 * 1000;
  const jstNow = new Date(now.getTime() + jstOffset);
  const jstDateStr = jstNow.toISOString().slice(0, 10);
  const start = new Date(`${jstDateStr}T00:00:00+09:00`).toISOString();
  const end = new Date(`${jstDateStr}T23:59:59+09:00`).toISOString();
  return { start, end };
}

export function AttendancePage() {
  const { user } = useAuth();
  const [status, setStatus] = useState<WorkStatus>("not-started");
  const [clockInTime, setClockInTime] = useState<string | null>(null);
  const [clockOutTime, setClockOutTime] = useState<string | null>(null);
  const [recordId, setRecordId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const now = useCurrentTime();

  const statusConfig = STATUS_MAP[status];

  const loadTodayRecord = useCallback(async () => {
    if (!user) return;
    setPageLoading(true);
    setError(null);
    try {
      const { start, end } = getTodayRangeUTC();
      const { data, error: fetchError } = await supabase
        .from("attendances")
        .select("id, clock_in, clock_out")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .gte("clock_in", start)
        .lte("clock_in", end)
        .order("clock_in", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fetchError) {
        setError("打刻データの取得に失敗しました");
        return;
      }

      if (data) {
        setRecordId(data.id);
        setClockInTime(data.clock_in);
        if (data.clock_out) {
          setClockOutTime(data.clock_out);
          setStatus("finished");
        } else {
          setStatus("working");
        }
      }
    } catch {
      setError("打刻データの取得に失敗しました");
    } finally {
      setPageLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadTodayRecord();
  }, [loadTodayRecord]);

  const handleClockIn = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const nowISO = new Date().toISOString();
      const { data, error } = await supabase
        .from("attendances")
        .insert({ user_id: user.id, clock_in: nowISO })
        .select("id, clock_in")
        .single();

      if (error) {
        alert("出勤の記録に失敗しました");
        return;
      }

      setRecordId(data.id);
      setClockInTime(data.clock_in);
      setClockOutTime(null);
      setStatus("working");
    } catch {
      alert("出勤の記録に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const handleClockOut = async () => {
    if (!recordId) return;
    setLoading(true);
    try {
      const nowISO = new Date().toISOString();
      const { data, error } = await supabase
        .from("attendances")
        .update({ clock_out: nowISO })
        .eq("id", recordId)
        .select("clock_out")
        .single();

      if (error) {
        alert("退勤の記録に失敗しました");
        return;
      }

      setClockOutTime(data.clock_out);
      setStatus("finished");
    } catch {
      alert("退勤の記録に失敗しました");
    } finally {
      setLoading(false);
    }
  };

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
          onClick={loadTodayRecord}
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
        <Clock className="h-6 w-6 text-blue-900" />
        <h1 className="text-2xl font-bold text-gray-900">打刻</h1>
      </div>

      <div className="mx-auto max-w-lg flex flex-col items-center gap-10">
        {/* 現在時刻 */}
        <div className="text-center">
          <p className="text-sm text-gray-500 mb-1">
            {now ? formatDateJST(now) : "\u00A0"}
          </p>
          <p className="text-6xl font-bold tracking-tight text-gray-900 tabular-nums">
            {now ? toJSTString(now) : "--:--:--"}
          </p>
        </div>

        {/* 勤務状態 */}
        <div
          className={`w-full rounded-xl px-6 py-5 text-center ${statusConfig.bg}`}
        >
          <p className="text-sm text-gray-500 mb-1">現在の勤務状態</p>
          <p className={`text-3xl font-bold ${statusConfig.color}`}>
            {statusConfig.label}
          </p>
          {clockInTime && (
            <p className="text-sm text-gray-500 mt-3">
              出勤: {toJSTString(new Date(clockInTime))}
              {clockOutTime &&
                ` — 退勤: ${toJSTString(new Date(clockOutTime))}`}
            </p>
          )}
        </div>

        {/* 出勤・退勤ボタン */}
        <div className="w-full grid grid-cols-2 gap-6">
          <button
            type="button"
            onClick={handleClockIn}
            disabled={status === "working" || loading}
            className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-green-600 px-6 py-8 text-white font-bold text-xl shadow-lg transition-all hover:bg-green-700 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
          >
            <LogIn className="h-8 w-8" />
            出勤
          </button>

          <button
            type="button"
            onClick={handleClockOut}
            disabled={status !== "working" || loading}
            className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-red-600 px-6 py-8 text-white font-bold text-xl shadow-lg transition-all hover:bg-red-700 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
          >
            <LogOut className="h-8 w-8" />
            退勤
          </button>
        </div>
      </div>
    </div>
  );
}
