"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

interface AuthSectionProps {
  readonly user: User | null;
}

export function AuthSection({ user }: AuthSectionProps) {
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);

  const showMessage = (text: string, type: "success" | "error") => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      });
      if (error) {
        showMessage(error.message, "error");
        return;
      }
      setLoginEmail("");
      setLoginPassword("");
      showMessage("ログインしました", "success");
    } catch {
      showMessage("ログインに失敗しました", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        showMessage(error.message, "error");
        return;
      }
      showMessage("ログアウトしました", "success");
    } catch {
      showMessage("ログアウトに失敗しました", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signupEmail || !signupPassword) return;
    if (signupPassword.length < 6) {
      showMessage("パスワードは6文字以上で入力してください", "error");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: signupEmail,
        password: signupPassword,
      });
      if (error) {
        showMessage(error.message, "error");
        return;
      }
      if (data.user) {
        await supabase.from("profiles").upsert({
          id: data.user.id,
          email: signupEmail,
          name: signupEmail.split("@")[0],
          role: "member",
        });
      }
      setSignupEmail("");
      setSignupPassword("");
      showMessage("新規登録が完了しました", "success");
    } catch {
      showMessage("新規登録に失敗しました", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {message && (
        <div
          className={`rounded-lg px-4 py-3 text-sm font-medium text-center ${
            message.type === "success"
              ? "bg-green-50 text-green-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          {message.text}
        </div>
      )}

      {user && (
        <p className="text-sm text-gray-500 text-center">
          ログイン中: <span className="font-medium text-gray-700">{user.email}</span>
        </p>
      )}

      {/* ログイン */}
      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-bold text-gray-900 mb-4">ログイン</h2>
        <form onSubmit={handleLogin} className="flex flex-col gap-3">
          <input
            type="email"
            placeholder="メールアドレス"
            value={loginEmail}
            onChange={(e) => setLoginEmail(e.target.value)}
            required
            disabled={loading || !!user}
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none disabled:opacity-40"
          />
          <input
            type="password"
            placeholder="パスワード（6文字以上）"
            value={loginPassword}
            onChange={(e) => setLoginPassword(e.target.value)}
            required
            minLength={6}
            disabled={loading || !!user}
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none disabled:opacity-40"
          />
          <button
            type="submit"
            disabled={loading || !!user}
            className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-bold text-white hover:bg-blue-700 transition-colors disabled:opacity-40"
          >
            ログイン
          </button>
        </form>
      </section>

      {/* ログアウト */}
      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-bold text-gray-900 mb-4">ログアウト</h2>
        <button
          type="button"
          onClick={handleLogout}
          disabled={loading || !user}
          className="w-full rounded-lg bg-gray-600 py-2.5 text-sm font-bold text-white hover:bg-gray-700 transition-colors disabled:opacity-40"
        >
          ログアウト
        </button>
      </section>

      {/* 新規登録 */}
      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-bold text-gray-900 mb-4">新規登録</h2>
        <form onSubmit={handleSignup} className="flex flex-col gap-3">
          <input
            type="email"
            placeholder="メールアドレス"
            value={signupEmail}
            onChange={(e) => setSignupEmail(e.target.value)}
            required
            disabled={loading || !!user}
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none disabled:opacity-40"
          />
          <input
            type="password"
            placeholder="パスワード（6文字以上）"
            value={signupPassword}
            onChange={(e) => setSignupPassword(e.target.value)}
            required
            minLength={6}
            disabled={loading || !!user}
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none disabled:opacity-40"
          />
          <button
            type="submit"
            disabled={loading || !!user}
            className="w-full rounded-lg bg-green-600 py-2.5 text-sm font-bold text-white hover:bg-green-700 transition-colors disabled:opacity-40"
          >
            新規登録
          </button>
        </form>
      </section>
    </div>
  );
}
