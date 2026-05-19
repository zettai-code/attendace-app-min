"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface HeaderProps {
  readonly email: string;
}

export function Header({ email }: HeaderProps) {
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-end gap-3 mb-6">
      <span className="text-sm text-gray-500 hidden sm:inline">{email}</span>
      <button
        type="button"
        onClick={handleLogout}
        disabled={loading}
        className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40"
      >
        <LogOut className="h-4 w-4" />
        <span className="hidden sm:inline">ログアウト</span>
      </button>
    </div>
  );
}
