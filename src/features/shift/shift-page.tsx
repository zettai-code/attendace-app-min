"use client";

import { useState, useEffect, useCallback } from "react";
import { CalendarClock, AlertCircle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";

type RequestStatus = "pending" | "approved" | "rejected";

interface ShiftRequest {
  readonly id: string;
  readonly date: string;
  readonly start_time: string;
  readonly end_time: string;
  readonly status: RequestStatus;
  readonly reject_reason: string | null;
  readonly created_at: string;
}

interface StatusConfig {
  readonly label: string;
  readonly textColor: string;
  readonly bgColor: string;
}

const STATUS_MAP: Record<RequestStatus, StatusConfig> = {
  pending: {
    label: "申請中",
    textColor: "text-orange-700",
    bgColor: "bg-orange-100",
  },
  approved: {
    label: "承認",
    textColor: "text-green-700",
    bgColor: "bg-green-100",
  },
  rejected: {
    label: "却下",
    textColor: "text-red-700",
    bgColor: "bg-red-100",
  },
};

function StatusBadge({ status }: { readonly status: RequestStatus }) {
  const config = STATUS_MAP[status];
  return (
    <span
      className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${config.bgColor} ${config.textColor}`}
    >
      {config.label}
    </span>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" });
}

function formatTimeShort(time: string): string {
  return time.slice(0, 5);
}

export function ShiftPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<readonly ShiftRequest[]>([]);
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRequests = useCallback(async () => {
    if (!user) return;
    setPageLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from("shifts")
        .select("id, date, start_time, end_time, status, reject_reason, created_at")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (fetchError) {
        setError("シフト申請の取得に失敗しました");
        return;
      }
      setRequests(data ?? []);
    } catch {
      setError("シフト申請の取得に失敗しました");
    } finally {
      setPageLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!date || !startTime || !endTime) {
      alert("全ての項目を入力してください。");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from("shifts").insert({
        user_id: user.id,
        date,
        start_time: startTime,
        end_time: endTime,
      });

      if (error) {
        alert(`申請に失敗しました: ${error.message}`);
        return;
      }

      setDate("");
      setStartTime("");
      setEndTime("");
      await loadRequests();
    } catch {
      alert("申請に失敗しました");
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
          onClick={loadRequests}
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
        <CalendarClock className="h-6 w-6 text-blue-900" />
        <h1 className="text-2xl font-bold text-gray-900">シフト申請</h1>
      </div>

      <div className="mx-auto max-w-2xl flex flex-col gap-10">
        {/* 申請フォーム */}
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-5">新規申請</h2>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label htmlFor="shift-date" className="block text-sm font-medium text-gray-700 mb-1">
                希望日
              </label>
              <input
                id="shift-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-colors"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="shift-start" className="block text-sm font-medium text-gray-700 mb-1">
                  開始時刻
                </label>
                <input
                  id="shift-start"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-colors"
                />
              </div>
              <div>
                <label htmlFor="shift-end" className="block text-sm font-medium text-gray-700 mb-1">
                  終了時刻
                </label>
                <input
                  id="shift-end"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  required
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-1 w-full rounded-lg bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-blue-700 active:scale-[0.98] disabled:opacity-40"
            >
              申請する
            </button>
          </form>
        </section>

        {/* 申請履歴一覧 */}
        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-4">申請履歴</h2>
          {requests.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">
              データがありません
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {requests.map((req) => (
                <div
                  key={req.id}
                  className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-semibold text-gray-900">
                          {req.date}
                        </span>
                        <span className="text-sm text-gray-500">
                          {formatTimeShort(req.start_time)} - {formatTimeShort(req.end_time)}
                        </span>
                      </div>
                      {req.status === "rejected" && req.reject_reason && (
                        <p className="mt-2 text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">
                          却下理由: {req.reject_reason}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <StatusBadge status={req.status} />
                      <span className="text-xs text-gray-400">
                        {formatDate(req.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
