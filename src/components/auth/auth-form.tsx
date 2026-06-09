/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-client";

export function AuthForm() {
  const [supabaseReady, setSupabaseReady] = useState(false);
  const [supabaseError, setSupabaseError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      createClient();
      setSupabaseReady(true);
    } catch (err: unknown) {
      setSupabaseError(err instanceof Error ? err.message : "Supabase sozlanmagan");
    }
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const normalizedEmail = email.trim().toLowerCase();

      if (isRegister) {
        const { data: emailExists, error: emailCheckError } = await supabase.rpc("email_exists", {
          p_email: normalizedEmail,
        });

        if (emailCheckError) throw emailCheckError;
        if (emailExists) {
          throw new Error("Bu email bilan akkaunt allaqachon mavjud. Iltimos, login qiling.");
        }

        const { data, error: signUpError } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
        });

        if (signUpError) throw signUpError;

        if (data.user) {
          const { error: profileError } = await supabase.from("profiles").upsert({
            id: data.user.id,
            username,
            full_name: fullName,
            email: normalizedEmail,
          });
          if (profileError) throw profileError;
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });
        if (signInError) throw signInError;
      }

      window.location.href = "/";
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Xatolik yuz berdi");
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    const supabase = createClient();
    const { error: googleError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });

    if (googleError) setError(googleError.message);
  };

  return (
    <div className="mx-auto w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h1 className="mb-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Telegram Clone</h1>
      <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">{isRegister ? "Yangi akkaunt yarating" : "Akkauntga kiring"}</p>
      {!supabaseReady ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {supabaseError ?? "Supabase yuklanmoqda..."}
        </p>
      ) : (
      <form onSubmit={onSubmit} className="space-y-3">
        {isRegister && (
          <>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} required className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700" placeholder="Ism" />
            <input value={username} onChange={(e) => setUsername(e.target.value)} required className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700" placeholder="Username" />
          </>
        )}
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700" placeholder="Email" />
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700" placeholder="Parol" />

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button disabled={loading} className="w-full rounded-lg bg-sky-600 px-3 py-2 font-medium text-white hover:bg-sky-700 disabled:opacity-60">
          {loading ? "Yuklanmoqda..." : isRegister ? "Ro'yxatdan o'tish" : "Kirish"}
        </button>
      </form>
      )}

      <button disabled={!supabaseReady} onClick={signInWithGoogle} className="mt-3 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-800">
        Google bilan kirish
      </button>

      <button onClick={() => setIsRegister((s) => !s)} className="mt-3 text-sm text-sky-600 hover:underline">
        {isRegister ? "Akkaunt bor, kirish" : "Akkaunt yo'q, ro'yxatdan o'tish"}
      </button>
    </div>
  );
}
