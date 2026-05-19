import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createClient } from "@supabase/supabase-js";

async function getAuthUser(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data: { user } } = await supabase.auth.getUser(token);
  return user;
}

function getTodayRange() {
  const now = new Date();
  const todayStr = now.toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
  const start = new Date(`${todayStr}T00:00:00+09:00`).toISOString();
  const end = new Date(`${todayStr}T23:59:59+09:00`).toISOString();
  return { start, end };
}

function getThisMonthRange() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const monthStr = `${y}-${String(m + 1).padStart(2, "0")}`;
  const lastDay = new Date(y, m + 1, 0).getDate();
  const start = new Date(`${monthStr}-01T00:00:00+09:00`).toISOString();
  const end = new Date(`${monthStr}-${String(lastDay).padStart(2, "0")}T23:59:59+09:00`).toISOString();
  return { start, end };
}

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const today = getTodayRange();
  const month = getThisMonthRange();

  const [
    membersResult,
    todayAttendResult,
    monthAttendResult,
    pendingShiftsResult,
  ] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select("id, name, email"),
    supabaseAdmin
      .from("attendances")
      .select("user_id, clock_in")
      .is("deleted_at", null)
      .gte("clock_in", today.start)
      .lte("clock_in", today.end),
    supabaseAdmin
      .from("attendances")
      .select("user_id, clock_in, clock_out")
      .is("deleted_at", null)
      .gte("clock_in", month.start)
      .lte("clock_in", month.end),
    supabaseAdmin
      .from("shifts")
      .select("id, user_id, date, start_time, end_time, created_at, profiles(name, email)")
      .eq("status", "pending")
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
  ]);

  const allMembers = membersResult.data ?? [];
  const todayAttendances = todayAttendResult.data ?? [];
  const monthAttendances = monthAttendResult.data ?? [];
  const pendingShifts = pendingShiftsResult.data ?? [];

  // 本日の出勤者IDセット
  const todayAttendedIds = new Set(todayAttendances.map((a) => a.user_id));

  // 出勤者・未出勤者
  const attendedMembers = allMembers.filter((m) => todayAttendedIds.has(m.id));
  const absentMembers = allMembers.filter((m) => !todayAttendedIds.has(m.id));

  // メンバー別サマリー
  const memberHoursMap = new Map<string, number>();
  const memberDaysMap = new Map<string, Set<string>>();
  const memberOvertimeMap = new Map<string, number>();

  for (const a of monthAttendances) {
    if (!a.clock_out) continue;
    const hours = (new Date(a.clock_out).getTime() - new Date(a.clock_in).getTime()) / (1000 * 60 * 60);
    const dateKey = new Date(a.clock_in).toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });

    memberHoursMap.set(a.user_id, (memberHoursMap.get(a.user_id) ?? 0) + hours);

    if (!memberDaysMap.has(a.user_id)) {
      memberDaysMap.set(a.user_id, new Set());
    }
    memberDaysMap.get(a.user_id)!.add(dateKey);

    if (hours > 8) {
      memberOvertimeMap.set(a.user_id, (memberOvertimeMap.get(a.user_id) ?? 0) + (hours - 8));
    }
  }

  const memberSummaries = allMembers.map((m) => ({
    id: m.id,
    name: m.name,
    email: m.email,
    attendanceDays: memberDaysMap.get(m.id)?.size ?? 0,
    totalHours: Math.round((memberHoursMap.get(m.id) ?? 0) * 10) / 10,
    overtimeHours: Math.round((memberOvertimeMap.get(m.id) ?? 0) * 10) / 10,
  }));

  const memberCount = allMembers.length;
  const totalTeamHours = [...memberHoursMap.values()].reduce((sum, h) => sum + h, 0);
  const avgHours = memberCount > 0 ? Math.round((totalTeamHours / memberCount) * 10) / 10 : 0;

  return NextResponse.json({
    data: {
      todayAttendedCount: attendedMembers.length,
      attendedMembers,
      absentMembers,
      totalMemberCount: memberCount,
      avgMonthlyHours: avgHours,
      pendingShifts,
      pendingCount: pendingShifts.length,
      memberSummaries,
    },
  });
}
