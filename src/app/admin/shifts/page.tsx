"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";

type RequestStatus = "pending" | "approved" | "rejected";

interface ShiftWithUser {
  readonly id: string;
  readonly date: string;
  readonly start_time: string;
  readonly end_time: string;
  readonly status: RequestStatus;
  readonly reject_reason: string | null;
  readonly created_at: string;
  readonly profiles: {
    readonly name: string;
    readonly email: string;
  };
}

interface StatusConfig {
  readonly label: string;
  readonly textColor: string;
  readonly bgColor: string;
}

const STATUS_MAP: Record<RequestStatus, StatusConfig> = {
  pending: { label: "申請中", textColor: "text-orange-700", bgColor: "bg-orange-100" },
  approved: { label: "承認", textColor: "text-green-700", bgColor: "bg-green-100" },
  rejected: { label: "却下", textColor: "text-red-700", bgColor: "bg-red-100" },
};

function StatusBadge({ status }: { readonly status: RequestStatus }) {
  const config = STATUS_MAP[status];
  return (
    <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${config.bgColor} ${config.textColor}`}>
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

export default function AdminShiftsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [shifts, setShifts] = useState<readonly ShiftWithUser[]>([]);
  const [role, setRole] = useState<string | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/");
      return;
    }

    supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()
      .then(({ data, error }) => {
        if (error || data?.role !== "admin") {
          router.replace("/");
          return;
        }
        setRole(data.role);
      });
  }, [user, authLoading, router]);

  const loadShifts = useCallback(async () => {
    if (role !== "admin") return;
    const { data, error } = await supabase
      .from("shifts")
      .select("id, date, start_time, end_time, status, reject_reason, created_at, profiles!shifts_user_id_fkey(name, email)")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to load shifts:", error);
      return;
    }
    setShifts((data as unknown as ShiftWithUser[]) ?? []);
    setPageLoading(false);
  }, [role]);

  useEffect(() => {
    loadShifts();
  }, [loadShifts]);

  const handleApprove = async (id: string) => {
    if (!window.confirm("本当に承認しますか？")) return;
    if (!user) return;

    setActionLoading(id);
    try {
      const { error } = await supabase
        .from("shifts")
        .update({ status: "approved", approved_by: user.id })
        .eq("id", id);

      if (error) {
        console.error("Approve failed:", error);
        alert("承認に失敗しました");
        return;
      }
      await loadShifts();
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: string) => {
    if (!window.confirm("本当に却下しますか？")) return;
    if (!user) return;

    const reason = window.prompt("却下理由を入力してください");
    if (reason === null) return;

    setActionLoading(id);
    try {
      const { error } = await supabase
        .from("shifts")
        .update({
          status: "rejected",
          reject_reason: reason || null,
          approved_by: user.id,
        })
        .eq("id", id);

      if (error) {
        console.error("Reject failed:", error);
        alert("却下に失敗しました");
        return;
      }
      await loadShifts();
    } finally {
      setActionLoading(null);
    }
  };

  if (authLoading || pageLoading || role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-400">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <CalendarClock className="h-6 w-6 text-blue-900" />
            <h1 className="text-2xl font-bold text-gray-900">シフト申請管理</h1>
          </div>
          <a
            href="/"
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            ← 戻る
          </a>
        </div>

        {shifts.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-12">シフト申請はまだありません</p>
        ) : (
          <div className="flex flex-col gap-3">
            {shifts.map((shift) => {
              const isPending = shift.status === "pending";
              const isActioning = actionLoading === shift.id;

              return (
                <div
                  key={shift.id}
                  className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="text-sm font-bold text-blue-700 bg-blue-50 rounded-md px-2 py-0.5">
                          {shift.profiles.name || shift.profiles.email}
                        </span>
                        <StatusBadge status={shift.status} />
                      </div>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="font-semibold text-gray-900">
                          {shift.date}
                        </span>
                        <span className="text-sm text-gray-500">
                          {formatTimeShort(shift.start_time)} - {formatTimeShort(shift.end_time)}
                        </span>
                      </div>
                      {shift.status === "rejected" && shift.reject_reason && (
                        <p className="mt-2 text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">
                          却下理由: {shift.reject_reason}
                        </p>
                      )}
                      <p className="text-xs text-gray-400 mt-2">
                        申請日: {formatDate(shift.created_at)}
                      </p>
                    </div>

                    {isPending && (
                      <div className="flex flex-col gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleApprove(shift.id)}
                          disabled={isActioning}
                          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-700 transition-colors disabled:opacity-40"
                        >
                          承認
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReject(shift.id)}
                          disabled={isActioning}
                          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 transition-colors disabled:opacity-40"
                        >
                          却下
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
