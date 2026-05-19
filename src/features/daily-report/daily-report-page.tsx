"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { FileText, CheckCircle, ArrowUpDown, Pencil, Trash2, X, AlertCircle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";

interface DailyReport {
  readonly id: string;
  readonly date: string;
  readonly body: string;
  readonly created_at: string;
  readonly user_name?: string;
  readonly user_email?: string;
}

interface DailyReportPageProps {
  readonly isAdmin?: boolean;
}

function todayString(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" });
}

export function DailyReportPage({ isAdmin = false }: DailyReportPageProps) {
  const { user } = useAuth();
  const [reports, setReports] = useState<readonly DailyReport[]>([]);
  const [allReports, setAllReports] = useState<readonly DailyReport[]>([]);
  const [createDate, setCreateDate] = useState(todayString);
  const [createBody, setCreateBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"mine" | "all">("mine");
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const activeReports = viewMode === "all" ? allReports : reports;

  const sortedReports = useMemo(() => {
    if (sortAsc) {
      return [...activeReports].sort((a, b) => a.date.localeCompare(b.date));
    }
    return activeReports;
  }, [activeReports, sortAsc]);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  const loadReports = useCallback(async () => {
    if (!user) return;
    setPageLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from("daily_reports")
        .select("id, date, body, created_at")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .order("date", { ascending: false });

      if (fetchError) {
        setError("日報の取得に失敗しました");
        return;
      }
      setReports(data ?? []);
    } catch {
      setError("日報の取得に失敗しました");
    } finally {
      setPageLoading(false);
    }
  }, [user]);

  const loadAllReports = useCallback(async () => {
    if (!user || !isAdmin) return;
    try {
      const { data, error: fetchError } = await supabase
        .from("daily_reports")
        .select("id, date, body, created_at, profiles(name, email)")
        .is("deleted_at", null)
        .order("date", { ascending: false });

      if (fetchError) return;
      const mapped = (data ?? []).map((r: Record<string, unknown>) => {
        const profile = r.profiles as { name?: string; email?: string } | null;
        return {
          id: r.id as string,
          date: r.date as string,
          body: r.body as string,
          created_at: r.created_at as string,
          user_name: profile?.name ?? undefined,
          user_email: profile?.email ?? undefined,
        };
      });
      setAllReports(mapped);
    } catch {
      // admin all reports load failure is non-critical
    }
  }, [user, isAdmin]);

  useEffect(() => {
    loadReports();
    loadAllReports();
  }, [loadReports, loadAllReports]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !createDate || !createBody.trim()) return;

    setLoading(true);
    try {
      const { error } = await supabase.from("daily_reports").insert({
        user_id: user.id,
        date: createDate,
        body: createBody.trim(),
      });

      if (error) {
        console.error("Failed to create report:", error);
        alert(`保存に失敗しました: ${error.message}`);
        return;
      }

      setCreateDate(todayString());
      setCreateBody("");
      showToast("日報を保存しました");
      await Promise.all([loadReports(), loadAllReports()]);
    } catch (err) {
      console.error("Failed to create report:", err);
      alert("保存に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("daily_reports")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);

      if (error) {
        console.error("Failed to delete report:", error);
        alert(`削除に失敗しました: ${error.message}`);
        return;
      }

      setDeleteConfirmId(null);
      showToast("日報を削除しました");
      await Promise.all([loadReports(), loadAllReports()]);
    } catch (err) {
      console.error("Failed to delete report:", err);
      alert("削除に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (report: DailyReport) => {
    setEditingId(report.id);
    setEditBody(report.body);
    setConfirmId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditBody("");
    setConfirmId(null);
  };

  const handleSaveEdit = async (id: string) => {
    if (!editBody.trim()) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from("daily_reports")
        .update({ body: editBody.trim() })
        .eq("id", id);

      if (error) {
        console.error("Failed to update report:", error);
        alert(`更新に失敗しました: ${error.message}`);
        return;
      }

      setEditingId(null);
      setEditBody("");
      setConfirmId(null);
      showToast("日報を更新しました");
      await Promise.all([loadReports(), loadAllReports()]);
    } catch (err) {
      console.error("Failed to update report:", err);
      alert("更新に失敗しました");
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
          onClick={loadReports}
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
        <FileText className="h-6 w-6 text-blue-900" />
        <h1 className="text-2xl font-bold text-gray-900">日報</h1>
      </div>

      {isAdmin && (
        <div className="mx-auto max-w-2xl mb-6 flex gap-2">
          <button
            type="button"
            onClick={() => setViewMode("mine")}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              viewMode === "mine"
                ? "bg-blue-600 text-white"
                : "bg-white border border-gray-300 text-gray-600 hover:bg-gray-50"
            }`}
          >
            自分の日報
          </button>
          <button
            type="button"
            onClick={() => setViewMode("all")}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              viewMode === "all"
                ? "bg-blue-600 text-white"
                : "bg-white border border-gray-300 text-gray-600 hover:bg-gray-50"
            }`}
          >
            全員の日報
          </button>
        </div>
      )}

      <div className="mx-auto max-w-2xl flex flex-col gap-10">
        {/* 作成フォーム */}
        {viewMode === "mine" && (
          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-5">日報を作成</h2>
          <form onSubmit={handleCreate} className="flex flex-col gap-4">
            <div>
              <label
                htmlFor="report-date"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                日付
              </label>
              <input
                id="report-date"
                type="date"
                value={createDate}
                onChange={(e) => setCreateDate(e.target.value)}
                required
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-colors"
              />
            </div>
            <div>
              <label
                htmlFor="report-body"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                本文
              </label>
              <textarea
                id="report-body"
                value={createBody}
                onChange={(e) => setCreateBody(e.target.value)}
                required
                rows={4}
                placeholder="業務内容を入力してください"
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-colors resize-none"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="mt-1 w-full rounded-lg bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-blue-700 active:scale-[0.98] disabled:opacity-40"
            >
              送信
            </button>
          </form>
        </section>
        )}

        {/* 日報一覧 */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">
              {viewMode === "all" ? "全員の日報一覧" : "日報一覧"}
            </h2>
            <button
              type="button"
              onClick={() => setSortAsc((prev) => !prev)}
              className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
              {sortAsc ? "古い順" : "新しい順"}
            </button>
          </div>
          {sortedReports.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">
              データがありません
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {sortedReports.map((report) => (
                <div
                  key={report.id}
                  className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
                >
                  {editingId === report.id ? (
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-gray-900">
                          {report.date}
                        </span>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <textarea
                        value={editBody}
                        onChange={(e) => setEditBody(e.target.value)}
                        rows={4}
                        className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-colors resize-none"
                      />

                      {confirmId === report.id ? (
                        <div className="rounded-lg bg-orange-50 border border-orange-200 p-4 flex flex-col gap-3">
                          <p className="text-sm font-medium text-orange-700">
                            この内容で保存しますか？
                          </p>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleSaveEdit(report.id)}
                              disabled={loading}
                              className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-bold text-white hover:bg-orange-600 transition-colors disabled:opacity-40"
                            >
                              保存する
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmId(null)}
                              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                            >
                              キャンセル
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmId(report.id)}
                          disabled={!editBody.trim()}
                          className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 transition-colors disabled:opacity-40"
                        >
                          保存
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          {viewMode === "all" && report.user_name && (
                            <span className="inline-block rounded-full bg-blue-100 text-blue-700 text-xs font-medium px-2.5 py-0.5 mb-1.5">
                              {report.user_name}
                            </span>
                          )}
                          <span className="font-semibold text-gray-900 block">
                            {report.date}
                          </span>
                          <p className="mt-2 text-sm text-gray-600 whitespace-pre-wrap">
                            {report.body}
                          </p>
                        </div>
                        {viewMode === "mine" && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => { startEdit(report); setDeleteConfirmId(null); }}
                              className="rounded-lg p-2 text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => { setDeleteConfirmId(report.id); setEditingId(null); }}
                              className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </div>

                      {deleteConfirmId === report.id && (
                        <div className="rounded-lg bg-orange-50 border border-orange-200 p-4 flex flex-col gap-3">
                          <p className="text-sm font-medium text-orange-700">
                            この日報を削除しますか？
                          </p>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleDelete(report.id)}
                              disabled={loading}
                              className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-bold text-white hover:bg-orange-600 transition-colors disabled:opacity-40"
                            >
                              削除する
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmId(null)}
                              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                            >
                              キャンセル
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* トースト通知 */}
      {toast && (
        <div className="fixed bottom-6 right-6 flex items-center gap-2 rounded-lg bg-green-600 px-4 py-3 text-sm font-medium text-white shadow-lg animate-in fade-in slide-in-from-bottom-4">
          <CheckCircle className="h-5 w-5 shrink-0" />
          {toast}
        </div>
      )}
    </div>
  );
}
